// ============================================================
// Águila Inventario Pro - Módulo: ai-phrases.js (HARDENED)
// Generación de Frases Motivacionales con IA y Capa de Seguridad
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

/**
 * CIERRE SEGURO (CLOSURE) PARA LLAVES DE IA
 * Protege la llave del scope global y evita que sea accesible vía consola.
 */
const AIService = (function() {
    // ELIMINADO: API_KEY expuesta y ofuscación (AHORA EN CLOUD FUNCTION)
    
    // Configuración del Proxy (Cloud Function V2) - ACTUALIZADO A V3
    const PROXY_URL = 'https://us-central1-promosentry.cloudfunctions.net/geminiProxyV3';

    /**
     * SANITIZACIÓN DE ENTRADAS (Anti-Prompt Injection)
     */
    function sanitize(text) {
        if (!text) return "";
        return text.toString().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "").substring(0, 30);
    }

    async function generate(userName) {
        const safeName = sanitize(userName);
        
        try {
            // a) Obtener el idToken del usuario actual autenticado (Firebase Auth)
            const user = firebase.auth().currentUser;
            if (!user) throw new Error("No hay sesión activa");

            const idToken = await user.getIdToken();

            // b) Llamar a la Cloud Function proxy
            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ userName: safeName })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("❌ Detalles técnicos del Proxy:", errorData.details || "Sin detalles");
                const msg = errorData.error || `Error ${response.status}`;
                throw new Error(msg);
            }

            const data = await response.json();
            
            // Retornar la frase recibida
            return data.phrase;

        } catch (error) {
            console.error("🛡️ Error IA (vía Proxy):", error.message);
            throw error; // getDailyAIPhrase manejará el fallback
        }
    }
  
    return {
        generate: generate
    };
})();

// ============================================================
// OBTENER FRASE DEL DÍA (con caché y seguridad)
// ============================================================
async function getDailyAIPhrase(userId, userName) {
    const today = new Date().toISOString().split('T')[0];

    try {
        const phraseRef = firebase.database().ref(`usuarios/${userId}/frasesIA/${today}`);
        const snapshot = await phraseRef.once('value');

        if (snapshot.exists()) return snapshot.val();

        // Si no existe, intentar generar con Rate Limiting
        const newPhrase = await AIService.generate(userName);
        await phraseRef.set(newPhrase);
        return newPhrase;

    } catch (error) {
        if (error.message === "RATE_LIMIT_EXCEEDED") {
            console.log("🛡️ Usando fallback por límite de cuota");
        }
        return getFallbackPhrase(userName);
    }
}

// ============================================================
// MOSTRAR FRASE DEL DÍA EN LA UI
// ============================================================
async function displayDailyAIPhrase() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const userSnapshot = await firebase.database().ref(`usuarios/${user.uid}`).once('value');
        const userData = userSnapshot.val();
        const fullName = userData?.nombrePromotor || 'Campeón';
        const firstName = fullName.split(' ')[0];

        const phrase = await getDailyAIPhrase(user.uid, firstName);

        const phraseContainer = document.getElementById('motivational-phrase');
        if (phraseContainer) {
            phraseContainer.textContent = `"${phrase}"`;
        }

    } catch (error) {
        console.error('🛡️ Error UI-IA:', error);
    }
}

function getFallbackPhrase(userName) {
    const phrases = [
        `¡${userName}, hoy es tu día para brillar! 🌟`,
        `${userName}, cada venta cuenta. ¡Vamos con todo! 💪`,
        `¡Hoy será un gran día, ${userName}! Dale con todo 🦅`
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

// Exportar funciones seguras
window.getDailyAIPhrase = getDailyAIPhrase;
window.displayDailyAIPhrase = displayDailyAIPhrase;

console.log('🛡️ ai-phrases.js endurecido con Rate Limiting.');