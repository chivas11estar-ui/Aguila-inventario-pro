/**
 * Águila Pro - ScannerService (Singleton con Mutex)
 * V5 - Estabilización de Hardware y Concurrencia
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.ScannerService = {
    stream: null,
    detector: null,
    activeVideoElement: null,
    isStreaming: false,

    async requestCamera(videoElement) {
        // Mutex: Si el hardware ya está en uso por este mismo elemento, no reiniciar
        if (this.isStreaming && this.activeVideoElement === videoElement) {
            console.log("🔒 [ScannerService] Hardware ya bloqueado y activo.");
            return true;
        }

        // Si hay un flujo activo en otro elemento, lo liberamos primero
        if (this.stream) this.stop(); 

        try {
            console.log("📷 [ScannerService] Solicitando acceso a cámara...");
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
                    this.isStreaming = true;
                    console.log("✅ [ScannerService] Streaming estable.");
                    resolve(true);
                };
            });
        } catch (err) {
            console.error("❌ [ScannerService] Error de acceso:", err);
            this.isStreaming = false;
            return false;
        }
    },

    initDetector() {
        if (!this.detector && 'BarcodeDetector' in window) {
            this.detector = new BarcodeDetector({ 
                formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] 
            });
        }
    },

    async scan(callback) {
        if (!this.activeVideoElement || !this.isStreaming) return;

        const loop = async () => {
            if (!this.isStreaming || !this.activeVideoElement) return;
            
            try {
                if (this.detector) {
                    const barcodes = await this.detector.detect(this.activeVideoElement);
                    if (barcodes.length > 0) {
                        const code = barcodes[0].rawValue;
                        callback(code);
                        if (navigator.vibrate) navigator.vibrate(50);
                        return; 
                    }
                }
            } catch (e) { /* Transición de frames */ }
            
            requestAnimationFrame(loop);
        };
        loop();
    },

    stop() {
        console.log("🔓 [ScannerService] Liberando hardware...");
        this.isStreaming = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
            this.activeVideoElement = null;
        }
    }
};

/** 
 * BRIDGE: Compatibilidad con openScanner legado
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
            // Puente al buscador si existe
            if (window.bridgeScanToSearch) window.bridgeScanToSearch(code);
            
            if (!window.AUDIT_PRO || !window.AUDIT_PRO.continuousMode) {
                window.ScannerService.stop();
                modal.classList.add('hidden');
            }
        });
    }
};
