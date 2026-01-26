/* sw.js v9 */
const VERSION = "v9";
const BASE_PATH = "/colorfinder/daten-os/";
const CACHE_NAME = `colorfinder-${VERSION}`;

const CORE_ASSETS = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}style.css`,
  `${BASE_PATH}app.js`,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith("colorfinder-") && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // ⭐ ENTSCHEIDEND FÜR FLUGMODUS START
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(`${BASE_PATH}index.html`, { ignoreSearch: true });
        if (cached) return cached;

        try {
          return await fetch(req);
        } catch {
          return new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  if (!sameOrigin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response("", { status: 503 });
      }
    })()
  );
});
