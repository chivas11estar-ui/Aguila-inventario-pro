// ============================================================
// Águila Inventario Pro - Módulo: ui.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// ESTE ARCHIVO YA NO CONTIENE LÓGICA DE ESCANEO (openScanner/closeScanner)
// PARA EVITAR CONFLICTOS CON scanner.js (ML KIT).
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
  
  // Auto-cerrar después de 3.5 segundos
  setTimeout(() => {
    toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:all 0.3s ease-out;';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
  
  // Cerrar al hacer clic
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
  const tabButtons = document.querySelectorAll('.tabs button[data-tab]');
  const tabPanels = document.querySelectorAll('.tab');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remover clase active de todos los botones y paneles
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      tabPanels.forEach(panel => panel.classList.remove('active'));
      
      // Agregar clase active al botón y panel seleccionado
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
      
      const targetPanel = document.getElementById('tab-' + targetTab);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
      
      console.log('📑 Tab activado:', targetTab);
    });
  });
}

// ============================================================
// BOTONES DE ESCANEO (Limpio para ML Kit)
// ============================================================
function setupScanButtons() {
  // Función helper para manejar el escaneo en diferentes inputs
  const handleScanClick = (inputId) => {
    // openScanner es una función GLOBAL definida en scanner.js
    if (typeof window.openScanner === 'function') {
      window.openScanner((code) => {
        const input = document.getElementById(inputId);
        if (input) {
          input.value = code;
          // Si es auditoría o relleno, forzar la búsqueda
          if (inputId.includes('audit')) {
             if (typeof window.buscarProductoAudit === 'function') window.buscarProductoAudit();
          } else if (inputId.includes('refill')) {
             // El código se maneja en refill.js (searchProductForRefill)
             if (typeof window.searchProductForRefill === 'function') window.searchProductForRefill(code);
          }
        }
      });
    } else {
      showToast('❌ El escáner (ML Kit) no está disponible', 'error');
    }
  };
  
  // Asignar eventos a todos los botones de escaneo
  document.getElementById('add-scan-btn')?.addEventListener('click', () => handleScanClick('add-barcode'));
  document.getElementById('inventory-scan-btn')?.addEventListener('click', () => handleScanClick('inventory-search'));
  document.getElementById('refill-scan-btn')?.addEventListener('click', () => handleScanClick('refill-barcode'));
  document.getElementById('audit-scan-btn')?.addEventListener('click', () => handleScanClick('audit-barcode'));

  // Asegurar que el botón de cerrar escáner llama a la función global
  document.getElementById('close-scanner')?.addEventListener('click', () => {
    if (typeof window.closeScanner === 'function') {
      window.closeScanner();
    }
  });
}

// ============================================================
// ESTADO DE CONEXIÓN
// ============================================================
function updateConnectionStatus(isOnline) {
  const indicator = document.querySelector('.status-indicator');
  const statusText = document.getElementById('connection-status-text');
  
  if (indicator && statusText) {
    if (isOnline) {
      indicator.className = 'status-indicator status-online';
      statusText.textContent = 'Conectado';
    } else {
      indicator.className = 'status-indicator status-error';
      statusText.textContent = 'Sin conexión';
    }
  }
}

// Monitorear conexión
window.addEventListener('online', () => {
  updateConnectionStatus(true);
  showToast('Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
  updateConnectionStatus(false);
  showToast('Sin conexión a internet', 'warning');
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initUI() {
  console.log('🎨 Inicializando UI...');
  
  setupTabs();
  setupScanButtons();
  updateConnectionStatus(navigator.onLine);
  
  console.log('✅ UI inicializado correctamente');
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.log('✅ ui.js cargado correctamente');