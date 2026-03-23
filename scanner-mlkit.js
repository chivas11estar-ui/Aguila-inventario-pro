/**
 * Águila Pro - ScannerService (Singleton Persistent Bridge)
 * V6 - WebRTC Stream Persistence
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.ScannerService = {
    persistentStream: null,
    detector: null,
    activeVideoElement: null,
    isScanning: false,

    /**
     * Punto de entrada único: Solicita hardware o reutiliza el stream caliente.
     */
    async requestCamera(videoElement) {
        console.log("📷 [ScannerService] Petición de cámara recibida.");

        // Caso A: Ya hay un stream activo y saludable
        if (this.persistentStream && this.persistentStream.active) {
            console.log("🔥 [ScannerService] Reutilizando Stream Caliente.");
            return await this.attachToElement(videoElement);
        }

        // Caso B: Primera vez o el stream se perdió
        try {
            this.persistentStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: "environment", 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    focusMode: "continuous"
                },
                audio: false
            });
            return await this.attachToElement(videoElement);
        } catch (err) {
            console.error("❌ [ScannerService] Error WebRTC:", err);
            return false;
        }
    },

    /**
     * Vincula el stream a un elemento sin apagar el sensor.
     */
    async attachToElement(videoElement) {
        if (!this.persistentStream || !videoElement) return false;

        // Desvincular video anterior si existe
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
                    console.log("✅ [ScannerService] Video vinculado y reproduciendo.");
                    resolve(true);
                } catch (e) {
                    console.warn("⚠️ [ScannerService] Play automático fallido:", e);
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
                        this.isScanning = false; // Detener flujo de datos tras éxito
                        return; 
                    }
                }
            } catch (e) { /* Transición de frames o video pausado */ }
            
            requestAnimationFrame(loop);
        };
        loop();
    },

    /**
     * Pausa el procesamiento de datos pero MANTIENE el hardware encendido.
     */
    stopDataFlow() {
        this.isScanning = false;
        console.log("⏸️ [ScannerService] Procesamiento de IA en pausa (Hardware encendido).");
    },

    /**
     * Único método que realmente apaga el sensor (Cierre de sesión / Salida).
     */
    hardStop() {
        console.log("🛑 [ScannerService] APAGANDO HARDWARE COMPLETAMENTE.");
        this.isScanning = false;
        if (this.persistentStream) {
            this.persistentStream.getTracks().forEach(track => track.stop());
            this.persistentStream = null;
        }
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
            this.activeVideoElement = null;
        }
    }
};

/** 
 * BRIDGE: Compatibilidad legacy
 */
window.openScanner = async function(callback) {
    const modal = document.getElementById('scanner-modal');
    const video = document.getElementById('scanner-video');
    if (!modal || !video) return;

    modal.classList.remove('hidden');
    const ready = await window.ScannerService.requestCamera(video);
    if (ready) {
        window.ScannerService.scan((code) => {
            if (callback) callback(code);
            if (window.bridgeScanToSearch) window.bridgeScanToSearch(code);
            
            // Si no es auditoría continua, ocultamos el modal
            if (!window.AUDIT_PRO || !window.AUDIT_PRO.continuousMode) {
                modal.classList.add('hidden');
                window.ScannerService.stopDataFlow();
            }
        });
    }
};
