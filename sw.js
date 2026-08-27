const CACHE_VERSION = "diandian-chinese-v103";
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
  "./modules/shared/learning-api-client.js?v=20260825-1",
  "./modules/shared/voice-orb.js?v=20260801-1",
  "./modules/ai-teacher/index.html",
  "./modules/ai-teacher/styles.css?v=20260827-1",
  "./modules/ai-teacher/app.js?v=20260827-1",
  "./modules/shared/draggable.js?v=20260823-1",
  "./modules/learning-hub/index.html",
  "./modules/learning-hub/templates/student-import-template.xlsx",
  "./modules/learning-hub/styles.css?v=20260824-4",
  "./modules/learning-hub/writing-zone.css?v=20260826-2",
  "./modules/learning-hub/practice-analytics.css?v=20260811-6",
  "./modules/learning-hub/app.js?v=20260826-1",
  "./modules/learning-hub/writing-zone.js?v=20260826-2",
  "./modules/learning-hub/practice-analytics.js?v=20260826-1",
  "./modules/character-hit/index.html",
  "./modules/character-hit/styles.css",
  "./modules/character-hit/app.js",
  "./modules/character-hit/assets/scene.svg",
  "./modules/character-hit/assets/audio/launch.wav",
  "./modules/character-hit/assets/audio/correct.wav",
  "./modules/character-hit/assets/audio/shatter.wav",
  "./modules/character-hit/assets/audio/place.wav",
  "./modules/character-hit/assets/audio/stage.wav",
  "./modules/character-hit/assets/audio/victory.wav",
  "./data/games/character-hit/zjzh-1-1.json",
  "./modules/digital-book/index.html",
  "./modules/digital-book/styles.css?v=20260826-10",
  "./modules/digital-book/pronunciation.css?v=20260824-1",
  "./modules/digital-book/app.js?v=20260826-10",
  "./modules/digital-book/pronunciation.js?v=20260824-1"
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
