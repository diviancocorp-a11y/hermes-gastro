// Service Worker (Workbox-powered)
// NOTE: Business name below must be updated manually or via onboarding script.
// Uses Workbox from CDN — no build step required.
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

const { precacheAndRoute } = workbox.precaching;
const { registerRoute, NavigationRoute, Route } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
// Background Sync removed intentionally — see "submit-order" section below.

// ─── Skip waiting on install ────────────────────────────
self.skipWaiting();
workbox.core.clientsClaim();

// ─── Pre-cache app shell ────────────────────────────────
// NOTE: Do NOT precache / or /index.html — the NavigationRoute
// with NetworkFirst below handles HTML and always checks the network
// first, so new deploys are picked up immediately.
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
    cacheName: 'lnp-static-v3',
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
    cacheName: 'lnp-images-v3',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }), // 7 days
    ],
  }),
);

// ─── NetworkFirst: API calls (Supabase) ─────────────────
registerRoute(
  ({ url }) => url.hostname.includes('supabase'),
  new NetworkFirst({
    cacheName: 'lnp-api-v3',
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
      cacheName: 'lnp-pages-v3',
      networkTimeoutSeconds: 3,
    }),
  ),
);

// ─── submit-order: NUNCA passar por el SW ────────────────────────
// Antes existía un BackgroundSyncPlugin que reintentaba la request si
// el primer intento "fallaba" (típicamente por CORS), produciendo
// pedidos duplicados porque la orden ya se había creado en DB.
// Ahora la request va directo a la red — si falla, falla, y el cliente
// muestra el error correctamente. Si en el futuro se quiere offline
// support para pedidos, debe implementarse con idempotency-key en la
// edge function antes de re-habilitar el background sync.
registerRoute(
  ({ url }) => url.hostname.includes('supabase') && url.pathname.includes('submit-order'),
  async ({ request }) => fetch(request),
  'POST',
);

// ─── Push notifications ─────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'La Nona Pato', body: '¡Tenemos novedades!', url: '/', icon: '/icons/icon-192.png' };
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
