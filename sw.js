const CACHE_VERSION = "tiantian-chinese-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./tools.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./vendor/hanzi-writer.min.js",
  "./data/stroke-data.js",
  "./data/character-lessons.js",
  "./data/character-cultures.js",
  "./data/textbook-library.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./modules/listening-speaking/index.html",
  "./modules/listening-speaking/styles.css",
  "./modules/listening-speaking/app.js",
  "./modules/listening-speaking/config.js",
  "./modules/listening-speaking/data/demo-data.js",
  "./modules/listening-speaking/js/api-client.js",
  "./modules/listening-speaking/js/voice-orb.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || cache.match("./index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const updated = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || updated;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  const isSameOrigin = url.origin === self.location.origin;
  const isStrokeData = url.hostname === "hsk-1311686407.cos.ap-guangzhou.myqcloud.com" &&
    url.pathname.includes("/hanzi-companion/stroke-data/");
  if (isSameOrigin || isStrokeData) event.respondWith(staleWhileRevalidate(request));
});
