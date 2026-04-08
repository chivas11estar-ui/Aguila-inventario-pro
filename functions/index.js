/**
 * Águila Inventario Pro - Cloud Functions
 * Versión: 2.1.7 (Model Fix: Gemini 1.5 Flash)
 * Lógica para Proxy Seguro y cálculo de promedios de venta.
 */

const { onValueCreated } = require("firebase-functions/v2/database");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

/**
 * 📈 FUNCION: syncSalesAnalytics
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
            if (doc.exists) oldAvg = doc.data().analytics?.daily_sales_avg || 0;
            const alpha = 2 / (30 + 1);
            const newAvg = (parseInt(piezasMovidas) * alpha) + (oldAvg * (1 - alpha));
            const roundedAvg = Math.round(newAvg * 100) / 100;
            transaction.set(productFsRef, {
                analytics: {
                    daily_sales_avg: roundedAvg,
                    last_sale_date: admin.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });
            await productRtdbRef.update({ daily_sales_avg: roundedAvg });
        });
    } catch (e) { console.error("❌ Error Analytics:", e); }
});

/**
 * 🦅 FUNCION: geminiProxy
 */
exports.geminiProxy = onRequest({ 
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

            const { userName } = req.body;
            // MODELO: gemini-3.1-flash-lite (Lo último de 2026)
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`;
            
            const prompt = `Genera una frase motivacional corta (máximo 15 palabras) para ${userName}, promotor de ventas. Usa tono profesional de México y 2 emojis. No uses comillas.`;

            const geminiResponse = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.9, maxOutputTokens: 100 }
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

            const phrase = data.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, '');
            return res.status(200).json({ phrase });

        } catch (error) {
            console.error("🛡️ Fallo Proxy:", error);
            return res.status(500).json({ error: error.message });
        }
    });
});
