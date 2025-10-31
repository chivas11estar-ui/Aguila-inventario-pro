// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js
// Copyright © 2025 José A. G. Betancourt
//
// Este archivo inicializa Firebase y expone los servicios
// (Auth y Database) para el resto de la aplicación.
// ============================================================

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBkzOZj4HIE0ikLZoYIhR99y8q7mhio5FE",
  authDomain: "promosentry.firebaseapp.com",
  databaseURL: "https://promosentry-default-rtdb.firebaseio.com",
  projectId: "promosentry",
  storageBucket: "promosentry.firebasestorage.app",
  messagingSenderId: "140188605265",
  appId: "1:140188605265:web:c53fe5b09ea08793e6d170"
};

/**
 * Función que inicializa Firebase y expone los servicios globalmente.
 * Debe llamarse solo una vez después de que los SDKs estén cargados.
 */
function initFirebase() {
  console.log('🔥 Iniciando Firebase...');
  
  try {
    // CRÍTICO: Verificar que el objeto global 'firebase' de la versión compat esté cargado.
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
      console.error('❌ Error: El objeto Firebase no está disponible. ¿Faltan los SDKs en index.html?');
      if (typeof showToast !== 'undefined') {
        showToast('Error de inicio: El SDK de Firebase no se cargó correctamente.', 'error');
      }
      return false;
    }
    
    // 1. Inicializar la app
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase inicializado correctamente');
      console.log('📦 Proyecto:', firebaseConfig.projectId);
    } else {
      console.log('⚠️ Firebase ya estaba inicializado');
    }
    
    // 2. Exponer servicios para el resto de los módulos (CRUCIAL para inventory.js)
    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseDB = firebase.database();

    console.log('🔐 Servicios de Firebase listos (Auth, DB).');
    
    return true;

  } catch (err) {
    const errorMsg = '❌ Error crítico inicializando Firebase: ' + err.message;
    console.error(errorMsg, err);
    
    if (typeof showToast !== 'undefined') {
        showToast('Fallo crítico al iniciar Firebase. Revisa la configuración. ' + err.message, 'critical');
    } else {
        document.getElementById('connection-status-text').textContent = 'ERROR FATAL';
    }
    return false;
  }
}

// ============================================================
// ⚠️ CORRECCIÓN CRÍTICA AÑADIDA: LLAMAR FUNCIÓN INMEDIATAMENTE
// Esto garantiza que Firebase se inicialice antes de que el
// navegador pase al siguiente script (ui.js, auth.js, etc.).
// ============================================================
initFirebase();

// Exponer la función globalmente solo si es necesaria más tarde
window.initFirebase = initFirebase;
