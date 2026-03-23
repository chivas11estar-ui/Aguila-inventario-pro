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

    // ALIAS DE COMPATIBILIDAD PARA EL ERROR DE CONSOLA
    stop() {
        this.isScanning = false;
        console.log("⏸️ [ScannerService] Flujo detenido.");
    },

    stopDataFlow() { this.stop(); },

    hardStop() {
        this.stop();
        if (this.persistentStream) {
            this.persistentStream.getTracks().forEach(track => track.stop());
            this.persistentStream = null;
        }
    }
};

/**
 * BRIDGE GLOBAL BLINDADO
 */
Object.defineProperty(window, 'openScanner', {
    value: async function(callback) {
        const modal = document.getElementById('scanner-modal');
        const video = document.getElementById('scanner-video');
        if (!modal || !video) return;
        modal.classList.remove('hidden');
        const ready = await window.ScannerService.requestCamera(video);
        if (ready) {
            window.ScannerService.scan((code) => {
                if (callback) callback(code);
                if (window.bridgeScanToSearch) window.bridgeScanToSearch(code);
                if (!window.AUDIT_PRO || !window.AUDIT_PRO.continuousMode) {
                    modal.classList.add('hidden');
                    window.ScannerService.stop();
                }
            });
        }
    },
    writable: false,
    configurable: true
});

console.log('✅ [SCANNER] Motor V6.3 (API Unified) desplegado.');
