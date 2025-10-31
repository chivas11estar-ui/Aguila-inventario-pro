// ============================================================
// Águila Inventario Pro - Módulo: app.js
// Copyright © 2025 José A. G. Betancourt
// ============================================================

console.log('🚀 Iniciando Águila Inventario Pro v7.1...');

// ============================================================
// VERIFICAR DEPENDENCIAS
// ============================================================
function checkDependencies() {
  const dependencies = {
    firebase: typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0,
    showToast: typeof showToast === 'function',
    openScanner: typeof openScanner === 'function'
  };
  
  console.log('📦 Dependencias:', dependencies);
  
  const allLoaded = Object.values(dependencies).every(dep => dep);
  
  if (!allLoaded) {
    console.warn('⚠️ Faltan dependencias:', dependencies);
  }
  
  return allLoaded;
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initializeApp() {
  console.log('⚙️ Inicializando app...');
  
  if (!firebase.apps || firebase.apps.length === 0) {
    console.error('❌ Firebase NO inicializado');
    if (typeof showToast !== 'undefined') {
      showToast('Error: Firebase no conectado', 'error');
    }
    return;
  }
  
  console.log('✅ Firebase OK');
  checkDependencies();
}

// ============================================================
// ESPERAR CARGA COMPLETA
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// ============================================================
// ERRORES GLOBALES
// ============================================================
window.addEventListener('error', (e) => {
  console.error('❌ Error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Promise:', e.reason);
});

console.log('✅ app.js cargado');