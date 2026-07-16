// Service worker for the ODCR Field Report PWA.
// Bump CACHE_NAME any time cached assets change, so returning users pick up
// the new version instead of a stale cache.
const CACHE_NAME = 'odcr-report-cache-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Files that must always be checked against the network first, so edits
// published on GitHub show up on refresh instead of being stuck behind a
// stale cached copy. Falls back to the cached copy only when offline.
const NETWORK_FIRST = ['index.html', 'questions.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

function isNetworkFirst(url){
  return NETWORK_FIRST.some((name) => url.pathname.endsWith(name)) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (isNetworkFirst(url)) {
    // Network-first: always try to get the latest version. Only fall back
    // to whatever is cached if the network request fails (e.g. offline).
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, fonts, etc.) — these
  // rarely change and this keeps the app fast and usable offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
