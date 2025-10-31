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
    firebase: typeof firebase !== 'undefined' && firebase.apps.length > 0, // Verificar inicialización
    showToast: typeof showToast === 'function',
    openScanner: typeof openScanner === 'function',
    // ❌ ELIMINADO: Quagga ya no se usa ni se verifica
  };
  
  console.log('📦 Dependencias verificadas:', dependencies);
  
  const allLoaded = Object.values(dependencies).every(dep => dep);
  
  if (!allLoaded) {
    console.warn('⚠️ Algunas dependencias no están cargadas:', dependencies);
  }
  
  return allLoaded;
}

// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================
function initializeApp() {
  console.log('⚙️ Inicializando aplicación principal...');
  
  // Verificar la inicialización de Firebase que ya hizo firebase-config.js
  if (!firebase.apps || firebase.apps.length === 0) {
    console.error('❌ Firebase no está inicializado. Fallo crítico.');
    if (typeof showToast !== 'undefined') {
        showToast('Error: Firebase no está inicializado. Recarga la página.', 'error');
    }
    return;
  }
  
  console.log('✅ Firebase inicializado correctamente (verificado en app.js)');
  checkDependencies();
  
  // El resto de la inicialización se maneja en auth.js
}

// ============================================================
// ESPERAR A QUE TODO ESTÉ CARGADO (CORREGIDO)
// ============================================================
window.addEventListener('load', () => {
  console.log('🎨 Página completamente cargada');
  
  // CRÍTICO: Llamada directa, confiando en el atributo DEFER de index.html
  initializeApp(); 
});

// ============================================================
// MANEJO DE ERRORES GLOBALES
// ============================================================
window.addEventListener('error', (event) => {
  console.error('❌ Error global capturado:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rechazada sin manejar:', event.reason);
});

console.log('✅ app.js cargado correctamente');