// ============================================================
// Águila Inventario Pro - Módulo: ai-phrases.js
// Generación de Frases Motivacionales con IA (Google Gemini)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// IMPORTANTE: Esta es una implementación de FRONTEND
// Para producción, se recomienda usar Firebase Functions para proteger la API key

const GEMINI_API_KEY = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU'; // ⚠️ Protegido bajo petición del usuario
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// ============================================================
// OBTENER FRASE DEL DÍA (con caché)
// ============================================================
async function getDailyAIPhrase(userId, userName) {
    const today = getLocalDateString(); // "2026-02-10" en zona horaria local

    try {
        // 1. Verificar si ya existe una frase para hoy en Firebase
        const phraseRef = firebase.database().ref(`usuarios/${userId}/frasesIA/${today}`);
        const snapshot = await phraseRef.once('value');

        if (snapshot.exists()) {
            console.log('✅ Frase del día encontrada en caché');
            return snapshot.val();
        }

        // 2. Si no existe, generar una nueva con IA
        console.log('🤖 Generando nueva frase con IA...');
        const newPhrase = await generateAIPhrase(userName);

        // 3. Guardar en Firebase para no volver a generar hoy
        await phraseRef.set(newPhrase);

        console.log('✅ Frase generada y guardada:', newPhrase);
        return newPhrase;

    } catch (error) {
        console.error('❌ Error obteniendo frase del día:', error);
        // Fallback a frase genérica
        return getFallbackPhrase(userName);
    }
}

// ============================================================
// GENERAR FRASE CON GOOGLE GEMINI API
// ============================================================
async function generateAIPhrase(userName) {
    const prompt = `Genera una frase motivacional corta y energética para ${userName}, quien es un promotor de ventas en una tienda. 
  
  Requisitos:
  - Debe ser inspiradora y positiva
  - Máximo 15 palabras
  - Incluir el nombre "${userName}" de forma natural
  - Enfocada en ventas, éxito y actitud positiva
  - Usar emojis relevantes (máximo 2)
  - En español
  - Tono profesional pero cercano
  
  Ejemplo: "¡${userName}, hoy cada cliente es una oportunidad de oro! 🌟"
  
  Genera SOLO la frase, sin comillas ni explicaciones adicionales.`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.9, // Más creatividad
                    maxOutputTokens: 100,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text.trim();

        // Limpiar comillas si las tiene
        return generatedText.replace(/^["']|["']$/g, '');

    } catch (error) {
        console.error('❌ Error llamando a Gemini API:', error);
        throw error;
    }
}

// ============================================================
// FRASE DE RESPALDO (si falla la IA)
// ============================================================
function getFallbackPhrase(userName) {
    const fallbackPhrases = [
        `¡${userName}, hoy es tu día para brillar! 🌟`,
        `${userName}, cada venta cuenta. ¡Vamos con todo! 💪`,
        `¡Adelante ${userName}! El éxito te espera hoy 🚀`,
        `${userName}, tu actitud marca la diferencia. ¡A triunfar! ⭐`,
        `¡Hoy será un gran día, ${userName}! Dale con todo 🦅`
    ];

    const randomIndex = Math.floor(Math.random() * fallbackPhrases.length);
    return fallbackPhrases[randomIndex];
}

// ============================================================
// MOSTRAR FRASE DEL DÍA EN LA UI
// ============================================================
async function displayDailyAIPhrase() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        // Obtener nombre del promotor
        const userSnapshot = await firebase.database().ref(`usuarios/${user.uid}/nombrePromotor`).once('value');
        const fullName = userSnapshot.val() || 'Campeón';
        const firstName = fullName.split(' ')[0];

        // Obtener frase del día
        const phrase = await getDailyAIPhrase(user.uid, firstName);

        // Mostrar en el contenedor
        const phraseContainer = document.getElementById('motivational-phrase');
        if (phraseContainer) {
            phraseContainer.textContent = `"${phrase}"`;
            phraseContainer.style.fontStyle = 'italic';
        }

    } catch (error) {
        console.error('❌ Error mostrando frase del día:', error);
    }
}

// ============================================================
// LIMPIAR FRASES ANTIGUAS (opcional - ahorro de espacio)
// ============================================================
async function cleanOldAIPhrases(userId, daysToKeep = 7) {
    try {
        const phrasesRef = firebase.database().ref(`usuarios/${userId}/frasesIA`);
        const snapshot = await phrasesRef.once('value');

        if (!snapshot.exists()) return;

        const phrases = snapshot.val();
        const today = new Date();
        const cutoffDate = new Date(today.getTime() - (daysToKeep * 24 * 60 * 60 * 1000));

        const updates = {};
        Object.keys(phrases).forEach(dateKey => {
            const phraseDate = new Date(dateKey);
            if (phraseDate < cutoffDate) {
                updates[dateKey] = null; // Marcar para eliminar
            }
        });

        if (Object.keys(updates).length > 0) {
            await phrasesRef.update(updates);
            console.log(`🗑️ Eliminadas ${Object.keys(updates).length} frases antiguas`);
        }

    } catch (error) {
        console.error('❌ Error limpiando frases antiguas:', error);
    }
}

// ============================================================
// EXPORTAR FUNCIONES
// ============================================================
window.getDailyAIPhrase = getDailyAIPhrase;
window.displayDailyAIPhrase = displayDailyAIPhrase;
window.cleanOldAIPhrases = cleanOldAIPhrases;

console.log('✅ ai-phrases.js cargado correctamente');
