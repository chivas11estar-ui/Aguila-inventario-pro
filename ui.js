// ============================================================
// Águila Inventario Pro - Módulo: ui.js (FIX FINAL)
// ============================================================

// --- 1. Toasts (Notificaciones) ---
window.showToast = function (message, type = "info") {
  try {
    const containerId = "app-toast-container";
    let container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 99999;
        display: flex; flex-direction: column; gap: 10px; max-width: 300px;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`; // Asegúrate de tener estilos para .toast-success, etc.
    toast.style.cssText = "background: #333; color: #fff; padding: 12px; border-radius: 8px; margin-bottom: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);";
    
    // Colores simples por si falla el CSS
    if(type === 'success') toast.style.background = '#10b981';
    if(type === 'error') toast.style.background = '#ef4444';
    if(type === 'warning') toast.style.background = '#f59e0b';

    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  } catch (e) { console.error("Toast error:", e); }
};

// --- 2. Loading ---
window.showLoading = function (id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "flex";
};

window.hideLoading = function (id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
};

// --- 3. Setup Tabs (LA FUNCIÓN QUE FALTABA) ---
function setupTabs() {
  const navButtons = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.tab-content');

  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-tab');

      // 1. Activar botón
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 2. Mostrar sección usando la clase 'hidden'
      sections.forEach(sec => {
        if (sec.id === `tab-${targetId}`) {
          sec.classList.remove('hidden');
          sec.classList.add('active'); // Opcional si usas active para display
        } else {
          sec.classList.add('hidden');
          sec.classList.remove('active');
        }
      });
      
      // Hook para notificar a app.js si existe
      if(window.APP && window.APP.switchTab) {
          // Si app.js maneja lógica extra
      }
    });
  });
}

// --- 4. Setup Sidebar (LA OTRA QUE FALTABA) ---
function setupSidebar() {
  const btnMenu = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const closeBtns = document.querySelectorAll('.close-sidebar'); // Si tienes botón cerrar

  function toggleSidebar() {
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  if (btnMenu) btnMenu.addEventListener('click', toggleSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
  closeBtns.forEach(b => b.addEventListener('click', closeSidebar));
}

// --- 5. Inicialización ---
function initUI() {
  console.log("🎨 Inicializando UI...");
  setupTabs();     // Ahora sí existen
  setupSidebar();  // Ahora sí existen
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}
