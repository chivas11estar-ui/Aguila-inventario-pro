// ============================================================
// Águila Inventario Pro - Service Worker
// Copyright © 2025 José A. G. Betancourt
// ============================================================

const CACHE_NAME = "aguila-inventario-v7-4-final";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/auth.js",
  "/ui.js",
  "/inventory.js",
  "/audit.js",
  "/system.js",
  "/scanner.js",
  "/firebase-config.js",
  "/refill.js",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png" 
];

// Instalación
self.addEventListener("install", (event) => {
  console.log("✅ Service Worker v7.4 Instalando...");
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Archivos cacheados correctamente");
      return cache.addAll(urlsToCache).catch(err => {
        console.warn("⚠️ Algunos archivos no pudieron cachearse:", err);
      });
    })
  );
});

// Activación
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker v7.4 Activando...");
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("🧹 Eliminando caché viejo:", name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => {
      self.clients.claim();
      console.log("✅ Service Worker activo y controlando clientes");
    })
  );
});

// Estrategia Cache-First
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response("⚠️ Sin conexión y recurso no disponible", {
          status: 503,
          statusText: "Offline"
        });
      });
    })
  );
});

console.log("✅ service-worker.js cargado correctamente");
