// ============================================================
// Águila Inventario Pro - Módulo: system.js
// Versión optimizada 9.0 — Rendimiento + Estabilidad
// ============================================================

// ============================================================
// UTILIDADES GENERALES
// ============================================================
const safeToast = (msg, type = "info") => {
  if (typeof showToast === "function") showToast(msg, type);
  else alert(msg);
};

const safeAlert = (msg) => alert(msg);

// ============================================================
// DIAGNÓSTICO DE FIREBASE
// ============================================================
function diagnosticoFirebase() {
  console.log("🔍 Iniciando diagnóstico Firebase…");

  const deviceType = (() => {
    const ua = navigator.userAgent.toLowerCase();
    const pwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;

    if (pwa) {
      if (ua.includes("android")) return "PWA instalada (Android)";
      if (ua.includes("iphone") || ua.includes("ipad"))
        return "PWA instalada (iOS)";
      return "PWA instalada (Escritorio)";
    }

    if (ua.includes("android")) return "Navegador móvil (Android)";
    if (ua.includes("iphone") || ua.includes("ipad"))
      return "Navegador móvil (iOS)";

    if (ua.includes("chrome")) return "Chrome escritorio";
    if (ua.includes("firefox")) return "Firefox escritorio";
    if (ua.includes("edge")) return "Edge escritorio";
    if (ua.includes("safari")) return "Safari escritorio";

    return "Navegador desconocido";
  })();

  const connectionType = (() => {
    if (!navigator.onLine) return "Sin conexión";

    const net =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (!net) return "Wi-Fi o datos móviles";

    const t = net.type || net.effectiveType || "online";

    if (t === "wifi") return "Wi-Fi";
    if (["cellular", "2g", "3g", "4g"].includes(t)) return "Datos móviles";
    return "Conexión establecida";
  })();

  const diag = {
    firebase: {
      cargado: typeof firebase === "object",
      apps: firebase?.apps?.length ?? 0,
      auth: typeof firebase?.auth === "function",
      db: typeof firebase?.database === "function",
    },
    usuario: {
      autenticado: !!firebase?.auth()?.currentUser,
      email: firebase?.auth()?.currentUser?.email ?? "N/A",
      uid: firebase?.auth()?.currentUser?.uid ?? null,
    },
    red: {
      online: navigator.onLine,
      tipo: connectionType,
    },
    disp: {
      tipo: deviceType,
      idioma: navigator.language,
    },
  };

  console.log("📋 Diagnóstico completo:", diag);

  safeAlert(
    `
🔥 Firebase: ${diag.firebase.cargado ? "Disponible" : "No cargado"}
📱 Apps: ${diag.firebase.apps}
🔐 Auth: ${diag.firebase.auth ? "OK" : "No disponible"}
💾 Database: ${diag.firebase.db ? "OK" : "No disponible"}

👤 Usuario: ${
      diag.usuario.autenticado ? "Autenticado" : "No autenticado"
    }
📧 Email: ${diag.usuario.email}

🌐 Conexión: ${diag.red.online ? "Online" : "Offline"}
📶 Tipo: ${diag.red.tipo}

💻 Entorno: ${diag.disp.tipo}
Idiomas: ${diag.disp.idioma}
`
  );

  safeToast("Diagnóstico completado", "info");
}

// ============================================================
// ESTADÍSTICAS DEL SISTEMA (OPTIMIZADAS)
// ============================================================
async function showSystemStats() {
  console.log("📊 Cargando estadísticas…");

  const user = firebase.auth().currentUser;
  if (!user) {
    return safeToast("Usuario no autenticado", "error");
  }

  try {
    const userSnap = await firebase
      .database()
      .ref("usuarios/" + user.uid)
      .once("value");
    const userData = userSnap.val();

    const det = userData?.determinante;
    if (!det) return safeToast("Determinante no encontrada", "error");

    const invSnap = await firebase
      .database()
      .ref("inventario/" + det)
      .once("value");
    const data = invSnap.val();

    if (!data) {
      return safeAlert(`
📦 ESTADÍSTICAS DEL INVENTARIO
⚠️ No hay productos registrados.
      `);
    }

    const productos = Object.values(data);

    const stats = {
      total: productos.length,
      cajas: productos.reduce((a, p) => a + (p.cajas || 0), 0),
      piezas: productos.reduce(
        (a, p) => a + (p.cajas || 0) * (p.piezasPorCaja || 0),
        0
      ),
      marcas: new Set(productos.map((p) => p.marca)).size,
      ubicaciones: new Set(productos.map((p) => p.ubicacion)).size,
      sinStock: productos.filter((p) => (p.cajas || 0) === 0).length,
      bajo: productos.filter((p) => (p.cajas || 0) > 0 && p.cajas < 5).length,
    };

    safeAlert(
      `
📦 ESTADÍSTICAS DEL INVENTARIO

Productos únicos: ${stats.total}
Cajas totales: ${stats.cajas}
Piezas totales: ${stats.piezas}

Marcas distintas: ${stats.marcas}
Ubicaciones: ${stats.ubicaciones}

Sin stock: ${stats.sinStock}
Stock bajo (<5): ${stats.bajo}
`
    );

    console.log("📊 Stats:", stats);
  } catch (e) {
    console.error("❌ Error al cargar estadísticas:", e);
    safeToast("Error cargando estadísticas", "error");
  }
}

// ============================================================
// LIMPIAR DATOS
// ============================================================
function clearAllData() {
  if (
    !confirm(
      "⚠️ Esto eliminará:\n• Caché\n• LocalStorage\n• Cookies\n\nNo borra tus datos en Firebase.\n¿Continuar?"
    )
  )
    return;

  try {
    localStorage.clear();
    sessionStorage.clear();

    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    safeToast("Datos locales eliminados", "success");

    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    console.error("❌ Error limpiando datos:", e);
    safeToast("Error al limpiar datos", "error");
  }
}

// ============================================================
// MONITOREO DE CONEXIÓN
// ============================================================
function updateSystemConnectionStatus() {
  const status = navigator.onLine ? "Conectado" : "Sin conexión";
  console.log("🌐 Estado:", status);

  const el = document.getElementById("system-connection-status");
  if (el) {
    el.textContent = status;
    el.style.color = navigator.onLine ? "var(--success)" : "var(--error)";
  }
}

function setupConnectionMonitoring() {
  updateSystemConnectionStatus();

  window.addEventListener("online", () => {
    updateSystemConnectionStatus();
    safeToast("Conexión restaurada", "success");
  });

  window.addEventListener("offline", () => {
    updateSystemConnectionStatus();
    safeToast("Sin internet", "warning");
  });

  setInterval(updateSystemConnectionStatus, 30000);
}

// ============================================================
// SERVICE WORKER
// ============================================================
function updateServiceWorkerStatus() {
  const el = document.getElementById("system-sw-status");
  if (!el) return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        el.textContent = "Activo";
        el.style.color = "var(--success)";
      } else {
        el.textContent = "No instalado";
      }
    });
  } else {
    el.textContent = "No soportado";
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initSystemModule() {
  console.log("⚙️ Inicializando módulo del sistema…");

  setupConnectionMonitoring();
  updateServiceWorkerStatus();

  console.log("✅ Módulo del sistema listo.");
}

document.addEventListener("DOMContentLoaded", initSystemModule);

// Exponer
window.diagnosticoFirebase = diagnosticoFirebase;
window.showSystemStats = showSystemStats;
window.clearAllData = clearAllData;

console.log("✅ system.js cargado correctamente");