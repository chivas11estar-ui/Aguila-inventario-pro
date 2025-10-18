// ============================================================
// águila Inventario Pro - M贸dulo: style.css
// Copyright 漏 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación 
// sin autorización expresa del autor.
// ============================================================

const CACHE_NAME = "aguila-inventario-v7";
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
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// Instalaci贸n
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("馃摝 Archivos cacheados correctamente");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activaci贸n
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("馃Ч Eliminando cache viejo:", name);
            return caches.delete(name);
          }
        })
      )
    )
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() =>
          new Response("鈿狅笍 Sin conexi贸n y recurso no disponible en cache", {
            status: 503,
            statusText: "Offline"
          })
        )
      );
    })
  );
});