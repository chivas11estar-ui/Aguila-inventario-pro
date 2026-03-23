/**
 * Águila Pro - ScannerService (Singleton Persistent Bridge)
 * V6.2 - Auto-Healing & Global Shield
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.ScannerService = {
    persistentStream: null,
    detector: null,
    activeVideoElement: null,
    isScanning: false,

    /**
     * Solicita cámara y CREA el elemento video si no existe en el contenedor.
     */
    async requestCamera(target) {
        console.log("📷 [ScannerService] Solicitando hardware...");
        
        let videoElement = (target instanceof HTMLElement) ? target : document.querySelector(target);
        
        // Si el target es un div (contenedor), buscar o crear video dentro
        if (videoElement && videoElement.tagName !== 'VIDEO') {
            let internalVideo = videoElement.querySelector('video');
            if (!internalVideo) {
                console.log("🎥 [ScannerService] Creando elemento video dinámico...");
                internalVideo = document.createElement('video');
                internalVideo.setAttribute('autoplay', '');
                internalVideo.setAttribute('playsinline', '');
                internalVideo.muted = true;
                internalVideo.style.cssText = "width:100%; height:100%; object-fit:cover; background:#000;";
                videoElement.prepend(internalVideo);
            }
            videoElement = internalVideo;
        }

        if (!videoElement) {
            console.error("❌ [ScannerService] No se encontró target válido.");
            return false;
        }

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
            if (typeof window.showToast === 'function') window.showToast("Permiso de cámara denegado", "error");
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
                try {
                    await videoElement.play();
                    this.initDetector();
                    resolve(true);
                } catch (e) {
                    resolve(false);
                }
            };
        });
    },

    initDetector() {
        if (!this.detector && 'BarcodeDetector' in window) {
            this.detector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] });
        }
    },

    async scan(callback) {
        this.isScanning = true;
        const loop = async () => {
            if (!this.isScanning || !this.activeVideoElement || this.activeVideoElement.paused) return;
            try {
                if (this.detector) {
                    const barcodes = await this.detector.detect(this.activeVideoElement);
                    if (barcodes.length > 0) {
                        callback(barcodes[0].rawValue);
                        if (navigator.vibrate) navigator.vibrate(50);
                        this.isScanning = false;
                        return; 
                    }
                }
            } catch (e) {}
            requestAnimationFrame(loop);
        };
        loop();
    },

    stopDataFlow() {
        this.isScanning = false;
    }
};

/**
 * BRIDGE GLOBAL BLINDADO
 */
Object.defineProperty(window, 'openScanner', {
    value: async function(callback) {
        console.log("🚀 [Bridge] openScanner invocado.");
        const modal = document.getElementById('scanner-modal');
        const video = document.getElementById('scanner-video');
        
        if (!modal || !video) {
            console.error("❌ Elementos del modal no encontrados.");
            return;
        }

        modal.classList.remove('hidden');
        const ready = await window.ScannerService.requestCamera(video);
        
        if (ready) {
            window.ScannerService.scan((code) => {
                if (callback) callback(code);
                if (window.bridgeScanToSearch) window.bridgeScanToSearch(code);
                
                if (!window.AUDIT_PRO || !window.AUDIT_PRO.continuousMode) {
                    modal.classList.add('hidden');
                    window.ScannerService.stopDataFlow();
                }
            });
        }
    },
    writable: false, // Evita sobreescritura
    configurable: true
});

console.log('✅ [SCANNER] Motor V6.2 (Auto-Healing) desplegado.');
