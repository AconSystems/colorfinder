const CACHE_NAME = "colorfinder-v3";

const ASSETS = [
  "/colorfinder/daten-os/index.html",
  "/colorfinder/daten-os/style.css",
  "/colorfinder/daten-os/app.js",
  "/colorfinder/daten-os/manifest.json",
  "/colorfinder/daten-os/icons/icon-192.png",
  "/colorfinder/daten-os/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;

      return fetch(event.request).catch(() => {
        return caches.match("/colorfinder/daten-os/index.html");
      });
    })
  );
});
