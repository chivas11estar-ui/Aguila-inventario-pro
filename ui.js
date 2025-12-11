// ============================================================
// Águila Inventario Pro - Módulo: ui.js
// VERSIÓN CORREGIDA: Sin código zombie del escáner
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// DEFINICIÓN GLOBAL Y SEGURA DE showToast
// ============================================================
window.showToast = function(message, type = 'info') {
  console.log('[TOAST]', type.toUpperCase(), '→', message);
  
  const containerId = 'app-toast-container';
  let container = document.getElementById(containerId);
  
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99998;display:flex;flex-direction:column;gap:10px;max-width:400px;';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    background: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    border-left: 4px solid ${getToastColor(type)};
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:all 0.3s ease-out;';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
  
  toast.addEventListener('click', () => {
    toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:all 0.3s ease-out;';
    setTimeout(() => toast.remove(), 300);
  });
};

function getToastColor(type) {
  const colors = {
    'success': '#10b981',
    'error': '#ef4444',
    'warning': '#f59e0b',
    'info': '#004aad'
  };
  return colors[type] || colors['info'];
}

// ============================================================
// MANEJO DE TABS
// ============================================================
function setupTabs() {
  const navItems = document.querySelectorAll('[data-tab]');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.getAttribute('data-tab');
      
      // Ocultar todos los tabs
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('hidden');
      });
      
      // Desactivar todos los botones de navegación
      document.querySelectorAll('[data-tab]').forEach(nav => {
        nav.classList.remove('active');
      });
      
      // Activar el tab seleccionado
      const tabElement = document.getElementById('tab-' + tabName);
      if (tabElement) {
        tabElement.classList.add('active');
        tabElement.classList.remove('hidden');
      }
      
      // Activar el botón de navegación
      item.classList.add('active');
      
      // Cerrar sidebar en móvil
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.remove('active');
      }
      
      console.log('📑 Tab activado:', tabName);
    });
  });
}

// ============================================================
// TOGGLE SIDEBAR (MENÚ MÓVIL)
// ============================================================
function setupSidebar() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      if (overlay) {
        overlay.classList.toggle('active');
      }
    });
  }
  
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initUI() {
  console.log('🎨 Inicializando UI...');
  
  setupTabs();
  setupSidebar();
  
  // ❌ CÓDIGO ZOMBIE ELIMINADO
  // El escáner ahora es manejado por scanner-events.js
  // No hay event listeners duplicados aquí
  
  console.log('✅ UI inicializado correctamente');
  console.log('📌 Eventos del escáner manejados por scanner-events.js');
}

// ============================================================
// MONITOREAR CONEXIÓN CON PROTECCIÓN
// ============================================================
window.addEventListener('online', () => {
  // Solo mostrar si hay usuario autenticado
  if (firebase.auth().currentUser) {
    showToast('✅ Conexión restaurada', 'success');
  }
});

window.addEventListener('offline', () => {
  // Solo mostrar si hay usuario autenticado
  if (firebase.auth().currentUser) {
    showToast('📡 Sin conexión - Trabajando offline', 'warning');
  }
});

// ============================================================
// UTILIDADES ADICIONALES
// ============================================================

// Función para mostrar/ocultar elementos de carga
window.showLoading = function(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'flex';
  }
};

window.hideLoading = function(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'none';
  }
};

// Función para confirmar acciones peligrosas
window.confirmAction = function(message, callback) {
  const confirmed = confirm(message);
  if (confirmed && typeof callback === 'function') {
    callback();
  }
  return confirmed;
};

// ============================================================
// INICIAR CUANDO DOM ESTÉ LISTO
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.log('✅ ui.js cargado correctamente (sin código zombie)');