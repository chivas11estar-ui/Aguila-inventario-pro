/**
 * Águila Pro - ScannerService (Singleton Persistent Bridge)
 * V6.1 - Reparación de Referencias Globales
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

// 1. Definición del Servicio Maestro
window.ScannerService = {
    persistentStream: null,
    detector: null,
    activeVideoElement: null,
    isScanning: false,

    async requestCamera(videoElement) {
        console.log("📷 [ScannerService] Petición de hardware recibida.");
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
            this.detector = new BarcodeDetector({ 
                formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] 
            });
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
    },

    hardStop() {
        this.isScanning = false;
        if (this.persistentStream) {
            this.persistentStream.getTracks().forEach(track => track.stop());
            this.persistentStream = null;
        }
    }
};

// 2. PUENTE DE COMPATIBILIDAD (Para evitar el error 'undefined')
window.SCANNER_MLKIT = {
    ensureScannerReady: async () => await window.ScannerService.requestCamera(document.createElement('video')),
    startContinuous: (cb) => window.ScannerService.scan(cb),
    stop: () => window.ScannerService.stopDataFlow()
};

console.log('✅ [SCANNER] Motor Persistent Bridge V6.1 cargado.');
