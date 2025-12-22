// ============================================================
// Águila Inventario Pro - Service Worker
// MODO DESARROLLO SEGURO (ANTI-CACHÉ FANTASMA)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

const CACHE_NAME = "aguila-static-v1";

// SOLO archivos estáticos reales (NO lógica)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/custom-styles.css",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener("install", (event) => {
  console.log("🧹 SW instalando (modo limpio)");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener("activate", (event) => {
  console.log("🔥 SW activando, limpiando cachés viejos");

  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // ❌ NO interceptar Firebase ni APIs
  if (
    request.url.includes("firebase") ||
    request.url.includes("googleapis") ||
    request.url.includes("gstatic") ||
    request.url.includes("open-meteo")
  ) {
    return;
  }

  // ✅ HTML y JS: SIEMPRE DESDE RED
  if (
    request.destination === "script" ||
    request.destination === "document"
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // ✅ Estáticos: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request);
    })
  );
});

console.log("✅ Service Worker activo (modo desarrollo seguro)");