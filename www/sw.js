/* Hoshi service worker: offline shell + cached posters.
   Bump VERSION when you change any file so phones pick up the new version. */
const VERSION = 'hoshi-v5';
const IMG = 'hoshi-img-v1';
const IMG_MAX = 250;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - IMG_MAX; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;           // API calls (AniList, cloud) are POST or never cached
  const url = new URL(req.url);

  // Anime posters and Google Fonts: serve from cache, refresh in the background.
  if (url.hostname.endsWith('anilist.co') || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(IMG).then(cache => cache.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { cache.put(req, res.clone()).then(() => trim(cache)); }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })));
    return;
  }

  if (url.origin !== location.origin) return;  // never touch the cloud/auth traffic

  // App files: network first so updates show up, fall back to cache when offline.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
