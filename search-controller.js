/**
 * Águila Pro - Hybrid Search Controller
 * Gestión de búsqueda por texto y escáner unificado.
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.SearchController = {
    renderGlobalSearch(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Limpiar búsqueda anterior si existe
        const existing = document.querySelector('.search-wrapper');
        if (existing) existing.remove();

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

        // Insertar al inicio del contenedor
        container.insertAdjacentHTML('afterbegin', searchHTML);

        this.setupListeners();
    },

    setupListeners() {
        const input = document.getElementById('global-search-input');
        const btn = document.getElementById('btn-trigger-scan');
        const video = document.getElementById('search-video-feed');
        const overlay = document.getElementById('quick-scanner-overlay');
        const closeBtn = document.getElementById('btn-close-quick-scan');

        if (!input || !btn || !video || !overlay) return;

        // Búsqueda por texto (Filtrado local)
        input.addEventListener('input', (e) => {
            if (typeof window.setSearchTerm === 'function') {
                window.setSearchTerm(e.target.value);
            }
        });

        // Disparar Escáner
        btn.addEventListener('click', async () => {
            console.log("🚀 [SearchController] Iniciando escaneo rápido...");
            overlay.classList.remove('hidden-scanner');
            overlay.classList.add('visible-scanner');
            
            const ready = await window.ScannerService.requestCamera(video);
            if (ready) {
                window.ScannerService.scan((code) => {
                    input.value = code;
                    this.closeScanner(overlay);
                    if (typeof window.setSearchTerm === 'function') {
                        window.setSearchTerm(code);
                    }
                    if (typeof showToast === 'function') showToast(`Escaneado: ${code}`, "success");
                });
            }
        });

        // Cerrar Escáner
        closeBtn.addEventListener('click', () => this.closeScanner(overlay));
    },

    closeScanner(overlay) {
        overlay.classList.remove('visible-scanner');
        overlay.classList.add('hidden-scanner');
        window.ScannerService.stop();
    }
};
