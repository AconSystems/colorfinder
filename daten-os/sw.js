"use strict";

/*
ColorFinder sw.js
komplette datei ersetzen
bei jedem release VERSION erhoehen
*/

const VERSION = "v11";
const CACHE_NAME = "colorfinder-cache-" + VERSION;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./sw.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
    })()
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(offlineFirstNavigate(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

async function offlineFirstNavigate(req) {
  const cache = await caches.open(CACHE_NAME);

  const cachedIndex =
    (await cache.match("./index.html", { ignoreSearch: true })) ||
    (await cache.match("./", { ignoreSearch: true }));

  if (cachedIndex) return cachedIndex;

  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (_) {
    return new Response("offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  return cached || (await networkPromise) || cached || offlineText();
}

function offlineText() {
  return new Response("offline", {
    status: 503,
    headers: { "Content-Type": "text/plain" }
  });
}
