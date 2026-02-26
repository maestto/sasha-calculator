const CACHE_NAME = 'sasha-calculator-v16';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './js/ui.js',
  './js/calculator.js',
  './js/storage.js',
  './js/settings.js',
  './js/export.js',
  './js/format.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const putInCache = (cacheRequest, response) => {
    if (!response || !response.ok || response.type === 'opaque') {
      return response;
    }

    const responseClone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(cacheRequest, responseClone));
    return response;
  };

  const isStaticAsset = ['style', 'script', 'manifest', 'font', 'image', 'worker']
    .includes(request.destination);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => putInCache(request, response))
        .catch(async () => {
          const cachedRequest = await caches.match(request);
          if (cachedRequest) {
            return cachedRequest;
          }

          return caches.match('./index.html');
        })
    );

    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => caches.match(request))
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => putInCache(request, response));
    })
  );
});
