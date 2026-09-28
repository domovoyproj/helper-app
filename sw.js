// Helper PWA Service Worker — офлайн-кэш с версионированием.
// При изменении статических файлов увеличьте CACHE_VERSION, чтобы сбросить старый кэш.
const CACHE_VERSION = 'helper-v2.3';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './experience.css',
  './app.js',
  './experience.js',
  './kyd-connector.js',
  './IMG_0676.png',
  './vendor/crypto-js.min.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // All runtime files are local. Keep the previous worker if an update is incomplete.
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
  // Никогда не кэшируем обращения к API (Gemini, GitHub, TinyURL и т.п.) — только сеть.
  if (url.pathname.includes('/api/')) return;
  if (url.origin !== self.location.origin && !PRECACHE.includes(req.url)) return;

  // Навигация (HTML): network-first, чтобы получать свежую версию, с офлайн-фолбэком.
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

  // Статика: cache-first с дозаписью в кэш.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          if (!res.ok) throw new Error('Navigation unavailable');
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
