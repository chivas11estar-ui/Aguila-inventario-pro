/**
 * Águila Pro - ScannerService (Singleton)
 * V4 - Motor Unificado de Hardware e IA
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.ScannerService = {
    stream: null,
    detector: null,
    activeVideoElement: null,
    isReady: false,

    async requestCamera(videoElement) {
        console.log("📷 [ScannerService] Solicitando hardware...");
        if (this.stream) this.stop(); 

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: "environment", 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            videoElement.srcObject = this.stream;
            this.activeVideoElement = videoElement;

            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play();
                    this.initDetector();
                    this.isReady = true;
                    console.log("✅ [ScannerService] Video caliente y listo.");
                    resolve(true);
                };
            });
        } catch (err) {
            console.error("❌ [ScannerService] Fallo en Cámara:", err);
            if (typeof showToast === 'function') showToast("Error de cámara: Activa los permisos.", "error");
            return false;
        }
    },

    initDetector() {
        if ('BarcodeDetector' in window) {
            this.detector = new BarcodeDetector({ 
                formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] 
            });
            console.log("🤖 [ScannerService] ML Kit Nativo Activo.");
        } else {
            console.warn("⚠️ [ScannerService] ML Kit no disponible. Usando fallback manual.");
            this.detector = null;
        }
    },

    async scan(callback) {
        if (!this.activeVideoElement) return;

        const loop = async () => {
            if (!this.stream || !this.activeVideoElement) return;
            
            try {
                if (this.detector) {
                    const barcodes = await this.detector.detect(this.activeVideoElement);
                    if (barcodes.length > 0) {
                        console.log("🎯 [ScannerService] Código detectado:", barcodes[0].rawValue);
                        callback(barcodes[0].rawValue);
                        if (navigator.vibrate) navigator.vibrate(50);
                        return; // Detener tras éxito
                    }
                }
            } catch (e) { /* Frame vacío o transición */ }
            
            if (this.isReady) {
                requestAnimationFrame(loop);
            }
        };
        loop();
    },

    stop() {
        this.isReady = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
        }
        console.log("📷 [ScannerService] Hardware liberado.");
    }
};

// Mantener compatibilidad con llamadas viejas si existen
window.SCANNER_MLKIT = {
    startContinuous: (cb) => window.ScannerService.scan(cb),
    stop: () => window.ScannerService.stop(),
    ensureScannerReady: () => window.ScannerService.requestCamera(document.createElement('video'))
};

/** 
 * BRIDGE: Conector Global para compatibilidad (V4.1)
 * Mapea las llamadas legacy al nuevo ScannerService Singleton.
 */
window.openScanner = async function(callback) {
    const modal = document.getElementById('scanner-modal');
    const video = document.getElementById('scanner-video');
    
    if (!modal || !video) {
        console.error("❌ [ScannerBridge] Elementos del modal no encontrados.");
        return;
    }

    // 1. Mostrar Interfaz
    modal.classList.remove('hidden');
    
    // 2. Encender Cámara vía Singleton
    const ready = await window.ScannerService.requestCamera(video);
    
    if (ready) {
        // 3. Iniciar Escaneo
        window.ScannerService.scan((code) => {
            // Ejecutar la lógica del módulo solicitante
            if (callback) callback(code);
            
            // 4. Seguridad/Batería: Auto-cierre tras éxito (Modo Manual)
            // Si no estamos en auditoría continua, cerramos para ahorrar recursos
            if (!window.AUDIT_PRO || !window.AUDIT_PRO.continuousMode) {
                window.ScannerService.stop();
                modal.classList.add('hidden');
            }
        });
    }
};

// Listener para el botón de cerrar modal (si existe)
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-scanner')?.addEventListener('click', () => {
        window.ScannerService.stop();
        document.getElementById('scanner-modal').classList.add('hidden');
    });
});

