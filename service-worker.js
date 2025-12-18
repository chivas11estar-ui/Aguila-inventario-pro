// ============================================================
// Águila Inventario Pro - Service Worker Versión 8.1
// Optimizado para modo offline real + actualizaciones confiables
// ============================================================

const CACHE_NAME = "aguila-inventario-v8-1";
const APP_SHELL = [
  "/",
  "/index.html",

  // CSS
  "/styles.css",
  "/custom-styles.css",

  // PWA
  "/manifest.json",

  // Core JS
  "/firebase-config.js",
  "/app.js",
  "/auth.js",
  "/ui.js",

  // Features
  "/inventory.js",
  "/inventory-enhanced.js",
  "/refill-enhanced.js",
  "/analytics.js",
  "/audit.js",
  "/system.js",
  "/system-events.js",

  // Scanner
  "/scanner-mlkit.js",
  "/scanner-events.js",

  // Charts
  "/charts.js",

  // Icons
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// ============================================================
// INSTALL
// Forzamos instalación + cache limpio
// ============================================================
self.addEventListener("install", (event) => {
  console.log(`📦 Instalando SW ${CACHE_NAME}`);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Guardando archivos...");
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn("⚠️ Archivos no cacheados:", err);
      });
    })
  );

  self.skipWaiting();
});

// ============================================================
// ACTIVATE
// Eliminamos versiones viejas inmediatamente
// ============================================================
self.addEventListener("activate", (event) => {
  console.log(`🧹 Activando SW ${CACHE_NAME}`);

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🗑 Borrando caché viejo:", key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => {
      console.log("✅ SW listo y controlando clientes");
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH Strategy: Cache-First con fallback inteligente
// ============================================================
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // No intervenir en Firebase ni CDNs
  if (
    url.includes("firebase") ||
    url.includes("gstatic") ||
    url.includes("googleapis") ||
    url.includes("cdnjs")
  ) {
    return event.respondWith(fetch(event.request));
  }

  // Navegación siempre vuelve a index.html (SPA)
  if (event.request.mode === "navigate") {
    return event.respondWith(
      fetch(event.request)
        .then(resp => resp)
        .catch(() => caches.match("/index.html"))
    );
  }

  // Cache primero para archivos del APP_SHELL
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((resp) => {
          // Clonar respuesta y guardar en cache
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, respClone);
          });
          return resp;
        })
        .catch(() =>
          new Response("⚠️ Recurso no disponible offline", {
            status: 503,
            statusText: "Offline Resource Missing",
          })
        );
    })
  );
});

console.log("✅ Service Worker 8.1 cargado correctamente");