/* Little Learners — offline service worker
 *
 * Strategy:
 *  - Precache the full app shell so the app works offline after first load.
 *  - For same-origin GETs: cache-first, then network, then any cached fallback.
 *  - For Google Fonts (cross-origin): network-first, fall back to cache if available.
 *  - Bump CACHE_VERSION whenever app assets change so old caches are cleaned up.
 */
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `pp-little-learners-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',

  './styles/shared.css',
  './styles/learners.css',
  './styles/categories.css',
  './styles/book.css',

  './shared/namespace.js',
  './shared/progress.js',
  './shared/theme.js',
  './shared/mascot.js',
  './shared/voice.js',
  './shared/audio.js',
  './shared/confetti.js',
  './shared/ui.js',
  './shared/auto-pause.js',

  './js/hub.js',
  './js/game-core.js',
  './js/sticker-book.js',
  './js/game-story.js',
  './js/parent.js',
  './js/settings.js',
  './js/game-letters.js',
  './js/game-numbers.js',
  './js/game-colors.js',
  './js/game-shapes.js',
  './js/game-animals.js',
  './js/game-bodyparts.js',
  './js/game-family.js',
  './js/game-food.js',
  './js/game-counting.js',
  './js/game-phonics.js',

  './js/data/categories.js',
  './js/data/letters.js',
  './js/data/numbers.js',
  './js/data/colors.js',
  './js/data/shapes.js',
  './js/data/animals.js',
  './js/data/bodyparts.js',
  './js/data/family.js',
  './js/data/food.js',
  './js/data/phonics.js',

  './pages/letters.html',
  './pages/numbers.html',
  './pages/colors.html',
  './pages/shapes.html',
  './pages/animals.html',
  './pages/bodyparts.html',
  './pages/family.html',
  './pages/food.html',
  './pages/counting.html',
  './pages/phonics.html',
  './pages/stickers.html',
  './pages/story.html',
  './pages/parent.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Use individual adds so a single 404 doesn't sink the whole install.
      Promise.all(PRECACHE.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isFonts = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';

  if (isSameOrigin) {
    event.respondWith(cacheFirst(req));
  } else if (isFonts) {
    event.respondWith(networkFirst(req));
  }
  // Everything else: let the browser handle it.
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && req.url.startsWith(self.location.origin)) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    // Last-ditch: serve index.html for navigations so the SPA-ish shell still loads.
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}
