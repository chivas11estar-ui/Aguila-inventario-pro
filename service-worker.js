// ============================================================
// Águila Inventario Pro - Service Worker (MODO PRODUCCIÓN)
// Estrategia: Stale-While-Revalidate para el App Shell
// Copyright © 2025 José A. G. Betancourt
// ============================================================

const CACHE_NAME = "aguila-pro-v1.7";

// Lista completa de los archivos que componen la aplicación (App Shell)
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/custom-styles.css",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/firebase-config.js",
  "/ui.js",
  "/scanner-mlkit.js",
  "/scanner-events.js",
  "/inventory.js",
  "/inventory-ui.js",
  "/refill-enhanced.js",
  "/audit.js",
  "/system.js",
  "/system-events.js",
  "/profile.js",
  "/profile-ui.js",
  "/analytics.js",
  "/analytics-ui.js",
  "/phrases.js",
  "/auth.js",
  "/app.js"
];

// ============================================================
// INSTALL: Cachear el App Shell
// ============================================================
self.addEventListener("install", (event) => {
  console.log(`[SW v${CACHE_NAME}] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`[SW v${CACHE_NAME}] Cacheando el App Shell...`);
      // Usar { cache: 'reload' } para asegurar que se obtienen los archivos más nuevos durante la instalación.
      const promises = APP_SHELL_ASSETS.map(url => {
        return cache.add(new Request(url, { cache: 'reload' }));
      });
      return Promise.all(promises);
    }).then(() => {
      self.skipWaiting(); // Forzar la activación inmediata del nuevo SW
    })
  );
});

// ============================================================
// ACTIVATE: Limpiar cachés antiguos
// ============================================================
self.addEventListener("activate", (event) => {
  console.log(`[SW v${CACHE_NAME}] Activando...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW v${CACHE_NAME}] Eliminando caché antigua:`, name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Tomar control de los clientes abiertos
    })
  );
});

// ============================================================
// FETCH: Implementar estrategia Stale-While-Revalidate
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignorar peticiones que no son GET y las de Firebase/APIs externas
  if (request.method !== "GET" ||
    request.url.includes("firebase") ||
    request.url.includes("googleapis") ||
    request.url.includes("gstatic") ||
    request.url.includes("open-meteo.com") ||
    request.url.includes("bigdatacloud.net")) {
    return;
  }

  const url = new URL(request.url);

  // Aplicar Stale-While-Revalidate para los assets del App Shell
  if (APP_SHELL_ASSETS.includes(url.pathname) || APP_SHELL_ASSETS.includes(url.pathname + url.search)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Obtener una versión nueva de la red en segundo plano
          const fetchedResponsePromise = fetch(request).then((networkResponse) => {
            // Si la respuesta es válida, la guardamos en caché para la próxima vez
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(err => {
            // La red falló, no hay nada que hacer, se usará la caché si existe.
            console.warn(`[SW v${CACHE_NAME}] Fallo de red para ${request.url}`, err);
            // IMPORTANTE: No devolver nada aquí para que la promesa resuelva con undefined, 
            // pero el siguiente .then manejará el cachedResponse || fetchedResponsePromise
          });

          // Devolver la respuesta de la caché inmediatamente si existe, si no, esperar a la red
          return cachedResponse || fetchedResponsePromise;
        });
      })
    );
  } else {
    // Para otros assets (ej. imágenes no cacheadas), usar estrategia Network First con fallback seguro
    event.respondWith(
      fetch(request).catch(() => {
        // Devolver una respuesta 404 válida en lugar de undefined para evitar el error "Failed to convert value to Response"
        return new Response("Offline / Fallo de red", { status: 404, statusText: "Offline" });
      })
    );
  }
});

console.log(`✅ Service Worker v${CACHE_NAME} (Producción) cargado y listo.`);