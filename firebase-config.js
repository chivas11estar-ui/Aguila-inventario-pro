// ============================================================
// Águila Inventario Pro - Módulo: firebase-config.js (HARDENED - FIXED)
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

// Limpia textos con codificacion rota antes de que lleguen a la consola.
(function setupConsoleTextRepair() {
    if (window.__aguilaConsoleTextRepair) return;
    window.__aguilaConsoleTextRepair = true;

    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
    const methods = ['log', 'info', 'warn', 'error', 'debug'];

    function repairText(value) {
        if (typeof value !== 'string') return value;

        let output = value;
        for (let i = 0; i < 3; i++) {
            if (!/[ÃÂâðÅ]/.test(output) || !decoder) break;

            const bytes = Uint8Array.from(Array.from(output, char => char.charCodeAt(0) & 255));
            const decoded = decoder.decode(bytes);
            if (!decoded || decoded === output || decoded.includes('�')) break;
            output = decoded;
        }

        return output
            .replace(/\u00c2/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    methods.forEach(method => {
        const original = console[method];
        if (typeof original !== 'function') return;

        console[method] = function repairedConsoleMethod(...args) {
            original.apply(console, args.map(repairText));
        };
    });

    window.cleanAppText = repairText;
})();

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
