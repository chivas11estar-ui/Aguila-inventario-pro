// ============================================================
// Águila Inventario Pro - Módulo: ai-phrases.js (HARDENED)
// Generación de Frases Motivacionales con IA y Capa de Seguridad
// OPTIMIZADO: frases cortas + clima + control de longitud
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

/**
 * CIERRE SEGURO (CLOSURE) PARA LLAVES DE IA
 */
const AIService = (function() {
    
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
            const user = firebase.auth().currentUser;
            if (!user) throw new Error("No hay sesión activa");

            const idToken = await user.getIdToken();

            const now = new Date();
            const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

            const context = {
                userName: safeName,
                date: now.toLocaleDateString('es-MX'),
                dayOfWeek: days[now.getDay()],
                weather: window.PROFILE_STATE?.weather || null,
                city: window.PROFILE_STATE?.weather?.city || 'México',
                style: "short" // 🔥 Indica al backend que la frase sea corta
            };

            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(context)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("❌ Detalles técnicos del Proxy:", errorData.details || "Sin detalles");
                const msg = errorData.error || `Error ${response.status}`;
                throw new Error(msg);
            }

            const data = await response.json();
            
            // 🛡️ CONTROL FINAL: limitar longitud (máx 12 palabras)
            let phrase = data.phrase || "";
            phrase = phrase.split(" ").slice(0, 12).join(" ");

            return phrase;

        } catch (error) {
            console.error("🛡️ Error IA (vía Proxy):", error.message);
            throw error;
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

// ============================================================
// FALLBACK CON CLIMA (MEJORADO)
// ============================================================
function getFallbackPhrase(userName) {
    const weatherDesc = (window.PROFILE_STATE?.weather?.description || "").toLowerCase();

    let climateHint = "";

    if (weatherDesc.includes("lluvia")) {
        climateHint = "aunque llueva";
    } else if (weatherDesc.includes("nube") || weatherDesc.includes("nublado")) {
        climateHint = "aunque el cielo esté gris";
    } else if (weatherDesc.includes("sol") || weatherDesc.includes("despejado")) {
        climateHint = "con este gran sol";
    }

    const phrases = [
        `¡${userName}, brilla ${climateHint}! 🌟`,
        `${userName}, hoy vendes fuerte ${climateHint} 💪`,
        `${userName}, avanza ${climateHint} 🦅`
    ];

    return phrases[Math.floor(Math.random() * phrases.length)];
}

// ============================================================
// EXPORTAR FUNCIONES SEGURAS
// ============================================================
window.getDailyAIPhrase = getDailyAIPhrase;
window.displayDailyAIPhrase = displayDailyAIPhrase;

console.log('🛡️ ai-phrases.js optimizado: corto + clima + control.');