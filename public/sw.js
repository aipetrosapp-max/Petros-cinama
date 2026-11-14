// Petros Cinema (Aipetros-stream) Production Auto-Updating Service Worker
const CACHE_NAME = 'aipetros-cache-v2.5.0';

// Files to cache for offline capabilities
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './logo.svg',
  './version.json'
];

// Install: pre-cache assets and force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache partial fallback:', err);
      });
    })
  );
});

// Activate: clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy: Network-First for HTML, version.json, and streams.json; Cache-First for hashed assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache or intercept live video streams, external CDN chunks, or API requests
  if (
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.mkv') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.hostname.includes('abrtech.top') ||
    url.hostname.includes('api.telegram.org') ||
    url.hostname.includes('omdbapi.com') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('raw.githubusercontent.com')
  ) {
    return;
  }

  // Network-First for version.json and HTML navigation requests to ensure instant update pickup
  if (event.request.mode === 'navigate' || url.pathname.endsWith('version.json') || url.pathname.endsWith('streams.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-First with Network fallback for hashed immutable assets (JS/CSS/SVG)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
        }
        return networkResponse;
      });
    })
  );
});

// Listen for message to force skip waiting from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
