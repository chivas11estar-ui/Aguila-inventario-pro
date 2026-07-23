/**
 * Águila Pro - Hybrid Search Controller
 * Gestión de búsqueda por texto y escáner unificado.
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.SearchController = {
    initializedContainers: new Set(),

    renderGlobalSearch(containerId) {
        if (this.initializedContainers.has(containerId)) {
            console.log("ℹ️ [SearchController] Buscador ya inyectado.");
            return;
        }

        const container = document.getElementById(containerId);
        if (!container) return;

        const searchHTML = `
            <div class="search-panel">
              <div class="search-wrapper">
                <span class="material-icons-round search-icon" aria-hidden="true">search</span>
                <input type="text" id="global-search-input"
                       placeholder="Buscar nombre, marca o código"
                       inputmode="search" autocomplete="off" class="search-input-pro"
                       aria-label="Buscar producto por nombre, marca o código">
                <button type="button" id="btn-clear-search" class="search-clear-btn" aria-label="Limpiar búsqueda" hidden>
                  <span class="material-icons-round">close</span>
                </button>
                <button type="button" id="btn-trigger-scan" class="search-scan-btn" aria-label="Escanear código">
                  <span class="material-icons-round">qr_code_scanner</span>
                </button>
              </div>
              <p id="search-results-summary" class="search-results-summary" aria-live="polite">Busca por nombre, marca o código de barras.</p>
            </div>
            <div id="quick-scanner-overlay" class="hidden-scanner">
                <video id="search-video-feed" playsinline muted></video>
                <div class="scan-target-box">
                    <div class="scan-laser"></div>
                </div>
                <button id="btn-close-quick-scan" class="close-scan-btn">✕</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', searchHTML);
        this.initializedContainers.add(containerId);
        this.setupListeners();
    },

    setupListeners() {
        const input = document.getElementById('global-search-input');
        const btn = document.getElementById('btn-trigger-scan');
        const clearBtn = document.getElementById('btn-clear-search');
        const summary = document.getElementById('search-results-summary');
        const video = document.getElementById('search-video-feed');
        const overlay = document.getElementById('quick-scanner-overlay');
        const closeBtn = document.getElementById('btn-close-quick-scan');

        if (!input || !btn || !clearBtn || !summary || !video || !overlay) return;

        const updateSummary = (term) => {
            const cleanTerm = String(term || '').trim();
            const products = (window.INVENTORY_STATE && window.INVENTORY_STATE.productosFiltrados) || [];
            clearBtn.hidden = !cleanTerm;
            summary.textContent = cleanTerm
                ? `${products.length} resultado${products.length === 1 ? '' : 's'} para “${cleanTerm}”.`
                : 'Busca por nombre, marca o código de barras.';
        };

        // Búsqueda por texto con debounce (300ms) para evitar re-renders excesivos
        let searchTimeout;
        input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (typeof window.setSearchTerm === 'function') {
                    window.setSearchTerm(e.target.value);
                }
                updateSummary(e.target.value);
            }, 300);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
        });

        // Disparar Escáner (V4.2 - Bridge Integrado)
        btn.addEventListener('click', async () => {
            if (typeof window.openScanner === 'function') {
                window.openScanner((code) => {
                    // Puente de datos: Inyectar código en buscador
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
            } else {
                // Fallback si no está el bridge (Modo In-Line Legacy)
                overlay.classList.remove('hidden-scanner');
                overlay.classList.add('visible-scanner');

                const ready = await window.ScannerService.requestCamera(video);
                if (ready) {
                    window.ScannerService.scan((code) => {
                        if (window.bridgeScanToSearch) {
                            window.bridgeScanToSearch(code);
                        }
                        this.closeScanner(overlay);
                    });
                }
            }
        });
        closeBtn.addEventListener('click', () => this.closeScanner(overlay));
    },

    closeScanner(overlay) {
        overlay.classList.remove('visible-scanner');
        overlay.classList.add('hidden-scanner');
        if (window.ScannerService && typeof window.ScannerService.stop === 'function') {
            window.ScannerService.stop();
        }
    }
};

/**
 * BRIDGE: Conecta el escáner con el filtrado global de la lista
 */
window.bridgeScanToSearch = function(code) {
    const input = document.getElementById('global-search-input');
    if (input) {
        input.value = code;
        // IMPORTANTE: Disparar evento para que el filtro de inventory.js reaccione
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof showToast === 'function') showToast(`🎯 Producto: ${code}`, "success");
    }
};
