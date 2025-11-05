/* ============================================================
   Águila Inventario Pro - app.js v7.1
   Lógica principal de la aplicación
   ============================================================ */

let currentUser = null;
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

// Mostrar Toast
function showToast(message, type = 'info') {
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
  
  // Cerrar sidebar en mobile
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('active');
  }
}

// Mostrar app
function showApp() {
  document.getElementById('auth-setup').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  updateOfflineStatus();
}

// Mostrar login
function showLogin() {
  document.getElementById('auth-setup').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
  currentUser = null;
}

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

// Logout
document.getElementById('btn-logout')?.addEventListener('click', () => {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    showLogin();
    showToast('Sesión cerrada correctamente', 'success');
  }
});

// Scanner button
document.getElementById('btn-scanner')?.addEventListener('click', () => {
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.add('active');
    // Inicializar cámara
    if (typeof startScanner === 'function') {
      startScanner();
    }
  }
});

// Close scanner
document.getElementById('close-scanner')?.addEventListener('click', () => {
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
    if (typeof stopScanner === 'function') {
      stopScanner();
    }
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

// Logout desde settings
document.getElementById('btn-logout-settings')?.addEventListener('click', () => {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    showLogin();
    showToast('Sesión cerrada correctamente', 'success');
  }
});

// Inicializar app
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ App Águila Pro v7.1 iniciada');
  
  // Por defecto mostrar login
  showLogin();
  
  // Simulación de usuario logueado (comentar después de agregar auth real)
  // setTimeout(() => {
  //   currentUser = { email: 'test@empresa.com', name: 'Promotor Test' };
  //   showApp();
  //   document.getElementById('user-info').textContent = `👤 ${currentUser.email}`;
  // }, 500);
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
    if (modal && modal.classList.contains('active')) {
      modal.classList.remove('active');
      if (typeof stopScanner === 'function') {
        stopScanner();
      }
    }
  }
});