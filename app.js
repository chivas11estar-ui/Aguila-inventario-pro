/* ============================================================
   Aguila Inventario Pro - app.js
   Logica principal y navegacion eficiente
   ============================================================ */

let isOnline = navigator.onLine;
let lastAnalyticsLoad = 0;

window.addEventListener('online', () => {
  isOnline = true;
  updateOfflineStatus();
  showToast('Conexion establecida', 'success');
});

window.addEventListener('offline', () => {
  isOnline = false;
  updateOfflineStatus();
  showToast('Modo offline activado', 'warning');
});

function updateOfflineStatus() {
  const btn = document.getElementById('btn-offline-status');
  if (!btn) return;

  const icon = btn.querySelector('.material-icons-round');
  if (icon) {
    icon.textContent = isOnline ? 'sensors' : 'sensors_off';
  } else {
    btn.textContent = isOnline ? 'En linea' : 'Offline';
  }
  btn.title = isOnline ? 'En linea' : 'Sin conexion (Modo Offline)';
}

function switchTab(tabName) {
  if (!tabName) return;

  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (!selectedTab) return;

  const currentTab = document.querySelector('.tab-content.active');
  if (currentTab?.id === selectedTab.id) return;

  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.classList.remove('active');
    tab.classList.add('hidden');
  });

  selectedTab.classList.remove('hidden');
  selectedTab.classList.add('active');
  selectedTab.scrollTop = 0;
  window.scrollTo(0, 0);

  document.querySelectorAll('[data-tab]').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
  });

  runTabLoader(tabName);

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('active');
}

function runTabLoader(tabName) {
  if (tabName === 'analytics') {
    const now = Date.now();
    if (typeof window.loadStats === 'function' && now - lastAnalyticsLoad > 60000) {
      lastAnalyticsLoad = now;
      window.loadStats();
    }
    return;
  }

  if ((tabName === 'inventory' || tabName === 'out-of-stock') && typeof window.loadInventory === 'function') {
    window.loadInventory();
    return;
  }

  if (tabName === 'audit' && typeof window.loadAuditUI === 'function') {
    window.loadAuditUI();
    return;
  }

  if (tabName === 'system') {
    if (typeof window.loadUserProfile === 'function') {
      window.loadUserProfile();
      return;
    }

    setTimeout(() => {
      if (typeof window.loadUserProfile === 'function') window.loadUserProfile();
    }, 500);
  }
}

window.switchTab = switchTab;

document.addEventListener('click', (e) => {
  const navItem = e.target.closest('[data-tab]');
  if (!navItem) return;

  e.preventDefault();
  switchTab(navItem.getAttribute('data-tab'));
});

document.getElementById('btn-menu')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('active');
});

document.getElementById('btn-scanner')?.addEventListener('click', () => {
  if (typeof openScanner === 'function') {
    openScanner((barcode) => {
      showToast(`Codigo detectado: ${barcode}`, 'success');
    });
  } else {
    showToast('El escaner no esta disponible', 'error');
  }
});

document.getElementById('close-scanner')?.addEventListener('click', () => {
  if (typeof closeScanner === 'function') closeScanner();
});

document.getElementById('btn-add-product')?.addEventListener('click', () => {
  showToast('Funcion de agregar producto en desarrollo', 'info');
});

document.getElementById('btn-change-password')?.addEventListener('click', () => {
  showToast('Funcion de cambiar contrasena en desarrollo', 'info');
});

document.addEventListener('DOMContentLoaded', () => {
  updateOfflineStatus();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'h') {
    e.preventDefault();
    switchTab('inventory');
  }

  if (e.key === 'Escape') {
    const modal = document.getElementById('scanner-modal');
    if (modal && !modal.classList.contains('hidden') && typeof closeScanner === 'function') {
      closeScanner();
    }
  }
});
