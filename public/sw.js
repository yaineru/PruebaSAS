// Service Worker mínimo, escrito a mano a propósito (sin Workbox/next-pwa):
// el alcance real necesario es chico - permitir que "abrir la aplicación" en
// una zona sin señal muestre la última versión conocida de las páginas de
// campo (Equipos/Mantenimientos/Novedades/Panel), en vez del error nativo
// del navegador "sin conexión a Internet". Todo lo demás (guardar datos
// offline, la cola de sincronización) vive en IndexedDB vía lib/offline/*,
// completamente aparte de este archivo.
//
// Sube este número cuando cambie la lógica de cacheo - fuerza a los
// dispositivos ya instalados a limpiar el caché viejo en la próxima visita.
const CACHE_VERSION = "eos-shell-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// No se cachean nunca:
// - Server Actions (POST) y llamadas a otro origen (Supabase Storage/Auth) -
//   interceptarlas rompería el flujo de auth.
// - /api/* en general, y /api/health en particular: este último es
//   justamente lo que usa lib/offline/connectivity.ts para saber si hay
//   conexión REAL (no solo `navigator.onLine`). Si el service worker lo
//   sirviera desde caché al fallar la red, el chequeo de conectividad vería
//   "200 OK" con el servidor completamente apagado - literalmente lo
//   opuesto de lo que existe para detectar. Confirmado como bug real durante
//   las pruebas: sin esta exclusión, apagar el servidor no se detectaba
//   como desconexión.
function isCacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheable(request)) return;

  // Navegaciones de página completa (abrir la app, recargar, cambiar de URL
  // a mano): red primero (para no mostrar datos viejos cuando sí hay señal),
  // con la última copia cacheada de esa misma URL como respaldo y, si nunca
  // se visitó antes, la página /offline genérica.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Assets estáticos de Next (hasheados por build, inmutables): cache-first.
  if (request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Todo lo demás (RSC payloads de navegación interna, imágenes, CSS): red
  // primero, cayendo a la última copia buena conocida si la red falla. Sin
  // respaldo genérico aquí a propósito - un dato a medio cargar es peor que
  // simplemente dejar que ese fetch puntual falle.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
