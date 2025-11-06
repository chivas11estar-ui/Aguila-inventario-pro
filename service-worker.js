// ============================================================
// Águila Inventario Pro - Service Worker
// Copyright © 2025 José A. G. Betancourt
// ============================================================

const CACHE_NAME = "aguila-inventario-v7.4final"; // VERSIÓN FINAL Y AGRESIVA
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
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png" 
];

// Instalación
self.addEventListener("install", (event) => {
  console.log("Service Worker v7.3 Instalando...");
  // CRÍTICO: Forzar que el SW nuevo tome control inmediatamente
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Archivos cacheados correctamente");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activación
self.addEventListener("activate", (event) => {
  console.log("Service Worker v7.3 Activando...");
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
      // CRÍTICO: Reclamar clientes inmediatamente
      self.clients.claim();
    })
  );
});

// Estrategia Cache-First para los archivos de la app
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Devolver recurso de caché si existe
      if (response) {
        return response;
      }
      
      // Si no está en caché, ir a la red
      return fetch(event.request).catch(() => {
        // Fallback si no hay conexión y el recurso no está en caché
        if (event.request.mode === 'navigate') {
          // Intentar devolver index.html para navegación offline
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