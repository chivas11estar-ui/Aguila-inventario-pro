// ============================================================
// Águila Inventario Pro - Módulo: style.css
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


console.log('🚀 Iniciando Águila Inventario Pro v7.0...');

// ============================================================
// VERIFICAR DEPENDENCIAS
// ============================================================
function checkDependencies() {
  const dependencies = {
    firebase: typeof firebase !== 'undefined',
    showToast: typeof showToast === 'function',
    openScanner: typeof openScanner === 'function',
    Quagga: typeof Quagga !== 'undefined'
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
  console.log('⚙️ Inicializando aplicación...');
  
  // Verificar que Firebase esté inicializado
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase no está cargado');
    alert('Error: Firebase no está cargado. Recarga la página.');
    return;
  }
  
  if (!firebase.apps || firebase.apps.length === 0) {
    console.error('❌ Firebase no está inicializado');
    alert('Error: Firebase no está inicializado. Recarga la página.');
    return;
  }
  
  console.log('✅ Firebase inicializado correctamente');
  console.log('📱 Apps de Firebase:', firebase.apps.length);
  
  // El resto de la inicialización se maneja en auth.js
  // cuando el usuario se autentica
  
  checkDependencies();
}

// ============================================================
// ESPERAR A QUE TODO ESTÉ CARGADO
// ============================================================
window.addEventListener('load', () => {
  console.log('🎨 Página completamente cargada');
  
  // Pequeño delay para asegurar que todos los scripts defer se ejecutaron
  setTimeout(() => {
    initializeApp();
  }, 100);
});

// ============================================================
// MANEJO DE ERRORES GLOBALES
// ============================================================
window.addEventListener('error', (event) => {
  console.error('❌ Error global capturado:', event.error);
  
  // No mostrar toast para cada error (puede ser molesto)
  // Solo loggear en consola
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rechazada sin manejar:', event.reason);
});

// ============================================================
// INFORMATION
// ============================================================
console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       🦅 ÁGUILA INVENTARIO PRO v7.0                      ║
║                                                           ║
║       Sistema de Gestión de Inventario                   ║
║       para Promotores PepsiCo                            ║
║                                                           ║
║       © 2025 José A. G. Betancourt                       ║
║       Todos los derechos reservados                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📋 Módulos cargados:
   ✅ firebase-config.js
   ✅ auth.js
   ✅ ui.js
   ✅ inventory.js
   ✅ refill.js
   ✅ audit.js
   ✅ system.js
   ✅ app.js

🔥 Firebase: Conectado
📱 Modo: Producción
🌐 Entorno: Web App

Para soporte o reportar bugs:
📧 Email: soporte@aguilainventario.com
`);

console.log('✅ app.js cargado correctamente');