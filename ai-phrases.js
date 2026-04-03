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
    // API KEY OFUSCADA (Reversión + Base64)
    const _H = "NDBuYjJxbTJFWmtybDV0VEFuaUxnYXlNcC1OcGh1VjBEeVNheklB=";
    const _D = (v) => atob(v).split('').reverse().join('');
    
    const API_KEY = _D(_H);
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    
    // Configuración de Rate Limiting (Protección contra abusos)
    const MAX_REQUESTS_PER_DAY = 3; 

    /**
     * SANITIZACIÓN DE ENTRADAS (Anti-Prompt Injection)
     */
    function sanitize(text) {
        if (!text) return "";
        return text.toString().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "").substring(0, 30);
    }

    /**
     * RATE LIMITING LOCAL
     */
    function checkRateLimit(userId) {
        const today = new Date().toISOString().split('T')[0];
        const key = `ai_req_${userId}_${today}`;
        const currentCount = parseInt(localStorage.getItem(key) || "0");
        
        if (currentCount >= MAX_REQUESTS_PER_DAY) {
            console.warn("🛡️ Rate limit alcanzado para la IA");
            return false;
        }
        
        localStorage.setItem(key, (currentCount + 1).toString());
        return true;
    }

    async function generate(userName) {
            const safeName = sanitize(userName);
            
            // Verificación de seguridad (mantenida de tu código original)
            if (typeof checkRateLimit === 'function' && !checkRateLimit(firebase.auth().currentUser?.uid)) {
                throw new Error("RATE_LIMIT_EXCEEDED");
            }

            const prompt = `Genera una frase motivacional corta (máximo 15 palabras) para ${safeName}, promotor de ventas. Usa tono profesional de México y 2 emojis. No uses comillas.`;

            try {
                const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ 
                            role: "user",
                            parts: [{ text: prompt }] 
                        }],
                        generationConfig: { 
                            temperature: 0.85, 
                            maxOutputTokens: 80 
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const exactError = errorData.error?.message || response.statusText;
                    throw new Error(`API Status: ${response.status} - ${exactError}`);
                }

                const data = await response.json();
                const text = data.candidates[0].content.parts[0].text.trim();
                return text.replace(/^["']|["']$/g, '');

            } catch (error) {
                console.error("🛡️ Error IA:", error.message);
                throw error;
            }
        }
  
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