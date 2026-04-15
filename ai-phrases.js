// ============================================================
// Águila Inventario Pro - Módulo: ai-phrases.js (HARDENED v2)
// Generación de Frases Motivacionales con IA y Capa de Seguridad
// EVOLUCIÓN: Netlify Functions (Groq/Gemma) + Firebase Proxy fallback
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

/**
 * CIERRE SEGURO (CLOSURE) PARA LLAVES DE IA
 */
const AIService = (function() {
        // Endpoints disponibles (orden de prioridad)
                       const NETLIFY_FUNCTION_URL = '/.netlify/functions/generate-phrase';
        const FIREBASE_PROXY_URL = 'https://us-central1-promosentry.cloudfunctions.net/geminiProxyV3';

                       /**
         * SANITIZACIÓN DE ENTRADAS (Anti-Prompt Injection)
         */
                       function sanitize(text) {
                                   if (!text) return '';
                                   return String(text)
                                       .replace(/[<>{}[\]\\\/]/g, '')
                                       .substring(0, 100)
                                       .trim();
                       }

                       /**
         * RUTA 1: Llamar a Netlify Function (Groq/Gemma - Sin autenticación Firebase requerida)
         */
                       async function generateViaNetlify(userName) {
                                   const safeName = sanitize(userName);
                                   const now = new Date();
                                   const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

            const weatherData = window.PROFILE_STATE?.weather || null;

            const payload = {
                            userName: safeName,
                            hourOfDay: now.getHours(),
                            dayOfWeek: days[now.getDay()],
                            date: now.toLocaleDateString('es-MX'),
                            weather: weatherData?.description || null,
                            city: window.PROFILE_STATE?.weather?.city || 'México'
            };

            console.log('🦅 [IA] Intentando Netlify Function (Groq/Gemma)...');

            const controller = new AbortController();
                                   const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

            try {
                            const response = await fetch(NETLIFY_FUNCTION_URL, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(payload),
                                                signal: controller.signal
                            });

                                       clearTimeout(timeout);

                                       if (!response.ok) {
                                                           const errorData = await response.json().catch(() => ({}));
                                                           console.warn('⚠️ Netlify Function error:', response.status, errorData);
                                                           throw new Error(errorData.error || `HTTP ${response.status}`);
                                       }

                                       const data = await response.json();
                            let phrase = data.phrase || '';

                                       // Control de longitud: máx 15 palabras
                                       if (phrase && phrase.split(' ').length > 15) {
                                                           phrase = phrase.split(' ').slice(0, 15).join(' ');
                                       }

                                       console.log('✅ [IA] Frase generada vía Netlify/Groq:', phrase);
                            return { phrase, source: data.source || 'netlify-groq' };

            } catch (error) {
                            clearTimeout(timeout);
                            if (error.name === 'AbortError') {
                                                console.warn('⏱️ Netlify Function timeout (8s)');
                            } else {
                                                console.warn('⚠️ Netlify Function falló:', error.message);
                            }
                            throw error;
            }
                       }

                       /**
         * RUTA 2 (FALLBACK): Llamar a Firebase Cloud Function Proxy (Gemini)
         */
                       async function generateViaFirebase(userName) {
                                   const safeName = sanitize(userName);

            try {
                            const user = firebase.auth().currentUser;
                            if (!user) throw new Error('No hay sesión activa');

                                       const idToken = await user.getIdToken();
                            const now = new Date();
                            const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

                                       const context = {
                                                           userName: safeName,
                                                           date: now.toLocaleDateString('es-MX'),
                                                           dayOfWeek: days[now.getDay()],
                                                           weather: window.PROFILE_STATE?.weather || null,
                                                           city: window.PROFILE_STATE?.weather?.city || 'México',
                                                           style: "short"
                                       };

                                       console.log('🔄 [IA] Intentando Firebase Proxy (Gemini)...');

                                       const response = await fetch(FIREBASE_PROXY_URL, {
                                                           method: 'POST',
                                                           headers: {
                                                                                   'Authorization': `Bearer ${idToken}`,
                                                                                   'Content-Type': 'application/json'
                                                           },
                                                           body: JSON.stringify(context)
                                       });

                                       if (!response.ok) {
                                                           const errorData = await response.json().catch(() => ({}));
                                                           console.error('❌ Firebase Proxy error:', response.status, errorData.details || 'Sin detalles');
                                                           throw new Error(errorData.error || `Error ${response.status}`);
                                       }

                                       const data = await response.json();
                            let phrase = data.phrase || '';

                                       // Control de longitud: máx 12 palabras
                                       if (phrase && phrase.split(' ').length > 12) {
                                                           phrase = phrase.split(' ').slice(0, 12).join(' ');
                                       }

                                       console.log('✅ [IA] Frase generada vía Firebase/Gemini:', phrase);
                            return { phrase, source: 'firebase-gemini' };

            } catch (error) {
                            console.warn('⚠️ Firebase Proxy falló:', error.message);
                            throw error;
            }
                       }

                       /**
         * FUNCIÓN PRINCIPAL: Cascada de fuentes de IA
         * 1. Netlify Function (Groq/Gemma) - más rápido, sin auth requerida
         * 2. Firebase Proxy (Gemini) - requiere auth Firebase
         * 3. Fallback local - frases estáticas con contexto de clima
         */
                       async function generate(userName) {
                                   // Intento 1: Netlify Function
            try {
                            const result = await generateViaNetlify(userName);
                            if (result.phrase) return result.phrase;
            } catch (e) {
                            console.log('🔄 Cambiando a Firebase Proxy...');
            }

            // Intento 2: Firebase Proxy
            try {
                            const result = await generateViaFirebase(userName);
                            if (result.phrase) return result.phrase;
            } catch (e) {
                            console.log('🔄 Cambiando a fallback local...');
            }

            // Intento 3: Fallback local
            return getFallbackPhrase(userName);
                       }

                       return { generate };
})();


// ============================================================
// OBTENER FRASE DEL DÍA (con caché en Firebase y seguridad)
// ============================================================
async function getDailyAIPhrase(userId, userName) {
        const today = new Date().toISOString().split('T')[0];

    try {
                // Verificar si ya hay una frase en caché para hoy
            const phraseRef = firebase.database().ref(`usuarios/${userId}/frasesIA/${today}`);
                const snapshot = await phraseRef.once('value');

            if (snapshot.exists()) {
                            console.log('📦 [IA] Frase cacheada encontrada para hoy');
                            return snapshot.val();
            }

            // Generar nueva frase vía cascada de IA
            const newPhrase = await AIService.generate(userName);
                await phraseRef.set(newPhrase);
                return newPhrase;

    } catch (error) {
                if (error.message === 'RATE_LIMIT_EXCEEDED') {
                                console.log('🛡️ Usando fallback por límite de cuota');
                }
                return getFallbackPhrase(userName);
    }
}


// ============================================================
// MOSTRAR FRASE DEL DÍA EN LA UI (con estado "Cargando...")
// ============================================================
async function displayDailyAIPhrase() {
        const user = firebase.auth().currentUser;
        if (!user) return;

    // Mostrar estado de carga
    const phraseContainer = document.getElementById('motivational-phrase');
        if (phraseContainer) {
                    phraseContainer.textContent = '✨ Generando frase del día...';
                    phraseContainer.style.opacity = '0.6';
        }

    try {
                const userSnapshot = await firebase.database().ref(`usuarios/${user.uid}`).once('value');
                const userData = userSnapshot.val();
                const fullName = userData?.nombrePromotor || 'Campeón';
                const firstName = fullName.split(' ')[0];

            const phrase = await getDailyAIPhrase(user.uid, firstName);

            if (phraseContainer) {
                            phraseContainer.textContent = `"${phrase}"`;
                            phraseContainer.style.opacity = '1';
                            phraseContainer.style.transition = 'opacity 0.3s ease-in';
            }
    } catch (error) {
                console.error('🛡️ Error UI-IA:', error);
                if (phraseContainer) {
                                phraseContainer.textContent = `"${getFallbackPhrase('Campeón')}"`;
                                phraseContainer.style.opacity = '1';
                }
    }
}


// ============================================================
// FALLBACK CON CLIMA (Frases locales de respaldo)
// ============================================================
function getFallbackPhrase(userName) {
        const weatherDesc = (window.PROFILE_STATE?.weather?.description || '').toLowerCase();
        let climateHint = '';

    if (weatherDesc.includes('lluvia')) {
                climateHint = 'aunque llueva';
    } else if (weatherDesc.includes('nube') || weatherDesc.includes('nublado')) {
                climateHint = 'aunque el cielo esté gris';
    } else if (weatherDesc.includes('sol') || weatherDesc.includes('despejado')) {
                climateHint = 'con este gran sol';
    }

    const phrases = [
                `¡${userName}, brilla ${climateHint}! Tu energía contagia al equipo 🌟`,
                `${userName}, hoy vendes fuerte ${climateHint}. Eres un campeón 💪`,
                `${userName}, avanza ${climateHint}. Cada paso cuenta hoy 🦅`,
                `¡Arriba ${userName}! Hoy es tu día para destacar ${climateHint} 🚀`,
                `${userName}, tu esfuerzo vale oro. A darlo todo hoy 🏆`,
                `¡Éxito total para ${userName}! El anaquel te espera 📈`,
                `${userName}, eres pieza clave del equipo. ¡Ánimo ${climateHint}! 💎`,
                `Hoy brillas ${userName}. Con actitud todo se logra ✨`,
                `${userName}, cada producto que acomodas suma. ¡Vamos! 🎯`,
                `¡${userName}, el inventario perfecto se logra con ganas como las tuyas! 🦅`
            ];

    return phrases[Math.floor(Math.random() * phrases.length)];
}


// ============================================================
// EXPORTAR FUNCIONES SEGURAS
// ============================================================
window.getDailyAIPhrase = getDailyAIPhrase;
window.displayDailyAIPhrase = displayDailyAIPhrase;

console.log('🛡️ ai-phrases.js v2: Netlify Functions (Groq/Gemma) + Firebase fallback + local fallback.');
