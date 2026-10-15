/*
 * Service worker de la PWA.
 *
 * - App shell: la navegación va a la red y, sin conexión, se sirve la última
 *   versión de "/" (la SPA resuelve la ruta).
 * - /assets/* (con hash de Vite) e /images/*, /icons/*: caché primero.
 * - Nunca se cachea /api/, /admin/ ni /media/: datos personales, pagos y
 *   descargas de un solo uso siempre van a la red.
 * - Avisos push del backend (evz_core.push): {title, body, link}.
 */

const CACHE = 'adela-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const NEVER = /^\/(api|admin|media|static)\//;
const CACHE_FIRST = /^\/(assets|images|icons)\//;

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || NEVER.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Adela Valverde', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: data.link || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(w => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then(w => w.navigate(link));
      return self.clients.openWindow(link);
    }),
  );
});
