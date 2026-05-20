// Service Worker (Workbox-powered)
// Hermes Gastro platform — generic across clients.
// The push notification falls back to a generic title; the payload from the
// server (push event data) should override `title` with the actual brand name.
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

const { precacheAndRoute } = workbox.precaching;
const { registerRoute, NavigationRoute, Route } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// Cache name prefix — bumping the version invalidates ALL previous caches.
// History:
//   v3 → lnp-* (legacy, LNP-specific naming)
//   v4 → hermes-* (renamed in FASE 2 cleanup)
const CACHE_PREFIX = 'hermes-v4';

// ─── Skip waiting on install ────────────────────────────
self.skipWaiting();
workbox.core.clientsClaim();

// ─── Pre-cache app shell ────────────────────────────────
// Do NOT precache / or /index.html — the NavigationRoute with NetworkFirst
// below handles HTML and always checks the network first, so new deploys
// are picked up immediately.
precacheAndRoute([
  { url: '/icons.svg', revision: '1' },
]);

// ─── CacheFirst: static assets (JS, CSS, fonts) ────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-static`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 days
    ],
  }),
);

// ─── StaleWhileRevalidate: images ───────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-images`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }), // 7 days
    ],
  }),
);

// ─── NetworkFirst: API calls (Supabase) ─────────────────
// CRITICAL: never intercept /auth/* (login state) or /realtime/* (websocket).
// If we cache /auth/v1/user a 401 response sticks and every refresh signs the
// user out. If we touch realtime we break the live subscription. Edge functions
// (/functions/v1/*) also bypass the SW so submit-order is never retried after
// the BackgroundSync removal.
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase') &&
    !url.pathname.startsWith('/auth/') &&
    !url.pathname.startsWith('/realtime/') &&
    !url.pathname.startsWith('/functions/'),
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-api`,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }), // 1 day
    ],
  }),
);

// ─── NetworkFirst: HTML navigation ──────────────────────
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: `${CACHE_PREFIX}-pages`,
      networkTimeoutSeconds: 3,
    }),
  ),
);

// ─── submit-order: NUNCA pasar por el SW ─────────────────────────
// Antes existía un BackgroundSyncPlugin que reintentaba la request si el
// primer intento "fallaba" (típicamente por CORS), produciendo pedidos
// duplicados porque la orden ya se había creado en DB. Ahora la request va
// directo a la red — si falla, falla, y el cliente muestra el error. Si en
// el futuro se quiere offline support para pedidos, hay que implementar
// idempotency-key en la edge function antes de re-habilitar background sync.
registerRoute(
  ({ url }) => url.hostname.includes('supabase') && url.pathname.includes('submit-order'),
  async ({ request }) => fetch(request),
  'POST',
);

// ─── Push notifications ─────────────────────────────────
// Generic defaults — the server should always send `title` and `body` in the
// push payload to brand the notification with the actual client name.
self.addEventListener('push', (event) => {
  let data = { title: 'Hermes', body: '¡Tenemos novedades!', url: '/', icon: '/icons/icon-192.png' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) { /* keep defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});

// ─── Offline fallback is handled by the NavigationRoute above ──
