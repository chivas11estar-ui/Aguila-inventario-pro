// ============================================================
// Águila Inventario Pro - Módulo: inventory.js
// Copyright © 2025 José A. G. Betancourt
// VERSIÓN CORREGIDA - SIN EXPORT, USA firebase DIRECTAMENTE
// ============================================================

let inventoryData = [];
let filteredInventory = [];
let currentBrandFilter = 'all';
let userDeterminante = null;
let mostrarProductosSinStock = false;

const BRAND_EXPIRY_CONFIG = {
  'Sabritas': 30,
  'Gamesa': 60,
  'Quaker': 60,
  "Sonric's": 60,
  'Cacahuate': 30,
  'default': 60
};

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('❌ Este navegador no soporta notificaciones');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    console.log('✅ Permisos de notificación ya otorgados');
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Permisos de notificación otorgados');
      if (typeof showToast === 'function') {
        showToast('Notificaciones activadas', 'success');
      }
      return true;
    } else {
      console.log('⚠️ Permisos de notificación denegados');
      if (typeof showToast === 'function') {
        showToast('Permiso de notificaciones denegado', 'warning');
      }
      return false;
    }
  }
  return false;
}

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

// Cargar inventario (SIN EXPORT)
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

// Renderizar lista
function renderInventoryList() {
  const listElement = document.getElementById('inventory-list');
  if (!listElement) return;
  
  if (filteredInventory.length === 0) {
    listElement.innerHTML = '<p style="color:var(--muted);">No hay productos que coincidan con los filtros aplicados.</p>';
    return;
  }
  
  filteredInventory.sort((a, b) => a.nombre.localeCompare(b.nombre));
  
  const html = filteredInventory.map(product => {
    const isLowStock = product.cajas <= 1 && product.cajas > 0;
    const isOutofStock = product.cajas === 0;
    const cardClass = isOutofStock ? 'out-of-stock' : (isLowStock ? 'low-stock' : '');
    
    const expiryDate = new Date(product.fechaCaducidad);
    const timeToExpiry = expiryDate.getTime() - new Date().getTime();
    const daysToExpiry = Math.ceil(timeToExpiry / (1000 * 60 * 60 * 24));
    const alertThreshold = BRAND_EXPIRY_CONFIG[product.marca] || BRAND_EXPIRY_CONFIG['default'];
    
    let expiryTag = '';
    if (daysToExpiry <= 0) {
      expiryTag = '<span style="color:#ef4444;font-weight:700;">VENCIDO</span>';
    } else if (daysToExpiry <= alertThreshold) {
      expiryTag = `<span style="color:#f59e0b;font-weight:700;">VENCE EN ${daysToExpiry} DÍAS</span>`;
    }

    return `
      <div class="card" style="background:var(--bg);${cardClass ? 'border-left: 4px solid ' + (isOutofStock ? '#ef4444' : '#f59e0b') + ';' : ''}" data-product-id="${product.id}" data-cajas="${product.cajas}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h4 style="margin:0 0 8px 0;">${product.nombre}</h4>
            <p style="margin:0;font-size:12px;color:var(--muted);">
              📍 Código: ${product.codigoBarras || 'N/A'}<br>
              🏷️ Marca: ${product.marca}<br>
              📦 ${product.piezasPorCaja} piezas/caja<br>
              📍 ${product.ubicacion}
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:700;color:var(--primary);">${product.cajas}</div>
            <div style="font-size:12px;color:var(--muted);">cajas</div>
            ${expiryTag ? '<div style="margin-top:8px;">' + expiryTag + '</div>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  listElement.innerHTML = html;
  attachInventoryEventListeners();
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

// Adjuntar event listeners
function attachInventoryEventListeners() {
  const searchInput = document.getElementById('inventory-search');
  if (searchInput) {
    searchInput.addEventListener('input', applyFiltersAndRender);
  }

  const filterContainer = document.getElementById('brand-filters');
  if (filterContainer) {
    filterContainer.addEventListener('click', (e) => {
      const brand = e.target.dataset?.brand;
      if (brand) {
        document.querySelectorAll('.brand-filter-btn').forEach(btn => {
          btn.style.background = 'white';
          btn.style.color = 'var(--text)';
        });
        e.target.style.background = 'var(--primary)';
        e.target.style.color = 'white';
        currentBrandFilter = brand;
        applyFiltersAndRender();
      }
    });
  }

  const toggleBtn = document.getElementById('toggle-stock-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      mostrarProductosSinStock = !mostrarProductosSinStock;
      toggleBtn.textContent = mostrarProductosSinStock ? '🙈 Ocultar sin stock' : '👁️ Mostrar sin stock';
      applyFiltersAndRender();
    });
  }
}

// Actualizar estadísticas
function updateDashboardStats(data) {
  console.log('📊 Actualizando estadísticas...');
  // Aquí va la lógica para actualizar stats del dashboard
}

// Eliminar producto
async function deleteProduct(id) {
  try {
    if (!userDeterminante) {
      if (typeof showToast === 'function') {
        showToast('Error: No se encontró la tienda para eliminar.', 'error');
      }
      return;
    }

    await firebase.database().ref('inventario/' + userDeterminante + '/' + id).remove();
    if (typeof showToast === 'function') {
      showToast('Producto eliminado correctamente.', 'success');
    }
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    if (typeof showToast === 'function') {
      showToast('Error al eliminar: ' + error.message, 'error');
    }
  }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('📦 Inicializando módulo de inventario...');
  
  // Intentar cargar inventario cuando el usuario esté autenticado
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, cargando inventario...');
      loadInventory();
    } else {
      console.log('⏳ Esperando autenticación...');
    }
  });
});

console.log('✅ inventory.js cargado correctamente');