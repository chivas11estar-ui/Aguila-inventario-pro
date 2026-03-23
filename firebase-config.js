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
    window.firestore = firebase.firestore(); // Nuevo: Soporte para Firestore (Arquitectura Pro)

    console.log('🔐 Servicios de Firebase listos (Auth, DB, Firestore).');
    
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

// ============================================================
// INSTRUCCIONES DE SEGURIDAD - Firebase Realtime Rules
// ============================================================
//
// ⚠️ CRÍTICO: Las reglas de seguridad en security-rules.json DEBEN
// deployarse INMEDIATAMENTE para proteger los datos.
//
// PASOS PARA DEPLOYAR RULES (versión web, sin CLI):
// 1. Ir a: https://console.firebase.google.com
// 2. Proyecto: promosentry
// 3. Realtime Database → Rules (pestaña)
// 4. Copiar TODO el contenido de security-rules.json
// 5. Pegar en el editor de Rules en Firebase Console
// 6. Hacer CLICK EN "PUBLISH"
//
// ALTERNATIVA (si tienes Firebase CLI instalado):
//   $ firebase login
//   $ cd "tu/ruta/al/proyecto"
//   $ firebase deploy --only database:rules
//
// ¿QUÉ HACEN ESTAS RULES?
// - ✅ Usuario A NO puede acceder datos de Usuario B
// - ✅ Stock NUNCA puede ser negativo
// - ✅ Determinante (tienda) DEBE ser 4-8 caracteres alfanuméricos
// - ✅ Códigos de barras deben tener ≥8 dígitos
// - ✅ Previene inyección de SQL/NoSQL
//
// TESTING DE SEGURIDAD:
// 1. Crear 2 usuarios: user1@test.com (tienda: TIENDA1) y user2@test.com (tienda: TIENDA2)
// 2. Login como user1 → Intentar acceder /productos/TIENDA2
//    ❌ Debe FALLAR (Access Denied)
// 3. Login como user1 → Intentar crear stock negativo
//    ❌ Debe FALLAR (Validation Failed)
// 4. Login como user1 → Crear stock válido para /productos/TIENDA1
//    ✅ Debe PASAR
//
// ============================================================