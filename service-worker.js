// ============================================================
// Águila Inventario Pro - Service Worker
// Copyright © 2025 José A. G. Betancourt
// VERSIÓN 7.6 - CORREGIDA Y COMPLETA
// ============================================================

// CAMBIO 1: Nuevo nombre de caché para forzar la actualización
const CACHE_NAME = "aguila-inventario-v7-6-fixes";

// CAMBIO 2: Lista de archivos COMPLETA
const urlsToCache = [
  "/",
  "/index.html",
  
  // CSS (Ambos archivos)
  "/styles.css",
  "/custom-styles.css", // <--- ARCHIVO QUE FALTABA
  
  // JSON
  "/manifest.json",
  
  // Scripts Principales
  "/firebase-config.js",
  "/app.js",
  "/auth.js",
  "/ui.js",
  
  // Scripts de Funcionalidad
  "/inventory.js",
  "/inventory-enhanced.js", // <--- ARCHIVO QUE FALTABA
  "/refill.js",
  "/audit.js",
  "/system.js",
  "/system-events.js", // <--- ARCHIVO QUE FALTABA
  
  // Scripts de Escáner
  "/scanner-mlkit.js",
  "/scanner-events.js", // <--- ARCHIVO QUE FALTABA
  
  // Iconos
  "/icon-192x192.png",
  "/icon-512x512.png" 
];

// Instalación
self.addEventListener("install", (event) => {
  console.log(`✅ Service Worker ${CACHE_NAME} Instalando...`);
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Cache abierto. Guardando archivos...");
      return cache.addAll(urlsToCache).catch(err => {
        console.warn("⚠️ Algunos archivos no pudieron cachearse:", err);
      });
    })
  );
});

// Activación
self.addEventListener("activate", (event) => {
  console.log(`✅ Service Worker ${CACHE_NAME} Activando...`);
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
  // No cachear peticiones de Firebase
  if (event.request.url.includes('firebase') || event.request.url.includes('gstatic')) {
    return event.respondWith(fetch(event.request));
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si está en caché, lo devuelve
      if (response) {
        return response;
      }
      
      // Si no, lo busca en la red
      return fetch(event.request).catch(() => {
        // Si falla (offline) y es una página, muestra index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // Para otros recursos, falla
        return new Response("⚠️ Sin conexión y recurso no disponible", {
          status: 503,
          statusText: "Offline"
        });
      });
    })
  );
});

console.log("✅ service-worker.js cargado correctamente");