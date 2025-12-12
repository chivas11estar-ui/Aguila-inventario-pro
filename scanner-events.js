// ============================================================
// Águila Inventario Pro - Scanner Events
// Configura los botones del escáner con protección avanzada
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📷 Configurando eventos del escáner...');

  // Función universal para asignar eventos de escaneo
  function setupScanner(buttonId, inputId, callbackFnName) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log(`📷 Abriendo escáner desde: ${buttonId}...`);

      if (typeof window.openScanner !== 'function') {
        console.error('❌ openScanner no está definido');
        return;
      }

      window.openScanner((code) => {
        if (!code) {
          console.warn('⚠️ Escaneo vacío o cancelado');
          return;
        }

        const input = document.getElementById(inputId);
        if (input) input.value = code;

        console.log(`✅ Código detectado (${buttonId}):`, code);

        const callback = window[callbackFnName];

        if (typeof callback === 'function') {
          callback(code);
        } else {
          console.warn(`⚠️ Falta la función ${callbackFnName}`);
        }

        if (typeof showToast === 'function') {
          showToast('📡 Código detectado', 'success');
        }
      });
    });
  }

  // ============================================================
  // CONFIGURAR LOS 3 BOTONES
  // ============================================================

  // 1. AGREGAR PRODUCTO
  setupScanner(
    'btn-scan-add',
    'add-barcode',
    'buscarProductoParaAgregar'
  );

  // 2. RELLENO
  setupScanner(
    'btn-scan-refill',
    'refill-barcode',
    'searchProductForRefill'
  );

  // 3. AUDITORÍA
  setupScanner(
    'btn-scan-audit',
    'audit-barcode',
    'buscarProductoAudit'
  );

  console.log('✅ Eventos del escáner configurados correctamente');
});