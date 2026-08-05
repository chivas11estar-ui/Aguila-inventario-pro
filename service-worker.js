// ============================================================
// Aguila Inventario Pro - Service Worker
// Estrategia: network-first para app shell y fallback offline
// ============================================================

const CACHE_NAME = "aguila-pro-v8.8";

const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/landing.html",
  "/privacy.html",
  "/styles.css",
  "/custom-styles.css",
  "/tailwind-built.css",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/firebase-config.js",
  "/app-loader.js",
  "/security-utils.js",
  "/date-utils.js",
  "/ui.js",
  "/listener-manager.js",
  "/scanner-mlkit.js",
  "/scanner-events.js",
  "/search-controller.js",
  "/inventory-core.js",
  "/inventory.js",
  "/inventory-ui.js",
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
  "/phrases.js",
  "/migrate-to-v2.js",
  "/login.js",
  "/auth.js",
  "/app.js",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt"
];

const APP_SHELL_SET = new Set(APP_SHELL_ASSETS);
const IGNORED_HOST_PARTS = [
  "firebase",
  "googleapis",
  "gstatic",
  "cdnjs.cloudflare.com",
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (IGNORED_HOST_PARTS.some((part) => request.url.includes(part))) return;

  if (APP_SHELL_SET.has(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request, { ignoreSearch: true });
    if (cachedResponse) return cachedResponse;

    if (request.mode === "navigate") {
      const cachedIndex = await cache.match("/index.html");
      if (cachedIndex) return cachedIndex;
    }

    return new Response("Offline / Fallo de red", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
