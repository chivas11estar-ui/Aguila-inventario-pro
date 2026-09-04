// ============================================================
// Aguila Inventario Pro - carga diferida de la app autenticada
// Mantiene ligera la pantalla publica de login para moviles.
// ============================================================

'use strict';

(function setupAguilaAppLoader() {
  if (window.loadAguilaAppModules) return;

  // ============================================================
  // OPTIMIZACIÓN DE CARGA
  // - Las librerías pesadas no usadas en el arranque (chart.js,
  //   crypto-js, firestore) se retiran: el cliente no las utiliza.
  // - xlsx se carga bajo demanda únicamente al exportar el reporte
  //   (ver window.ensureAguilaXLSX y analytics.js).
  // - Los módulos propios (mismo origin) se cargan en PARALELO en
  //   lugar de secuencialmente para reducir el tiempo de arranque.
  //   inventory-ui.js depende de inventory.js + search-controller.js
  //   y analytics-ui.js de analytics.js, por lo que van en fase 2.
  // ============================================================

  // Librería diferida (solo bajo demanda)
  const XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';

  // Fase 1: módulos base (mismo origin), cargados en paralelo.
  const CORE_MODULES = [
    'security-utils.js?v=1.2',
    'ui.js?v=1.9',
    'listener-manager.js?v=1.0',
    'inventory-core.js?v=5.5',
    'scanner-mlkit.js?v=7.2',
    'refill-safe.js?v=6.4',
    'inventory.js?v=3.3',
    'search-controller.js?v=1.1',
    'lote-mover.js?v=1.1',
    'app.js?v=2.3',
    'audit.js?v=3.1',
    'system.js?v=1.3',
    'system-events.js?v=1.3',
    'weather.js?v=1.7',
    'profile.js?v=1.8',
    'profile-ui.js?v=2.3',
    'analytics.js?v=1.9',
    'ai-phrases.js?v=1.6',
    'phrases.js?v=1.4',
    'migrate-to-v2.js?v=2.1',
    'ai-phrases-enhanced.js?v=1.1'
  ];

  // Fase 2: módulos que dependen de la fase 1 (también en paralelo entre sí).
  const DEPENDENT_MODULES = [
    'inventory-ui.js?v=3.2',
    'analytics-ui.js?v=2.0'
  ];

  let appModulesPromise = null;

  function loadScriptOnce(src) {
    const existing = document.querySelector(`script[data-aguila-src="${src}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.dataset.aguilaSrc = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }

  // Carga bajo demanda de XLSX (solo cuando se exporta el reporte).
  window.ensureAguilaXLSX = async function ensureAguilaXLSX() {
    if (window.XLSX) return;
    await loadScriptOnce(XLSX_SRC);
  };

  window.loadAguilaAppModules = function loadAguilaAppModules() {
    if (appModulesPromise) return appModulesPromise;

    appModulesPromise = (async () => {
      await Promise.all(CORE_MODULES.map(loadScriptOnce));
      await Promise.all(DEPENDENT_MODULES.map(loadScriptOnce));
    })();

    return appModulesPromise;
  };
})();
