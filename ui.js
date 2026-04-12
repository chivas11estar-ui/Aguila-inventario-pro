// ============================================================
// Águila Inventario Pro - Módulo: ui.js (FINAL)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// DEFINICIÓN GLOBAL Y SEGURA DE showToast
// ============================================================
window.showToast = function(message, type = 'info') {
  console.log('[TOAST]', type.toUpperCase(), '→', message);
  
  const containerId = 'app-toast-container';
  let container = document.getElementById(containerId);
  
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99998;display:flex;flex-direction:column;gap:10px;max-width:400px;';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    background: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    border-left: 4px solid ${getToastColor(type)};
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:all 0.3s ease-out;';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
  
  toast.addEventListener('click', () => {
    toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:all 0.3s ease-out;';
    setTimeout(() => toast.remove(), 300);
  });
};

function getToastColor(type) {
  const colors = {
    'success': '#10b981',
    'error': '#ef4444',
    'warning': '#f59e0b',
    'info': '#004aad'
  };
  return colors[type] || colors['info'];
}

// ============================================================
// MANEJO DE TABS
// ============================================================
function setupTabs() {
  const navItems = document.querySelectorAll('[data-tab]');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.getAttribute('data-tab');
      
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      
      document.querySelectorAll('[data-tab]').forEach(nav => {
        nav.classList.remove('active');
      });
      
      const tabElement = document.getElementById('tab-' + tabName);
      if (tabElement) {
        tabElement.classList.add('active');
        // RECONEXIÓN CALIENTE: Si la pestaña tiene un video, reconectar el stream persistente
        refreshCameraOnTabChange(tabName);
      }
      
      item.classList.add('active');
      
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.remove('active');
      }
      
      console.log('📑 Tab activado:', tabName);
    });
  });
}

/**
 * Asegura que el video se mantenga reproduciendo al cambiar de pestaña (Hot-Swap)
 */
function refreshCameraOnTabChange(tabName) {
    if (!window.ScannerService || !window.ScannerService.persistentStream) return;

    // Buscar si hay un video en la pestaña activa
    const activeTab = document.getElementById('tab-' + tabName);
    const video = activeTab?.querySelector('video');

    if (video) {
        console.log(`🔗 [UI] Reconectando cámara a la pestaña: ${tabName}`);
        window.ScannerService.attachToElement(video);
    }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initUI() {
  console.log('🎨 Inicializando UI...');
  
  setupTabs();
  connectGlobalScanButtons();
  
  console.log('✅ UI inicializado correctamente');
}

/**
 * Conector Global de Eventos de Cámara (Bridge V4.2)
 * Asegura que todos los botones de escaneo tengan un comportamiento consistente.
 */
function connectGlobalScanButtons() {
    // 1. Botón pestaña AÑADIR
    document.getElementById('btn-scan-add')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openScanner((code) => {
            const input = document.getElementById('add-barcode');
            if (input) {
                input.value = code;
                // Disparar eventos para activar validaciones y búsquedas automáticas
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.focus();

                // Si existe una función para buscar en "Agregar", llamarla
                if (typeof window.buscarProductoParaAgregar === 'function') {
                    window.buscarProductoParaAgregar(code);
                } else if (typeof window.buscarProductoPorCodigo === 'function') {
                    // Fallback: verificar si ya existe el producto
                    window.buscarProductoPorCodigo(code).then(prod => {
                        if (prod && prod._exists) {
                            showToast(`📦 Producto existente: ${prod.nombre}`, 'info');
                            if (document.getElementById('add-product-name')) {
                                document.getElementById('add-product-name').value = prod.nombre || '';
                            }
                            if (document.getElementById('add-brand')) {
                                document.getElementById('add-brand').value = prod.marca || '';
                            }
                        }
                    });
                }
            }
        });
    });

    // 2. Botón pestaña RELLENAR
    document.getElementById('btn-scan-refill')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openScanner((code) => {
            const input = document.getElementById('refill-barcode');
            if (input) {
                input.value = code;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.focus();

                // Prioridad a refill-safe.js
                if (typeof window.searchProductForRefillSafe === 'function') {
                    window.searchProductForRefillSafe(code);
                } else if (typeof window.searchProductForRefill === 'function') {
                    window.searchProductForRefill(code);
                }
            }
        });
    });

    // 3. Botón pestaña AUDITORÍA (Modo Normal)
    document.getElementById('btn-scan-audit')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openScanner((code) => {
            const input = document.getElementById('audit-barcode');
            if (input) {
                input.value = code;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                // Llamar a la búsqueda de auditoría
                if (typeof window.buscarProductoAudit === 'function') {
                    window.buscarProductoAudit();
                }
            }
        });
    });

    // 4. Botón Búsqueda Global (Si existe el ID)
    document.getElementById('btn-trigger-scan')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openScanner((code) => {
            if (window.bridgeScanToSearch) {
                window.bridgeScanToSearch(code);
            } else {
                const input = document.getElementById('global-search-input');
                if (input) {
                    input.value = code;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    });

    // 5. Botón cerrar modal (APAGADO FÍSICO DE HARDWARE)
    document.getElementById('close-scanner')?.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Ejecutar HARD STOP para liberar hardware y GPU
        if (window.ScannerService && typeof window.ScannerService.hardStop === 'function') {
            window.ScannerService.hardStop();
        } else if (window.ScannerService) {
            window.ScannerService.stop(); // Fallback
        }

        const modal = document.getElementById('scanner-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('active');
        }
        
        console.log("📷 [UI] Cámara apagada y recursos liberados.");
    });
}

// ============================================================
// MONITOREAR CONEXIÓN
// ============================================================
window.addEventListener('online', () => {
  showToast('✅ Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
  showToast('📡 Sin conexión a internet', 'warning');
});

// ============================================================
// INICIAR CUANDO DOM ESTÉ LISTO
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.log('✅ ui.js cargado correctamente');