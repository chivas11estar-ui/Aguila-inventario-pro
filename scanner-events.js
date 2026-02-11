// ============================================================
// Águila Inventario Pro - Scanner Events
// Configura los botones del escáner (v2 - compatible con modo continuo)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  console.log('📷 Configurando eventos del escáner (v2)...');

  // 1. BOTÓN ESCÁNER EN "AGREGAR"
  const btnScanAdd = document.getElementById('btn-scan-add');
  if (btnScanAdd) {
    btnScanAdd.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.openScanner === 'function') {
        window.openScanner({
          onScan: (code) => {
            const input = document.getElementById('add-barcode');
            if (input) {
              input.value = code;
              if (typeof window.buscarProductoParaAgregar === 'function') {
                window.buscarProductoParaAgregar(code);
              }
              if (typeof showToast === 'function') showToast('✅ Código detectado', 'success');
            }
          },
          continuous: false // Modo de escaneo único
        });
      }
    });
  }

  // 2. BOTÓN ESCÁNER EN "RELLENO"
  const btnScanRefill = document.getElementById('btn-scan-refill');
  if (btnScanRefill) {
    btnScanRefill.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.openScanner === 'function') {
        window.openScanner({
          onScan: (code) => {
            const input = document.getElementById('refill-barcode');
            if (input) {
              input.value = code;
              if (typeof window.searchProductForRefill === 'function') {
                window.searchProductForRefill(code);
              }
            }
          },
          continuous: false // Modo de escaneo único
        });
      }
    });
  }

  // 3. BOTÓN ESCÁNER EN "AUDITORÍA" (MODO NORMAL)
  const btnScanAudit = document.getElementById('btn-scan-audit');
  if (btnScanAudit) {
    btnScanAudit.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.openScanner === 'function') {
        window.openScanner({
          onScan: (code) => {
            const input = document.getElementById('audit-barcode');
            if (input) {
              input.value = code;
              if (typeof window.buscarProductoAudit === 'function') {
                window.buscarProductoAudit();
              }
            }
          },
          continuous: false // Modo de escaneo único
        });
      }
    });
  }

  console.log('✅ Eventos del escáner (v2) configurados correctamente');
});
