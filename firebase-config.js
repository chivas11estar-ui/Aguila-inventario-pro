// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema Águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación
// sin autorización expresa del autor.
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

// Inicialización protegida de Firebase
(function initFirebase() {
  console.log('🔥 Iniciando Firebase...');
  
  try {
    // Verificar que Firebase SDK esté cargado
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK no cargado. Verifica los <script> en index.html');
      return;
    }
    
    // Evitar reinicialización
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase inicializado correctamente');
      console.log('📦 Proyecto:', firebaseConfig.projectId);
      console.log('🔗 Auth Domain:', firebaseConfig.authDomain);
    } else {
      console.log('⚠️ Firebase ya estaba inicializado');
      console.log('📦 Apps activas:', firebase.apps.length);
    }
    
    // Exponer Firebase globalmente
    window.firebase = firebase;
    
    // Verificar servicios disponibles
    console.log('🔐 Auth disponible:', typeof firebase.auth === 'function');
    console.log('💾 Database disponible:', typeof firebase.database === 'function');
    
  } catch (err) {
    console.error('❌ Error crítico inicializando Firebase:', err);
    console.error('📋 Stack:', err.stack);
  }
})();

console.log('✅ firebase-config.js cargado');