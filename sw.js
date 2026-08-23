const CACHE_VERSION = "diandian-chinese-v66";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./config.js?v=20260823-1",
  "./vendor/hanzi-writer.min.js?v=20260731-16",
  "./vendor/xlsx.full.min.js",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/icon-96.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./modules/shared/learning-api-client.js?v=20260823-4",
  "./modules/shared/voice-orb.js?v=20260801-1",
  "./modules/shared/draggable.js?v=20260823-1",
  "./modules/learning-hub/index.html",
  "./modules/learning-hub/templates/student-import-template.xlsx",
  "./modules/learning-hub/styles.css?v=20260823-6",
  "./modules/learning-hub/writing-zone.css?v=20260811-3",
  "./modules/learning-hub/practice-analytics.css?v=20260811-6",
  "./modules/learning-hub/app.js?v=20260823-10",
  "./modules/learning-hub/writing-zone.js?v=20260823-1",
  "./modules/learning-hub/practice-analytics.js?v=20260823-1",
  "./modules/character-hit/index.html",
  "./modules/character-hit/styles.css?v=20260818-2",
  "./modules/character-hit/app.js?v=20260818-3",
  "./modules/character-hit/assets/scene.svg",
  "./modules/word-link/index.html",
  "./modules/word-link/styles.css?v=20260818-2",
  "./modules/word-link/app.js?v=20260818-4",
  "./modules/hanzi-challenge/index.html",
  "./modules/digital-book/index.html",
  "./modules/digital-book/styles.css?v=20260823-6",
  "./modules/digital-book/pronunciation.css?v=20260823-8",
  "./modules/digital-book/app.js?v=20260823-6",
  "./modules/digital-book/pronunciation.js?v=20260823-9"
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
  const isAudio = /\.(mp3|m4a|wav)$/i.test(url.pathname);
  if (request.headers.has("range") || isAudio) {
    event.respondWith(fetch(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  const isSameOrigin = url.origin === self.location.origin;
  const isStrokeData = url.hostname === "hsk-1311686407.cos.ap-guangzhou.myqcloud.com" &&
    url.pathname.includes("/hanzi-companion/stroke-data/");
  if (isSameOrigin || isStrokeData) event.respondWith(staleWhileRevalidate(request));
});
