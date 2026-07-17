// Service Worker desactivado temporalmente para desarrollo local (Evita errores 404 y cache corrupto)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  // Solo dejamos que pase la peticion sin cachear nada
  return;
});
