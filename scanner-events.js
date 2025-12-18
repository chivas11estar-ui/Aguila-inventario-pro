// ============================================================
// Águila Inventario Pro - Scanner Events (BRIDGE)
// Conecta los botones con la lógica de negocio.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📷 Configurando botones del escáner...');

  // Función auxiliar segura
  function bindScanner(btnId, inputId, callbackName) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (typeof window.openScanner !== 'function') {
        alert('Error: El módulo de cámara (scanner-mlkit.js) no cargó.');
        return;
      }

      window.openScanner((code) => {
        // 1. Poner código en el input
        const input = document.getElementById(inputId);
        if (input) input.value = code;

        // 2. Ejecutar la lógica específica
        if (typeof window[callbackName] === 'function') {
          window[callbackName](code);
        } else {
          console.warn(`⚠️ Función ${callbackName} no existe aún.`);
        }
      });
    });
  }

  // 1. Pestaña AGREGAR
  bindScanner('btn-scan-add', 'add-barcode', 'buscarProductoParaAgregar');

  // 2. Pestaña RELLENO
  bindScanner('btn-scan-refill', 'refill-barcode', 'searchProductForRefill');

  // 3. Pestaña AUDITORÍA
  bindScanner('btn-scan-audit', 'audit-barcode', 'buscarProductoAudit');
  
});