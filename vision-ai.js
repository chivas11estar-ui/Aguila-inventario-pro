/**
 * Águila Pro - Módulo: vision-ai.js
 * Inteligencia Artificial de Visión (Gemma 4 VLM)
 * Corre en el navegador usando Transformers.js
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.VisionAI = {
    model: null,
    isReady: false,
    isLoading: false,

    async init() {
        if (this.isReady || this.isLoading) return;
        this.isLoading = true;
        console.log("🧠 [VisionAI] Despertando a Gemma 4...");

        try {
            // Importar dinámicamente Transformers.js
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
            
            // Cargamos un modelo ligero optimizado para móviles (Object Detection / Image-to-Text)
            // Usaremos 'detr-resnet-50' que es excelente para contar productos en anaquel
            this.model = await pipeline('object-detection', 'Xenova/detr-resnet-50');
            
            this.isReady = true;
            this.isLoading = false;
            console.log("✅ [VisionAI] ¡Águila ya tiene ojos!");
            if (typeof showToast === 'function') showToast("👁️ Inteligencia Visual Lista", "success");
        } catch (err) {
            console.error("❌ [VisionAI] Fallo al cargar el cerebro:", err);
            this.isLoading = false;
        }
    },

    async analyzeShelf(imageDataUrl) {
        // Extraer solo el base64 de la URL de datos
        const base64Image = imageDataUrl.split(',')[1];
        
        console.log("📸 [VisionAI] Enviando anaquel a Gemini 2.5...");
        
        try {
            const user = firebase.auth().currentUser;
            if (!user) throw new Error("No hay sesión activa");
            const idToken = await user.getIdToken();

            const response = await fetch('https://us-central1-promosentry.cloudfunctions.net/geminiProxyV3', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    mode: 'shelf_analysis',
                    image: base64Image 
                })
            });

            if (!response.ok) throw new Error("Fallo en la comunicación con el ojo de Gemini");

            const analysis = await response.json();
            console.log("📊 [VisionAI] Análisis de Gemini:", analysis);
            return analysis;
        } catch (err) {
            console.error("❌ [VisionAI] Error en auditoría visual:", err);
            return null;
        }
    }
};

// Auto-inicializar después de 5 segundos para no alentar el arranque inicial
setTimeout(() => {
    window.VisionAI.init();
}, 5000);

console.log('✅ vision-ai.js (Módulo Visión IA) cargado correctamente');
