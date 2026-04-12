/**
 * Águila Pro - Módulo: vision-ai.js
 * Inteligencia Artificial de Visión (Gemini 2.5 Multimodal)
 * Puente para Auditoría Visual vía Cloud Proxy
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.VisionAI = {
    isReady: true, // Siempre listo ya que procesa en la nube

    async init() {
        console.log("👁️ [VisionAI] Ojo de Águila activo (Cloud Mode)");
        return true;
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("❌ Error del Proxy Vision:", errorData);
                throw new Error(errorData.error || "Fallo en la comunicación con el ojo de Gemini");
            }

            const analysis = await response.json();
            console.log("📊 [VisionAI] Análisis de Gemini:", analysis);
            return analysis;
        } catch (err) {
            console.error("❌ [VisionAI] Error en auditoría visual:", err);
            if (typeof showToast === 'function') showToast("⚠️ Error al analizar: " + err.message, "error");
            return null;
        }
    }
};

// Inicialización inmediata (ya no pesa nada)
window.VisionAI.init();

console.log('✅ vision-ai.js (Cloud Vision Ready) cargado correctamente');
