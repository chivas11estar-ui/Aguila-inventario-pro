/**
 * Águila Pro - Hybrid Search Controller
 * Gestión de búsqueda por texto y escáner unificado.
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.SearchController = {
    isInitialized: false,

    renderGlobalSearch(containerId) {
        if (this.isInitialized) {
            console.log("ℹ️ [SearchController] Buscador ya inyectado.");
            return;
        }

        const container = document.getElementById(containerId);
        if (!container) return;

        const searchHTML = `
            <div class="search-wrapper">
                <input type="text" id="global-search-input" 
                       placeholder="🔍 Buscar por nombre o código..." 
                       inputmode="text" class="search-input-pro">
                <button id="btn-trigger-scan" class="search-scan-btn">
                    <span class="material-icons-round">qr_code_scanner</span>
                </button>
            </div>
            <div id="quick-scanner-overlay" class="hidden-scanner">
                <video id="search-video-feed" playsinline muted></video>
                <div class="scan-target-box">
                    <div class="scan-laser"></div>
                </div>
                <button id="btn-close-quick-scan" class="close-scan-btn">✕</button>
            </div>
        `;

        container.insertAdjacentHTML('afterbegin', searchHTML);
        this.isInitialized = true;
        this.setupListeners();
    },

    setupListeners() {
        const input = document.getElementById('global-search-input');
        const btn = document.getElementById('btn-trigger-scan');
        const video = document.getElementById('search-video-feed');
        const overlay = document.getElementById('quick-scanner-overlay');
        const closeBtn = document.getElementById('btn-close-quick-scan');

        if (!input || !btn || !video || !overlay) return;

        // Búsqueda por texto (Bridge directo a inventory.js)
        input.addEventListener('input', (e) => {
            if (typeof window.setSearchTerm === 'function') {
                window.setSearchTerm(e.target.value);
            }
        });

        // Disparar Escáner
        btn.addEventListener('click', async () => {
            overlay.classList.remove('hidden-scanner');
            overlay.classList.add('visible-scanner');
            
            const ready = await window.ScannerService.requestCamera(video);
            if (ready) {
                window.ScannerService.scan((code) => {
                    // Puente de datos: Inyectar código en buscador
                    if (window.bridgeScanToSearch) {
                        window.bridgeScanToSearch(code);
                    }
                    this.closeScanner(overlay);
                });
            }
        });

        closeBtn.addEventListener('click', () => this.closeScanner(overlay));
    },

    closeScanner(overlay) {
        overlay.classList.remove('visible-scanner');
        overlay.classList.add('hidden-scanner');
        window.ScannerService.stop();
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
