/**
 * Águila Inventario Pro - Cloud Functions
 * Versión: 2.3.0 (Real Daily Sales Average)
 * Lógica para Proxy Seguro, analíticas y Auditoría Visual.
 */

const { onValueCreated } = require("firebase-functions/v2/database");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

/**
 * 📈 FUNCION: syncSalesAnalytics (PROMEDIO REAL DIARIO)
 */
exports.syncSalesAnalytics = onValueCreated("/movimientos/{storeId}/{movId}", async (event) => {
    const movData = event.data.val();
    if (movData.tipo !== "salida") return;

    const { productoCodigo, piezasMovidas } = movData;
    const storeId = event.params.storeId;
    const barcode = productoCodigo.trim();
    const productFsRef = db.doc(`stores/${storeId}/products/${barcode}`);
    const productRtdbRef = rtdb.ref(`productos/${storeId}/${barcode}`);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(productFsRef);
            let oldAvg = 0;
            let lastSaleDate = Date.now();

            if (doc.exists) {
                const data = doc.data().analytics || {};
                oldAvg = data.daily_sales_avg || 0;
                lastSaleDate = data.last_sale_date?.toMillis() || Date.now() - (24 * 60 * 60 * 1000);
            }

            // Calcular días transcurridos (mínimo 1 para evitar división por cero)
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysElapsed = Math.max(1, (Date.now() - lastSaleDate) / msPerDay);
            
            // La tasa real de hoy es piezas / días que pasaron
            const dailyRate = parseInt(piezasMovidas) / daysElapsed;

            // Fórmula EMA (Suavizado exponencial)
            const alpha = 2 / (30 + 1); // Ventana de 30 días
            const newAvg = (dailyRate * alpha) + (oldAvg * (1 - alpha));
            const roundedAvg = Math.round(newAvg * 100) / 100;

            transaction.set(productFsRef, {
                analytics: {
                    daily_sales_avg: roundedAvg,
                    last_sale_date: admin.firestore.FieldValue.serverTimestamp(),
                    last_pieces_moved: piezasMovidas
                }
            }, { merge: true });

            await productRtdbRef.update({ 
                daily_sales_avg: roundedAvg,
                last_sale_date: Date.now() 
            });
        });
    } catch (e) { console.error("❌ Error Analytics:", e); }
});

/**
 * 🦅 FUNCION: geminiProxyV3 (MULTIMODAL)
 */
exports.geminiProxyV3 = onRequest({ 
    region: "us-central1",
    secrets: ["GEMINI_KEY"],
    maxInstances: 10
}, (req, res) => {
    return cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) return res.status(401).json({ error: "No autorizado" });
            
            const idToken = authHeader.split("Bearer ")[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const uid = decodedToken.uid;

            const API_KEY = process.env.GEMINI_KEY;
            if (!API_KEY) throw new Error("LLAVE_NO_CONFIGURADA");

            const { userName, image, mode, date, dayOfWeek, weather, city, time } = req.body;
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
            
            let contents = [];
            
            if (mode === 'shelf_analysis' && image) {
                contents = [{
                    role: "user",
                    parts: [
                        { text: "Analiza esta foto de anaquel de botanas. Cuenta cuántos frentes (facings) totales hay en la imagen y cuántos pertenecen a marcas de PepsiCo (Sabritas, Gamesa, Quaker, Sonric's). Responde ÚNICAMENTE en formato JSON: {\"total_frentes\": numero, \"pepsico_frentes\": numero, \"competencia_frentes\": numero, \"mensaje\": \"resumen corto\"}" },
                        { inline_data: { mime_type: "image/jpeg", data: image } }
                    ]
                }];
            } else {
                const weatherContext = weather ? `el clima es ${weather.condition} con ${weather.temperature}°C` : 'clima desconocido';
                const prompt = `Actúa como una socia digital motivadora y apasionada para ${userName}, un promotor de ventas en México. 
                Contexto actual:
                - Fecha: ${date} (${dayOfWeek})
                - Hora actual: ${time}
                - Ubicación: ${city || 'México'}
                - Clima: ${weatherContext}
                
                Instrucciones:
                1. Saluda por su nombre considerando la hora (mañana, tarde, noche).
                2. Menciona algo del clima o el santoral si es relevante.
                3. Da una frase motivacional de ventas muy corta.
                4. Usa 2 emojis. Tono mexicano coqueto pero profesional. Máximo 25 palabras.`;
                
                contents = [{ role: "user", parts: [{ text: prompt }] }];
            }

            const geminiResponse = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: { 
                        temperature: mode === 'shelf_analysis' ? 0.1 : 0.9, 
                        maxOutputTokens: 300,
                        response_mime_type: mode === 'shelf_analysis' ? "application/json" : "text/plain"
                    }
                })
            });

            const data = await geminiResponse.json();

            if (!geminiResponse.ok) {
                console.error("❌ ERROR GEMINI:", JSON.stringify(data));
                return res.status(geminiResponse.status).json({ 
                    error: "Error de la IA", 
                    details: data.error?.message || "Error desconocido"
                });
            }

            const rawText = data.candidates[0].content.parts[0].text.trim();
            
            if (mode === 'shelf_analysis') {
                try {
                    const analysis = JSON.parse(rawText.replace(/```json|```/g, ""));
                    return res.status(200).json(analysis);
                } catch(e) {
                    return res.status(200).json({ error: "Error procesando JSON de visión", raw: rawText });
                }
            }

            const phrase = rawText.replace(/^["']|["']$/g, '');
            return res.status(200).json({ phrase });

        } catch (error) {
            console.error("🛡️ Fallo Proxy:", error);
            return res.status(500).json({ error: error.message });
        }
    });
});
