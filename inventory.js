// ============================================================
// Águila Inventario Pro - Módulo: inventory.js
// Copyright © 2025 José A. G. Betancourt
// VERSIÓN CON FILTRO DE STOCK 0
// ============================================================

let inventoryData = [];
let filteredInventory = [];
let currentBrandFilter = 'all';
let userDeterminante = null;
let mostrarProductosSinStock = false; // NUEVO: Toggle para productos sin stock

// ============================================================
// SISTEMA DE ALERTAS DE CADUCIDAD POR MARCA
// ============================================================

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
      showToast('Notificaciones activadas. Recibirás alertas de productos próximos a vencer.', 'success');
      return true;
    }
  }
  
  console.log('❌ Permisos de notificación denegados');
  return false;
}

function getExpiryUrgency(marca, daysUntilExpiry) {
  const maxDays = BRAND_EXPIRY_CONFIG[marca] || BRAND_EXPIRY_CONFIG['default'];
  
  if (daysUntilExpiry < 0) {
    return {
      level: 'expired',
      color: '#7f1d1d',
      bgColor: '#fecaca',
      intensity: 100,
      shouldAlert: true,
      shouldVibrate: true,
      text: `⚠️ CADUCADO hace ${Math.abs(daysUntilExpiry)} días`
    };
  }
  
  if (daysUntilExpiry < maxDays) {
    const daysAfterLimit = maxDays - daysUntilExpiry;
    const percentageExpired = (daysAfterLimit / maxDays) * 100;
    
    if (percentageExpired >= 90) {
      return {
        level: 'critical',
        color: '#991b1b',
        bgColor: '#fee2e2',
        intensity: 95,
        shouldAlert: true,
        shouldVibrate: true,
        text: `🚨 CRÍTICO: Solo ${daysUntilExpiry} días`
      };
    } else if (percentageExpired >= 70) {
      return {
        level: 'severe',
        color: '#b91c1c',
        bgColor: '#fef2f2',
        intensity: 85,
        shouldAlert: true,
        shouldVibrate: true,
        text: `🔴 URGENTE: ${daysUntilExpiry} días`
      };
    } else if (percentageExpired >= 50) {
      return {
        level: 'high',
        color: '#dc2626',
        bgColor: '#fef2f2',
        intensity: 70,
        shouldAlert: true,
        shouldVibrate: false,
        text: `🔴 ${daysUntilExpiry} días restantes`
      };
    } else if (percentageExpired >= 33) {
      return {
        level: 'medium',
        color: '#ea580c',
        bgColor: '#ffedd5',
        intensity: 50,
        shouldAlert: false,
        shouldVibrate: false,
        text: `🟠 ${daysUntilExpiry} días restantes`
      };
    } else {
      return {
        level: 'warning',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        intensity: 30,
        shouldAlert: false,
        shouldVibrate: false,
        text: `🟡 ${daysUntilExpiry} días restantes`
      };
    }
  }
  
  const daysUntilLimit = daysUntilExpiry - maxDays;
  
  if (daysUntilLimit <= 5 && daysUntilLimit > 0) {
    return {
      level: 'approaching',
      color: '#eab308',
      bgColor: '#fefce8',
      intensity: 20,
      shouldAlert: false,
      shouldVibrate: false,
      text: `🟡 ${daysUntilExpiry} días (próximo a límite)`
    };
  }
  
  return {
    level: 'safe',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    intensity: 0,
    shouldAlert: false,
    shouldVibrate: false,
    text: `✅ ${daysUntilExpiry} días restantes`
  };
}

function showExpiryNotification(product, urgency) {
  if (Notification.permission !== 'granted') return;
  
  const notification = new Notification('⚠️ Alerta de Caducidad - Águila Inventario', {
    body: `${product.nombre}\n${urgency.text}\nMarca: ${product.marca}\nStock: ${product.cajas} cajas`,
    icon: 'icon-192x192.png',
    badge: 'icon-192x192.png',
    tag: product.id,
    requireInteraction: urgency.intensity >= 85,
    vibrate: urgency.shouldVibrate ? [200, 100, 200, 100, 200] : [200, 100, 200]
  });
  
  notification.onclick = () => {
    window.focus();
    document.querySelector('[data-tab="inventario"]')?.click();
    notification.close();
  };
  
  if (urgency.intensity >= 50) {
    playAlertSound(urgency.intensity);
  }
}

function playAlertSound(intensity) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const frequency = 400 + (intensity * 8);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    const volume = Math.min(0.3, intensity / 250);
    gainNode.gain.value = volume;
    
    const duration = intensity >= 85 ? 0.3 : 0.15;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    
    if (intensity >= 85) {
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = frequency + 100;
        osc2.type = 'sine';
        gain2.gain.value = volume;
        osc2.start();
        osc2.stop(audioContext.currentTime + duration);
      }, 400);
    }
    
  } catch (error) {
    console.error('❌ Error al reproducir sonido:', error);
  }
}

function checkExpiringProducts() {
  console.log('🔔 Verificando productos por vencer...');
  
  const today = new Date();
  const alertsToShow = [];
  
  inventoryData.forEach(product => {
    if (!product.fechaCaducidad || (product.cajas || 0) === 0) return;
    
    const expiryDate = new Date(product.fechaCaducidad);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    const urgency = getExpiryUrgency(product.marca, daysUntilExpiry);
    
    if (urgency.shouldAlert) {
      alertsToShow.push({ product, urgency, daysUntilExpiry });
    }
  });
  
  const criticalAlerts = alertsToShow
    .filter(a => a.urgency.intensity >= 70)
    .sort((a, b) => b.urgency.intensity - a.urgency.intensity)
    .slice(0, 3);
  
  criticalAlerts.forEach(({ product, urgency }) => {
    showExpiryNotification(product, urgency);
  });
  
  if (alertsToShow.length > 0) {
    console.log(`⚠️ ${alertsToShow.length} productos requieren atención`);
  }
}

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
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    console.error('❌ No se pudo obtener el determinante');
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  console.log('🏪 Cargando inventario de tienda:', userDeterminante);
  
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
      
      setTimeout(() => {
        checkExpiringProducts();
      }, 2000);
      
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
  // NUEVO: Contar solo productos con stock
  const productsWithStock = inventoryData.filter(item => (item.cajas || 0) > 0);
  const totalProducts = productsWithStock.length;
  document.getElementById('total-products').textContent = totalProducts;
  
  const totalBoxes = inventoryData.reduce((sum, item) => sum + (item.cajas || 0), 0);
  document.getElementById('total-inventory-value').textContent = totalBoxes;
  
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const expiringSoon = inventoryData.filter(item => {
    if (!item.fechaCaducidad || (item.cajas || 0) === 0) return false;
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
  // NUEVO: Contar solo productos con stock
  const productsWithStock = inventoryData.filter(item => (item.cajas || 0) > 0);
  const brands = [...new Set(productsWithStock.map(item => item.marca))].sort();
  
  const filterContainer = document.getElementById('brand-filters');
  if (!filterContainer) return;
  
  filterContainer.innerHTML = `
    <button class="brand-filter-btn active" data-brand="all" onclick="filterByBrand('all')">
      Todas (${productsWithStock.length})
    </button>
    ${brands.map(brand => {
      const count = productsWithStock.filter(item => item.marca === brand).length;
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
// TOGGLE PRODUCTOS SIN STOCK (NUEVO)
// ============================================================
function toggleProductosSinStock() {
  mostrarProductosSinStock = !mostrarProductosSinStock;
  
  const btn = document.getElementById('toggle-stock-btn');
  if (btn) {
    btn.textContent = mostrarProductosSinStock ? '👁️ Ocultar sin stock' : '👁️‍🗨️ Mostrar sin stock';
    btn.style.background = mostrarProductosSinStock ? '#6b7280' : '#004aad';
  }
  
  displayInventory(filteredInventory);
  console.log('👁️ Toggle productos sin stock:', mostrarProductosSinStock);
}

// ============================================================
// MOSTRAR INVENTARIO (MODIFICADO)
// ============================================================
function displayInventory(items) {
  const container = document.getElementById('inventory-list');
  
  if (!container) {
    console.error('❌ Contenedor de inventario no encontrado');
    return;
  }
  
  // NUEVO: Separar productos con y sin stock
  const conStock = items.filter(item => (item.cajas || 0) > 0);
  const sinStock = items.filter(item => (item.cajas || 0) === 0);
  
  console.log(`📊 Productos con stock: ${conStock.length}, sin stock: ${sinStock.length}`);
  
  if (conStock.length === 0 && !mostrarProductosSinStock) {
    displayEmptyInventory();
    return;
  }
  
  if (currentBrandFilter === 'all') {
    displayInventoryGroupedWithToggle(conStock, sinStock);
  } else {
    displayInventoryFlatWithToggle(conStock, sinStock);
  }
}

function displayInventoryGroupedWithToggle(conStock, sinStock) {
  const container = document.getElementById('inventory-list');
  
  // Agrupar productos CON stock
  const grouped = conStock.reduce((acc, item) => {
    const brand = item.marca || 'Sin Marca';
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(item);
    return acc;
  }, {});
  
  const brands = Object.keys(grouped).sort();
  
  let html = brands.map(brand => `
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
  
  // NUEVO: Agregar productos SIN stock si el toggle está activado
  if (mostrarProductosSinStock && sinStock.length > 0) {
    html += `
      <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 12px; text-align: center;">
        <h3 style="color: #6b7280; margin: 0;">📦 Productos sin stock (${sinStock.length})</h3>
      </div>
    `;
    
    sinStock.forEach(item => {
      html += renderInventoryItem(item, true);
    });
  }
  
  container.innerHTML = html;
}

function displayInventoryFlatWithToggle(conStock, sinStock) {
  const container = document.getElementById('inventory-list');
  
  let html = conStock.map(item => renderInventoryItem(item)).join('');
  
  // NUEVO: Agregar productos SIN stock si el toggle está activado
  if (mostrarProductosSinStock && sinStock.length > 0) {
    html += `
      <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 12px; text-align: center;">
        <h3 style="color: #6b7280; margin: 0;">📦 Productos sin stock (${sinStock.length})</h3>
      </div>
    `;
    
    sinStock.forEach(item => {
      html += renderInventoryItem(item, true);
    });
  }
  
  container.innerHTML = html;
}

function renderInventoryItem(item, isSinStock = false) {
  const expiryDate = item.fechaCaducidad ? new Date(item.fechaCaducidad) : null;
  const today = new Date();
  const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
  
  let urgency = { level: 'none', color: '#6b7280', bgColor: '#f9fafb', text: 'Sin fecha' };
  
  if (expiryDate && daysUntilExpiry !== null) {
    urgency = getExpiryUrgency(item.marca, daysUntilExpiry);
  }
  
  const stockClass = (item.cajas || 0) === 0 ? 'out-of-stock' : (item.cajas || 0) < 5 ? 'low-stock' : '';
  const totalPiezas = (item.cajas || 0) * (item.piezasPorCaja || 0);
  
  const pulseAnimation = urgency.intensity >= 85 ? 'style="animation: alertPulse 2s infinite;"' : '';
  
  // NUEVO: Estilo especial para productos sin stock
  const sinStockStyle = isSinStock ? 'opacity: 0.5; border: 2px dashed #e5e7eb; background: #f9fafb;' : '';
  
  return `
    <div class="inventory-item ${stockClass}" data-id="${item.id}" ${pulseAnimation} style="${sinStockStyle}">
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
        <div class="detail-row" style="background: #e0f2fe; padding: 8px; border-radius: 6px; margin: 4px 0;">
          <span class="detail-label" style="font-weight: 700;">🎯 Total Piezas:</span>
          <span class="detail-value" style="font-weight: 700; color: var(--primary); font-size: 1.1em;">${totalPiezas}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📍 Ubicación:</span>
          <span class="detail-value">${item.ubicacion || 'N/A'}</span>
        </div>
        <div class="detail-row" style="background: ${urgency.bgColor}; padding: 8px; border-radius: 6px; margin: 4px 0; border-left: 4px solid ${urgency.color};">
          <span class="detail-label" style="font-weight: 700;">📅 Caducidad:</span>
          <span class="detail-value" style="font-weight: 700; color: ${urgency.color}; font-size: 1.05em;">
            ${urgency.text}
          </span>
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
      <h3>No hay productos con stock disponible</h3>
      <p>Los productos sin stock están ocultos. Click en "Mostrar sin stock" para verlos.</p>
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