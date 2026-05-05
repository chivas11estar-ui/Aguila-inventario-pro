/**
 * Águila Pro - ScannerService (Singleton Persistent Bridge)
 * V6.3 - Unified API & Crash Fix
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.ScannerService = {
    persistentStream: null,
    detector: null,
    activeVideoElement: null,
    isScanning: false,

    async requestCamera(target) {
        console.log("📷 [ScannerService] Solicitando hardware...");
        
        let videoElement = (target instanceof HTMLElement) ? target : document.querySelector(target);
        
        if (videoElement && videoElement.tagName !== 'VIDEO') {
            let internalVideo = videoElement.querySelector('video');
            if (!internalVideo) {
                internalVideo = document.createElement('video');
                internalVideo.setAttribute('autoplay', '');
                internalVideo.setAttribute('playsinline', '');
                internalVideo.muted = true;
                internalVideo.style.cssText = "width:100%; height:100%; object-fit:cover; background:#000;";
                videoElement.prepend(internalVideo);
            }
            videoElement = internalVideo;
        }

        if (!videoElement) return false;

        if (this.persistentStream && this.persistentStream.active) {
            return await this.attachToElement(videoElement);
        }

        try {
            this.persistentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            return await this.attachToElement(videoElement);
        } catch (err) {
            console.error("❌ [ScannerService] Error WebRTC:", err);
            return false;
        }
    },

    async attachToElement(videoElement) {
        if (!this.persistentStream || !videoElement) return false;
        if (this.activeVideoElement && this.activeVideoElement !== videoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
        }
        videoElement.srcObject = this.persistentStream;
        this.activeVideoElement = videoElement;
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = async () => {
                try { await videoElement.play(); this.initDetector(); resolve(true); } catch (e) { resolve(false); }
            };
        });
    },

    initDetector() {
        if (!this.detector && 'BarcodeDetector' in window) {
            this.detector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] });
        }
    },

    async scan(callback) {
        if (!this.detector && !('BarcodeDetector' in window)) {
            console.error("❌ BarcodeDetector no disponible en este navegador.");
            if (typeof showToast === 'function') showToast("⚠️ Tu navegador no soporta el escáner nativo", "error");
            this.isScanning = false;
            return;
        }
        
        this.isScanning = true;
        const loop = async () => {
            if (!this.isScanning || !this.activeVideoElement || this.activeVideoElement.paused) return;
            try {
                if (this.detector) {
                    const barcodes = await this.detector.detect(this.activeVideoElement);
                    if (barcodes.length > 0) {
                        const code = barcodes[0].rawValue;
                        console.log("🎯 Código detectado:", code);
                        
                        if (navigator.vibrate) navigator.vibrate(50);
                        
                        callback(code);
                        
                        if (!window.ScannerService.continuousMode) {
                            this.isScanning = false;
                            return; 
                        }
                    }
                }
            } catch (e) {
                console.warn("⚠️ Error en ciclo de escaneo:", e);
            }
            if (this.isScanning) requestAnimationFrame(loop);
        };
        loop();
    },

    // ALIAS DE COMPATIBILIDAD
    stop() {
        this.isScanning = false;
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
        }
        console.log("⏸️ [ScannerService] Flujo detenido.");
    },

    stopDataFlow() { this.stop(); },

    /**
     * MÉTODO HARD-STOP (Mobile Optimization)
     * Apaga físicamente el hardware de la cámara y libera el buffer de la GPU.
     */
    hardStop() {
        console.log("🛑 [ScannerService] Apagando hardware de cámara...");
        
        // 1. Detener el ciclo de detección
        this.isScanning = false;
        
        // 2. Limpiar el elemento de video (Libera buffer GPU)
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
            this.activeVideoElement.load(); // Fuerza limpieza del buffer
            this.activeVideoElement = null;
        }
        
        // 3. Matar físicamente los tracks del MediaStream
        if (this.persistentStream) {
            const tracks = this.persistentStream.getTracks();
            tracks.forEach(track => {
                track.stop();
                console.log(`✅ Track detenido: ${track.kind}`);
            });
            this.persistentStream = null;
        }

        console.log("🔋 Hardware liberado correctamente.");
    }
};

/**
 * BRIDGE GLOBAL BLINDADO
 * Soporta: 
 * 1. openScanner(callback)
 * 2. openScanner({ onScan: callback, continuous: bool })
 */
Object.defineProperty(window, 'openScanner', {
    value: async function(args) {
        const modal = document.getElementById('scanner-modal');
        const video = document.getElementById('scanner-video');
        if (!modal || !video) {
            console.error("❌ No se encontró el modal o video del escáner");
            return;
        }

        // Determinar callback y modo
        let callback = typeof args === 'function' ? args : (args?.onScan || null);
        window.ScannerService.continuousMode = args?.continuous || false;

        if (!callback) {
            console.error("❌ openScanner requiere un callback");
            return;
        }

        modal.classList.remove('hidden');
        modal.classList.add('active'); // Por si se usa CSS para mostrarlo

        const ready = await window.ScannerService.requestCamera(video);
        if (ready) {
            window.ScannerService.scan((code) => {
                callback(code);
                
                // Si hay un puente global para búsqueda (analytics/etc)
                if (window.bridgeScanToSearch) window.bridgeScanToSearch(code);

                // Auto-cerrar si no es modo continuo (HARD STOP para liberar hardware)
                if (!window.ScannerService.continuousMode) {
                    modal.classList.add('hidden');
                    modal.classList.remove('active');
                    if (window.ScannerService.hardStop) {
                        window.ScannerService.hardStop();
                    } else {
                        window.ScannerService.stop();
                    }
                }
            });
        } else {
            if (typeof showToast === 'function') showToast("❌ No se pudo acceder a la cámara", "error");
            modal.classList.add('hidden');
        }
    },
    writable: false,
    configurable: true
});

console.log('✅ [SCANNER] Motor V6.3 (API Unified) desplegado.');
