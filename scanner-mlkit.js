/**
 * Águila Inventario Pro - Módulo: scanner-mlkit.js (V3 Singleton Pro)
 * Optimizado para Auditoría masiva y cambio de pestañas.
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.SCANNER_MLKIT = (function() {
    let stream = null;
    let detector = null;
    let isReady = false;
    let readyPromise = null;
    let activeCallback = null;

    /**
     * INICIALIZACIÓN SINGLETON
     */
    async function init() {
        if (readyPromise) return readyPromise;

        readyPromise = new Promise(async (resolve, reject) => {
            try {
                console.log("📷 [SCANNER] Iniciando Singleton...");

                // 1. Soporte de Hardware
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw { name: 'NotSupportedError' };
                }

                // 2. Motor de Detección (ML Kit Nativo vs Fallback)
                if ('BarcodeDetector' in window) {
                    detector = new BarcodeDetector({ 
                        formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] 
                    });
                } else {
                    console.warn("⚠️ [SCANNER] ML Kit no nativo. Usando fallback engine.");
                    // Fallback Dummy para evitar errores de null
                    detector = { detect: async () => [] };
                }

                // 3. Captura de Cámara (Industrial Settings)
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: "environment",
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                isReady = true;
                resolve(true);

            } catch (err) {
                isReady = false;
                readyPromise = null;
                handleError(err);
                reject(err);
            }
        });

        return readyPromise;
    }

    function handleError(err) {
        let msg = "Error de cámara.";
        if (err.name === 'NotAllowedError') msg = "🚫 Activa la cámara en los ajustes del navegador.";
        if (err.name === 'NotSupportedError') msg = "❌ Navegador no compatible con escáner.";
        if (typeof showToast === 'function') showToast(msg, "error");
    }

    /**
     * LOOP DE ESCANEO RECURSIVO
     */
    async function scanLoop(video) {
        if (!isReady || !detector || !video || video.paused) return;

        try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0 && activeCallback) {
                activeCallback(barcodes[0].rawValue);
            }
        } catch (e) {
            // Silenciar errores de frames vacíos durante transición
        }

        if (window.AUDIT_PRO && window.AUDIT_PRO.state === 'SCANNING') {
            requestAnimationFrame(() => scanLoop(video));
        }
    }

    return {
        ensureScannerReady: async function() {
            return await init();
        },

        startContinuous: async function(callback) {
            await this.ensureScannerReady();
            activeCallback = callback;

            // Buscar elemento video en la zona de auditoría
            let video = document.querySelector('#audit-scanner-view video');
            
            if (!video) {
                // Crear dinámicamente si no existe
                const container = document.getElementById('audit-scanner-view');
                if (container) {
                    video = document.createElement('video');
                    video.setAttribute('autoplay', '');
                    video.setAttribute('playsinline', '');
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.objectFit = 'cover';
                    container.prepend(video);
                }
            }

            if (video) {
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play();
                    scanLoop(video);
                };
            }
        },

        stop: function() {
            activeCallback = null;
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.pause();
                v.srcObject = null;
            });
            console.log("📷 [SCANNER] Detenido.");
        }
    };
})();
