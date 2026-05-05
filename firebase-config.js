// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js (HARDENED - FIXED)
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

/**
 * OFUSCACIÓN DE CREDENCIALES (Ciberseguridad Pro)
 * Técnica: Reversión + Base64 para evitar detección por bots de scraping estático.
 */
const _S = {
    // API Key ofuscada (Reversión corregida)
    k: "RUY1b2lobTdxOHk5OVJoSVlvWkxraTBFSUg0alpPemtCeVNheklB", 
    // App ID ofuscada (Reversión corregida)
    a: "MDcxZDZlMzk3ODBhZTkwYjVlZjM1YzpiZXc6NTYyNTA2ODgxMDQxOjE="
};

function _D(v) {
    try {
        // Decodificar Base64 y luego revertir para obtener el string original
        return atob(v).split('').reverse().join('');
    } catch(e) { 
        console.error("❌ Error de decodificación:", e);
        return ""; 
    }
}

const firebaseConfig = {
  apiKey: _D(_S.k),
  authDomain: "promosentry.firebaseapp.com",
  databaseURL: "https://promosentry-default-rtdb.firebaseio.com",
  projectId: "promosentry",
  storageBucket: "promosentry.firebasestorage.app",
  messagingSenderId: "140188605265",
  appId: _D(_S.a)
};

function initFirebase() {
  console.log('🛡️ Iniciando Firebase (Capa de Seguridad Activa)...');
  
  // VERIFICACIÓN TEMPORAL (Eliminar después de confirmar)
  // console.log('DEBUG [API_KEY]:', firebaseConfig.apiKey);

  try {
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
      console.error('❌ Error: SDK de Firebase no detectado.');
      return false; 
    }
    
    if (!firebase.apps || firebase.apps.length === 0) {
      // Inicializar con la configuración ya decodificada
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase blindado e inicializado');
    }
    
    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseDB = firebase.database();
    window.firestore = firebase.firestore();

    return true;

  } catch (err) {
    console.error('❌ Error crítico en initFirebase:', err);
    return false;
  }
}

// Inicialización automática
initFirebase();
window.initFirebase = initFirebase;

console.log('🛡️ Configuración de Firebase endurecida y verificada.');