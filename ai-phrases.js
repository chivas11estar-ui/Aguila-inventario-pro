// ============================================================
// Águila Inventario Pro - Módulo: ai-phrases.js
// Generación de Frases Motivacionales con IA (Google Gemini)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// IMPORTANTE: Esta es una implementación de FRONTEND
// Para producción, se recomienda usar Firebase Functions para proteger la API key

const GEMINI_API_KEY = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU'; // ⚠️ Protegido bajo petición del usuario
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
            const cachedPhrase = snapshot.val();
            // Validación: Si la frase es muy corta (posible error previo), regenerar
            if (cachedPhrase && cachedPhrase.length > 5) {
                console.log('✅ Frase del día encontrada en caché');
                return cachedPhrase;
            } else {
                console.warn('⚠️ Frase en caché inválida o muy corta. Regenerando...');
            }
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
    // Detectar celebración especial (México)
    const today = new Date();
    const holiday = getMexicanHoliday(today);

    let specialContext = "";
    if (holiday) {
        specialContext = `- HOY es ${holiday} en México. La frase DEBE mencionar esto de forma festiva.`;
        console.log(`🎉 Celebración detectada: ${holiday}`);
    }

    const prompt = `Genera una frase motivacional corta y energética para ${userName}, quien es un promotor de ventas en una tienda. 
  
  Requisitos:
  - Debe ser inspiradora y positiva
  - Máximo 15 palabras
  - Incluir el nombre "${userName}" de forma natural
  - Enfocada en ventas, éxito y actitud positiva
  - Usar emojis relevantes (máximo 2)
  - En español (México)
  - Tono profesional pero cercano
  ${specialContext}
  
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
// DETECTAR FESTIVIDADES MEXICANAS
// ============================================================
function getMexicanHoliday(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${month}-${day}`;

    const holidays = {
        '01-01': 'Año Nuevo',
        '01-06': 'Día de Reyes',
        '02-05': 'Día de la Constitución',
        '02-14': 'Día del Amor y la Amistad',
        '02-24': 'Día de la Bandera',
        '03-21': 'Primavera / Natalicio de Benito Juárez',
        '04-30': 'Día del Niño',
        '05-01': 'Día del Trabajo',
        '05-05': 'Batalla de Puebla',
        '05-10': 'Día de las Madres',
        '05-15': 'Día del Maestro',
        '05-23': 'Día del Estudiante',
        '06-01': 'Día de la Marina',
        '09-15': 'Grito de Independencia',
        '09-16': 'Día de la Independencia',
        '10-12': 'Día de la Raza',
        '11-01': 'Día de Todos los Santos',
        '11-02': 'Día de Muertos',
        '11-20': 'Revolución Mexicana',
        '12-12': 'Día de la Virgen de Guadalupe',
        '12-24': 'Nochebuena',
        '12-25': 'Navidad',
        '12-28': 'Día de los Inocentes',
        '12-31': 'Fin de Año'
    };

    if (holidays[key]) return holidays[key];

    // Día del Padre (Tercer domingo de Junio)
    if (date.getMonth() === 5 && date.getDay() === 0) { // Junio es mes 5
        const d = date.getDate();
        if (d >= 15 && d <= 21) return 'Día del Padre';
    }

    return null;
}

// ============================================================
// EXPORTAR FUNCIONES
// ============================================================
window.getDailyAIPhrase = getDailyAIPhrase;
window.displayDailyAIPhrase = displayDailyAIPhrase;
window.cleanOldAIPhrases = cleanOldAIPhrases;

console.log('✅ ai-phrases.js cargado correctamente');
