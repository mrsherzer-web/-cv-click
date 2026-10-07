// Offline support: the whole game is cached on first visit, so the installed
// app works without internet. Bump VERSION whenever game files change.
const VERSION = 'gefen-snooker-v2';
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "css/fonts.css",
  "css/style.css",
  "src/config.js",
  "src/main.js",
  "src/story.js",
  "src/generated/assets-meta.js",
  "src/ui/dialogue.js",
  "src/ui/dom.js",
  "src/world/character.js",
  "src/world/corridor.js",
  "src/world/office.js",
  "src/world/props.js",
  "src/world/rooms.js",
  "src/engine/assets.js",
  "src/engine/audio.js",
  "src/engine/gfx.js",
  "src/engine/textures.js",
  "src/engine/voice.js",
  "src/scenes/escape.js",
  "src/scenes/intro.js",
  "src/scenes/night.js",
  "src/scenes/story.js",
  "src/game/save.js",
  "vendor/THREE_LICENSE",
  "vendor/three.module.min.js",
  "assets/img/char_cap.webp",
  "assets/img/char_cap_glow.png",
  "assets/img/char_gefen.webp",
  "assets/img/char_gefen_glow.png",
  "assets/img/char_smiler.webp",
  "assets/img/char_smiler_glow.png",
  "assets/img/gefen_normal.jpg",
  "assets/img/gefen_normal_blur.jpg",
  "assets/img/gefen_scary.jpg",
  "assets/img/gefen_scary_blur.jpg",
  "assets/img/js_cap.webp",
  "assets/img/js_gefen.webp",
  "assets/img/js_smiler.webp",
  "assets/img/tex_gefen_photo.jpg",
  "assets/img/tex_gefen_scary_photo.jpg",
  "assets/img/tex_poster_duo.jpg",
  "assets/img/vn_cap.webp",
  "assets/img/vn_duo.webp",
  "assets/img/vn_duo_possessed.webp",
  "assets/img/vn_gefen_normal.webp",
  "assets/img/vn_gefen_scary.webp",
  "assets/img/vn_maayan.webp",
  "assets/img/vn_smiler.webp",
  "assets/img/vn_yahali.webp",
  "assets/fonts/heebo-hebrew.woff2",
  "assets/fonts/heebo-latin.woff2",
  "assets/fonts/rubik-beastly-hebrew.woff2",
  "assets/fonts/rubik-beastly-latin.woff2",
  "assets/fonts/rubik-glitch-hebrew.woff2",
  "assets/fonts/rubik-glitch-latin.woff2",
  "assets/fonts/rubik-wet-paint-hebrew.woff2",
  "assets/fonts/rubik-wet-paint-latin.woff2",
  "assets/fonts/vt323-latin.woff2",
  "assets/video/possession.mp4",
  "assets/video/possession.webm"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
