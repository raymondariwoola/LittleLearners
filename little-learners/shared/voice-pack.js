/* PP.VoicePack — pre-baked phrase audio (Tier 1 of the voice stack).
 *
 * What this is:
 *   A tiny runtime that loads a manifest of phrase ids -> audio files and
 *   plays them on demand. When the manifest is missing or a phrase isn't in
 *   it, this module reports a miss so PP.Voice can fall through to the
 *   neural or device-speech tiers.
 *
 * Why it exists:
 *   Web Speech voices vary wildly by device. Pre-recording (or pre-baking
 *   with a single high-quality TTS) the lines kids hear most lets us
 *   guarantee a warm, consistent storyteller no matter where the app is
 *   opened. See `tools/bake-voice.mjs` for the generator.
 *
 * Storage:
 *   - Manifest fetched once at boot from `audio/voice/<packId>/manifest.json`.
 *   - Each clip URL is resolved relative to the app root (works from
 *     /pages/* too) and is cached by the service worker after first play.
 *   - The active pack id lives in `pp_settings.voicePackId`.
 *
 * Compatibility:
 *   - No-op (and silently misses) when the manifest 404s. Safe to ship
 *     before any clips are baked; PP.Voice just keeps using speechSynthesis.
 */
(function () {
  const DEFAULT_PACK_ID = 'hoot-en-v1';

  function S() { return (window.PP && PP.Progress) ? PP.Progress.settings() : {}; }
  function saveS(patch) { if (window.PP && PP.Progress) PP.Progress.setSettings(patch); }

  function appRoot() {
    const path = location.pathname.replace(/[^/]*$/, '');
    if (/\/pages\/$/.test(path)) return path.replace(/pages\/$/, '');
    return path;
  }
  function resolveUrl(url) {
    if (!url) return url;
    if (/^(?:[a-z]+:|\/\/|\/|data:|blob:)/i.test(url)) return url;
    try { return new URL(url, location.origin + appRoot()).toString(); }
    catch { return url; }
  }

  // Normalize a free-form spoken string into a key we can use to look up a
  // clip by text. We collapse whitespace, strip trailing punctuation that
  // doesn't affect meaning, and lowercase — so "Brilliant!" and "brilliant!"
  // match the same clip. We also strip a *leading* "the " article because
  // some game callers say "the cat" while the clip is recorded as just "cat".
  function normalize(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/^the\s+/, '')
      .replace(/[.,;:!?\u2026]+$/g, '');
  }

  let state = {
    packId: S().voicePackId || DEFAULT_PACK_ID,
    manifest: null,         // { id, label, voice, clips: { phraseId: { file, text, durationMs } } }
    textIndex: null,        // Map<normalized text, phraseId>
    ready: false,
    loading: null,          // Promise<void> while loading
    missing: new Set(),     // phrase ids/text that missed (for dev report)
  };

  // Currently-playing audio element, so interrupt() can stop it.
  let current = null;
  const lipsync = new Set(); // listeners: (speaking:boolean) => void
  // Listeners fired whenever the pack finishes loading (or fails). Settings
  // uses this to repaint the Voice card once the manifest resolves, because
  // the auto-loader injects this script after first paint.
  const changeListeners = new Set();
  function onChange(fn) { changeListeners.add(fn); return () => changeListeners.delete(fn); }
  function emitChange() {
    changeListeners.forEach(fn => { try { fn(); } catch (_) {} });
  }

  function onLipsync(fn) { lipsync.add(fn); return () => lipsync.delete(fn); }
  function emitLipsync(speaking) { lipsync.forEach(fn => { try { fn(speaking); } catch (_) {} }); }

  function packUrl(file) {
    return resolveUrl(`audio/voice/${state.packId}/${file}`);
  }

  function load(packId) {
    const id = packId || state.packId;
    state.packId = id;
    state.ready = false;
    state.manifest = null;
    state.textIndex = null;
    state.loading = fetch(resolveUrl(`audio/voice/${id}/manifest.json`), { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('manifest-missing')))
      .then(json => {
        state.manifest = json;
        const idx = new Map();
        const clips = json && json.clips ? json.clips : {};
        Object.keys(clips).forEach(phraseId => {
          const meta = clips[phraseId];
          if (meta && typeof meta.text === 'string') {
            idx.set(normalize(meta.text), phraseId);
          }
        });
        state.textIndex = idx;
        state.ready = true;
        emitChange();
      })
      .catch(() => {
        // No pack on disk yet — that's fine, just stay silent.
        state.manifest = null;
        state.textIndex = new Map();
        state.ready = false;
        emitChange();
      });
    return state.loading;
  }

  // Resolve an input (String wrapper from PP.Phrases, or a plain string) to
  // a clip metadata record or null.
  function match(input) {
    if (!state.manifest) return null;
    const phraseId = input && typeof input === 'object' && input.phraseId;
    if (phraseId && state.manifest.clips && state.manifest.clips[phraseId]) {
      return { phraseId, ...state.manifest.clips[phraseId] };
    }
    const text = (typeof input === 'string') ? input : String(input || '');
    const hit = state.textIndex && state.textIndex.get(normalize(text));
    if (hit && state.manifest.clips[hit]) {
      return { phraseId: hit, ...state.manifest.clips[hit] };
    }
    if (text) state.missing.add(text);
    return null;
  }

  // Play a matched clip. opts: { interrupt, rate, volume, onStart, onEnd }.
  // Returns a Promise that resolves when playback ends (or errors).
  function play(meta, opts = {}) {
    if (!meta || !meta.file) return Promise.resolve(false);
    if (opts.interrupt !== false) interrupt();

    const url = packUrl(meta.file);
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    audio.playbackRate = Math.max(0.5, Math.min(2, opts.rate ?? 1));
    audio.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
    current = audio;

    return new Promise(resolve => {
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        if (current === audio) current = null;
        emitLipsync(false);
        try { audio.pause(); } catch (_) {}
        resolve(!!ok);
      };
      audio.addEventListener('ended', () => finish(true));
      audio.addEventListener('error', () => finish(false));
      // Safety net: if the file is much longer than the manifest claims, the
      // 'ended' event still fires; this is just a last-ditch failsafe so a
      // hung Audio element can't deadlock the speak() promise chain.
      if (meta.durationMs) {
        setTimeout(() => finish(true), Math.max(800, meta.durationMs + 1500));
      }
      emitLipsync(true);
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => finish(false));
    });
  }

  function interrupt() {
    if (!current) return;
    try { current.pause(); current.currentTime = 0; } catch (_) {}
    current = null;
    emitLipsync(false);
  }

  function isReady() { return state.ready; }
  function isLoaded() { return !!state.manifest; }
  function getPackInfo() {
    if (!state.manifest) return null;
    return { id: state.manifest.id, label: state.manifest.label, voice: state.manifest.voice, count: Object.keys(state.manifest.clips || {}).length };
  }
  function report() {
    return { missing: Array.from(state.missing).slice(0, 200), packed: state.manifest ? Object.keys(state.manifest.clips).length : 0 };
  }
  function setPack(id) {
    saveS({ voicePackId: id });
    return load(id);
  }

  window.PP = window.PP || {};
  window.PP.VoicePack = {
    load, match, play, interrupt,
    isReady, isLoaded, getPackInfo,
    onLipsync, onChange, report, setPack,
    normalize, // exposed for tests / bake script
  };

  // Kick off the load immediately. We don't await — match() simply returns
  // null until the manifest resolves, and the first speak() call after that
  // will start hitting the pack.
  load().catch(() => { /* swallowed; load() already handled */ });
})();
