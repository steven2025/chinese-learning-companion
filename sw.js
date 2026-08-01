const CACHE_VERSION = "diandian-chinese-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./vendor/hanzi-writer.min.js",
  "./data/lessons/zjzh-1-1/vocabulary-audio.json",
  "./data/lessons/zjzh-1-1/vocabulary-metadata.json",
  "./data/lessons/zjzh-1-1/text-audio.json",
  "./data/lessons/zjzh-1-1/book-pages.json",
  "./data/lessons/zjzh-1-1/lesson-practice.json",
  "./data/lessons/zjzh-1-1/practice-intro-translations.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./modules/shared/learning-api-client.js",
  "./modules/shared/voice-orb.js",
  "./modules/learning-hub/index.html",
  "./modules/learning-hub/styles.css",
  "./modules/learning-hub/app.js",
  "./modules/digital-book/index.html",
  "./modules/digital-book/styles.css",
  "./modules/digital-book/app.js",
  "./modules/digital-book/book-data.js",
  "./modules/digital-book/stroke-data.js"
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
