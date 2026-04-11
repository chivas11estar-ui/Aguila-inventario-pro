/* ============================================================
   Águila Inventario Pro - app.js v7.6
   Lógica principal de la aplicación
   Copyright © 2025 José A. G. Betancourt
   ============================================================ */

let isOnline = navigator.onLine;

// Detectar estado de conexión
window.addEventListener('online', () => {
  isOnline = true;
  updateOfflineStatus();
  showToast('✅ Conexión establecida', 'success');
});

window.addEventListener('offline', () => {
  isOnline = false;
  updateOfflineStatus();
  showToast('📡 Modo offline activado', 'warning');
});

// Actualizar estado offline
function updateOfflineStatus() {
  const btn = document.getElementById('btn-offline-status');
  if (btn) {
    btn.textContent = isOnline ? '📡' : '🔌';
    btn.title = isOnline ? 'En línea' : 'Sin conexión (Modo Offline)';
  }
}

// Cambiar de tab
function switchTab(tabName) {
  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Mostrar el tab seleccionado
  const tab = document.getElementById(`tab-${tabName}`);
  if (tab) {
    tab.classList.add('active');
  }

  // Actualizar nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeItem = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // Llama a la función de carga específica según la pestaña
  if (tabName === 'analytics') {
    console.log('✅ Navegando a: analytics');
    if (typeof window.loadStats === 'function') {
      window.loadStats();
    } else {
      console.warn('⚠️ window.loadStats no está definido. Asegúrate de que analytics.js se cargue correctamente.');
    }
  } else if (tabName === 'inventory') {
    // Ejemplo para otras pestañas, asumiendo que existen loadInventory()
    console.log('✅ Navegando a: inventory');
    if (typeof window.loadInventory === 'function') {
      window.loadInventory();
    }
  } else if (tabName === 'out-of-stock') {
    console.log('✅ Navegando a: agotados');
    if (typeof window.loadInventory === 'function') {
      window.loadInventory();
    }
  } else if (tabName === 'audit') {
    // Ejemplo para auditorías, asumiendo que existe loadAuditUI()
    console.log('✅ Navegando a: audit');
    if (typeof window.loadAuditUI === 'function') {
      window.loadAuditUI();
    }
  } else if (tabName === 'system') { // Added for Profile/System tab
    console.log('✅ Navegando a: system (Perfil)');
    if (typeof window.loadUserProfile === 'function') {
      window.loadUserProfile();
    } else {
      console.warn('⚠️ window.loadUserProfile no está definido. Intentando de nuevo en breve...');
      setTimeout(() => {
        if (typeof window.loadUserProfile === 'function') {
          window.loadUserProfile();
        } else {
          console.error('❌ Fallo persistente: window.loadUserProfile sigue sin estar definido.');
        }
      }, 500); // Retry after 500ms
    }
  }

  // Cerrar sidebar en mobile
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('active');
  }
}
// Expone switchTab globalmente si no lo está ya, para ser llamado desde HTML
window.switchTab = switchTab;

// Event Listeners del Menú
document.getElementById('btn-menu')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('active');
});

// Navigation items
document.querySelectorAll('[data-tab]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = item.getAttribute('data-tab');
    switchTab(tab);
  });
});

// Scanner button - Usa openScanner que está definido en scanner.js
document.getElementById('btn-scanner')?.addEventListener('click', () => {
  if (typeof openScanner === 'function') {
    openScanner((barcode) => {
      console.log('📦 Código escaneado:', barcode);
      showToast(`✅ Código detectado: ${barcode}`, 'success');
      // Aquí puedes hacer más cosas con el código
    });
  } else {
    showToast('❌ El escáner no está disponible', 'error');
  }
});

// Close scanner
document.getElementById('close-scanner')?.addEventListener('click', () => {
  if (typeof closeScanner === 'function') {
    closeScanner();
  }
});

// Add product button
document.getElementById('btn-add-product')?.addEventListener('click', () => {
  showToast('Función de agregar producto en desarrollo', 'info');
});

// Cambiar contraseña
document.getElementById('btn-change-password')?.addEventListener('click', () => {
  showToast('Función de cambiar contraseña en desarrollo', 'info');
});

// Inicializar app
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ App Águila Pro v7.6 iniciada');
  updateOfflineStatus();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+H para ir a Inventario
  if (e.ctrlKey && e.key === 'h') {
    e.preventDefault();
    switchTab('inventory');
  }

  // Esc para cerrar scanner
  if (e.key === 'Escape') {
    const modal = document.getElementById('scanner-modal');
    if (modal && !modal.classList.contains('hidden')) {
      if (typeof closeScanner === 'function') {
        closeScanner();
      }
    }
  }
});

console.log('✅ app.js cargado correctamente');