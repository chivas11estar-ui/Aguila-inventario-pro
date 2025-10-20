// ============================================================
// Águila Inventario Pro - Módulo: inventory
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema Águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación
// sin autorización expresa del autor.
// ============================================================

// ============================================================
// Águila Inventario Pro - Módulo: inventory.js (Multi-Usuario)
// ============================================================

let inventoryData = [];
let filteredInventory = [];
let currentBrandFilter = 'all';
let userDeterminante = null;

// ============================================================
// OBTENER DETERMINANTE DEL USUARIO
// ============================================================
async function getUserDeterminante() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;
  
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('❌ Error al obtener determinante:', error);
    return null;
  }
}

// ============================================================
// CARGAR INVENTARIO
// ============================================================
async function loadInventory() {
  console.log('📦 Cargando inventario...');
  
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error('❌ No hay usuario autenticado');
    return;
  }
  
  // Obtener determinante del usuario
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    console.error('❌ No se pudo obtener el determinante');
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  console.log('🏪 Cargando inventario de tienda:', userDeterminante);
  
  // Cargar inventario por determinante (compartido)
  const inventoryRef = firebase.database().ref('inventario/' + userDeterminante);
  
  inventoryRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      inventoryData = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      
      console.log('✅ Inventario cargado:', inventoryData.length, 'productos');
      
      updateDashboardStats();
      filteredInventory = [...inventoryData];
      displayInventory(filteredInventory);
      updateBrandFilters();
      
    } else {
      console.log('📭 No hay productos en el inventario');
      inventoryData = [];
      filteredInventory = [];
      displayEmptyInventory();
    }
  }, (error) => {
    console.error('❌ Error al cargar inventario:', error);
    showToast('Error al cargar inventario: ' + error.message, 'error');
  });
}

// ============================================================
// ACTUALIZAR ESTADÍSTICAS DEL DASHBOARD
// ============================================================
function updateDashboardStats() {
  const totalProducts = inventoryData.length;
  document.getElementById('total-products').textContent = totalProducts;
  
  const totalBoxes = inventoryData.reduce((sum, item) => sum + (item.cajas || 0), 0);
  document.getElementById('total-inventory-value').textContent = totalBoxes;
  
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const expiringSoon = inventoryData.filter(item => {
    if (!item.fechaCaducidad) return false;
    const expiryDate = new Date(item.fechaCaducidad);
    return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
  }).length;
  
  document.getElementById('expiry-alert').textContent = expiringSoon;
  
  console.log('📊 Estadísticas actualizadas');
}

// ============================================================
// FILTROS DE MARCA
// ============================================================
function updateBrandFilters() {
  const brands = [...new Set(inventoryData.map(item => item.marca))].sort();
  
  const filterContainer = document.getElementById('brand-filters');
  if (!filterContainer) return;
  
  filterContainer.innerHTML = `
    <button class="brand-filter-btn active" data-brand="all" onclick="filterByBrand('all')">
      Todas (${inventoryData.length})
    </button>
    ${brands.map(brand => {
      const count = inventoryData.filter(item => item.marca === brand).length;
      return `
        <button class="brand-filter-btn" data-brand="${brand}" onclick="filterByBrand('${brand}')">
          ${brand} (${count})
        </button>
      `;
    }).join('')}
  `;
}

function filterByBrand(brand) {
  console.log('🏷️ Filtrando por marca:', brand);
  currentBrandFilter = brand;
  
  document.querySelectorAll('.brand-filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-brand') === brand) {
      btn.classList.add('active');
    }
  });
  
  if (brand === 'all') {
    filteredInventory = [...inventoryData];
  } else {
    filteredInventory = inventoryData.filter(item => item.marca === brand);
  }
  
  const searchInput = document.getElementById('inventory-search');
  if (searchInput && searchInput.value.trim()) {
    applySearch(searchInput.value.trim());
  } else {
    displayInventory(filteredInventory);
  }
}

// ============================================================
// BÚSQUEDA DE PRODUCTOS
// ============================================================
function setupInventorySearch() {
  const searchInput = document.getElementById('inventory-search');
  const scanBtn = document.getElementById('inventory-scan-btn');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      applySearch(query);
    });
  }
  
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      openScanner((code) => {
        searchInput.value = code;
        applySearch(code);
      });
    });
  }
}

function applySearch(query) {
  console.log('🔍 Buscando:', query);
  
  if (!query) {
    if (currentBrandFilter === 'all') {
      filteredInventory = [...inventoryData];
    } else {
      filteredInventory = inventoryData.filter(item => item.marca === currentBrandFilter);
    }
    displayInventory(filteredInventory);
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  
  let baseData = currentBrandFilter === 'all' 
    ? inventoryData 
    : inventoryData.filter(item => item.marca === currentBrandFilter);
  
  filteredInventory = baseData.filter(item => {
    return (
      item.nombre?.toLowerCase().includes(lowerQuery) ||
      item.marca?.toLowerCase().includes(lowerQuery) ||
      item.codigoBarras?.includes(query) ||
      item.ubicacion?.toLowerCase().includes(lowerQuery)
    );
  });
  
  displayInventory(filteredInventory);
  
  if (filteredInventory.length === 0) {
    showToast('No se encontraron productos', 'warning');
  }
}

// ============================================================
// MOSTRAR INVENTARIO (igual que antes)
// ============================================================
function displayInventory(items) {
  const container = document.getElementById('inventory-list');
  
  if (!container) {
    console.error('❌ Contenedor de inventario no encontrado');
    return;
  }
  
  if (items.length === 0) {
    displayEmptyInventory();
    return;
  }
  
  if (currentBrandFilter === 'all') {
    displayInventoryGrouped(items);
  } else {
    displayInventoryFlat(items);
  }
}

function displayInventoryGrouped(items) {
  const container = document.getElementById('inventory-list');
  
  const grouped = items.reduce((acc, item) => {
    const brand = item.marca || 'Sin Marca';
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(item);
    return acc;
  }, {});
  
  const brands = Object.keys(grouped).sort();
  
  container.innerHTML = brands.map(brand => `
    <div class="brand-section">
      <div class="brand-section-header" onclick="toggleBrandSection('${brand}')">
        <h4>${brand}</h4>
        <span class="brand-count">${grouped[brand].length} productos | ${grouped[brand].reduce((sum, item) => sum + (item.cajas || 0), 0)} cajas</span>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="brand-section-content" id="section-${brand}">
        ${grouped[brand].map(item => renderInventoryItem(item)).join('')}
      </div>
    </div>
  `).join('');
}

function displayInventoryFlat(items) {
  const container = document.getElementById('inventory-list');
  container.innerHTML = items.map(item => renderInventoryItem(item)).join('');
}

function renderInventoryItem(item) {
  const expiryDate = item.fechaCaducidad ? new Date(item.fechaCaducidad) : null;
  const today = new Date();
  const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
  
  let expiryClass = '';
  let expiryText = 'Sin fecha';
  
  if (expiryDate) {
    if (daysUntilExpiry < 0) {
      expiryClass = 'expired';
      expiryText = `Caducado hace ${Math.abs(daysUntilExpiry)} días`;
    } else if (daysUntilExpiry <= 7) {
      expiryClass = 'expiring-soon';
      expiryText = `${daysUntilExpiry} días restantes`;
    } else if (daysUntilExpiry <= 30) {
      expiryClass = 'expiring-warning';
      expiryText = `${daysUntilExpiry} días restantes`;
    } else {
      expiryText = expiryDate.toLocaleDateString('es-MX');
    }
  }
  
  const stockClass = (item.cajas || 0) === 0 ? 'out-of-stock' : (item.cajas || 0) < 5 ? 'low-stock' : '';
  
  return `
    <div class="inventory-item ${stockClass}" data-id="${item.id}">
      <div class="item-header">
        <h4>${item.nombre}</h4>
        <span class="item-brand">${item.marca || 'N/A'}</span>
      </div>
      <div class="item-details">
        <div class="detail-row">
          <span class="detail-label">📦 Stock:</span>
          <span class="detail-value stock-value">${item.cajas || 0} cajas</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📊 Piezas/Caja:</span>
          <span class="detail-value">${item.piezasPorCaja || 0}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📍 Ubicación:</span>
          <span class="detail-value">${item.ubicacion || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📅 Caducidad:</span>
          <span class="detail-value expiry-${expiryClass}">${expiryText}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">🔢 Código:</span>
          <span class="detail-value code-value">${item.codigoBarras || 'N/A'}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn edit-btn" onclick="editProduct('${item.id}')" title="Editar">
          ✏️
        </button>
        <button class="action-btn delete-btn" onclick="deleteProduct('${item.id}', '${item.nombre}')" title="Eliminar">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function displayEmptyInventory() {
  const container = document.getElementById('inventory-list');
  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
      <div style="font-size: 4em; margin-bottom: 16px;">📦</div>
      <h3>No hay productos en el inventario</h3>
      <p>Comienza agregando productos desde la pestaña "Agregar"</p>
    </div>
  `;
}

// ============================================================
// TOGGLE SECCIONES DE MARCA
// ============================================================
function toggleBrandSection(brand) {
  const content = document.getElementById('section-' + brand);
  const header = content?.previousElementSibling;
  
  if (content && header) {
    const icon = header.querySelector('.toggle-icon');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.textContent = '▼';
    } else {
      content.style.display = 'none';
      icon.textContent = '▶';
    }
  }
}

// ============================================================
// EDITAR PRODUCTO
// ============================================================
function editProduct(productId) {
  console.log('✏️ Editando producto:', productId);
  
  const product = inventoryData.find(item => item.id === productId);
  if (!product) {
    showToast('Producto no encontrado', 'error');
    return;
  }
  
  const addTab = document.querySelector('[data-tab="agregar-producto"]');
  if (addTab) addTab.click();
  
  document.getElementById('add-barcode').value = product.codigoBarras || '';
  document.getElementById('add-product-name').value = product.nombre || '';
  document.getElementById('add-brand').value = product.marca || '';
  document.getElementById('add-pieces-per-box').value = product.piezasPorCaja || '';
  document.getElementById('add-warehouse').value = product.ubicacion || '';
  document.getElementById('add-expiry-date').value = product.fechaCaducidad || '';
  document.getElementById('add-boxes').value = product.cajas || '';
  
  document.getElementById('add-product-form').dataset.editingId = productId;
  
  showToast('Editando producto. Modifica los campos y guarda.', 'info');
}

// ============================================================
// ELIMINAR PRODUCTO
// ============================================================
async function deleteProduct(productId, productName) {
  if (!confirm(`¿Estás seguro de eliminar "${productName}"?`)) {
    return;
  }
  
  console.log('🗑️ Eliminando producto:', productId);
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  firebase.database().ref('inventario/' + userDeterminante + '/' + productId).remove()
    .then(() => {
      console.log('✅ Producto eliminado');
      showToast('Producto eliminado correctamente', 'success');
    })
    .catch((error) => {
      console.error('❌ Error al eliminar:', error);
      showToast('Error al eliminar producto: ' + error.message, 'error');
    });
}

// ============================================================
// AGREGAR O ACTUALIZAR PRODUCTO
// ============================================================
document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('💾 Guardando producto...');
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  const formData = {
    codigoBarras: document.getElementById('add-barcode').value.trim(),
    nombre: document.getElementById('add-product-name').value.trim(),
    marca: document.getElementById('add-brand').value,
    piezasPorCaja: parseInt(document.getElementById('add-pieces-per-box').value),
    ubicacion: document.getElementById('add-warehouse').value.trim(),
    fechaCaducidad: document.getElementById('add-expiry-date').value,
    cajas: parseInt(document.getElementById('add-boxes').value),
    fechaActualizacion: new Date().toISOString(),
    actualizadoPor: firebase.auth().currentUser.email
  };
  
  const form = document.getElementById('add-product-form');
  const editingId = form.dataset.editingId;
  
  try {
    if (editingId) {
      await firebase.database().ref('inventario/' + userDeterminante + '/' + editingId).update(formData);
      showToast('Producto actualizado correctamente', 'success');
      delete form.dataset.editingId;
    } else {
      formData.fechaCreacion = new Date().toISOString();
      formData.creadoPor = firebase.auth().currentUser.email;
      await firebase.database().ref('inventario/' + userDeterminante).push(formData);
      showToast('Producto agregado correctamente', 'success');
    }
    
    form.reset();
    document.querySelector('[data-tab="inventario"]')?.click();
    
  } catch (error) {
    console.error('❌ Error al guardar producto:', error);
    showToast('Error al guardar producto: ' + error.message, 'error');
  }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Inicializando módulo de inventario...');
  setupInventorySearch();
});

// Exponer funciones globalmente
window.filterByBrand = filterByBrand;
window.toggleBrandSection = toggleBrandSection;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

console.log('✅ inventory.js (multi-usuario) cargado correctamente');