// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js
// Copyright © 2025 José A. G. Betancourt
//
// Este archivo inicializa Firebase y expone los servicios
// (Auth y Database) para el resto de la aplicación.
// ============================================================

// Configuración de Firebase (debe ser la que usa en su consola)
const firebaseConfig = {
  apiKey: "AIzaSyBkzOZj4HIE0ikLZoYIhR99y8q7mhio5FE",
  authDomain: "promosentry.firebaseapp.com",
  databaseURL: "https://promosentry-default-rtdb.firebaseio.com",
  projectId: "promosentry",
  storageBucket: "promosentry.firebasestorage.app",
  messagingSenderId: "140188605265",
  appId: "1:140188605265:web:c53fe5b09ea08793e6d170"
};

// Variables globales que serán inicializadas
export let app;
export let auth;
export let db;

// ============================================================
// Inicialización de Firebase (Llamada desde app.js)
// ============================================================
export function initFirebase() {
  console.log('🔥 Iniciando Firebase...');
  
  // Verificación de existencia de las funciones importadas
  if (typeof window.initializeApp === 'undefined') {
    const errorMsg = '❌ Error: Las funciones de Firebase no se cargaron correctamente en index.html.';
    console.error(errorMsg);
    // Usamos el DOM para mostrar un error visible sin depender de showToast
    document.getElementById('connection-status-text').textContent = 'ERROR DE CONFIG.';
    document.querySelector('.status-indicator').className = 'status-indicator status-error';
    return;
  }
  
  try {
    // 1. Inicializar la aplicación
    if (!window.firebaseApp || !window.firebaseApp.name) {
      app = window.initializeApp(firebaseConfig);
      window.firebaseApp = app; // Exponer la app
      console.log('✅ Firebase inicializado correctamente');
    } else {
      app = window.firebaseApp;
      console.log('⚠️ Firebase ya estaba inicializado');
    }
    
    // 2. Inicializar servicios y exponerlos
    auth = window.getAuth(app);
    db = window.getDatabase(app);

    // Exportar variables para uso en otros módulos
    window.firebaseAuth = auth;
    window.firebaseDB = db;
    
    console.log('🔐 Servicios de Firebase listos (Auth, DB)');
    
    // Retornar éxito
    return true;

  } catch (error) {
    const errorMsg = '❌ Error fatal al inicializar Firebase: ' + error.message;
    console.error(errorMsg, error);
    // Si showToast no está disponible, usamos el DOM
    if (typeof showToast !== 'undefined') {
      showToast('Error de configuración de Firebase: ' + error.message, 'error');
    }
    document.getElementById('connection-status-text').textContent = 'FALLO DE CONFIG.';
    document.querySelector('.status-indicator').className = 'status-indicator status-error';
    return false;
  }
}