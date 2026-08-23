const CACHE_VERSION = "diandian-chinese-v54";
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./vendor/hanzi-writer.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./modules/shared/learning-api-client.js",
  "./modules/shared/voice-orb.js",
  "./modules/learning-hub/index.html",
  "./modules/learning-hub/styles.css",
  "./modules/learning-hub/writing-zone.css",
  "./modules/learning-hub/practice-analytics.css",
  "./modules/learning-hub/app.js",
  "./modules/learning-hub/writing-zone.js",
  "./modules/learning-hub/practice-analytics.js",
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
  "./modules/word-link/index.html",
  "./modules/word-link/styles.css",
  "./modules/word-link/app.js",
  "./modules/hanzi-challenge/index.html",
  "./modules/hanzi-challenge/sfx/correct_1.mp3",
  "./modules/hanzi-challenge/sfx/correct_2.mp3",
  "./modules/hanzi-challenge/sfx/correct_3.mp3",
  "./modules/hanzi-challenge/sfx/correct_4.mp3",
  "./modules/hanzi-challenge/sfx/correct_5.mp3",
  "./modules/hanzi-challenge/sfx/correct_6.mp3",
  "./modules/hanzi-challenge/sfx/wrong_1.mp3",
  "./modules/hanzi-challenge/sfx/wrong_2.mp3",
  "./modules/hanzi-challenge/sfx/wrong_3.mp3",
  "./modules/hanzi-challenge/sfx/wrong_4.mp3",
  "./modules/hanzi-challenge/sfx/celebrate.mp3",
  "./modules/digital-book/index.html",
  "./modules/digital-book/styles.css",
  "./modules/digital-book/pronunciation.css",
  "./modules/digital-book/app.js",
  "./modules/digital-book/pronunciation.js"
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
