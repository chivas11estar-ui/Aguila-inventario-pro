// ============================================================
// Águila Inventario Pro - MÓdulo: inventory.js
// VERSIÓN CORREGIDA - Con preventDefault agregado
// ============================================================

let inventoryData = [];
let filteredInventory = [];
let currentBrandFilter = 'all';
let userDeterminante = null;
let mostrarProductosSinStock = false;
let currentEditingProduct = null;

const BRAND_EXPIRY_CONFIG = {
  'Sabritas': 30,
  'Gamesa': 60,
  'Quaker': 60,
  "Sonric's": 60,
  'Cacahuate': 30,
  'default': 60
};

// Obtener determinante del usuario
async function getUserDeterminante() {
    if (userDeterminante) return userDeterminante;
    
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('Usuario no autenticado para obtener determinante.');
        return null;
    }

    try {
        const userRef = firebase.database().ref('usuarios/' + user.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData && userData.determinante) {
            userDeterminante = userData.determinante;
            console.log('🔑 Determinante de usuario obtenido:', userDeterminante);
            return userDeterminante;
        } else {
            console.error('No se encontró determinante para el usuario:', user.uid);
            return null;
        }
    } catch (error) {
        console.error('Error al obtener el determinante de Firebase:', error);
        return null;
    }
}

// Cargar inventario
async function loadInventory() {
  const listElement = document.getElementById('inventory-list');
  if (!listElement) {
    console.warn('⚠️ Elemento inventory-list no encontrado');
    return;
  }
  
  listElement.innerHTML = '<p style="color:var(--muted);">Conectando con la base de datos...</p>';

  userDeterminante = await getUserDeterminante();

  if (!userDeterminante) {
    listElement.innerHTML = '<p style="color:var(--error);">❌ No se pudo cargar el inventario. Falla al obtener ID de Tienda.</p>';
    if (typeof showToast === 'function') {
      showToast('Error: No se encontró el ID de su tienda (Determinante)', 'error');
    }
    return;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userDeterminante);
  
  inventoryRef.on('value', (snapshot) => {
    try {
      const productsObject = snapshot.val();
      inventoryData = [];
      
      if (productsObject) {
        inventoryData = Object.keys(productsObject).map(key => ({
          id: key,
          ...productsObject[key]
        }));
        
        console.log(`✅ Inventario cargado: ${inventoryData.length} productos.`);
        
        applyFiltersAndRender();
        updateDashboardStats(inventoryData);
        generateBrandFilters(inventoryData);
        
      } else {
        inventoryData = [];
        listElement.innerHTML = '<p style="color:var(--muted);">Aún no hay productos registrados. Use la pestaña "Agregar".</p>';
        updateDashboardStats([]);
        generateBrandFilters([]);
      }
    } catch (error) {
      console.error('Error procesando datos del inventario:', error);
      listElement.innerHTML = '<p style="color:var(--error);">❌ Error al procesar los datos del inventario.</p>';
      if (typeof showToast === 'function') {
        showToast('Error al procesar el inventario: ' + error.message, 'error');
      }
    }
  }, (error) => {
    console.error('❌ Error de conexión a Firebase DB:', error);
    listElement.innerHTML = '<p style="color:var(--error);">❌ No se pudo conectar a Firebase. Verifique su conexión o reinicie la app.</p>';
    if (typeof showToast === 'function') {
      showToast('Fallo en la conexión al servidor: ' + error.message, 'error');
    }
  });
}

// ============================================================
// RENDERIZAR INVENTARIO CON AGRUPACIÓN POR BODEGA
// ============================================================
function renderInventoryList() {
  const listElement = document.getElementById('inventory-list');
  if (!listElement) return;
  
  const productosConStock = filteredInventory.filter(p => p.cajas > 0);
  
  if (productosConStock.length === 0) {
    listElement.innerHTML = '<p style="color:var(--muted);">✅ Sin productos con stock disponible</p>';
    return;
  }
  
  // Agrupar por código de barras
  const productosAgrupados = {};
  
  productosConStock.forEach(prod => {
    const codigo = prod.codigoBarras || prod.id;
    
    if (!productosAgrupados[codigo]) {
      productosAgrupados[codigo] = {
        nombre: prod.nombre,
        marca: prod.marca || 'Otra',
        codigoBarras: prod.codigoBarras,
        piezasPorCaja: prod.piezasPorCaja,
        bodegas: [],
        totalCajas: 0,
        totalPiezas: 0
      };
    }
    
    productosAgrupados[codigo].bodegas.push({
      ubicacion: prod.ubicacion,
      cajas: prod.cajas,
      fechaCaducidad: prod.fechaCaducidad,
      id: prod.id
    });
    
    productosAgrupados[codigo].totalCajas += parseInt(prod.cajas) || 0;
    productosAgrupados[codigo].totalPiezas = 
      productosAgrupados[codigo].totalCajas * (prod.piezasPorCaja || 0);
  });
  
  // Agrupar por marca
  const porMarca = {};
  
  Object.values(productosAgrupados).forEach(product => {
    const marca = product.marca;
    if (!porMarca[marca]) {
      porMarca[marca] = [];
    }
    porMarca[marca].push(product);
  });
  
  // Ordenar marcas
  const marcasOrdenadas = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Otra'].filter(m => porMarca[m]);
  
  // Renderizar
  let html = '';
  
  marcasOrdenadas.forEach(marca => {
    const productos = porMarca[marca].sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    html += `
      <div data-brand-section="${marca}" style="margin-bottom:24px;">
        <div data-brand-header data-brand-name="${marca}" style="background:linear-gradient(135deg,var(--primary),#003a8a);color:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;font-weight:700;font-size:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <span>🏷️ ${marca} (<span data-product-count>${productos.length}</span> productos)</span>
          <span style="font-size:12px;">▼</span>
        </div>
        <div data-products-list style="display:block;transition:all 0.3s;">
    `;
    
    productos.forEach(product => {
      const tieneMuchasBodegas = product.bodegas.length > 1;
      
      // Calcular fecha de caducidad más próxima
      let expiryTag = '';
      let minDaysToExpiry = Infinity;
      
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
      
      const alertThreshold = BRAND_EXPIRY_CONFIG[product.marca] || BRAND_EXPIRY_CONFIG['default'];
      
      if (minDaysToExpiry <= 0) {
        expiryTag = '<span style="color:#ef4444;font-weight:700;font-size:12px;">🔴 VENCIDO</span>';
      } else if (minDaysToExpiry <= alertThreshold) {
        expiryTag = `<span style="color:#f59e0b;font-weight:700;font-size:12px;">🟡 VENCE EN ${minDaysToExpiry} DÍAS</span>`;
      } else if (minDaysToExpiry !== Infinity) {
        expiryTag = `<span style="color:#10b981;font-weight:700;font-size:12px;">✅ ${minDaysToExpiry} días</span>`;
      }

      html += `
        <div data-product-item data-product-name="${product.nombre}" data-product-code="${product.codigoBarras}" class="card" style="background:white;border-left:4px solid var(--primary);margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;">
              <h4 style="margin:0 0 8px 0;color:var(--primary);">${product.nombre}</h4>
              <div style="font-size:13px;color:var(--muted);line-height:1.8;">
                <div>📍 Código: <strong>${product.codigoBarras || 'N/A'}</strong></div>
                <div>📦 ${product.piezasPorCaja} piezas/caja</div>
                ${expiryTag ? `<div>📅 ${expiryTag}</div>` : ''}
              </div>
            </div>
            <div style="text-align:right;min-width:100px;">
              <div style="font-size:32px;font-weight:700;color:var(--success);">${product.totalCajas}</div>
              <div style="font-size:12px;color:var(--muted);">cajas totales</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px;">
                ${product.totalPiezas} piezas
              </div>
            </div>
          </div>
          
          ${tieneMuchasBodegas ? `
            <details class="bodega-details" style="margin-top:12px;border:1px solid #e5e7eb;border-radius:8px;padding:10px;">
              <summary style="cursor:pointer;font-weight:600;color:#2563eb;padding:5px;">
                🏢 Bodegas (${product.bodegas.length})
              </summary>
              <ul class="bodega-list" style="list-style:none;padding:10px 0 0 0;margin:0;">
                ${product.bodegas.map(b => {
                  const bodegaExpiry = b.fechaCaducidad ? new Date(b.fechaCaducidad) : null;
                  const bodegaDays = bodegaExpiry ? Math.ceil((bodegaExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                  
                  return `
                    <li style="padding:8px;margin:5px 0;background:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;">
                      <strong>${b.ubicacion}:</strong> ${b.cajas} cajas
                      ${bodegaDays !== null ? `<br><small style="color:#64748b;font-size:0.85em;">Cad: ${b.fechaCaducidad} (${bodegaDays} días)</small>` : ''}
                      <br><button onclick="editarProducto('${b.id}')" style="margin-top:6px;padding:4px 8px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✏️ Editar</button>
                    </li>
                  `;
                }).join('')}
              </ul>
            </details>
          ` : `
            <div style="margin-top:10px;font-size:13px;color:#6b7280;">
              <strong>🏢 Bodega:</strong> ${product.bodegas[0].ubicacion}
              ${product.bodegas[0].fechaCaducidad ? 
                `<br><strong>📅 Caducidad:</strong> ${product.bodegas[0].fechaCaducidad}` 
                : ''}
            </div>
          `}
          
          <div style="margin-top:12px;">
            <button onclick="editarProducto('${product.bodegas[0].id}')" style="width:100%;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">
              ✏️ Editar Producto
            </button>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  listElement.innerHTML = html;
}

// Aplicar filtros
function applyFiltersAndRender() {
  const searchInput = document.getElementById('inventory-search');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  
  filteredInventory = inventoryData.filter(product => {
    if (!mostrarProductosSinStock && product.cajas === 0) {
      return false;
    }
    
    if (currentBrandFilter !== 'all' && product.marca !== currentBrandFilter) {
      return false;
    }
    
    if (searchTerm.length > 0) {
      return product.nombre.toLowerCase().includes(searchTerm) ||
             product.marca.toLowerCase().includes(searchTerm) ||
             (product.codigoBarras && product.codigoBarras.toLowerCase().includes(searchTerm));
    }
    
    return true;
  });
  
  renderInventoryList();
}

// Generar filtros de marca
function generateBrandFilters(data) {
  const brands = [...new Set(data.map(p => p.marca))];
  const filterContainer = document.getElementById('brand-filters');
  if (!filterContainer) return;
  
  let filterHTML = `<button class="brand-filter-btn ${currentBrandFilter === 'all' ? 'active' : ''}" data-brand="all" style="padding:8px 16px;border:1px solid var(--border);background:${currentBrandFilter === 'all' ? 'var(--primary)' : 'white'};color:${currentBrandFilter === 'all' ? 'white' : 'var(--text)'};border-radius:8px;cursor:pointer;margin:4px;font-size:12px;">Todos</button>`;
  
  brands.forEach(brand => {
    const isActive = currentBrandFilter === brand;
    filterHTML += `<button class="brand-filter-btn" data-brand="${brand}" style="padding:8px 16px;border:1px solid var(--border);background:${isActive ? 'var(--primary)' : 'white'};color:${isActive ? 'white' : 'var(--text)'};border-radius:8px;cursor:pointer;margin:4px;font-size:12px;">${brand}</button>`;
  });
  
  filterContainer.innerHTML = filterHTML;
}

// Actualizar estadísticas
function updateDashboardStats(data) {
  console.log('📊 Actualizando estadísticas...');
}

// ============================================================
// EDITAR PRODUCTO
// ============================================================
async function editarProducto(productId) {
  console.log('✏️ Editando producto:', productId);
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('❌ Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  try {
    const product = inventoryData.find(p => p.id === productId);
    
    if (!product) {
      showToast('❌ Producto no encontrado', 'error');
      return;
    }
    
    currentEditingProduct = product;
    
    // Cambiar a la pestaña "Agregar"
    const addTab = document.getElementById('tab-add');
    const inventoryTab = document.getElementById('tab-inventory');
    
    if (addTab && inventoryTab) {
      inventoryTab.classList.remove('active');
      inventoryTab.classList.add('hidden');
      
      addTab.classList.remove('hidden');
      addTab.classList.add('active');
      
      document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
      document.querySelector('[data-tab="add"]')?.classList.add('active');
    }
    
    // Cambiar título del formulario
    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) {
      formTitle.textContent = '✏️ Editar Producto';
    }
    
    // Rellenar el formulario
    document.getElementById('add-barcode').value = product.codigoBarras || '';
    document.getElementById('add-product-name').value = product.nombre || '';
    document.getElementById('add-brand').value = product.marca || '';
    document.getElementById('add-pieces-per-box').value = product.piezasPorCaja || '';
    document.getElementById('add-warehouse').value = product.ubicacion || '';
    document.getElementById('add-expiry-date').value = product.fechaCaducidad || '';
    document.getElementById('add-boxes').value = product.cajas || '';
    
    // Cambiar botón submit
    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '💾 Actualizar Producto';
      submitBtn.style.background = '#f59e0b';
    }
    
    // Agregar botón cancelar
    let cancelBtn = document.getElementById('cancel-edit-btn');
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancel-edit-btn';
      cancelBtn.type = 'button';
      cancelBtn.textContent = '❌ Cancelar';
      cancelBtn.style.width = '100%';
      cancelBtn.style.marginTop = '10px';
      cancelBtn.className = 'error';
      cancelBtn.onclick = cancelarEdicion;
      submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
    
    showToast('✏️ Editando: ' + product.nombre, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
  } catch (error) {
    console.error('❌ Error al editar producto:', error);
    showToast('❌ Error al cargar el producto: ' + error.message, 'error');
  }
}

// ============================================================
// CANCELAR EDICIÓN
// ============================================================
function cancelarEdicion() {
  currentEditingProduct = null;
  
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
  
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  const addTab = document.getElementById('tab-add');
  const inventoryTab = document.getElementById('tab-inventory');
  
  if (addTab && inventoryTab) {
    addTab.classList.remove('active');
    addTab.classList.add('hidden');
    
    inventoryTab.classList.remove('hidden');
    inventoryTab.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-tab="inventory"]')?.classList.add('active');
  }
  
  showToast('✅ Edición cancelada', 'info');
}

// ============================================================
// AGREGAR O ACTUALIZAR PRODUCTO
// ✅ CORRECCIÓN 4: e.preventDefault() agregado
// ============================================================
async function handleAddProduct(event) {
  // ✅ CRÍTICO: Prevenir recarga de página
  event.preventDefault();
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('❌ Error: No se encontró información de la tienda', 'error');
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
      fechaActualizacion: new Date().toISOString(),
      actualizadoPor: firebase.auth().currentUser?.email || 'sistema'
    };
    
    // Validar datos obligatorios
    if (!formData.nombre || !formData.marca || !formData.fechaCaducidad || formData.piezasPorCaja <= 0) {
      showToast('❌ Completa todos los campos correctamente', 'error');
      return;
    }
    
    // Si estamos editando
    if (currentEditingProduct) {
      console.log('💾 Actualizando producto:', currentEditingProduct.id);
      
      await firebase.database()
        .ref('inventario/' + userDeterminante + '/' + currentEditingProduct.id)
        .update(formData);
      
      showToast('✅ Producto actualizado correctamente', 'success');
      currentEditingProduct = null;
      
    } else {
      // Si estamos agregando uno nuevo
      console.log('💾 Guardando nuevo producto...');
      
      await firebase.database()
        .ref('inventario/' + userDeterminante)
        .push(formData);
      
      showToast('✅ Producto guardado correctamente', 'success');
    }
    
    // Limpiar formulario
    document.getElementById('add-product-form').reset();
    
    // Restaurar interfaz
    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) {
      formTitle.textContent = '➕ Agregar Producto';
    }
    
    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '✅ Guardar Producto';
      submitBtn.style.background = '';
    }
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
      cancelBtn.remove();
    }
    
    // Volver a tab de inventario
    const inventoryTab = document.getElementById('tab-inventory');
    const addTab = document.getElementById('tab-add');
    if (inventoryTab && addTab) {
      inventoryTab.classList.add('active');
      inventoryTab.classList.remove('hidden');
      addTab.classList.remove('active');
      addTab.classList.add('hidden');
      
      const navItems = document.querySelectorAll('[data-tab]');
      navItems.forEach(nav => nav.classList.remove('active'));
      document.querySelector('[data-tab="inventory"]')?.classList.add('active');
    }
    
  } catch (error) {
    console.error('Error al guardar/actualizar producto:', error);
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 Inicializando módulo de inventario...');
  
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', handleAddProduct);
    console.log('✅ Formulario de agregar/editar producto configurado');
  }
  
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, cargando inventario...');
      loadInventory();
    } else {
      console.log('⏳ Esperando autenticación...');
    }
  });
});

// Exponer funciones globalmente
window.editarProducto = editarProducto;
window.cancelarEdicion = cancelarEdicion;

console.log('✅ inventory.js con EDITAR cargado correctamente');