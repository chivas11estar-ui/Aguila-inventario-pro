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
  isLoading: false
};

const BRAND_EXPIRY_CONFIG = {
  'Sabritas': 30,
  'Gamesa': 60,
  'Quaker': 60,
  "Sonric's": 60,
  'Cacahuate': 30,
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
// CARGAR INVENTARIO DESDE FIREBASE
// ============================================================
async function loadInventory() {
  console.log('📦 Cargando inventario desde Firebase...');

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
        window.INVENTORY_STATE.productos = Object.keys(productsObject).map(key => ({
          id: key,
          ...productsObject[key]
        }));

        console.log(`✅ Inventario cargado: ${window.INVENTORY_STATE.productos.length} productos`);

        applyFiltersAndRender();
        loadBrandStates();

      } else {
        window.INVENTORY_STATE.productos = [];
        console.log('⚠️ Inventario vacío');

        // Renderizar mensaje de vacío
        if (typeof window.renderInventoryUI === 'function') {
          window.renderInventoryUI([]);
        }
      }

      window.INVENTORY_STATE.isLoading = false;

    } catch (error) {
      console.error('❌ Error procesando inventario:', error);
      window.INVENTORY_STATE.isLoading = false;
      if (typeof showToast === 'function') {
        showToast('Error al procesar inventario', 'error');
      }
    }
  }, (error) => {
    console.error('❌ Error de conexión Firebase:', error);
    window.INVENTORY_STATE.isLoading = false;
    if (typeof showToast === 'function') {
      showToast('Error de conexión: ' + error.message, 'error');
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
      cajas: parseInt(prod.cajas) || 0,
      fechaCaducidad: prod.fechaCaducidad,
      id: prod.id
    });

    agrupados[codigo].totalCajas += parseInt(prod.cajas) || 0;
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
  const searchTerm = window.INVENTORY_STATE.searchTerm.toLowerCase();

  if (searchTerm.length > 0) {
    window.INVENTORY_STATE.productosFiltrados = window.INVENTORY_STATE.productos.filter(p => {
      return (
        (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) ||
        (p.marca && p.marca.toLowerCase().includes(searchTerm)) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(searchTerm))
      );
    });
  } else {
    window.INVENTORY_STATE.productosFiltrados = [...window.INVENTORY_STATE.productos];
  }

  const productsWithStock = window.INVENTORY_STATE.productosFiltrados.filter(p =>
    (parseInt(p.cajas) || 0) > 0
  );

  console.log('📊 Productos con stock:', productsWithStock.length);

  if (typeof window.renderInventoryUI === 'function') {
    window.renderInventoryUI(productsWithStock);
  } else {
    console.warn('⚠️ renderInventoryUI no está disponible');
  }
}

// ============================================================
// ESTABLECER TÉRMINO DE BÚSQUEDA
// ============================================================
function setSearchTerm(term) {
  window.INVENTORY_STATE.searchTerm = term;
  applyFiltersAndRender();
}

// ============================================================
// TOGGLE ESTADO DE MARCA
// ============================================================
function toggleBrandState(brandName) {
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
      const marcas = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Otra'];
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
    document.getElementById('add-boxes').value = product.cajas || '';

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
// AGREGAR O ACTUALIZAR PRODUCTO
// ============================================================
async function handleAddProduct(event) {
  if (event) event.preventDefault();

  const determinante = window.INVENTORY_STATE.determinante;
  if (!determinante) {
    if (typeof showToast === 'function') {
      showToast('❌ Error: No se encontró información de la tienda', 'error');
    }
    return;
  }

  try {
    const formData = {
      codigoBarras: document.getElementById('add-barcode')?.value.trim() || '',
      nombre: document.getElementById('add-product-name')?.value.trim() || '',
      marca: document.getElementById('add-brand')?.value || '',
      piezasPorCaja: parseInt(document.getElementById('add-pieces-per-box')?.value || 0),
      ubicacion: document.getElementById('add-warehouse')?.value.trim() || '',
      fechaCaducidad: document.getElementById('add-expiry-date')?.value || '',
      cajas: parseInt(document.getElementById('add-boxes')?.value || 0),
      fechaActualizacion: getLocalISOString(),
      actualizadoPor: firebase.auth().currentUser?.email || 'sistema'
    };

    if (!formData.nombre || !formData.marca || !formData.fechaCaducidad || formData.piezasPorCaja <= 0) {
      if (typeof showToast === 'function') {
        showToast('❌ Completa todos los campos correctamente', 'error');
      }
      return;
    }

    if (window.EDITING_PRODUCT_ID) {
      await firebase.database()
        .ref('inventario/' + determinante + '/' + window.EDITING_PRODUCT_ID)
        .update(formData);

      if (typeof showToast === 'function') {
        showToast('✅ Producto actualizado correctamente', 'success');
      }

      window.EDITING_PRODUCT_ID = null;
    } else {
      await firebase.database()
        .ref('inventario/' + determinante)
        .push(formData);

      if (typeof showToast === 'function') {
        showToast('✅ Producto guardado correctamente', 'success');
      }
    }

    document.getElementById('add-product-form').reset();

    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) {
      formTitle.textContent = '➕ Agregar Producto';
    }

    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '✅ Guardar Producto';
      submitBtn.style.background = '';
    }

    if (typeof window.switchTab === 'function') {
      window.switchTab('inventory');
    }

  } catch (error) {
    console.error('Error al guardar/actualizar producto:', error);
    if (typeof showToast === 'function') {
      showToast('❌ Error: ' + error.message, 'error');
    }
  }
}

// ============================================================
// INICIALIZACIÓN (CRÍTICO - CORREGIDO)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 Inicializando módulo de inventario (lógica)...');

  // Configurar formulario de agregar/editar
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', handleAddProduct);
    console.log('✅ Formulario configurado');
  }

  // CRÍTICO: Cargar inventario cuando el usuario esté autenticado
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
});

// ============================================================
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.loadInventory = loadInventory;
window.setSearchTerm = setSearchTerm;
window.toggleBrandState = toggleBrandState;
window.editarProducto = editarProducto;
window.handleAddProduct = handleAddProduct;
window.groupProductsByBarcode = groupProductsByBarcode;
window.groupProductsByBrand = groupProductsByBrand;
window.calculateBrandTotals = calculateBrandTotals;
window.calculateExpiryInfo = calculateExpiryInfo;
window.BRAND_EXPIRY_CONFIG = BRAND_EXPIRY_CONFIG;

console.log('✅ inventory.js (Inicialización corregida) cargado correctamente');