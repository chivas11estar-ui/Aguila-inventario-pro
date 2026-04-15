// ============================================================
// Águila Inventario Pro - Netlify Function: generate-phrase.js
// Backend Serverless para Generación de Frases con IA (Groq)
// MODELOS: Cascada automática de modelos disponibles
// Copyright © 2026 José A. G. Betancourt
// ============================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Cascada de modelos: intenta el primero, si falla usa el siguiente
const MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

// System prompt: personalidad de la IA
const SYSTEM_PROMPT = `Eres el asistente de Águila Inventario Pro. Eres un gerente de tienda entusiasta y motivador mexicano.
Genera una frase motivacional de máximo 15 palabras para el promotor.
No uses hashtags ni comillas. Usa un tono cálido, profesional y mexicano.
Si se proporciona el nombre del promotor, inclúyelo en la frase.
Si se proporciona la hora del día, adapta el saludo (buenos días, buenas tardes, buenas noches).
Responde SOLO con la frase, sin explicaciones adicionales.`;

exports.handler = async function(event, context) {
    // Manejar preflight CORS
    if (event.httpMethod === 'OPTIONS') {
          return {
                  statusCode: 204,
                  headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                  },
                  body: ''
          };
    }

    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
          return {
                  statusCode: 405,
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                  body: JSON.stringify({ error: 'Método no permitido. Usa POST.' })
          };
    }

    // Leer la API Key desde variables de entorno de Netlify
    const API_KEY = process.env.GEMMA_API_KEY;
    if (!API_KEY) {
          console.error('GEMMA_API_KEY no configurada');
          return {
                  statusCode: 500,
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                  body: JSON.stringify({ error: 'API Key no configurada en el servidor.' })
          };
    }

    try {
          // Parsear el body del request
      const requestBody = JSON.parse(event.body || '{}');
          const { userName, hourOfDay, dayOfWeek, date, weather, city } = requestBody;

      // Sanitizar entradas
      const safeName = sanitize(userName || 'Campeón');
          const safeHour = typeof hourOfDay === 'number' ? hourOfDay : new Date().getHours();

      // Determinar saludo por hora
      let timeGreeting = 'Buenos días';
          if (safeHour >= 12 && safeHour < 18) timeGreeting = 'Buenas tardes';
          else if (safeHour >= 18) timeGreeting = 'Buenas noches';

      // Construir prompt dinámico
      let userPrompt = `Genera una frase motivacional para ${safeName}. Es ${timeGreeting.toLowerCase()}.`;
          if (dayOfWeek) userPrompt += ` Hoy es ${sanitize(dayOfWeek)}.`;
          if (date) userPrompt += ` Fecha: ${sanitize(date)}.`;
          if (weather) userPrompt += ` Clima: ${sanitize(weather)}.`;
          if (city) userPrompt += ` Ciudad: ${sanitize(city)}.`;

      // Intentar con cada modelo en cascada
      let lastError = null;
          for (const model of MODELS) {
                  try {
                            console.log(`Intentando modelo: ${model}`);
                            const response = await fetch(GROQ_API_URL, {
                                        method: 'POST',
                                        headers: {
                                                      'Authorization': `Bearer ${API_KEY}`,
                                                      'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                                      model: model,
                                                      messages: [
                                                        { role: 'system', content: SYSTEM_PROMPT },
                                                        { role: 'user', content: userPrompt }
                                                                    ],
                                                      temperature: 0.9,
                                                      max_tokens: 60,
                                                      top_p: 0.95
                                        })
                            });

                    if (!response.ok) {
                                const errData = await response.json().catch(() => ({}));
                                console.warn(`Modelo ${model} falló (${response.status}):`, errData.error?.message || 'desconocido');
                                lastError = errData;
                                continue; // Intentar siguiente modelo
                    }

                    const data = await response.json();
                            let phrase = data.choices?.[0]?.message?.content?.trim() || '';

                    // Control de longitud: máximo 15 palabras
                    if (phrase) {
                                const words = phrase.split(' ');
                                if (words.length > 15) phrase = words.slice(0, 15).join(' ');
                                phrase = phrase.replace(/["#]/g, '').trim();
                    }

                    if (!phrase) continue; // Si no hay frase, intentar siguiente modelo

                    console.log(`Éxito con modelo: ${model}`);
                            return {
                                        statusCode: 200,
                                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                                        body: JSON.stringify({ phrase, source: 'groq-' + model.split('/').pop() })
                            };

                  } catch (modelError) {
                            console.warn(`Error con ${model}:`, modelError.message);
                            lastError = modelError;
                            continue;
                  }
          }

      // Si todos los modelos fallaron, devolver fallback
      return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({
                        phrase: `¡${safeName}, hoy es tu día para brillar! Adelante campeón.`,
                        source: 'fallback-servidor'
              })
      };

    } catch (error) {
          console.error('Error en generate-phrase:', error.message);
          return {
                  statusCode: 500,
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                  body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
          };
    }
};

// Sanitización de entradas (Anti-Prompt Injection)
function sanitize(text) {
    if (!text) return '';
    return String(text)
      .replace(/[<>{}[\]\\\/]/g, '')
      .replace(/\n|\r/g, ' ')
      .substring(0, 100)
      .trim();
}
