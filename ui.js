// ============================================================
// Águila Inventario Pro - Módulo: ui.js (FINAL)
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
      
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      
      document.querySelectorAll('[data-tab]').forEach(nav => {
        nav.classList.remove('active');
      });
      
      const tabElement = document.getElementById('tab-' + tabName);
      if (tabElement) {
        tabElement.classList.add('active');
      }
      
      item.classList.add('active');
      
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.remove('active');
      }
      
      console.log('📑 Tab activado:', tabName);
    });
  });
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initUI() {
  console.log('🎨 Inicializando UI...');
  
  setupTabs();
  
  // ✅ BOTÓN ESCÁNER AGREGAR - CORREGIDO
  const btnScanAdd = document.getElementById('btn-scan-add');
  if (btnScanAdd) {
    btnScanAdd.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🎬 Abriendo escáner para agregar...');
      
      if (typeof window.openScanner === 'function') {
        console.log('✅ openScanner disponible, abriendo...');
        window.openScanner((code) => {
          console.log('📦 Código escaneado:', code);
          const input = document.getElementById('add-barcode');
          if (input) {
            input.value = code;
            showToast('✅ Código detectado: ' + code, 'success');
          }
        });
      } else {
        console.error('❌ openScanner NO está disponible');
        showToast('❌ El escáner no está disponible', 'error');
      }
    });
  } else {
    console.warn('⚠️ Botón btn-scan-add no encontrado');
  }
  
  // ✅ BOTÓN CERRAR ESCÁNER
  const closeBtn = document.getElementById('close-scanner');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔴 Cerrando escáner...');
      if (typeof window.closeScanner === 'function') {
        window.closeScanner();
      }
    });
  }
  
  console.log('✅ UI inicializado correctamente');
}

// ============================================================
// MONITOREAR CONEXIÓN
// ============================================================
window.addEventListener('online', () => {
  showToast('✅ Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
  showToast('📡 Sin conexión a internet', 'warning');
});

// ============================================================
// INICIAR CUANDO DOM ESTÉ LISTO
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.log('✅ ui.js cargado correctamente');