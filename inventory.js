// ============================================================
// Águila Inventario Pro - Módulo: inventory.js
// Fase 2 - INICIALIZACIÓN CORREGIDA
// Copyright © 2025 José A. G. Betancourt
// ============================================================

window.INVENTORY_STATE = {
  productos: [],
  productosFiltrados: [],
  marcasExpandidas: {},
  searchTerm: '',
  determinante: null,
  isLoading: false,
        isRenderingInventory: false
};

const BRAND_EXPIRY_CONFIG = {
  'Sabritas': 30,
  'Gamesa': 60,
  'Quaker': 60,
  "Sonric's": 60,
  'Cacahuates': 30,
  'default': 60
};

// ============================================================
// OBTENER DETERMINANTE DEL USUARIO
// ============================================================
async function getUserDeterminante() {
  if (window.INVENTORY_STATE.determinante) {
    return window.INVENTORY_STATE.determinante;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    console.error('Usuario no autenticado');
    return null;
  }

  try {
    const snapshot = await firebase.database()
      .ref('usuarios/' + user.uid)
      .once('value');

    const userData = snapshot.val();
    if (userData && userData.determinante) {
      window.INVENTORY_STATE.determinante = userData.determinante;
      console.log('🔑 Determinante obtenido:', userData.determinante);
      return userData.determinante;
    }

    console.error('No se encontró determinante para el usuario');
    return null;
  } catch (error) {
    console.error('Error al obtener determinante:', error);
    return null;
  }
}

// ============================================================
// CARGAR INVENTARIO DESDE FIREBASE (V2 - DELEGA A inventory-core.js)
// ============================================================
// NOTA V2: Esta función ahora delega a cargarInventario() de
// inventory-core.js, que lee de productos/{det}/{codigo} (nueva ruta).
// Se mantiene el nombre loadInventory() porque app.js y otras partes
// la llaman por ese nombre.
async function loadInventory() {
  console.log('📦 [V2] loadInventory → delegando a cargarInventario()...');

  // REVISIÓN: Check para evitar doble render
      if (window.INVENTORY_STATE.isRenderingInventory) {
              console.warn('⚠️ Ya se está renderizando, abortando...');
              return null;
      }
      if (typeof window.cargarInventario === 'function') {
    window.INVENTORY_STATE.isRenderingInventory = true;
            return window.cargarInventario();
  }

  // Fallback: si inventory-core.js aún no cargó, intentar la ruta antigua
  console.warn('⚠️ cargarInventario() no disponible, usando ruta legacy...');
  window.INVENTORY_STATE.isLoading = true;

  const determinante = await getUserDeterminante();
  if (!determinante) {
    console.error('❌ No se pudo cargar el inventario sin determinante');
    if (typeof showToast === 'function') {
      showToast('Error: No se encontró ID de la tienda', 'error');
    }
    window.INVENTORY_STATE.isLoading = false;
    return;
  }

  const inventoryRef = firebase.database().ref('inventario/' + determinante);

  inventoryRef.on('value', (snapshot) => {
    try {
      const productsObject = snapshot.val();

      if (productsObject) {
        window.INVENTORY_STATE.productos = Object.keys(productsObject).map(key => {
          const product = productsObject[key];
          try {
            if (typeof window.decryptData === 'function') {
              product.nombre = window.decryptData(product.nombre) || product.nombre;
              product.marca = window.decryptData(product.marca) || product.marca;
              product.ubicacion = window.decryptData(product.ubicacion) || product.ubicacion;
            }
          } catch (e) {
            console.warn('⚠️ Producto con formato antiguo o error de llave:', key);
          }
          return { id: key, ...product };
        });

        console.log(`✅ Inventario cargado y desencriptado: ${window.INVENTORY_STATE.productos.length} productos`);
        loadBrandStates();
        applyFiltersAndRender();
      } else {
        window.INVENTORY_STATE.productos = [];
        console.log('⚠️ Inventario vacío');
        if (typeof window.renderInventoryUI === 'function') {
          window.renderInventoryUI([]);
        }
      }
      window.INVENTORY_STATE.isLoading = false;
    } catch (error) {
      console.error('❌ Error procesando inventario:', error);
      window.INVENTORY_STATE.isLoading = false;
    }
  });
}

// ============================================================
// AGRUPAR PRODUCTOS POR CÓDIGO DE BARRAS
// ============================================================
function groupProductsByBarcode(productos) {
  const agrupados = {};

  productos.forEach(prod => {
    const codigo = prod.codigoBarras || prod.id;
    // V2: soportar tanto 'stockTotal' (nueva estructura) como 'cajas' (legacy)
    const cajasProducto = parseFloat(prod.stockTotal) || parseFloat(prod.cajas) || 0;

    if (!agrupados[codigo]) {
      agrupados[codigo] = {
        nombre: prod.nombre,
        marca: prod.marca || 'Otra',
        codigoBarras: prod.codigoBarras,
        piezasPorCaja: prod.piezasPorCaja,
        bodegas: [],
        totalCajas: 0,
        totalPiezas: 0
      };
    }

    agrupados[codigo].bodegas.push({
      ubicacion: prod.ubicacion,
      cajas: cajasProducto,
      fechaCaducidad: prod.fechaCaducidad,
      id: prod.id
    });

    agrupados[codigo].totalCajas += cajasProducto;
    agrupados[codigo].totalPiezas =
      agrupados[codigo].totalCajas * (prod.piezasPorCaja || 0);
  });

  return Object.values(agrupados);
}

// ============================================================
// AGRUPAR PRODUCTOS POR MARCA
// ============================================================
function groupProductsByBrand(productos) {
  const porMarca = {};

  productos.forEach(product => {
    const marca = product.marca || 'Otra';
    if (!porMarca[marca]) {
      porMarca[marca] = [];
    }
    porMarca[marca].push(product);
  });

  Object.keys(porMarca).forEach(marca => {
    porMarca[marca].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  return porMarca;
}

// ============================================================
// CALCULAR TOTALES POR MARCA
// ============================================================
function calculateBrandTotals(productos) {
  const totalCajas = productos.reduce((sum, p) => sum + p.totalCajas, 0);
  const totalProductos = productos.length;

  return { totalCajas, totalProductos };
}

// ============================================================
// CALCULAR DÍAS HASTA CADUCIDAD
// ============================================================
function calculateExpiryInfo(product, brandConfig) {
  let minDaysToExpiry = Infinity;
  let expiryTag = '';

  product.bodegas.forEach(bodega => {
    if (bodega.fechaCaducidad) {
      const expiryDate = new Date(bodega.fechaCaducidad);
      const timeToExpiry = expiryDate.getTime() - new Date().getTime();
      const daysToExpiry = Math.ceil(timeToExpiry / (1000 * 60 * 60 * 24));

      if (daysToExpiry < minDaysToExpiry) {
        minDaysToExpiry = daysToExpiry;
      }
    }
  });

  const alertThreshold = brandConfig[product.marca] || brandConfig['default'];

  if (minDaysToExpiry <= 0) {
    expiryTag = {
      text: '🔴 VENCIDO',
      color: '#ef4444',
      days: minDaysToExpiry
    };
  } else if (minDaysToExpiry <= alertThreshold) {
    expiryTag = {
      text: `🟡 VENCE EN ${minDaysToExpiry} DÍAS`,
      color: '#f59e0b',
      days: minDaysToExpiry
    };
  } else if (minDaysToExpiry !== Infinity) {
    expiryTag = {
      text: `✅ ${minDaysToExpiry} días`,
      color: '#10b981',
      days: minDaysToExpiry
    };
  }

  return expiryTag;
}

// ============================================================
// APLICAR FILTROS Y RENDERIZAR
// ============================================================
function applyFiltersAndRender() {
  try {
    const searchTerm = window.INVENTORY_STATE.searchTerm.toLowerCase();

    if (searchTerm.length > 0) {
      window.INVENTORY_STATE.productosFiltrados = window.INVENTORY_STATE.productos.filter(p => {
        const nameMatch = p.nombre && p.nombre.toLowerCase().includes(searchTerm);
        const brandMatch = p.marca && p.marca.toLowerCase().includes(searchTerm);
        const fullBarcodeMatch = p.codigoBarras && p.codigoBarras.toLowerCase().includes(searchTerm);

        // NUEVO: Coincidencia por los últimos 4 dígitos (si el término tiene 4 o más caracteres y es numérico)
        let suffixMatch = false;
        if (searchTerm.length >= 4 && /^\d+$/.test(searchTerm)) {
            suffixMatch = p.codigoBarras && p.codigoBarras.endsWith(searchTerm);
        }

        return nameMatch || brandMatch || fullBarcodeMatch || suffixMatch;
      });
    } else {
      window.INVENTORY_STATE.productosFiltrados = [...window.INVENTORY_STATE.productos];
    }

  // V2.1: Separar productos con stock de los agotados
  // ✅ FIX v9.1b: Tolerancia a datos LEGACY (v2, v1, datos anteriores)
  const productsWithStock = window.INVENTORY_STATE.productosFiltrados.filter(p => {
    // Soportar múltiples estructuras de datos:
    // V3: totalCajas, totalPiezas
    // V2: cajas, piezas, stockTotal
    // Legacy: stockTotal, cajas
    const cajas = parseInt(p.totalCajas || p.cajas) || 0;
    const piezas = parseInt(p.totalPiezas || p.piezas || p.piezasSueltas) || 0;
    const stockAntiguo = parseInt(p.stockTotal) || 0;

    return cajas > 0 || piezas > 0 || stockAntiguo > 0;
  });

  const productsOutOfStock = window.INVENTORY_STATE.productosFiltrados.filter(p => {
    const cajas = parseInt(p.totalCajas || p.cajas) || 0;
    const piezas = parseInt(p.totalPiezas || p.piezas || p.piezasSueltas) || 0;
    const stockAntiguo = parseInt(p.stockTotal) || 0;

    return cajas <= 0 && piezas <= 0 && stockAntiguo <= 0;
  });

    console.log(`📊 Stock: ${productsWithStock.length} | Agotados: ${productsOutOfStock.length}`);

    if (typeof window.renderInventoryUI === 'function') {
      // Renderizar en el contenedor de Stock
      window.renderInventoryUI(productsWithStock, 'inventory-list');
      // Renderizar en el contenedor de Agotados
      window.renderInventoryUI(productsOutOfStock, 'out-of-stock-list');
    } else {
      console.warn('⚠️ renderInventoryUI no está disponible');
    }
  } catch (error) {
    console.error('❌ [FILTER ERROR]:', error);
    if (typeof showToast === 'function') {
      showToast('⚠️ Error al procesar inventario. Reintenta.', 'error');
    }
  }
}

// ============================================================
// ESTABLECER TÉRMINO DE BÚSQUEDA (CON DEBOUNCE)
// ============================================================
let searchDebounceTimeout = null;

function setSearchTerm(term) {
  window.INVENTORY_STATE.searchTerm = term;
  
  if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
  
  searchDebounceTimeout = setTimeout(() => {
      console.log('🔍 Filtrando por:', term);
      applyFiltersAndRender();
  }, 300); // Esperar 300ms antes de procesar
}

// ============================================================
// TOGGLE ESTADO DE MARCA
// ============================================================
function toggleBrandState(brandName) {
  // Si no existe, inicializar como true (expandido) antes de toglear
  if (window.INVENTORY_STATE.marcasExpandidas[brandName] === undefined) {
    window.INVENTORY_STATE.marcasExpandidas[brandName] = true;
  }
  
  const currentState = window.INVENTORY_STATE.marcasExpandidas[brandName];
  window.INVENTORY_STATE.marcasExpandidas[brandName] = !currentState;

  console.log(`📁 Marca "${brandName}" ${!currentState ? 'expandida' : 'contraída'}`);

  saveBrandStates();

  return window.INVENTORY_STATE.marcasExpandidas[brandName];
}

// ============================================================
// GUARDAR ESTADO DE MARCAS
// ============================================================
function saveBrandStates() {
  try {
    localStorage.setItem(
      'aguila_marcas_expandidas',
      JSON.stringify(window.INVENTORY_STATE.marcasExpandidas)
    );
    console.log('💾 Estado de marcas guardado');
  } catch (error) {
    console.warn('⚠️ No se pudo guardar estado de marcas:', error);
  }
}

// ============================================================
// CARGAR ESTADO DE MARCAS
// ============================================================
function loadBrandStates() {
  try {
    const saved = localStorage.getItem('aguila_marcas_expandidas');
    if (saved) {
      window.INVENTORY_STATE.marcasExpandidas = JSON.parse(saved);
      console.log('📂 Estado de marcas cargado:', window.INVENTORY_STATE.marcasExpandidas);
    } else {
      const marcas = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Cacahuates', 'Otra'];
      marcas.forEach(marca => {
        window.INVENTORY_STATE.marcasExpandidas[marca] = true;
      });
      console.log('✅ Estado de marcas inicializado (todas expandidas)');
    }
  } catch (error) {
    console.warn('⚠️ Error al cargar estado de marcas:', error);
  }
}

// ============================================================
// EDITAR PRODUCTO
// ============================================================
async function editarProducto(productId) {
  console.log('✏️ Editando producto:', productId);

  const product = window.INVENTORY_STATE.productos.find(p => p.id === productId);

  if (!product) {
    if (typeof showToast === 'function') {
      showToast('❌ Producto no encontrado', 'error');
    }
    return;
  }

  if (typeof window.switchTab === 'function') {
    window.switchTab('add');
  }

  setTimeout(() => {
    document.getElementById('add-barcode').value = product.codigoBarras || '';
    document.getElementById('add-product-name').value = product.nombre || '';
    document.getElementById('add-brand').value = product.marca || '';
    document.getElementById('add-pieces-per-box').value = product.piezasPorCaja || '';
    document.getElementById('add-warehouse').value = product.ubicacion || '';
    document.getElementById('add-expiry-date').value = product.fechaCaducidad || '';
    // V2: soportar stockTotal (nuevo) y cajas (legacy)
    document.getElementById('add-boxes').value = product.stockTotal || product.cajas || '';

    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) {
      formTitle.textContent = '✏️ Editar Producto';
    }

    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '💾 Actualizar Producto';
      submitBtn.style.background = '#f59e0b';
    }

    window.EDITING_PRODUCT_ID = productId;

    if (typeof showToast === 'function') {
      showToast('✏️ Editando: ' + product.nombre, 'info');
    }
  }, 100);
}

// ============================================================
// AGREGAR O ACTUALIZAR PRODUCTO (LEGACY - DESACTIVADO EN V2)
// ============================================================
// NOTA V2: Esta función ya NO se usa directamente.
// La lógica de escritura fue reemplazada por handleAddProductV2()
// en inventory-core.js que usa productos/{det}/{codigoBarras}
// en vez de push(). Se mantiene como fallback/referencia.
async function handleAddProduct(event) {
  if (event) event.preventDefault();
  console.warn('⚠️ [LEGACY] handleAddProduct llamado. Redirigiendo a inventory-core V2...');
  if (typeof window.handleAddProductV2 === 'function') {
    return window.handleAddProductV2(event);
  }
  console.error('❌ handleAddProductV2 no disponible. ¿Se cargó inventory-core.js?');
}

// ============================================================
// INICIALIZACIÓN (CRÍTICO - CORREGIDO)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 Inicializando módulo de inventario (lógica)...');

  // NOTA V2: El formulario de agregar/editar ahora es manejado
  // por inventory-core.js (handleAddProductV2). No registrar listener aquí.
  // Se mantiene handleAddProduct como fallback que redirige a V2.
  console.log('📋 Formulario será configurado por inventory-core.js');

  // NOTA [ARCHITECT]: Desactivado para evitar condición de carrera. 
  // La carga ahora es gestionada secuencialmente por auth.js
  /*
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, cargando inventario...');

      // Cargar inmediatamente
      setTimeout(() => {
        loadInventory();
      }, 500);
    } else {
      console.log('⏳ Esperando autenticación...');
    }
  });
  */
});


// 🔧 FUNCIÓN: Recalcular contador de productos agotados (FIX v3.0)
function recalculateOutOfStock() {
    const productsWithStock = window.INVENTORY_STATE.productos.filter(p => {
          const cajas = parseFloat(p.cajas) || 0;
          const piezas = parseFloat(p.piezas) || 0;
          return cajas > 0 || piezas > 0;
    });
    const productsOutOfStock = window.INVENTORY_STATE.productos.filter(p => {
          const cajas = parseFloat(p.cajas) || 0;
          const piezas = parseFloat(p.piezas) || 0;
          return cajas <= 0 && piezas <= 0;
    });
    console.log('\ud83d� Stock: ' + productsWithStock.length + ' | Agotados: ' + productsOutOfStock.length);
}
// ============================================================
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.loadInventory = loadInventory;
window.setSearchTerm = setSearchTerm;
window.toggleBrandState = toggleBrandState;
window.editarProducto = editarProducto;
window.handleAddProduct = handleAddProduct;
window.applyFiltersAndRender = applyFiltersAndRender;
window.groupProductsByBarcode = groupProductsByBarcode;
window.groupProductsByBrand = groupProductsByBrand;
window.calculateBrandTotals = calculateBrandTotals;
window.calculateExpiryInfo = calculateExpiryInfo;
window.BRAND_EXPIRY_CONFIG = BRAND_EXPIRY_CONFIG;

console.log('✅ inventory.js (Inicialización corregida) cargado correctamente');
