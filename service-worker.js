// ============================================================
// Aguila Inventario Pro - Service Worker
// Estrategia: stale-while-revalidate para el App Shell
// ============================================================

const CACHE_NAME = "aguila-pro-v3.6";

const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/custom-styles.css",
  "/tailwind-built.css",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/firebase-config.js",
  "/security-utils.js",
  "/date-utils.js",
  "/ui.js",
  "/listener-manager.js",
  "/scanner-mlkit.js",
  "/scanner-events.js",
  "/search-controller.js",
  "/inventory.js",
  "/inventory-ui.js",
  "/inventory-core.js",
  "/lote-mover.js",
  "/refill-safe.js",
  "/audit.js",
  "/system.js",
  "/system-events.js",
  "/weather.js",
  "/profile.js",
  "/profile-ui.js",
  "/analytics.js",
  "/analytics-ui.js",
  "/ai-phrases.js",
  "/ai-phrases-enhanced.js",
  "/phrases.js",
  "/src/auth/login.js",
  "/auth.js",
  "/app.js"
];

const APP_SHELL_SET = new Set(APP_SHELL_ASSETS);
const IGNORED_HOST_PARTS = [
  "firebase",
  "googleapis",
  "gstatic",
  "open-meteo.com",
  "bigdatacloud.net"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (IGNORED_HOST_PARTS.some((part) => request.url.includes(part))) return;

  if (APP_SHELL_SET.has(url.pathname) || APP_SHELL_SET.has(url.pathname + url.search)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => new Response("Offline / Fallo de red", {
      status: 404,
      statusText: "Offline"
    }))
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkResponsePromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse || new Response("Offline / Fallo de red", {
      status: 503,
      statusText: "Offline"
    }));

  return cachedResponse || networkResponsePromise;
}
