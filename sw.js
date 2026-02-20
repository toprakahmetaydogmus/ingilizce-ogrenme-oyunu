// ULTIMATE+ English — Service Worker (offline-first)
const CACHE_NAME = 'ue-cache-v8';
const CORE_ASSETS = [
  './',
  './index.html',
  './single.html',
  './database.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      self.clients.claim();
    })()
  );
});

function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Only handle GET
  if (req.method !== 'GET') return;

  // Navigation: network-first, fallback to cached index
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      })()
    );
    return;
  }

  // Same-origin assets: cache-first with background update
  if (isSameOrigin(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            // Cache successful responses
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);

        // database.json: prefer fresh but fallback to cache
        if (url.endsWith('/database.json') || url.endsWith('database.json')) {
          const fresh = await fetchPromise;
          return fresh || cached || Response.error();
        }

        return cached || (await fetchPromise) || Response.error();
      })()
    );
  }
});
