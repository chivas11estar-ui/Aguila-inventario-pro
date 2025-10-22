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
      
      // --- INICIO MODIFICACIÓN: Verificar alertas de caducidad ---
      // Esperamos 2 segundos para no sobrecargar al inicio
      setTimeout(() => {
        checkExpiringProducts();
      }, 2000);
      // --- FIN MODIFICACIÓN ---
      
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

// --- INICIO REEMPLAZO: renderInventoryItem ---
// Esta función ahora incluye "Total Piezas" y las alertas de caducidad progresivas
function renderInventoryItem(item) {
  const expiryDate = item.fechaCaducidad ? new Date(item.fechaCaducidad) : null;
  const today = new Date();
  const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
  
  // Obtener el objeto de urgencia (color, texto, etc.)
  let urgency = { level: 'none', color: '#6b7280', bgColor: '#f9fafb', text: 'Sin fecha' };
  if (expiryDate && daysUntilExpiry !== null) {
    urgency = getExpiryUrgency(item.marca, daysUntilExpiry);
  }

  const stockClass = (item.cajas || 0) === 0 ? 'out-of-stock' : (item.cajas || 0) < 5 ? 'low-stock' : '';
  const totalPiezas = (item.cajas || 0) * (item.piezasPorCaja || 0);

  // Añadir animación de pulso si la intensidad es muy alta (crítica)
  const pulseAnimation = urgency.intensity >= 80 ? 'style="animation: pulse 2s infinite;"' : '';
  
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
// --- FIN REEMPLAZO: renderInventoryItem ---

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
// --- INICIO REEMPLAZO: DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Inicializando módulo de inventario...');
  setupInventorySearch();
  
  // Solicitar permisos de notificación después de 3 segundos
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);
  
  // Verificar productos por vencer cada hora, por si la app queda abierta
  setInterval(() => {
    checkExpiringProducts();
  }, 60 * 60 * 1000); // 60 minutos * 60 segundos * 1000 ms = 1 hora
});
// --- FIN REEMPLAZO: DOMContentLoaded ---

// Exponer funciones globalmente
window.filterByBrand = filterByBrand;
window.toggleBrandSection = toggleBrandSection;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

console.log('✅ inventory.js (multi-usuario) cargado correctamente');


// ============================================================
// ============================================================
// SISTEMA DE ALERTAS DE CADUCIDAD (v3.0 - DÍAS FIJOS)
// ============================================================

/**
 * --- MODIFICADO ---
 * Configuración de DÍAS DE ALERTA por marca.
 * El sistema enviará una notificación push si a un producto
 * le quedan ESTOS días o menos.
 */
const ALERT_DAYS_CONFIG = {
  'Sabritas': 35,      // Alerta a los 60 días o menos
  'Gamesa': 65,        // Alerta a los 65 días o menos
  'Quaker': 65,
  "Sonric's": 65,
  'Cacahuate': 65,
  'default': 60        // Alerta a los 60 días para marcas no listadas
};

/**
 * Solicita permiso al usuario para mostrar notificaciones.
 * Se debe llamar una vez que la app haya cargado.
 */
async function requestNotificationPermission() {
  // Verificar si el navegador soporta notificaciones
  if (!('Notification' in window)) {
    console.log('❌ Este navegador no soporta notificaciones');
    return false;
  }
  
  // Si ya tenemos permiso, no hacemos nada
  if (Notification.permission === 'granted') {
    console.log('✅ Permisos de notificación ya otorgados');
    return true;
  }
  
  // Si no nos han denegado, pedimos permiso
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Permisos de notificación otorgados');
      showToast('¡Notificaciones activadas! Recibirás alertas de productos por vencer.', 'success');
      return true;
    }
  }
  
  // Si llegamos aquí, el permiso fue denegado
  console.log('❌ Permisos de notificación denegados');
  return false;
}

/**
 * Calcula el nivel de urgencia, color y texto basado en la marca y los días restantes.
 * Esta es la lógica central del sistema progresivo.
 * @param {string} marca - La marca del producto
 * @param {number} daysUntilExpiry - Días restantes (puede ser negativo)
 * @returns {object} Objeto de urgencia
 */
function getExpiryUrgency(marca, daysUntilExpiry) {
  // Obtener los días de vigencia estándar para esta marca
  const maxDays = BRAND_EXPIRY_CONFIG[marca] || BRAND_EXPIRY_CONFIG['default'];
  
  // Nivel 1: Caducado
  if (daysUntilExpiry < 0) {
    return {
      level: 'expired',
      color: '#dc2626',  // Rojo oscuro
      bgColor: '#fee2e2',
      intensity: 100, // Máxima intensidad
      shouldAlert: true,
      text: `⚠️ CADUCADO hace ${Math.abs(daysUntilExpiry)} días`
    };
  }
  
  // Calcular el porcentaje de vigencia restante
  const percentage = (daysUntilExpiry / maxDays) * 100;
  
  // Nivel 2: Crítico (Menos del 10% de vigencia)
  if (percentage <= 10) {
    return {
      level: 'critical',
      color: '#b91c1c',  // Rojo muy intenso
      bgColor: '#fecaca',
      intensity: 95,
      shouldAlert: true,
      text: `🚨 URGENTE: ${daysUntilExpiry} días`
    };
  }
  // Nivel 3: Severo (Menos del 20% de vigencia)
  else if (percentage <= 20) {
    return {
      level: 'severe',
      color: '#dc2626',  // Rojo intenso
      bgColor: '#fef2f2',
      intensity: 80,
      shouldAlert: true,
      text: `⚠️ MUY URGENTE: ${daysUntilExpiry} días`
    };
  }
  // Nivel 4: Alto (Menos del 33% de vigencia)
  else if (percentage <= 33) {
    return {
      level: 'high',
      color: '#ea580c',  // Naranja-rojo
      bgColor: '#ffedd5',
      intensity: 65,
      shouldAlert: true,
      text: `⚠️ ${daysUntilExpiry} días restantes`
    };
  }
  // Nivel 5: Medio (Menos del 50% de vigencia)
  else if (percentage <= 50) {
    return {
      level: 'medium',
      color: '#f59e0b',  // Naranja
      bgColor: '#fef3c7',
      intensity: 50,
      shouldAlert: false, // No enviamos push-notification por esto
      text: `⏰ ${daysUntilExpiry} días restantes`
    };
  }
  // Nivel 6: Bajo (Menos del 75% de vigencia)
  else if (percentage <= 75) {
    return {
      level: 'low',
      color: '#eab308',  // Amarillo
      bgColor: '#fefce8',
      intensity: 30,
      shouldAlert: false,
      text: `📅 ${daysUntilExpiry} días restantes`
    };
  }
  // Nivel 7: Seguro (Más del 75% de vigencia)
  else {
    return {
      level: 'safe',
      color: '#22c55e',  // Verde
      bgColor: '#f0fdf4',
      intensity: 0,
      shouldAlert: false,
      text: `✅ ${daysUntilExpiry} días restantes`
    };
  }
}

/**
 * Muestra una notificación Push (del navegador/PWA)
 * @param {object} product - El objeto del producto
 * @param {object} urgency - El objeto de urgencia de getExpiryUrgency
 */
function showExpiryNotification(product, urgency) {
  if (Notification.permission !== 'granted') return;
  
  const notificationTitle = '⚠️ Alerta de Caducidad - Águila Inventario';
  const notificationBody = `${product.nombre}\n${urgency.text}\nMarca: ${product.marca}\nStock: ${product.cajas} cajas`;
  
  const options = {
    body: notificationBody,
    icon: 'icon-192x192.png', // Icono de la PWA
    badge: 'icon-192x192.png', // Icono para Android
    tag: product.id, // Evita notificaciones duplicadas para el mismo producto
    requireInteraction: urgency.intensity >= 80, // Requiere que el usuario la cierre si es muy urgente
    vibrate: urgency.intensity >= 65 ? [200, 100, 200, 100, 200] : [200, 100, 200] // Vibra más si es urgente
  };
  
  // Mostrar la notificación
  const notification = new Notification(notificationTitle, options);
  
  // Reproducir sonido de alerta
  playAlertSound(urgency.intensity);
  
  // Al hacer clic, lleva al usuario a la app
  notification.onclick = () => {
    window.focus(); // Enfoca la pestaña de la app si está abierta
    document.querySelector('[data-tab="inventario"]')?.click(); // Cambia a la pestaña de inventario
    notification.close();
  };
}

/**
 * Reproduce un sonido de alerta usando la Web Audio API.
 * La intensidad del sonido varía según la urgencia.
 * @param {number} intensity - Nivel de 0 a 100
 */
function playAlertSound(intensity) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Frecuencia más alta = más urgente
    const frequency = 400 + (intensity * 8); // Rango de 400Hz a 1200Hz
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine'; // Un tono limpio
    
    // Volumen (bajo para no ser molesto)
    const volume = Math.min(0.3, intensity / 200);
    gainNode.gain.value = volume;
    
    // Duración
    const duration = intensity >= 80 ? 0.3 : 0.15; // Más largo si es crítico
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    
    // Si es muy urgente, reproduce un segundo tono (efecto "bi-bip")
    if (intensity >= 80) {
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = frequency + 100; // Tono ligeramente diferente
        osc2.type = 'sine';
        gain2.gain.value = volume;
        osc2.start();
        osc2.stop(audioContext.currentTime + duration);
      }, 400); // 400ms después
    }
    
  } catch (error) {
    console.error('❌ Error al reproducir sonido de alerta:', error);
  }
}

/**
 * Revisa todo el inventario en busca de productos por vencer
 * y dispara las notificaciones necesarias.
 */
function checkExpiringProducts() {
  console.log('🔔 Verificando productos por vencer...');
  
  const today = new Date();
  const alertsToShow = [];
  
  inventoryData.forEach(product => {
    // Ignorar si no tiene fecha o no hay stock
    if (!product.fechaCaducidad || (product.cajas || 0) === 0) return;
    
    const expiryDate = new Date(product.fechaCaducidad);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    const urgency = getExpiryUrgency(product.marca, daysUntilExpiry);
    
    // Solo nos interesan los que marcamos como "alertables"
    if (urgency.shouldAlert) {
      alertsToShow.push({ product, urgency, daysUntilExpiry });
    }
  });
  
  // Para no saturar al usuario, mostramos solo las 3 alertas más críticas
  const criticalAlerts = alertsToShow
    .filter(a => a.urgency.intensity >= 65) // Filtramos por nivel 'Alto' o superior
    .sort((a, b) => b.urgency.intensity - a.urgency.intensity) // Ordenamos por más urgente
    .slice(0, 3); // Tomamos solo las 3 primeras
  
  criticalAlerts.forEach(({ product, urgency }) => {
    showExpiryNotification(product, urgency);
  });
  
  if (alertsToShow.length > 0) {
    console.log(`⚠️ ${alertsToShow.length} productos requieren atención de caducidad.`);
  }
}
