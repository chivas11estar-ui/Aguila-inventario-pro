// ============================================================
// Ãguila Inventario Pro - MÃ³dulo: ui.js (FINAL)
// Copyright Â© 2025 JosÃ© A. G. Betancourt
// ============================================================

// ============================================================
// DEFINICIÃ“N GLOBAL Y SEGURA DE showToast
// ============================================================
window.showToast = function(message, type = 'info') {
  console.log('[TOAST]', type.toUpperCase(), 'â†’', message);
  
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
    background: var(--card-bg);
    color: var(--text);
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    border-left: 4px solid ${getToastColor(type)};
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
    border: 1px solid var(--border);
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

      if (typeof window.switchTab === 'function') {
        window.switchTab(tabName);
        refreshCameraOnTabChange(tabName);
        console.log('Tab activado:', tabName);
        return;
      }
      
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('hidden');
      });
      
      document.querySelectorAll('[data-tab]').forEach(nav => {
        nav.classList.remove('active');
      });
      
      const tabElement = document.getElementById('tab-' + tabName);
      if (tabElement) {
        tabElement.classList.remove('hidden');
        tabElement.classList.add('active');
        refreshCameraOnTabChange(tabName);
      }
      
      item.classList.add('active');
      
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.remove('active');
      }
      
      console.log('Tab activado:', tabName);
    });
  });
}
/**
 * Asegura que el video se mantenga reproduciendo al cambiar de pestaÃ±a (Hot-Swap)
 */
function refreshCameraOnTabChange(tabName) {
    if (!window.ScannerService || !window.ScannerService.persistentStream) return;

    // Buscar si hay un video en la pestaÃ±a activa
    const activeTab = document.getElementById('tab-' + tabName);
    const video = activeTab?.querySelector('video');

    if (video) {
        console.log(`ðŸ”— [UI] Reconectando cÃ¡mara a la pestaÃ±a: ${tabName}`);
        window.ScannerService.attachToElement(video);
    }
}

// ============================================================
// INICIALIZACIÃ“N
// ============================================================
function initUI() {
  console.log('ðŸŽ¨ Inicializando UI...');
  
  setupTabs();
  connectGlobalScanButtons();
  enhanceQuantityInputs();
  
  console.log('âœ… UI inicializado correctamente');
}

function enhanceQuantityInputs() {
  ['refill-boxes', 'refill-pieces', 'audit-boxes'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input || input.dataset.aguilaStepper === 'true') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'aguila-stepper';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'aguila-stepper-btn';
    minus.setAttribute('aria-label', 'Disminuir');
    minus.innerHTML = '<span class="material-icons-round">remove</span>';

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'aguila-stepper-btn';
    plus.setAttribute('aria-label', 'Aumentar');
    plus.innerHTML = '<span class="material-icons-round">add</span>';

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(minus);
    wrapper.appendChild(input);
    wrapper.appendChild(plus);
    input.dataset.aguilaStepper = 'true';

    const stepBy = (delta) => {
      const current = parseFloat(input.value) || 0;
      const min = input.min !== '' ? parseFloat(input.min) : 0;
      const next = Math.max(min, current + delta);
      input.value = Number.isInteger(next) ? String(next) : next.toFixed(2);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    minus.addEventListener('click', () => stepBy(-1));
    plus.addEventListener('click', () => stepBy(1));
  });
}

window.enhanceQuantityInputs = enhanceQuantityInputs;

/**
 * Conector Global de Eventos de CÃ¡mara (Bridge V4.2)
 * Asegura que todos los botones de escaneo tengan un comportamiento consistente.
 */
function connectGlobalScanButtons() {
    // 1. BotÃ³n pestaÃ±a AÃ‘ADIR
    document.getElementById('btn-scan-add')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openScanner((code) => {
            const input = document.getElementById('add-barcode');
            if (input) {
                input.value = code;
                // Disparar eventos para activar validaciones y bÃºsquedas automÃ¡ticas
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.focus();

                // Si existe una funciÃ³n para buscar en "Agregar", llamarla
                if (typeof window.buscarProductoParaAgregar === 'function') {
                    window.buscarProductoParaAgregar(code);
                } else if (typeof window.buscarProductoPorCodigo === 'function') {
                    // Fallback: verificar si ya existe el producto
                    window.buscarProductoPorCodigo(code).then(prod => {
                        if (prod && prod._exists) {
                            showToast(`ðŸ“¦ Producto existente: ${prod.nombre}`, 'info');
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

    // 2. BotÃ³n pestaÃ±a RELLENAR
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

    // 3. BotÃ³n pestaÃ±a AUDITORÃA (Modo Normal)
    document.getElementById('btn-scan-audit')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openScanner((code) => {
            const input = document.getElementById('audit-barcode');
            if (input) {
                input.value = code;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                // Llamar a la bÃºsqueda de auditorÃ­a
                if (typeof window.buscarProductoAudit === 'function') {
                    window.buscarProductoAudit();
                }
            }
        });
    });

    // 4. BotÃ³n BÃºsqueda Global (Si existe el ID)
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

    // 5. BotÃ³n cerrar modal (APAGADO FÃSICO DE HARDWARE)
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
        
        console.log("ðŸ“· [UI] CÃ¡mara apagada y recursos liberados.");
    });
}

// ============================================================
// MONITOREAR CONEXIÃ“N
// ============================================================
window.addEventListener('online', () => {
  showToast('âœ… ConexiÃ³n restaurada', 'success');
});

window.addEventListener('offline', () => {
  showToast('ðŸ“¡ Sin conexiÃ³n a internet', 'warning');
});

// ============================================================
// INICIAR CUANDO DOM ESTÃ‰ LISTO
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.log('âœ… ui.js cargado correctamente');
