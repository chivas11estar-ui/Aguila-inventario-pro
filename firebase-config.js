// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js
// Versión Optimizada 2025 - Estable, Segura y Profesional
// © 2025 José A. G. Betancourt
// ============================================================

console.log("🔥 Cargando módulo firebase-config.js...");

/* ------------------------------------------------------------
   CONFIGURACIÓN DE FIREBASE (VERSIÓN FINAL)
------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyBkzOZj4HIE0ikLZoYIhR99y8q7mhio5FE",
  authDomain: "promosentry.firebaseapp.com",
  databaseURL: "https://promosentry-default-rtdb.firebaseio.com",
  projectId: "promosentry",
  storageBucket: "promosentry.firebasestorage.app",
  messagingSenderId: "140188605265",
  appId: "1:140188605265:web:c53fe5b09ea08793e6d170"
};

/* ------------------------------------------------------------
   FUNCIÓN PRINCIPAL: Inicializa Firebase correctamente
------------------------------------------------------------ */
function initFirebase() {
  console.log("🔧 Intentando inicializar Firebase…");

  try {
    // 1️⃣ Validación estricta: verifica que los SDKs existan
    if (
      typeof firebase === "undefined" ||
      typeof firebase.initializeApp !== "function"
    ) {
      console.error(
        "❌ Error crítico: Los SDKs de Firebase no están cargados. Revisa index.html."
      );
      window.firebaseReady = false;
      return false;
    }

    // 2️⃣ Prevenir doble inicialización
    if (firebase.apps && firebase.apps.length > 0) {
      console.warn("⚠️ Firebase ya estaba inicializado, usando instancia existente.");
    } else {
      firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase inicializado correctamente.");
    }

    // 3️⃣ Exponer Servicios Globales (Auth + DB)
    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseDB = firebase.database();

    // 4️⃣ Bandera global para saber si Firebase está listo
    window.firebaseReady = true;

    console.log("🔐 Servicios listos: Auth + Realtime Database.");
    console.log("📦 Proyecto:", firebaseConfig.projectId);

    return true;

  } catch (err) {
    console.error("❌ Error fatal inicializando Firebase:", err);
    window.firebaseReady = false;
    return false;
  }
}

/* ------------------------------------------------------------
   EJECUCIÓN AUTOMÁTICA AL CARGAR EL SCRIPT
------------------------------------------------------------ */
initFirebase();

/* ------------------------------------------------------------
   EXPOSE API (solo si se requiere en módulos externos)
------------------------------------------------------------ */
window.initFirebase = initFirebase;

console.log("✅ firebase-config.js cargado con éxito.");