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
 */
function initFirebase() {
  console.log('🔥 Iniciando Firebase...');
  
  try {
    // Verificar si el objeto global 'firebase' de la versión compat está cargado.
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
      console.error('❌ Error: El objeto Firebase no está disponible. ¿Faltan los SDKs en index.html?');
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
    
    // 2. Exponer servicios para el resto de los módulos
    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseDB = firebase.database();

    console.log('🔐 Servicios de Firebase listos (Auth, DB).');
    
    return true;

  } catch (err) {
    console.error('❌ Error crítico inicializando Firebase:', err);
    return false;
  }
}

// ============================================================
// LLAMADA CRÍTICA: Inicializa Firebase en cuanto este script cargue.
// Esto bloquea la ejecución de auth.js, etc., hasta que Firebase esté listo.
// ============================================================
initFirebase();

// Exponer la función globalmente solo si es necesaria más tarde
window.initFirebase = initFirebase;

console.log('✅ firebase-config.js cargado correctamente');