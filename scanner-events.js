// ============================================================
// Águila Inventario Pro - Scanner Events
// Configura los botones del escáner
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('📷 Configurando eventos del escáner...');

  // BOTÓN ESCÁNER EN AGREGAR
  const btnScanAdd = document.getElementById('btn-scan-add');
  if (btnScanAdd) {
    btnScanAdd.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('📷 Abriendo escáner para AGREGAR...');
      
      if (typeof window.openScanner === 'function') {
        window.openScanner((code) => {
          const input = document.getElementById('add-barcode');
          if (input) {
            input.value = code;
            console.log('✅ Código en agregar:', code);
            if (typeof showToast === 'function') {
              showToast('✅ Código detectado: ' + code, 'success');
            }
          }
        });
      }
    });
  }

  // BOTÓN ESCÁNER EN RELLENO
  const btnScanRefill = document.getElementById('btn-scan-refill');
  if (btnScanRefill) {
    btnScanRefill.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('📷 Abriendo escáner para RELLENO...');
      
      if (typeof window.openScanner === 'function') {
        window.openScanner((code) => {
          const input = document.getElementById('refill-barcode');
          if (input) {
            input.value = code;
            console.log('✅ Código en relleno:', code);
            
            if (typeof window.searchProductForRefill === 'function') {
              window.searchProductForRefill(code);
            }
            
            if (typeof showToast === 'function') {
              showToast('✅ Código detectado: ' + code, 'success');
            }
          }
        });
      }
    });
  }

  // BOTÓN ESCÁNER EN AUDITORÍA
  const btnScanAudit = document.getElementById('btn-scan-audit');
  if (btnScanAudit) {
    btnScanAudit.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('📷 Abriendo escáner para AUDITORÍA...');
      
      if (typeof window.openScanner === 'function') {
        window.openScanner((code) => {
          const input = document.getElementById('audit-barcode');
          if (input) {
            input.value = code;
            console.log('✅ Código en auditoría:', code);
            
            if (typeof window.buscarProductoAudit === 'function') {
              window.buscarProductoAudit();
            }
            
            if (typeof showToast === 'function') {
              showToast('✅ Código detectado: ' + code, 'success');
            }
          }
        });
      }
    });
  }

  console.log('✅ Eventos del escáner configurados');
});