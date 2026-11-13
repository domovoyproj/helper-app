const CACHE_VERSION = 'helper-v3.3';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './styles.css?v=3.3',
  './experience.css?v=3.3',
  './app.js?v=3.3',
  './food-config.js?v=3.3',
  './food-ai.js?v=3.3',
  './experience.js?v=3.3',
  './workspace.js?v=3.3',
  './icon.svg',
  './icon-512.png',
  './vendor/crypto-js.min.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('helper-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return;
  if (url.origin !== self.location.origin && !PRECACHE.includes(req.url)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok) throw new Error('Navigation unavailable');
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached || Response.error());
      return cached || fresh;
    })
  );
});
