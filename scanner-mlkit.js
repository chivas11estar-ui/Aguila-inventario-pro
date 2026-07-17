/**
 * Águila Pro - ScannerService (Singleton Persistent Bridge)
 * V7.0 - High Precision & Torch Support
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.ScannerService = {
    persistentStream: null,
    detector: null,
    activeVideoElement: null,
    isScanning: false,
    torchEnabled: false,
    lastScannedCode: null,
    lastScanTime: 0,

    async requestCamera(target) {
        console.log("📷 [ScannerService] Solicitando hardware de alta precisión...");
        
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
            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    focusMode: "continuous"
                },
                audio: false
            };

            this.persistentStream = await navigator.mediaDevices.getUserMedia(constraints);

            const ready = await this.attachToElement(videoElement);
            if (ready) {
                this.checkTorchCapability();
                this.applyAdvancedConstraints();
            }
            return ready;
        } catch (err) {
            console.error("❌ [ScannerService] Error WebRTC:", err);
            return false;
        }
    },

    async applyAdvancedConstraints() {
        const track = this.persistentStream?.getVideoTracks()[0];
        if (!track) return;
        try {
            const capabilities = track.getCapabilities();
            const constraints = {};
            if (capabilities.focusMode?.includes('continuous')) constraints.focusMode = 'continuous';
            if (Object.keys(constraints).length > 0) await track.applyConstraints({ advanced: [constraints] });
        } catch (e) {}
    },

    async checkTorchCapability() {
        const track = this.persistentStream?.getVideoTracks()[0];
        if (!track) return;

        try {
            const capabilities = track.getCapabilities();
            const torchBtn = document.getElementById('btn-toggle-torch');
            if (capabilities && capabilities.torch) {
                if (torchBtn) {
                    torchBtn.classList.remove('hidden');
                    torchBtn.onclick = () => this.toggleTorch();
                }
            } else {
                if (torchBtn) torchBtn.classList.add('hidden');
            }
        } catch (e) {
            console.log("🔦 Linterna no verificable.");
        }
    },

    async toggleTorch() {
        const track = this.persistentStream?.getVideoTracks()[0];
        if (!track) return;

        try {
            this.torchEnabled = !this.torchEnabled;
            await track.applyConstraints({
                advanced: [{ torch: this.torchEnabled }]
            });
            const torchBtn = document.getElementById('btn-toggle-torch');
            if (torchBtn) {
                torchBtn.querySelector('span').textContent = this.torchEnabled ? 'flashlight_off' : 'flashlight_on';
                torchBtn.style.background = this.torchEnabled ? '#fbbf24' : 'rgba(0,0,0,0.5)';
            }
        } catch (e) {
            console.error("❌ Error al usar linterna:", e);
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
            this.detector = new BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'qr_code']
            });
            console.log("🚀 Detector nativo inicializado con soporte multiformato.");
        }
    },

    async scan(callback) {
        if (!this.detector && !('BarcodeDetector' in window)) {
            console.error("❌ BarcodeDetector no disponible.");
            this.isScanning = false;
            return;
        }
        
        this.isScanning = true;
        this.lastScannedCode = null;

        const loop = async () => {
            if (!this.isScanning || !this.activeVideoElement || this.activeVideoElement.paused) return;

            try {
                const barcodes = await this.detector.detect(this.activeVideoElement);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    const now = Date.now();

                    if (code !== this.lastScannedCode || (now - this.lastScanTime > 2000)) {
                        this.lastScannedCode = code;
                        this.lastScanTime = now;
                        if (navigator.vibrate) navigator.vibrate([70]);
                        callback(code);
                        if (!window.ScannerService.continuousMode) {
                            this.isScanning = false;
                            return; 
                        }
                    }
                }
            } catch (e) { console.warn("⚠️ Error en ciclo:", e); }

            if (this.isScanning) {
                setTimeout(() => requestAnimationFrame(loop), 60);
            }
        };
        loop();
    },

    stop() {
        this.isScanning = false;
        if (this.activeVideoElement) this.activeVideoElement.pause();
    },

    hardStop() {
        this.isScanning = false;
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
            this.activeVideoElement.load();
            this.activeVideoElement = null;
        }
        if (this.persistentStream) {
            this.persistentStream.getTracks().forEach(t => t.stop());
            this.persistentStream = null;
        }
    }
};

Object.defineProperty(window, 'openScanner', {
    value: async function(args) {
        const modal = document.getElementById('scanner-modal');
        const video = document.getElementById('scanner-video');
        if (!modal || !video) return;

        let callback = typeof args === 'function' ? args : (args?.onScan || null);
        window.ScannerService.continuousMode = args?.continuous || false;

        if (!callback) return;

        modal.classList.remove('hidden');
        const ready = await window.ScannerService.requestCamera(video);
        if (ready) {
            window.ScannerService.scan((code) => {
                callback(code);
                if (!window.ScannerService.continuousMode) {
                    modal.classList.add('hidden');
                    window.ScannerService.hardStop();
                }
            });
        } else {
            modal.classList.add('hidden');
        }
    },
    writable: false,
    configurable: true
});
