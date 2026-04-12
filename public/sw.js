// Service Worker — La Nona Pato
// Cache-first for static assets, network-first for API calls

const CACHE_NAME = 'lnp-v1';
const STATIC_ASSETS = ['/', '/index.html', '/favicon.svg', '/quack.mp3'];

// Install: pre-cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and supabase API requests (always fresh)
  if (e.request.method !== 'GET' || url.hostname.includes('supabase')) return;

  // JS/CSS/images: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // HTML: network-first with cache fallback
  e.respondWith(
    fetch(e.request).then((res) => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
