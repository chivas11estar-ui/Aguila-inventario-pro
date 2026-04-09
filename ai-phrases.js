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
            const user = firebase.auth().currentUser;
            if (!user) throw new Error("No hay sesión activa");

            const idToken = await user.getIdToken();

            // Recopilar contexto para la Súper Frase
            const now = new Date();
            const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const context = {
                userName: safeName,
                date: now.toLocaleDateString('es-MX'),
                dayOfWeek: days[now.getDay()],
                weather: window.PROFILE_STATE?.weather || null,
                city: window.PROFILE_STATE?.weather?.city || 'México'
            };

            // b) Llamar a la Cloud Function proxy V3
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
// OBTENER FRASE DINÁMICA (Límite 10/día, refresco cada 2 horas)
// ============================================================
async function getDailyAIPhrase(userId, userName) {
    const today = new Date().toISOString().split('T')[0];
    const phraseRef = firebase.database().ref(`usuarios/${userId}/frasesIA/${today}`);

    try {
        const snapshot = await phraseRef.once('value');
        const data = snapshot.val() || { count: 0, lastPhrase: "", lastUpdate: 0 };

        const ahora = Date.now();
        const dosHoras = 2 * 60 * 60 * 1000;

        // ¿Necesitamos frase nueva? 
        // 1. Menos de 10 frases hoy AND 2. Pasaron más de 2 horas (o es la primera)
        if (data.count < 10 && (ahora - data.lastUpdate > dosHoras)) {
            console.log("🧠 Generando nueva frase por bloque de tiempo...");
            const newPhrase = await AIService.generate(userName);
            
            const newData = {
                count: data.count + 1,
                lastPhrase: newPhrase,
                lastUpdate: ahora
            };
            
            await phraseRef.set(newData);
            return newPhrase;
        }

        // Si no, devolver la última guardada
        return data.lastPhrase || getFallbackPhrase(userName);

    } catch (error) {
        console.error("🛡️ Fallo en lógica de frases:", error);
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