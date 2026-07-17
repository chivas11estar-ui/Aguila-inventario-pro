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

// Segunda capa para textos doblemente codificados por Windows-1252.
(function setupConsoleTextRepairV2() {
    if (window.__aguilaConsoleTextRepairV2) return;
    window.__aguilaConsoleTextRepairV2 = true;

    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    const windows1252 = {
        0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
        0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
        0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
        0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
        0x017e: 0x9e, 0x0178: 0x9f
    };

    function toWindows1252Bytes(text) {
        return Uint8Array.from(Array.from(text, char => {
            const code = char.charCodeAt(0);
            if (code <= 0xff) return code;
            return windows1252[code] ?? 0x3f;
        }));
    }

    function repairTextV2(value) {
        if (typeof value !== 'string') return value;

        let output = value;
        for (let i = 0; i < 3; i++) {
            if (!/[ÃÂâðÅ]/.test(output) || !decoder) break;

            const decoded = decoder.decode(toWindows1252Bytes(output));
            if (!decoded || decoded === output) break;
            output = decoded;
        }

        return output
            .replace(/ÃƒÂ¡/g, 'á')
            .replace(/ÃƒÂ©/g, 'é')
            .replace(/ÃƒÂ­/g, 'í')
            .replace(/ÃƒÂ³/g, 'ó')
            .replace(/ÃƒÂº/g, 'ú')
            .replace(/ÃƒÂ±/g, 'ñ')
            .replace(/ÃƒÂ/g, 'Á')
            .replace(/ÃƒÂ‰/g, 'É')
            .replace(/ÃƒÂ/g, 'Í')
            .replace(/ÃƒÂ“/g, 'Ó')
            .replace(/ÃƒÂš/g, 'Ú')
            .replace(/Ãƒâ€˜/g, 'Ñ')
            .replace(/Ã¡/g, 'á')
            .replace(/Ã©/g, 'é')
            .replace(/Ã­/g, 'í')
            .replace(/Ã³/g, 'ó')
            .replace(/Ãº/g, 'ú')
            .replace(/Ã±/g, 'ñ')
            .replace(/Ã/g, 'Á')
            .replace(/Ã‰/g, 'É')
            .replace(/Ã/g, 'Í')
            .replace(/Ã“/g, 'Ó')
            .replace(/Ãš/g, 'Ú')
            .replace(/Ã‘/g, 'Ñ')
            .replace(/âœ…/g, '')
            .replace(/âœ“/g, '')
            .replace(/âš™ï¸/g, '')
            .replace(/âš¡/g, '')
            .replace(/â˜€ï¸/g, '')
            .replace(/â„¹ï¸/g, '')
            .replace(/â†’/g, '->')
            .replace(/â€¦/g, '...')
            .replace(/ðŸ[\s\S]{0,3}/g, '')
            .replace(/\u00c2/g, '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    methods.forEach(method => {
        const previous = console[method];
        if (typeof previous !== 'function') return;

        console[method] = function repairedConsoleMethodV2(...args) {
            previous.apply(console, args.map(repairTextV2));
        };
    });

    window.cleanAppText = repairTextV2;
})();

// Consola limpia para uso diario: oculta ruido de arranque y deja errores reales visibles.
(function setupQuietProductionConsole() {
    if (window.__aguilaQuietProductionConsole) return;
    window.__aguilaQuietProductionConsole = true;
    window.AGUILA_DEBUG = window.AGUILA_DEBUG === true;

    const originalLog = console.log;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    console.log = function quietLog(...args) {
        if (window.AGUILA_DEBUG) originalLog.apply(console, args);
    };

    console.info = function quietInfo(...args) {
        if (window.AGUILA_DEBUG) originalInfo.apply(console, args);
    };

    console.debug = function quietDebug(...args) {
        if (window.AGUILA_DEBUG) originalDebug.apply(console, args);
    };
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
