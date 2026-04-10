/**
 * Águila Pro - Módulo: audit-camera.js
 * Cámara INDEPENDIENTE para Auditoría Visual
 * Separado del escáner de códigos de barras
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.AuditCamera = {
    videoElement: null,
    stream: null,
    isOpen: false,

    async openAuditCamera() {
        console.log('📸 [AUDIT CAMERA] Abriendo cámara de auditoría...');

        const modal = document.getElementById('audit-camera-modal');
        this.videoElement = document.getElementById('audit-camera-video');

        if (!modal || !this.videoElement) {
            console.error('❌ Elementos de cámara no encontrados');
            return;
        }

        try {
            // Solicitar permiso de cámara con configuración específica
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Cámara trasera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            this.videoElement.srcObject = this.stream;
            modal.classList.remove('hidden');
            this.isOpen = true;

            console.log('✅ Cámara de auditoría abierta');
            if (typeof showToast === 'function') {
                showToast('📸 Cámara lista. Captura cuando veas claro.', 'success');
            }

        } catch (error) {
            console.error('❌ Error al abrir cámara:', error);
            if (typeof showToast === 'function') {
                showToast('❌ Error: No se pudo acceder a la cámara', 'error');
            }
        }
    },

    closeAuditCamera() {
        console.log('📸 [AUDIT CAMERA] Cerrando cámara de auditoría...');

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const modal = document.getElementById('audit-camera-modal');
        if (modal) {
            modal.classList.add('hidden');
        }

        this.isOpen = false;
        console.log('✅ Cámara de auditoría cerrada');
    },

    async captureAuditFrame() {
        console.log('📸 [AUDIT CAMERA] Capturando fotograma...');

        if (!this.videoElement) {
            console.error('❌ Video element no disponible');
            return null;
        }

        try {
            // Crear canvas para capturar el fotograma
            const canvas = document.createElement('canvas');
            canvas.width = this.videoElement.videoWidth;
            canvas.height = this.videoElement.videoHeight;

            const context = canvas.getContext('2d');
            context.drawImage(this.videoElement, 0, 0);

            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            console.log('✅ Fotograma capturado');

            return imageDataUrl;

        } catch (error) {
            console.error('❌ Error al capturar fotograma:', error);
            if (typeof showToast === 'function') {
                showToast('❌ Error al capturar imagen', 'error');
            }
            return null;
        }
    },

    async analyzeWithVisionAI() {
        console.log('📸 [AUDIT CAMERA] Enviando a análisis...');

        const imageDataUrl = await this.captureAuditFrame();
        if (!imageDataUrl) return;

        if (typeof showToast === 'function') {
            showToast('⏳ Analizando anaquel con IA...', 'info');
        }

        // Enviar a vision-ai.js
        if (window.VisionAI && typeof window.VisionAI.analyzeShelf === 'function') {
            const analysis = await window.VisionAI.analyzeShelf(imageDataUrl);

            if (analysis) {
                console.log('📊 Análisis completado:', analysis);
                this.closeAuditCamera();

                // Mostrar resultados (TODO: implementar UI de resultados)
                if (typeof showToast === 'function') {
                    showToast('✅ Análisis completado. Ver detalles en auditoría.', 'success');
                }
            }
        } else {
            console.error('❌ Vision AI no disponible');
            if (typeof showToast === 'function') {
                showToast('❌ IA de visión no disponible', 'error');
            }
        }
    }
};

// Configurar event listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnCapture = document.getElementById('btn-capture-audit');
    const btnClose = document.getElementById('close-audit-camera');
    const btnVisualScan = document.getElementById('btn-visual-scan');

    if (btnCapture) {
        btnCapture.addEventListener('click', () => window.AuditCamera.analyzeWithVisionAI());
    }

    if (btnClose) {
        btnClose.addEventListener('click', () => window.AuditCamera.closeAuditCamera());
    }

    if (btnVisualScan) {
        btnVisualScan.addEventListener('click', () => window.AuditCamera.openAuditCamera());
    }
});

console.log('✅ audit-camera.js (Auditoría Visual Independiente) cargado correctamente');
