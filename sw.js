// Service worker: מאפשר פתיחה גם בלי אינטרנט (מצב הדגמה + מתכונים מקומיים)
const CACHE = 'smartpantry-v4';
const ASSETS = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/engine.js', 'js/data.js', 'js/ai.js', 'js/icons.js', 'js/prompts.js',
  'assets/host.jpg', 'assets/host-avatar.jpg', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // השרת (api/) תמיד חי – לא שומרים מכסות או תשובות במטמון
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // רשת קודם, מטמון כגיבוי – כך עדכונים מגיעים מיד
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
