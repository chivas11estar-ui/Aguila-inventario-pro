// ============================================================
// Águila Inventario Pro - Módulo: inventory.js
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

let inventoryData = [];
let filteredInventory = [];
let currentBrandFilter = 'all';
let userDeterminante = null;

// ============================================================
// SISTEMA DE ALERTAS DE CADUCIDAD POR MARCA
// ============================================================

// Días de vigencia por marca
const BRAND_EXPIRY_CONFIG = {
  'Sabritas': 30,
  'Gamesa': 60,
  'Quaker': 60,
  "Sonric's": 60,
  'Cacahuate': 60,
  'default': 30
};

// Solicitar permisos de notificación
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

// Obtener urgencia y color según días REALES restantes vs límite de marca
function getExpiryUrgency(marca, daysUntilExpiry) {
  const maxDays = BRAND_EXPIRY_CONFIG[marca] || BRAND_EXPIRY_CONFIG['default'];
  
  // CADUCADO
  if (daysUntilExpiry < 0) {
    return {
      level: 'expired',
      color: '#7f1d1d',  // Rojo muy oscuro
      bgColor: '#fecaca',
      intensity: 100,
      shouldAlert: true,
      shouldVibrate: true,
      text: `⚠️ CADUCADO hace ${Math.abs(daysUntilExpiry)} días`
    };
  }
  
  // YA PASÓ EL LÍMITE DE VIGENCIA (ejemplo: Sabritas con 25 días = ya pasó los 30)
  if (daysUntilExpiry < maxDays) {
    // Calcular qué tan cerca está de caducar
    const daysAfterLimit = maxDays - daysUntilExpiry;
    const percentageExpired = (daysAfterLimit / maxDays) * 100;
    
    if (percentageExpired >= 90) {  // Quedan 3 días o menos (90% consumido)
      return {
        level: 'critical',
        color: '#991b1b',  // Rojo muy intenso
        bgColor: '#fee2e2',
        intensity: 95,
        shouldAlert: true,
        shouldVibrate: true,
        text: `🚨 CRÍTICO: Solo ${daysUntilExpiry} días`
      };
    } else if (percentageExpired >= 70) {  // Quedan 9 días o menos
      return {
        level: 'severe',
        color: '#b91c1c',  // Rojo intenso
        bgColor: '#fef2f2',
        intensity: 85,
        shouldAlert: true,
        shouldVibrate: true,
        text: `🔴 URGENTE: ${daysUntilExpiry} días`
      };
    } else if (percentageExpired >= 50) {  // Quedan 15 días o menos
      return {
        level: 'high',
        color: '#dc2626',  // Rojo
        bgColor: '#fef2f2',
        intensity: 70,
        shouldAlert: true,
        shouldVibrate: false,
        text: `🔴 ${daysUntilExpiry} días restantes`
      };
    } else if (percentageExpired >= 33) {  // Quedan 20 días o menos
      return {
        level: 'medium',
        color: '#ea580c',  // Naranja-rojo
        bgColor: '#ffedd5',
        intensity: 50,
        shouldAlert: false,
        shouldVibrate: false,
        text: `🟠 ${daysUntilExpiry} días restantes`
      };
    } else {  // Entre el límite y 33% consumido
      return {
        level: 'warning',
        color: '#f59e0b',  // Amarillo-naranja
        bgColor: '#fef3c7',
        intensity: 30,
        shouldAlert: false,
        shouldVibrate: false,
        text: `🟡 ${daysUntilExpiry} días restantes`
      };
    }
  }
  
  // TODAVÍA TIENE MÁS DÍAS QUE EL LÍMITE DE VIGENCIA
  // (ejemplo: Sabritas con 45 días = está fresco, aún no llega a los 30)
  
  // Si está muy cerca del límite (dentro de 5 días)
  const daysUntilLimit = daysUntilExpiry - maxDays;
  
  if (daysUntilLimit <= 5 && daysUntilLimit > 0) {
    return {
      level: 'approaching',
      color: '#eab308',  // Amarillo
      bgColor: '#fefce8',
      intensity: 20,
      shouldAlert: false,
      shouldVibrate: false,
      text: `🟡 ${daysUntilExpiry} días (próximo a límite)`
    };
  }
  
  // VERDE - Todo está bien
  return {
    level: 'safe',
    color: '#16a34a',  // Verde
    bgColor: '#f0fdf4',
    intensity: 0,
    shouldAlert: false,
    shouldVibrate: false,
    text: `✅ ${daysUntilExpiry} días restantes`
  };
}

// Mostrar notificación del navegador
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
  
  // Reproducir sonido
  if (urgency.intensity >= 50) {
    playAlertSound(urgency.intensity);
  }
}

// Reproducir sonido de alerta
function playAlertSound(intensity) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Frecuencia según intensidad
    const frequency = 400 + (intensity * 8);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    // Volumen
    const volume = Math.min(0.3, intensity / 250);
    gainNode.gain.value = volume;
    
    // Duración
    const duration = intensity >= 85 ? 0.3 : 0.15;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    
    // Repetir si es muy urgente
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

// Verificar productos por vencer
function checkExpiringProducts() {
  console.log('🔔 Verificando productos por vencer...');
  
  const today = new Date();
  const alertsToShow = [];
  
  inventoryData.forEach(product => {
    if (!product.fechaCaducidad || (product.cajas || 0) === 0) return;
    
    const expiryDate = new Date(product.fechaCaducidad);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    const urgency = getExpiryUrgency(product.marca, daysUntilExpiry);
    
    // Solo alertar productos que necesitan atención
    if (urgency.shouldAlert) {
      alertsToShow.push({ product, urgency, daysUntilExpiry });
    }
  });
  
  // Mostrar alertas más urgentes
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
      
      // Verificar alertas de caducidad
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
// MOSTRAR INVENTARIO
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
  
  let urgency = { level: 'none', color: '#6b7280', bgColor: '#f9fafb', text: 'Sin fecha' };
  
  if (expiryDate && daysUntilExpiry !== null) {
    urgency = getExpiryUrgency(item.marca, daysUntilExpiry);
  }
  
  const stockClass = (item.cajas || 0) === 0 ? 'out-of-stock' : (item.cajas || 0) < 5 ? 'low-stock' : '';
  const totalPiezas = (item.cajas || 0) * (item.piezasPorCaja || 0);
  
  // Animación de pulso solo para productos críticos
  const pulseAnimation = urgency.intensity >= 85 ? 'style="animation: pulse 2s infinite;"' : '';
  
  return `
    <div class="inventory-item ${stockClass}" data-id="${item.id}" ${pulseAnimation}>
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
  
  // Solicitar permisos de notificación
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);
  
  // Verificar productos por vencer cada hora
  setInterval(() => {
    checkExpiringProducts();
  }, 60 * 60 * 1000);
});

// Exponer funciones globalmente
window.filterByBrand = filterByBrand;
window.toggleBrandSection = toggleBrandSection;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

console.log('✅ inventory.js cargado correctamente');
Ahora también necesitas agregar este CSS al final de tu archivo styles.css:
/* Animación de pulso para productos urgentes */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
  }
}