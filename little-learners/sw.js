/* Little Learners — offline service worker
 *
 * Strategy:
 *  - Precache the full app shell so the app works offline after first load.
 *  - Navigations (HTML): network-first, falling back to cache (then index.html).
 *    This ensures users always see the latest page when online, instead of being
 *    pinned to a stale precached copy until they hard-refresh.
 *  - Other same-origin assets (CSS / JS / data / images): stale-while-revalidate
 *    — instant load from cache, refreshed in the background so the *next* visit
 *    has the new file. Combined with the navigation strategy above, a single
 *    normal refresh is enough to pick up code changes.
 *  - Google Fonts (cross-origin): network-first, fall back to cache if available.
 *  - Bump CACHE_VERSION whenever app assets change so old caches are cleaned up.
 */
const CACHE_VERSION = 'v1.5.1';
const CACHE_NAME = `pp-little-learners-${CACHE_VERSION}`;

// Voice assets (pre-baked phrase clips and the manifest) live in a separate
// cache so they survive app version bumps. The clips are immutable per
// phrase id, so we cache-first them forever and let the manifest version
// invalidate them.
const VOICE_CACHE = 'pp-voice-assets-v1';
const VOICE_PATH_RE = /\/audio\/voice\//;

// Neural-tier runtime + model files come from third-party CDNs (esm.sh for
// the JS, huggingface.co for the Piper voice). They're large and immutable
// per URL, so we cache-first them in a dedicated bucket that also survives
// version bumps. This makes Hoot Plus work offline after first download.
const NEURAL_CACHE = 'pp-neural-tts-v1';
const NEURAL_HOSTS = new Set([
  'esm.sh',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com', // onnxruntime-web wasm loaded by vits-web
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cas-bridge.xethub.hf.co', // HF often redirects model files through here
]);

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
  './shared/voice-pack.js',
  './shared/voice-neural.js',
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
  './js/game-memory.js',

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
  './pages/memory.html',
  './pages/parent.html',
  './pages/settings.html',

  './audio/voice/hoot-en-v1/manifest.json',
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
      // Keep the active app cache AND the dedicated voice + neural caches
      // when cleaning stale versions; both are large and don't change
      // across app updates.
      Promise.all(keys
        .filter((k) => k !== CACHE_NAME && k !== VOICE_CACHE && k !== NEURAL_CACHE)
        .map((k) => caches.delete(k)))
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
    // Voice clips: cache-first, never evicted by version bumps. The manifest
    // is the source of truth for which clip ids are valid, so a clip URL is
    // effectively immutable once baked.
    if (VOICE_PATH_RE.test(url.pathname) && !/manifest\.json$/.test(url.pathname)) {
      event.respondWith(cacheFirstVoice(req));
      return;
    }
    // Navigations (HTML page loads) must be network-first so updates show up
    // immediately on a normal refresh. Everything else uses
    // stale-while-revalidate so the UI stays fast but updates within one cycle.
    if (req.mode === 'navigate' || req.destination === 'document') {
      event.respondWith(networkFirstNavigation(req));
    } else {
      event.respondWith(staleWhileRevalidate(req));
    }
  } else if (isFonts) {
    event.respondWith(networkFirst(req));
  } else if (NEURAL_HOSTS.has(url.host)) {
    // Neural TTS runtime + model files (esm.sh, huggingface.co). Cache-first
    // in a dedicated bucket so a returning visitor doesn't re-download 80 MB
    // every session. These URLs are content-hashed by the CDN so a stale
    // entry is safe to keep indefinitely.
    event.respondWith(cacheFirstNeural(req));
  }
  // Everything else: let the browser handle it.
});

// Allow the page to ask the SW to take over immediately after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  // Settings -> "Remove voice" sends this to wipe the cached neural model.
  // We reply via the source port so the UI can confirm + repaint.
  if (event.data && event.data.type === 'PURGE_NEURAL_CACHE') {
    event.waitUntil((async () => {
      const ok = await caches.delete(NEURAL_CACHE);
      if (event.source && event.source.postMessage) {
        try { event.source.postMessage({ type: 'PURGE_NEURAL_CACHE_DONE', ok }); } catch (_) {}
      }
    })());
  }
});

async function networkFirstNavigation(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match('./index.html');
    if (shell) return shell;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  const networkPromise = fetch(req).then((res) => {
    if (res && res.ok && req.url.startsWith(self.location.origin)) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  });
  if (cached) {
    // Kick off background refresh but don't block on it; swallow errors.
    networkPromise.catch(() => {});
    return cached;
  }
  // No cache: must await the network and surface any error so the browser
  // can show a proper failure instead of receiving a null Response.
  return networkPromise;
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

// Cache-first for the voice clip pack. The clip URL is keyed by phrase id
// in the manifest, so once it's downloaded we never need to refetch it.
async function cacheFirstVoice(req) {
  const cache = await caches.open(VOICE_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// Cache-first for the neural TTS runtime + model. Some HuggingFace responses
// arrive as opaque (no-cors) when fetched cross-origin without credentials —
// we still cache them so subsequent loads work offline, but we only
// re-serve cached entries with a matching response type to avoid surprising
// any caller that needs the original headers.
async function cacheFirstNeural(req) {
  const cache = await caches.open(NEURAL_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    // Only cache successful or opaque responses; skip 4xx/5xx so a transient
    // error doesn't poison the cache.
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}
