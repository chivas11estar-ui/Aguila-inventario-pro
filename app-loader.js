// ============================================================
// Aguila Inventario Pro - carga diferida de la app autenticada
// FAST BOOT: carga solo las dependencias necesarias para mostrar
// el inventario y deja los módulos secundarios en segundo plano.
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
    { src: 'audit.js?v=2.6', global: () => window.buscarProductoAudit },
    { src: 'system.js?v=1.3' },
    { src: 'system-events.js?v=1.3' },
    { src: 'weather.js?v=1.8' },
    { src: 'profile-ui.js?v=2.5' },
    { src: 'profile.js?v=1.9', global: () => window.loadUserProfile },
    { src: 'analytics.js?v=1.9', global: () => window.loadStats },
    { src: 'analytics-ui.js?v=2.0' },
    { src: 'ai-phrases.js?v=1.6' },
    { src: 'phrases.js?v=1.4' },
    { src: 'migrate-to-v2.js?v=2.1' }
  ];

  // Dependencias mínimas para que el usuario pueda ver y operar el inventario.
  // Se mantienen en fases para respetar las dependencias de ejecución.
  const CRITICAL_STAGE_1 = [
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
    'security-utils.js?v=1.2',
    'ui.js?v=1.8',
    'listener-manager.js?v=1.0'
  ];
  const CRITICAL_STAGE_2 = [
    'inventory-core.js?v=5.4',
    'inventory-ui.js?v=3.3'
  ];
  const CRITICAL_STAGE_3 = [
    'inventory.js?v=3.4'
  ];

  let appModulesPromise = null;

  function getModuleBySrc(src) {
    return APP_MODULES.find(moduleConfig => moduleConfig.src === src);
  }

  function loadScriptOnce(moduleConfig) {
    const existing = document.querySelector(`script[data-aguila-src="${moduleConfig.src}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = moduleConfig.src;
      script.defer = true;
      script.dataset.aguilaSrc = moduleConfig.src;
      script.onload = () => {
        try {
          if (moduleConfig.src.includes('firebase-firestore') && typeof firebase.firestore === 'function') {
            window.firestore = firebase.firestore();
          }
        } catch (error) {
          console.warn('[LOADER] Firestore init warning:', error);
        }
        resolve();
      };
      script.onerror = () => reject(new Error(`No se pudo cargar ${moduleConfig.src}`));
      document.head.appendChild(script);
    });
  }

  async function loadStage(srcs) {
    await Promise.all(srcs.map(async (src) => {
      const moduleConfig = getModuleBySrc(src);
      if (!moduleConfig) return;

      try {
        if (typeof moduleConfig.global === 'function' && moduleConfig.global()) return;
      } catch (error) {
        // Si la comprobacion falla, intentamos cargar el modulo.
      }
      await loadScriptOnce(moduleConfig);
    }));
  }

  async function loadCriticalInventoryModules() {
    // Fase 1: dependencias compartidas en paralelo.
    await loadStage(CRITICAL_STAGE_1);

    // Fase 2: motor y UI del inventario en paralelo.
    await loadStage(CRITICAL_STAGE_2);

    // Fase 3: adaptador legacy que expone loadInventory().
    await loadStage(CRITICAL_STAGE_3);
  }

  function loadSecondaryModulesInBackground() {
    const critical = new Set([
      ...CRITICAL_STAGE_1,
      ...CRITICAL_STAGE_2,
      ...CRITICAL_STAGE_3
    ]);

    const secondary = APP_MODULES.filter(moduleConfig => !critical.has(moduleConfig.src));

    // No bloquea el arranque. Los errores secundarios no deben impedir
    // que el inventario ya visible siga funcionando.
    loadStage(secondary.map(moduleConfig => moduleConfig.src)).catch(error => {
      console.warn('[LOADER] Algunos módulos secundarios no pudieron cargarse:', error);
    });
  }

  window.loadAguilaAppModules = function loadAguilaAppModules() {
    if (appModulesPromise) return appModulesPromise;

    // La promesa solo representa el BOOT CRÍTICO. Una vez resuelta,
    // los módulos secundarios comienzan en segundo plano.
    appModulesPromise = loadCriticalInventoryModules()
      .then(() => {
        loadSecondaryModulesInBackground();
      });

    return appModulesPromise;
  };
})();
