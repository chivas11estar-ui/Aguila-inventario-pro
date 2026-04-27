/**
 * Águila Pro - ScannerService (Version Eagle Batch)
 * V7.0 - Batch Processing & Modern UI Integration
 */

'use strict';

window.ScannerService = {
    persistentStream: null,
    detector: null,
    activeVideoElement: null,
    isScanning: false,
    batchSession: [], // Almacena los códigos escaneados en esta sesión

    async requestCamera(target) {
        console.log("📷 [ScannerService] Solicitando hardware...");
        let videoElement = (target instanceof HTMLElement) ? target : document.querySelector(target);
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
        let lastScanTime = 0;
        
        const loop = async () => {
            if (!this.isScanning || !this.activeVideoElement || this.activeVideoElement.paused) return;
            try {
                if (this.detector) {
                    const barcodes = await this.detector.detect(this.activeVideoElement);
                    if (barcodes.length > 0) {
                        const now = Date.now();
                        const code = barcodes[0].rawValue;

                        // Antidebounce para no escanear lo mismo 20 veces por segundo
                        if (now - lastScanTime > 1500) {
                            lastScanTime = now;
                            console.log("🎯 Código detectado:", code);
                            if (navigator.vibrate) navigator.vibrate(50);
                            
                            this.addToBatch(code);
                            callback(code);
                        }
                    }
                }
            } catch (e) { console.warn("⚠️ Error en ciclo:", e); }
            if (this.isScanning) requestAnimationFrame(loop);
        };
        loop();
    },

    addToBatch(code) {
        // Evitar duplicados en el lote actual (opcional, dependiendo de la lógica de negocio)
        this.batchSession.push(code);
        this.updateBatchUI();
    },

    updateBatchUI() {
        const listElement = document.getElementById('scanned-items-list');
        const countBadge = document.getElementById('scan-batch-count');
        const summaryText = document.getElementById('batch-summary-text');
        if (!listElement) return;

        if (this.batchSession.length === 0) {
            listElement.innerHTML = `<div class="flex flex-col items-center justify-center w-full text-slate-300"><p class="text-[10px] font-bold">Sin capturas recientes</p></div>`;
            if (countBadge) countBadge.textContent = '0 Items';
            if (summaryText) summaryText.textContent = '0 SKU detectados';
            return;
        }

        // Obtener nombres de productos si están en el inventario local
        const products = this.batchSession.map(code => {
            return window.INVENTORY_STATE?.productos?.find(p => p.codigoBarras === code) || { nombre: 'Producto Nuevo', codigoBarras: code };
        });

        listElement.innerHTML = products.map((p, index) => `
            <div class="flex-shrink-0 w-24 bg-slate-50 rounded-xl p-2 border border-slate-100 relative animate-in slide-in-from-right duration-300">
                <div class="w-full aspect-square bg-white rounded-lg mb-1 flex items-center justify-center overflow-hidden border border-slate-50 text-primary">
                    <span class="material-symbols-outlined text-2xl">package_2</span>
                </div>
                <p class="text-[8px] font-bold text-slate-700 truncate text-center">${p.nombre}</p>
                <button onclick="window.ScannerService.removeFromBatch(${index})" class="absolute -top-1 -right-1 w-4 h-4 bg-error text-white rounded-full flex items-center justify-center text-[10px] shadow-sm">×</button>
            </div>
        `).join('');

        if (countBadge) countBadge.textContent = `${this.batchSession.length} Items`;
        
        const uniqueSKUs = new Set(this.batchSession).size;
        if (summaryText) summaryText.textContent = `${uniqueSKUs} SKU detectados`;
    },

    removeFromBatch(index) {
        this.batchSession.splice(index, 1);
        this.updateBatchUI();
    },

    hardStop() {
        this.isScanning = false;
        if (this.activeVideoElement) {
            this.activeVideoElement.pause();
            this.activeVideoElement.srcObject = null;
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

        window.ScannerService.batchSession = []; // Reset batch
        window.ScannerService.updateBatchUI();

        let callback = typeof args === 'function' ? args : (args?.onScan || null);
        window.ScannerService.continuousMode = true; // Por defecto modo lote para el diseño Eagle

        modal.classList.remove('hidden');

        const ready = await window.ScannerService.requestCamera(video);
        if (ready) {
            window.ScannerService.scan((code) => {
                if (typeof callback === 'function') callback(code);
            });
        }
    }
});

// Configurar botón de cerrar
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-scanner');
    if (closeBtn) {
        closeBtn.onclick = () => {
            window.ScannerService.hardStop();
            document.getElementById('scanner-modal').classList.add('hidden');
        };
    }
    
    const submitBtn = document.getElementById('btn-submit-batch');
    if (submitBtn) {
        submitBtn.onclick = () => {
            if (window.ScannerService.batchSession.length === 0) {
                if (typeof showToast === 'function') showToast("⚠️ No hay productos para procesar", "warning");
                return;
            }
            // Aquí puedes conectar con la lógica de envío de lote
            if (typeof showToast === 'function') showToast(`✅ Procesando lote de ${window.ScannerService.batchSession.length} items`, "success");
            
            // Ejemplo: Ir a la pestaña de relleno con el primer código
            const firstCode = window.ScannerService.batchSession[0];
            window.ScannerService.hardStop();
            document.getElementById('scanner-modal').classList.add('hidden');
            
            window.switchTab('refill');
            setTimeout(() => {
                const input = document.getElementById('refill-barcode');
                if (input) {
                    input.value = firstCode;
                    if (window.searchProductForRefillSafe) window.searchProductForRefillSafe(firstCode);
                }
            }, 100);
        };
    }
});


console.log('✅ [SCANNER] Motor V6.3 (API Unified) desplegado.');
