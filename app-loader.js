// ============================================================
// Aguila Inventario Pro - carga diferida de la app autenticada
// Mantiene ligera la pantalla publica de login para moviles.
// ============================================================

'use strict';

(function setupAguilaAppLoader() {
  if (window.loadAguilaAppModules) return;

  const APP_MODULES = [
    { src: 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js', global: () => firebase.firestore },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js', global: () => window.CryptoJS },
    { src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js', global: () => window.Chart },
    { src: 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js', global: () => window.XLSX },
    { src: 'security-utils.js?v=1.2' },
    { src: 'ui.js?v=1.8', global: () => window.enhanceQuantityInputs },
    { src: 'listener-manager.js?v=1.0' },
    { src: 'inventory-core.js?v=5.4', global: () => window.cargarInventario && window.handleAddProductV2 },
    { src: 'scanner-mlkit.js?v=7.2', global: () => window.ScannerService || window.openScanner },
    { src: 'refill-safe.js?v=6.4', global: () => window.searchProductForRefillSafe },
    { src: 'inventory.js?v=3.4', global: () => window.loadInventory },
    { src: 'search-controller.js?v=1.1' },
    { src: 'lote-mover.js?v=1.1', global: () => window.moverProducto && window.moverLote },
    { src: 'inventory-ui.js?v=3.3' },
    { src: 'app.js?v=2.3', global: () => window.switchTab },
    { src: 'audit.js?v=2.5', global: () => window.buscarProductoAudit },
    { src: 'system.js?v=1.3' },
    { src: 'system-events.js?v=1.3' },
    { src: 'weather.js?v=1.7' },
    { src: 'profile-ui.js?v=2.4' },
    { src: 'profile.js?v=1.8', global: () => window.loadUserProfile },
    { src: 'analytics.js?v=1.9', global: () => window.loadStats },
    { src: 'analytics-ui.js?v=2.0' },
    { src: 'ai-phrases.js?v=1.6' },
    { src: 'phrases.js?v=1.4' },
    { src: 'migrate-to-v2.js?v=2.1' }
  ];

  let appModulesPromise = null;

  function loadScriptOnce(moduleConfig) {
    const existing = document.querySelector(`script[data-aguila-src="${moduleConfig.src}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = moduleConfig.src;
      script.defer = true;
      script.dataset.aguilaSrc = moduleConfig.src;
      script.onload = () => {
        if (moduleConfig.src.includes('firebase-firestore') && typeof firebase.firestore === 'function') {
          window.firestore = firebase.firestore();
        }
        resolve();
      };
      script.onerror = () => reject(new Error(`No se pudo cargar ${moduleConfig.src}`));
      document.head.appendChild(script);
    });
  }

  window.loadAguilaAppModules = function loadAguilaAppModules() {
    if (appModulesPromise) return appModulesPromise;

    appModulesPromise = APP_MODULES.reduce((chain, moduleConfig) => {
      return chain.then(async () => {
        try {
          if (typeof moduleConfig.global === 'function' && moduleConfig.global()) return;
        } catch (error) {
          // Si la comprobacion falla, intentamos cargar el modulo.
        }
        await loadScriptOnce(moduleConfig);
      });
    }, Promise.resolve());

    return appModulesPromise;
  };
})();
