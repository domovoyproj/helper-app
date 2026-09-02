// Helper PWA Service Worker — офлайн-кэш с версионированием.
// При изменении статических файлов увеличьте CACHE_VERSION, чтобы сбросить старый кэш.
const CACHE_VERSION = 'helper-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './IMG_0676.png',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // Кэшируем поштучно: сбой одного ресурса (CDN/офлайн) не должен срывать всю установку.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Никогда не кэшируем обращения к API (Gemini, GitHub, TinyURL и т.п.) — только сеть.
  if (url.origin !== self.location.origin && !PRECACHE.includes(req.url)) return;

  // Навигация (HTML): network-first, чтобы получать свежую версию, с офлайн-фолбэком.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
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
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
