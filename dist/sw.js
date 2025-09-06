const CACHE_NAME = 'ep-video-cache-v1';
const VIDEO_PATH_SEGMENT = '/videos/';

// Install: take control quickly
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    // Ensure the cache exists
    const cache = await caches.open(CACHE_NAME);
    return cache;
  })());
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== CACHE_NAME) return caches.delete(k);
      return Promise.resolve();
    }));
    // Claim clients so the SW starts controlling pages immediately
    try { await self.clients.claim(); } catch { /* no-op */ }
  })());
});

// Fetch handler:
// - If request is for /videos/* and includes a Range header, forward to network (do not cache partial responses).
// - If request is for /videos/* without Range header, try cache first then network, caching successful responses.
// - Other requests: passthrough to network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Only handle same-origin video paths
  if (!url.pathname.includes(VIDEO_PATH_SEGMENT)) return;

  // If client requested a byte range, bypass cache and forward request to network so server handles range responses.
  if (request.headers.has('range')) {
    event.respondWith(fetch(request).catch(err => {
      // Fallback: return 416-like response or network error
      return new Response(null, { status: 504, statusText: 'Network error for ranged request' });
    }));
    return;
  }

  // For full requests, try cache first
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        // Return cached response and refresh in background
        event.waitUntil((async () => {
          try {
            const fresh = await fetch(request);
            if (fresh && fresh.ok) await cache.put(request, fresh.clone());
          } catch { /* ignore background refresh errors */ }
        })());
        return cached;
      }

      // Not cached: fetch from network, cache and return
      const response = await fetch(request);
      if (response && response.ok) {
        try { await cache.put(request, response.clone()); } catch { /* ignore cache put errors */ }
      }
      return response;
    } catch (err) {
      // Final fallback: network attempt
      try { return await fetch(request); } catch { return new Response(null, { status: 504, statusText: 'Offline' }); }
    }
  })());
});

// Support skipWaiting via postMessage from the page
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data === 'skipWaiting') {
    try { self.skipWaiting(); } catch { /* no-op */ }
  }
});