"use strict";

/*
ColorFinder sw.js
komplette datei ersetzen
bei jedem release VERSION erhoehen
*/

const VERSION = "v7";
const CACHE_NAME = "colorfinder-cache-" + VERSION;

// passe die liste an falls du spaeter mehr files hast
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("colorfinder-cache-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// optional: aus der app kannst du per postMessage "SKIP_WAITING" senden
self.addEventListener("message", (event) => {
  if (event && event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // nur GET behandeln
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // nur same origin cachen
  if (url.origin !== self.location.origin) return;

  event.respondWith(staleWhileRevalidate(req));
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const networkPromise = fetch(req)
    .then((res) => {
      // nur erfolgreiche basic responses cachen
      if (res && res.ok && res.type === "basic") {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  // wenn cache da ist sofort liefern sonst netz
  return cached || (await networkPromise) || cachedFallback(req);
}

async function cachedFallback(req) {
  // fuer navigation immer index.html liefern wenn vorhanden
  if (req.mode === "navigate") {
    const cache = await caches.open(CACHE_NAME);
    const cachedIndex = await cache.match("./index.html");
    if (cachedIndex) return cachedIndex;
  }
  return new Response("offline", {
    status: 503,
    headers: { "Content-Type": "text/plain" }
  });
}
