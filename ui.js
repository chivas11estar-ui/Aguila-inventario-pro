// ============================================================
// Águila Inventario Pro - Módulo: ui.js
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
// ESCÁNER DE CÓDIGO DE BARRAS
// ============================================================
let scannerActive = false;

function openScanner(callback) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Tu dispositivo no soporta el escáner de cámara', 'error');
    return;
  }
  
  const modal = document.getElementById('scanner-modal');
  const statusEl = document.getElementById('scanner-status');
  
  modal.classList.remove('hidden');
  statusEl.textContent = 'Iniciando cámara...';
  scannerActive = true;
  
  console.log('📷 Iniciando escáner...');
  
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#scanner-view'),
      constraints: {
        width: 640,
        height: 480,
        facingMode: "environment"
      }
    },
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "code_128_reader",
        "code_39_reader",
        "upc_reader",
        "upc_e_reader"
      ]
    }
  }, function(err) {
    if (err) {
      console.error('❌ Error al iniciar escáner:', err);
      showToast('Error al iniciar cámara: ' + err.message, 'error');
      closeScanner();
      return;
    }
    console.log('✅ Escáner iniciado correctamente');
    statusEl.textContent = 'Enfoca el código de barras';
    Quagga.start();
  });
  
  Quagga.onDetected(function(result) {
    if (scannerActive && result.codeResult && result.codeResult.code) {
      const code = result.codeResult.code;
      console.log('✅ Código detectado:', code);
      showToast('Código detectado: ' + code, 'success');
      
      if (callback && typeof callback === 'function') {
        callback(code);
      }
      
      closeScanner();
    }
  });
}

function closeScanner() {
  console.log('🔒 Cerrando escáner...');
  scannerActive = false;
  
  if (typeof Quagga !== 'undefined') {
    Quagga.stop();
  }
  
  const modal = document.getElementById('scanner-modal');
  modal.classList.add('hidden');
}

// Event listener para botón de cerrar escáner
document.getElementById('close-scanner')?.addEventListener('click', closeScanner);

// ============================================================
// BOTONES DE ESCANEO
// ============================================================
function setupScanButtons() {
  // Botón de escaneo en "Agregar Producto"
  const addScanBtn = document.getElementById('add-scan-btn');
  if (addScanBtn) {
    addScanBtn.addEventListener('click', () => {
      openScanner((code) => {
        document.getElementById('add-barcode').value = code;
      });
    });
  }
  
  // LOS OTROS BOTONES SE QUITARON PARA EVITAR CONFLICTOS
  // (Se manejan en sus respectivos archivos, ej: audit.js, refill.js)
}

// ============================================================
// (FUNCIONES REMOVIDAS)
// ============================================================
// Se eliminaron las funciones 'searchProductByBarcode',
// 'displayRefillProductInfo' y 'displayAuditProductInfo'
// porque ya existen en los archivos 'audit.js' y 'refill.js',
// y mantenerlas aquí causaba el conflicto.

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

