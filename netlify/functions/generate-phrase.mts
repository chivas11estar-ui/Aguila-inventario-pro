const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant"
];

const SYSTEM_PROMPT = `Eres el asistente motivacional de Aguila Inventario Pro.
Genera UNA frase motivacional para un promotor de inventario en Mexico.
Reglas:
- Maximo 15 palabras.
- Sin comillas, sin hashtags, sin explicaciones.
- Tono mexicano, profesional, directo y positivo.
- Si hay nombre, usalo naturalmente.
- Si hay inventario, menciona orden, anaquel, stock o tienda de forma breve.
- Responde solo la frase.`;

type PhraseRequest = {
  userName?: string;
  hourOfDay?: number;
  dayOfWeek?: string;
  date?: string;
  weather?: string;
  temperature?: number | string;
  humidity?: number | string;
  city?: string;
  saint?: string;
  stockCount?: number | string;
  outOfStockCount?: number | string;
  tone?: string;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Metodo no permitido. Usa POST." }, 405);
  }

  const body = await readJson(req);
  const context = normalizeContext(body);
  const apiKey = getEnv("GROQ_API_KEY") || getEnv("GEMMA_API_KEY");

  if (!apiKey) {
    return json({
      phrase: buildServerFallback(context),
      source: "netlify-fallback-no-api-key"
    });
  }

  const userPrompt = buildUserPrompt(context);
  let lastError = "";

  for (const model of MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.85,
          max_tokens: 60,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        lastError = errorData?.error?.message || `HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      const phrase = cleanPhrase(data?.choices?.[0]?.message?.content);

      if (isValidPhrase(phrase)) {
        return json({
          phrase,
          source: `netlify-groq-${model.split("/").pop()}`,
          generatedAt: new Date().toISOString()
        });
      }

      lastError = "Respuesta vacia o invalida";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Error desconocido";
    }
  }

  return json({
    phrase: buildServerFallback(context),
    source: "netlify-fallback-provider-error",
    providerError: lastError
  });
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}

async function readJson(req: Request): Promise<PhraseRequest> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function getEnv(name: string) {
  const netlifyValue = (globalThis as any).Netlify?.env?.get?.(name);
  const processValue = (globalThis as any).process?.env?.[name];
  return netlifyValue || processValue || "";
}

function normalizeContext(body: PhraseRequest) {
  const hour = Number(body.hourOfDay);

  return {
    userName: sanitize(body.userName) || "Campeon",
    hourOfDay: Number.isFinite(hour) ? hour : new Date().getHours(),
    dayOfWeek: sanitize(body.dayOfWeek),
    date: sanitize(body.date),
    weather: sanitize(body.weather),
    temperature: sanitize(body.temperature),
    humidity: sanitize(body.humidity),
    city: sanitize(body.city) || "Mexico",
    saint: sanitize(body.saint),
    stockCount: sanitize(body.stockCount),
    outOfStockCount: sanitize(body.outOfStockCount),
    tone: sanitize(body.tone) || "motivacional"
  };
}

function buildUserPrompt(context: ReturnType<typeof normalizeContext>) {
  const greeting = getGreeting(context.hourOfDay);
  const parts = [
    `Nombre: ${context.userName}.`,
    `Saludo: ${greeting}.`,
    context.dayOfWeek ? `Dia: ${context.dayOfWeek}.` : "",
    context.date ? `Fecha: ${context.date}.` : "",
    context.city ? `Ciudad: ${context.city}.` : "",
    context.weather ? `Clima: ${context.weather}.` : "",
    context.temperature ? `Temperatura: ${context.temperature} C.` : "",
    context.humidity ? `Humedad: ${context.humidity}%.` : "",
    context.saint ? `Santo del dia: ${context.saint}.` : "",
    context.stockCount ? `Productos con stock: ${context.stockCount}.` : "",
    context.outOfStockCount ? `Productos agotados: ${context.outOfStockCount}.` : "",
    `Tono: ${context.tone}.`
  ].filter(Boolean);

  return `${parts.join(" ")} Genera una frase corta para iniciar su jornada.`;
}

function getGreeting(hour: number) {
  if (hour >= 18) return "buenas noches";
  if (hour >= 12) return "buenas tardes";
  return "buenos dias";
}

function sanitize(value: unknown) {
  return String(value || "")
    .replace(/[<>{}[\]\\\/`$]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function cleanPhrase(value: unknown) {
  let phrase = String(value || "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length > 15) {
    phrase = words.slice(0, 15).join(" ");
  }

  if (phrase && !/[.!?]$/.test(phrase)) {
    phrase += ".";
  }

  return phrase;
}

function isValidPhrase(phrase: string) {
  const words = phrase.split(/\s+/).filter(Boolean);
  return words.length >= 5 && words.length <= 16 && !phrase.includes("\n");
}

function buildServerFallback(context: ReturnType<typeof normalizeContext>) {
  const name = context.userName || "Campeon";
  const greeting = getGreeting(context.hourOfDay);
  const hasStock = Number(context.stockCount || 0) > 0;
  const hasOut = Number(context.outOfStockCount || 0) > 0;

  if (hasOut) {
    return `${capitalize(greeting)}, ${name}: ordena prioridades y recupera esos anaqueles hoy.`;
  }

  if (hasStock) {
    return `${capitalize(greeting)}, ${name}: tu stock listo impulsa una gran jornada.`;
  }

  return `${capitalize(greeting)}, ${name}: cada anaquel ordenado suma valor hoy.`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
