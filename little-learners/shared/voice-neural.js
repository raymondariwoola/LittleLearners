/* PP.VoiceNeural — in-browser neural TTS (Tier 2 of the voice stack).
 *
 * Sits between the pre-baked phrase pack (Tier 1) and the device Web Speech
 * fallback (Tier 3). When the pack misses a line (a child's name, a story
 * sentence, a less-common word), this module synthesizes it on-device so
 * everything still sounds like Hoot instead of switching to the system
 * voice mid-sentence.
 *
 * Engine
 * ------
 * Piper voices via @diffusionstudio/vits-web. Each voice is ~20 MB,
 * WASM-only, runs offline after the first download. Stored in the browser's
 * Origin Private File System (OPFS) under "piper/".
 *
 * Storage layout
 * --------------
 *   - The engine library is fetched from a CDN (esm.sh) and cached by the
 *     browser HTTP cache + our service worker.
 *   - The voice .onnx + .json are downloaded from Hugging Face and stored
 *     in OPFS by vits-web itself.
 *   - Per-text synth results are cached in-memory as Blob URLs for the
 *     session (helps when the same line replays during a round).
 *
 * Settings hooks (read from PP.Progress.settings()):
 *   - neuralEnabled : true to allow use of this tier
 *   - neuralVoice   : Piper voice id (e.g. 'en_US-amy-medium')
 *   - neuralAutoLoad: true to warm up on page load; default false (manual)
 */
(function () {
  // ---- pinned CDN URL ----------------------------------------------------
  // Use jsDelivr's rolled bundle (`/+esm`) rather than esm.sh: the esm.sh
  // build injects an `unenv` Node `fs` polyfill that throws
  // "[unenv] fs.readFile is not implemented yet!" when onnxruntime tries to
  // read the model. jsDelivr ships dist/vits-web.js verbatim from npm and
  // loads onnxruntime-web from cdnjs (a real browser CDN), so it just works.
  const PIPER_ESM = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm';
  const PIPER_DEFAULT_VOICE = 'en_US-amy-medium';

  // Subset of Piper voices we expose in the UI. The full list lives in the
  // vits-web PATH_MAP; we curate kid-friendly American English voices first.
  const VOICE_CATALOG = [
    { id: 'en_US-amy-medium',       label: 'Amy (US, medium)',       size: '~20 MB' },
    { id: 'en_US-amy-low',          label: 'Amy (US, low)',          size: '~7 MB'  },
    { id: 'en_US-hfc_female-medium',label: 'HFC Female (US, medium)',size: '~20 MB' },
    { id: 'en_US-libritts_r-medium',label: 'LibriTTS-R (US, medium)',size: '~20 MB' },
    { id: 'en_US-lessac-medium',    label: 'Lessac (US, medium)',    size: '~20 MB' },
    { id: 'en_US-ryan-medium',      label: 'Ryan (US, medium)',      size: '~20 MB' },
    { id: 'en_US-joe-medium',       label: 'Joe (US, medium)',       size: '~20 MB' },
    { id: 'en_GB-alan-medium',      label: 'Alan (UK, medium)',      size: '~20 MB' },
  ];
  const VALID_VOICE_IDS = new Set(VOICE_CATALOG.map(v => v.id));

  // ---- state -------------------------------------------------------------
  const state = {
    ready: false,
    loading: null,
    error: null,
    config: null,         // { voice }
    engine: null,         // { synth, listVoices, mod }
    cache: new Map(),     // normalized text -> Blob URL
    progress: { phase: 'idle', loaded: 0, total: 0, percent: 0, label: '' },
  };

  const listeners = new Set();
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function notify() { listeners.forEach(fn => { try { fn(snapshot()); } catch (_) {} }); }

  function snapshot() {
    return {
      ready: state.ready,
      loading: !!state.loading,
      error: state.error ? String(state.error.message || state.error) : null,
      engine: 'piper',
      voice: state.config && state.config.voice,
      progress: { ...state.progress },
    };
  }

  function setProgress(patch) {
    Object.assign(state.progress, patch);
    if (typeof state.progress.loaded === 'number' && typeof state.progress.total === 'number' && state.progress.total > 0) {
      state.progress.percent = Math.round((state.progress.loaded / state.progress.total) * 100);
    }
    notify();
  }

  // ---- capability detection ---------------------------------------------
  function capability() {
    const hasWasm = typeof WebAssembly === 'object';
    // Piper stores models in OPFS; require navigator.storage.getDirectory.
    const hasOpfs = typeof navigator !== 'undefined'
      && navigator.storage
      && typeof navigator.storage.getDirectory === 'function';
    // Reject devices with <2 GB RAM where reported. Safari typically omits
    // deviceMemory; we trust those (they're nearly always >= 4 GB anyway).
    const memOk = (typeof navigator === 'undefined' || navigator.deviceMemory == null)
      ? true
      : navigator.deviceMemory >= 2;
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    return {
      capable: hasWasm && hasOpfs && memOk,
      mobile: isMobile,
      reason: !hasWasm ? 'no-wasm' : (!hasOpfs ? 'no-opfs' : (!memOk ? 'low-memory' : 'ok')),
    };
  }

  // ---- settings glue -----------------------------------------------------
  function S() { return (window.PP && PP.Progress) ? PP.Progress.settings() : {}; }
  function saveS(patch) { if (window.PP && PP.Progress) PP.Progress.setSettings(patch); }

  function readConfig() {
    const s = S();
    // Migrate any legacy/invalid voice id (e.g. 'af_bella' from the old
    // Kokoro engine) back to the Piper default so we don't 404 on download.
    let voice = s.neuralVoice;
    if (!voice || !VALID_VOICE_IDS.has(voice)) voice = PIPER_DEFAULT_VOICE;
    return { voice };
  }

  function configure(cfg) {
    const next = { ...readConfig(), ...(cfg || {}) };
    if (!VALID_VOICE_IDS.has(next.voice)) next.voice = PIPER_DEFAULT_VOICE;
    state.config = next;
    saveS({ neuralVoice: next.voice });
    notify();
  }

  // ---- engine loader -----------------------------------------------------
  async function loadPiper(cfg) {
    setProgress({ phase: 'lib', label: 'Loading Piper library\u2026', loaded: 0, total: 0, percent: 0 });
    // @diffusionstudio/vits-web exposes:
    //   predict({ text, voiceId }, progressCb?) -> Blob
    //   download(voiceId, progressCb?)
    //   stored() -> string[]
    //   remove(voiceId), flush()
    //   voices() -> Promise<Voice[]>
    // Repo: https://github.com/diffusionstudio/vits-web
    const mod = await import(/* @vite-ignore */ PIPER_ESM);
    const predict  = mod.predict  || (mod.default && mod.default.predict);
    const download = mod.download || (mod.default && mod.default.download);
    if (!predict)  throw new Error('vits-web: predict export not found');

    const voiceId = cfg.voice || PIPER_DEFAULT_VOICE;
    if (typeof download === 'function') {
      setProgress({ phase: 'model', label: `Downloading ${voiceId}\u2026`, loaded: 0, total: 0, percent: 0 });
      try {
        await download(voiceId, (p) => setProgress({
          phase: 'model',
          label: `Downloading ${voiceId}\u2026`,
          loaded: (p && p.loaded) || 0,
          total: (p && p.total) || 0,
        }));
      } catch (err) {
        // download() failure usually means a 404 from a stale voice id.
        // Surface a clean error rather than the cryptic JSON parse one.
        throw new Error(`Could not download voice "${voiceId}": ${err.message || err}`);
      }
    }
    setProgress({ phase: 'ready', label: 'Voice model ready', percent: 100 });

    return {
      mod,
      synth: async (text, opts) => {
        const id = opts.voice || voiceId;
        if (!VALID_VOICE_IDS.has(id)) {
          throw new Error(`Unknown Piper voice "${id}"`);
        }
        const wavBlob = await predict({ text, voiceId: id });
        return wavBlob instanceof Blob ? wavBlob : new Blob([wavBlob], { type: 'audio/wav' });
      },
      listVoices: () => VOICE_CATALOG.map(v => v.id),
    };
  }

  // ---- enable / disable --------------------------------------------------
  async function enable() {
    if (state.ready) return true;
    if (state.loading) return state.loading;

    const cap = capability();
    if (!cap.capable) {
      state.error = new Error('Device cannot run neural voice (' + cap.reason + ')');
      notify();
      return false;
    }

    const cfg = readConfig();
    state.config = cfg;
    state.error = null;

    state.loading = (async () => {
      try {
        const engine = await loadPiper(cfg);
        state.engine = engine;
        state.ready = true;
        // Persist BOTH flags so subsequent page loads auto-warm Piper without
        // requiring another click. The OPFS model is already on disk, so the
        // "warm" is effectively free (vits-web's download() short-circuits).
        saveS({ neuralEnabled: true, neuralAutoLoad: true });
        setProgress({ phase: 'ready', label: 'Voice ready', percent: 100 });
        return true;
      } catch (err) {
        state.error = err;
        state.ready = false;
        setProgress({ phase: 'error', label: String(err.message || err) });
        return false;
      } finally {
        state.loading = null;
        notify();
      }
    })();
    return state.loading;
  }

  function disable() {
    state.ready = false;
    state.loading = null;
    state.engine = null;
    state.cache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
    state.cache.clear();
    setProgress({ phase: 'idle', label: '', loaded: 0, total: 0, percent: 0 });
    saveS({ neuralEnabled: false });
    notify();
  }

  // Wipe the persisted model from disk. This includes:
  //   - Piper's OPFS model store (vits-web.flush())
  //   - the service worker's NEURAL_CACHE bucket (esm.sh + huggingface URLs)
  async function removeDownload() {
    const eng = state.engine;
    // 1. Tear down in-memory state first so nothing tries to use a
    //    half-removed model.
    disable();

    // 2. Piper exposes a flush() that wipes its OPFS directory.
    if (eng && eng.mod) {
      try {
        if (typeof eng.mod.flush === 'function') await eng.mod.flush();
      } catch (err) {
        console.warn('[PP.VoiceNeural] Piper flush failed:', err);
      }
    } else {
      // Engine not loaded right now; reach into vits-web ourselves so the
      // "Remove download" button still works without re-downloading first.
      try {
        const mod = await import(/* @vite-ignore */ PIPER_ESM);
        if (typeof mod.flush === 'function') await mod.flush();
      } catch (err) {
        console.warn('[PP.VoiceNeural] Piper flush (cold) failed:', err);
      }
    }

    // 3. Ask the SW to drop its neural cache bucket. Wait for confirmation.
    const reg = (navigator.serviceWorker && navigator.serviceWorker.controller) ? navigator.serviceWorker : null;
    if (reg && reg.controller) {
      await new Promise((resolve) => {
        const ch = new MessageChannel();
        let done = false;
        const finish = () => { if (done) return; done = true; resolve(); };
        ch.port1.onmessage = (e) => {
          if (e.data && e.data.type === 'PURGE_NEURAL_CACHE_DONE') finish();
        };
        // Fallback in case the SW is mid-update and never replies.
        setTimeout(finish, 2500);
        try {
          reg.controller.postMessage({ type: 'PURGE_NEURAL_CACHE' }, [ch.port2]);
        } catch (_) { finish(); }
      });
    }

    saveS({ neuralAutoLoad: false });
    notify();
    return true;
  }

  // ---- speak -------------------------------------------------------------
  let current = null;
  // Serialize calls into the underlying engine. Piper's ONNX session is
  // single-threaded — launching a second predict() while the first is in
  // flight can throw or corrupt the next call.
  let synthChain = Promise.resolve();
  function runSynth(text, opts) {
    const next = synthChain.then(() => state.engine.synth(text, opts));
    // Keep the chain alive even if a call rejects, so a one-off failure
    // doesn't permanently break the queue.
    synthChain = next.catch(() => {});
    return next;
  }

  async function speak(text, opts = {}) {
    if (!state.ready || !state.engine || !text) return false;
    try {
      const key = normalizeKey(text, opts);
      let url = state.cache.get(key);
      if (!url) {
        const blob = await runSynth(text, opts);
        if (!blob) return false;
        url = URL.createObjectURL(blob);
        // Bound the in-memory cache so a long session can't leak blobs.
        if (state.cache.size > 80) {
          const firstKey = state.cache.keys().next().value;
          const firstUrl = state.cache.get(firstKey);
          if (firstUrl) { try { URL.revokeObjectURL(firstUrl); } catch (_) {} }
          state.cache.delete(firstKey);
        }
        state.cache.set(key, url);
      }
      return await playUrl(url, opts);
    } catch (err) {
      console.warn('[PP.VoiceNeural] synth failed:', err);
      return false;
    }
  }

  function playUrl(url, opts) {
    return new Promise(resolve => {
      // Use createElement instead of `new Audio()` because some host pages
      // run a SES/lockdown shim (MetaMask, etc.) that freezes or removes
      // the global Audio constructor, raising "Audio is not a constructor".
      const a = document.createElement('audio');
      a.src = url;
      a.preload = 'auto';
      a.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
      // Apply playback rate here as an inexpensive time-stretch. Piper
      // doesn't expose a `speed` synth param, so this is the only knob.
      a.playbackRate = Math.max(0.5, Math.min(2, opts.rate ?? 1));
      if (current) { try { current.pause(); } catch (_) {} }
      current = a;
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        if (current === a) current = null;
        resolve(ok);
      };
      a.addEventListener('ended', () => finish(true));
      a.addEventListener('error', () => finish(false));
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => finish(false));
    });
  }

  function interrupt() {
    if (!current) return;
    try { current.pause(); current.currentTime = 0; } catch (_) {}
    current = null;
  }

  function normalizeKey(text, opts) {
    const v = (opts && opts.voice) || (state.config && state.config.voice) || '';
    return v + '|' + String(text).trim().toLowerCase();
  }

  // ---- public API --------------------------------------------------------
  window.PP = window.PP || {};
  window.PP.VoiceNeural = {
    capability, configure, enable, disable, removeDownload, speak, interrupt,
    isReady: () => state.ready,
    isLoading: () => !!state.loading,
    snapshot, onChange,
    listVoices: () => state.engine ? state.engine.listVoices() : VOICE_CATALOG.map(v => v.id),
    voiceCatalog: () => VOICE_CATALOG.slice(),
    // Constants exposed so callers / SW can pre-warm or filter.
    urls: { PIPER_ESM },
    defaults: { PIPER_DEFAULT_VOICE },
  };

  // One-time migration: if a previous Kokoro install left a Kokoro voice id
  // in storage (e.g. 'af_bella'), reset it to a valid Piper voice so the
  // first download() doesn't 404 on `/undefined.json`.
  {
    const s = S();
    if (s.neuralVoice && !VALID_VOICE_IDS.has(s.neuralVoice)) {
      saveS({ neuralVoice: PIPER_DEFAULT_VOICE });
    }
    // Drop any stale engine selector — only piper exists now.
    if (s.neuralEngine && s.neuralEngine !== 'piper') {
      saveS({ neuralEngine: 'piper' });
    }
  }

  // Auto-warm whenever the user has previously opted in. Treat neuralEnabled
  // as the source of truth: if it's true, the model is already in OPFS and
  // download() will short-circuit, so warming costs essentially nothing.
  // (The neuralAutoLoad flag remains for legacy/UI introspection.)
  const s0 = S();
  if (s0.neuralEnabled === true) {
    state.config = readConfig();
    enable().catch(() => { /* error captured in snapshot */ });
  }
})();
