// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js (HARDENED)
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

/**
 * OFUSCACIÓN DE CREDENCIALES (Ciberseguridad Pro)
 * Técnica: Reversión + Base64 para evitar detección por bots de scraping estático.
 */
const _S = {
    // API Key ofuscada
    k: "RVRGNm9paG03cTh5OTlSaElvWkxraTBFSWhyNEpqWk96a2JTenhpQUE=", 
    // App ID ofuscada
    a: "MDcxMDlhOWViMGU1MzVjOmJldzo1NjI4NjA4MTA0MToxOmRhR29K"
};

function _D(v) {
    try {
        return atob(v).split('').reverse().join('');
    } catch(e) { return ""; }
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
  
  try {
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
      console.error('❌ Error: SDK de Firebase no detectado.');
      return false; 
    }
    
    if (!firebase.apps || firebase.apps.length === 0) {
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

console.log('🛡️ Configuración de Firebase endurecida.');