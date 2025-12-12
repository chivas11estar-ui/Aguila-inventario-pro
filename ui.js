// ============================================================
// Águila Inventario Pro - Módulo: ui.js (Optimizado 9.1)
// Estabilidad, rendimiento y limpieza profesional
// ============================================================

// ============================================================
// TOASTS PROFESIONALES
// ============================================================
window.showToast = function (message, type = "info") {
  try {
    const containerId = "app-toast-container";
    let container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99998;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 350px;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML = `<span>${message}</span>`;
    toast.style.cssText = `
      background: #fff;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      border-left: 4px solid ${getToastColor(type)};
      font-size: 14px;
      display: flex;
      align-items: center;
      animation: fadeInSlide 0.35s ease-out;
      cursor: pointer;
    `;

    container.appendChild(toast);

    // Auto-desvanecer
    setTimeout(() => closeToast(toast), 3500);

    toast.addEventListener("click", () => closeToast(toast));
  } catch (e) {
    console.error("Toast error:", e);
  }
};

function closeToast(toast) {
  toast.style.transition = "all 0.3s ease-out";
  toast.style.opacity = "0";
  toast.style.transform = "translateX(50px)";
  setTimeout(() => toast.remove(), 300);
}

function getToastColor(type) {
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#004aad",
  };
  return colors[type] || colors.info;
}

// ============================================================
// MANEJO DE TABS
// ============================================================
function setupTabs() {
  const navItems = document.querySelectorAll("[data-tab]");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabName = item.getAttribute("data-tab");

      // Ocultar todo
      document.querySelectorAll(".tab-content").forEach((t) => {
        t.classList.add("hidden");
        t.classList.remove("active");
      });

      // Desactivar navegación
      navItems.forEach((n) => n.classList.remove("active"));

      // Activar tab
      const target = document.getElementById("tab-" + tabName);
      if (target) {
        target.classList.remove("hidden");
        target.classList.add("active");
      }

      // Activar navegación
      item.classList.add("active");

      // Cerrar sidebar
      const sidebar = document.getElementById("sidebar");
      if (sidebar) sidebar.classList.remove("active");

      console.log("📑 Tab activado:", tabName);
    });
  });
}

// ============================================================
// SIDEBAR MÓVIL
// ============================================================
function setupSidebar() {
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      if (overlay) overlay.classList.toggle("active");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    });
  }
}

// ============================================================
// MONITOREO DE INTERNET
// ============================================================
window.addEventListener("online", () => {
  if (firebase?.auth()?.currentUser) {
    showToast("Conexión restaurada", "success");
  }
});

window.addEventListener("offline", () => {
  if (firebase?.auth()?.currentUser) {
    showToast("Sin conexión - Modo offline", "warning");
  }
});

// ============================================================
// LOADING UTILITIES
// ============================================================
window.showLoading = function (id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "flex";
};

window.hideLoading = function (id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
};

// ============================================================
// CONFIRMACIONES SEGURAS
// ============================================================
window.confirmAction = function (message, callback) {
  const ok = confirm(message);
  if (ok && typeof callback === "function") callback();
  return ok;
};

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initUI() {
  console.log("🎨 Inicializando UI optimizada…");

  setupTabs();
  setupSidebar();

  console.log("✅ UI lista y estable");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}

console.log("✅ ui.js optimizado cargado correctamente");