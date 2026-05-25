/* PP.VoiceNeural — in-browser neural TTS (Tier 2 of the voice stack).
 *
 * Sits between the pre-baked phrase pack (Tier 1) and the device Web Speech
 * fallback (Tier 3). When the pack misses a line (a child's name, a story
 * sentence, a less-common word), this module synthesizes it on-device so
 * everything still sounds like Hoot instead of switching to the system
 * voice mid-sentence.
 *
 * Engines
 * -------
 *   - 'kokoro' (recommended) — kokoro-js, ~80 MB ONNX model, English voices,
 *     WebGPU or WASM. Highest quality available in a single npm package.
 *     Model: onnx-community/Kokoro-82M-v1.0-ONNX on HuggingFace Hub.
 *   - 'piper'  (experimental) — Piper voices via @diffusionstudio/vits-web,
 *     ~20 MB per voice, WASM only. Smaller download, lower quality. Marked
 *     experimental because the in-browser Piper ecosystem moves fast and we
 *     haven't pinned a long-term-stable build yet.
 *
 * Storage layout
 * --------------
 *   - The engine library is fetched from a CDN (esm.sh) and cached by the
 *     browser HTTP cache + our service worker.
 *   - The model itself is downloaded once via the library's own loader
 *     (transformers.js for Kokoro). The browser cache + SW pass-through
 *     keeps it offline. We do not add a separate IndexedDB cache —
 *     transformers.js already maintains one.
 *   - Per-text synth results are cached in-memory as Blob URLs for the
 *     session (helps when the same line replays during a round).
 *
 * Settings hooks (read from PP.Progress.settings()):
 *   - neuralEnabled : true to allow use of this tier
 *   - neuralEngine  : 'kokoro' | 'piper'
 *   - neuralVoice   : engine-specific voice id (e.g. 'af_bella' for Kokoro)
 *   - neuralAutoLoad: true to warm up on page load; default false (manual)
 */
(function () {
  // ---- pinned CDN URLs ---------------------------------------------------
  // Pin specific versions so a breaking upstream release can't silently
  // black-hole the voice. Bump deliberately when re-testing.
  const KOKORO_ESM = 'https://esm.sh/kokoro-js@1.2.0';
  const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  const KOKORO_DEFAULT_VOICE = 'af_bella'; // warm female voice, good for kids
  const KOKORO_DEFAULT_DTYPE = 'q8';       // ~80 MB; 'fp32' is ~330 MB

  const PIPER_ESM = 'https://esm.sh/@diffusionstudio/vits-web@1.0.3';
  const PIPER_DEFAULT_VOICE = 'en_US-amy-medium';

  // ---- state -------------------------------------------------------------
  const state = {
    ready: false,
    loading: null,
    error: null,
    config: null,         // { engine, voice, dtype }
    engine: null,         // active adapter { kind, synth, listVoices }
    engineKind: null,
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
      engine: state.engineKind,
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
    const hasGpu  = typeof navigator !== 'undefined' && !!navigator.gpu;
    // Reject devices with <2 GB RAM where reported. Safari typically omits
    // deviceMemory; we trust those (they're nearly always >= 4 GB anyway).
    const memOk = (typeof navigator === 'undefined' || navigator.deviceMemory == null)
      ? true
      : navigator.deviceMemory >= 2;
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    return {
      capable: hasWasm && memOk,
      webgpu: hasGpu,
      mobile: isMobile,
      reason: !hasWasm ? 'no-wasm' : (!memOk ? 'low-memory' : 'ok'),
      // On mobile without WebGPU, Piper's smaller footprint is a better bet.
      recommendedEngine: hasGpu ? 'kokoro' : (isMobile ? 'piper' : 'kokoro'),
    };
  }

  // ---- settings glue -----------------------------------------------------
  function S() { return (window.PP && PP.Progress) ? PP.Progress.settings() : {}; }
  function saveS(patch) { if (window.PP && PP.Progress) PP.Progress.setSettings(patch); }

  function readConfig() {
    const s = S();
    const engine = s.neuralEngine || 'kokoro';
    const voice = s.neuralVoice || (engine === 'piper' ? PIPER_DEFAULT_VOICE : KOKORO_DEFAULT_VOICE);
    const dtype = s.neuralDtype || KOKORO_DEFAULT_DTYPE;
    return { engine, voice, dtype };
  }

  function configure(cfg) {
    const next = { ...readConfig(), ...cfg };
    state.config = next;
    saveS({
      neuralEngine: next.engine,
      neuralVoice: next.voice,
      neuralDtype: next.dtype,
    });
    notify();
  }

  // ---- engine loaders ----------------------------------------------------
  async function loadKokoro(cfg) {
    setProgress({ phase: 'lib', label: 'Loading Kokoro library\u2026', loaded: 0, total: 0, percent: 0 });
    const mod = await import(/* @vite-ignore */ KOKORO_ESM);
    const KokoroTTS = mod.KokoroTTS || (mod.default && mod.default.KokoroTTS);
    if (!KokoroTTS) throw new Error('kokoro-js: KokoroTTS export not found');

    setProgress({ phase: 'model', label: 'Downloading voice model (one-time ~80 MB)\u2026', loaded: 0, total: 0, percent: 0 });
    const cap = capability();
    const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
      dtype: cfg.dtype || KOKORO_DEFAULT_DTYPE,
      device: cap.webgpu ? 'webgpu' : 'wasm',
      // transformers.js progress shape: { status, file, progress, loaded, total }
      progress_callback: (info) => {
        if (!info) return;
        if (info.status === 'progress' || info.status === 'download') {
          setProgress({
            phase: 'model',
            label: info.file ? `Downloading ${info.file}\u2026` : 'Downloading voice model\u2026',
            loaded: info.loaded || 0,
            total: info.total || 0,
          });
        } else if (info.status === 'done' || info.status === 'ready') {
          setProgress({ phase: 'ready', label: 'Voice model ready', percent: 100 });
        }
      },
    });
    return {
      kind: 'kokoro',
      synth: async (text, opts) => {
        const out = await tts.generate(text, {
          voice: opts.voice || cfg.voice || KOKORO_DEFAULT_VOICE,
          speed: opts.rate || 1,
        });
        // out: { audio: Float32Array, sampling_rate: number }
        return floatToWavBlob(out.audio, out.sampling_rate || 24000);
      },
      listVoices: () => {
        try { return Object.keys(tts.voices || {}); }
        catch { return []; }
      },
    };
  }

  async function loadPiper(cfg) {
    setProgress({ phase: 'lib', label: 'Loading Piper library\u2026', loaded: 0, total: 0, percent: 0 });
    // @diffusionstudio/vits-web exposes `predict({ text, voiceId })` and a
    // `download(voiceId, onProgress)` helper. API surface:
    //   import { predict, download, voices } from '@diffusionstudio/vits-web';
    // Repo: https://github.com/diffusionstudio/vits-web
    const mod = await import(/* @vite-ignore */ PIPER_ESM);
    const predict = mod.predict || (mod.default && mod.default.predict);
    const download = mod.download || (mod.default && mod.default.download);
    if (!predict) throw new Error('vits-web: predict export not found');

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
      } catch (_) {
        // download() may not exist in some builds; predict() also lazy-downloads.
      }
    }
    setProgress({ phase: 'ready', label: 'Voice model ready', percent: 100 });

    return {
      kind: 'piper',
      mod,
      synth: async (text, opts) => {
        const wavBlob = await predict({
          text,
          voiceId: opts.voice || voiceId,
        });
        return wavBlob instanceof Blob ? wavBlob : new Blob([wavBlob], { type: 'audio/wav' });
      },
      listVoices: () => {
        try {
          const list = mod.voices || (mod.default && mod.default.voices) || {};
          return Object.keys(list);
        } catch { return []; }
      },
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
        const engine = cfg.engine === 'piper' ? await loadPiper(cfg) : await loadKokoro(cfg);
        state.engine = engine;
        state.engineKind = engine.kind;
        state.ready = true;
        saveS({ neuralEnabled: true });
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
    state.engineKind = null;
    state.cache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
    state.cache.clear();
    setProgress({ phase: 'idle', label: '', loaded: 0, total: 0, percent: 0 });
    saveS({ neuralEnabled: false });
    notify();
  }

  // Wipe the persisted model from disk. This includes:
  //   - the service worker's NEURAL_CACHE (esm.sh + huggingface.co URLs)
  //   - Piper's own IndexedDB-backed model store (when loaded)
  // Note: transformers.js caches model files in the browser's Cache Storage,
  // which the SW PURGE_NEURAL_CACHE message also covers because all model
  // requests go through huggingface.co. We can't reach transformers.js's
  // private cache name directly from here, but the SW handles those URLs.
  async function removeDownload() {
    const eng = state.engine;
    // 1. Tear down in-memory state first so nothing tries to use a
    //    half-removed model.
    disable();

    // 2. Piper exposes a remove/flush API for its IndexedDB store.
    if (eng && eng.kind === 'piper' && eng.mod) {
      try {
        if (typeof eng.mod.flush === 'function') await eng.mod.flush();
        // remove(voiceId) deletes a single voice; flush() handles the rest.
      } catch (err) {
        console.warn('[PP.VoiceNeural] Piper flush failed:', err);
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
  // Serialize calls into the underlying engine. Kokoro's ONNX session is
  // single-threaded — launching a second generate() while the first is in
  // flight throws "Session already started" and then corrupts the next call
  // with "Cannot read properties of null". Piper has similar constraints.
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
      // NOTE: do NOT apply opts.rate as playbackRate here. Kokoro/Piper
      // already time-stretch during synthesis (`speed` arg). Applying it
      // again here would compound (e.g. 1.3 * 1.3 = 1.69x), which produces
      // chipmunk/garbled output that can sound like a foreign language.
      a.playbackRate = 1;
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

  // ---- Float32 -> WAV Blob (used by Kokoro adapter) ----------------------
  // Wrap raw float samples in a minimal RIFF/WAVE container so HTMLAudio can
  // play them without WebAudio plumbing on the page.
  function floatToWavBlob(samples, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    let p = 0;
    function w(s) { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); }
    function u32(v) { view.setUint32(p, v, true); p += 4; }
    function u16(v) { view.setUint16(p, v, true); p += 2; }
    w('RIFF'); u32(36 + dataSize); w('WAVE');
    w('fmt '); u32(16); u16(1); u16(numChannels); u32(sampleRate); u32(byteRate); u16(blockAlign); u16(bitsPerSample);
    w('data'); u32(dataSize);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      p += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  // ---- public API --------------------------------------------------------
  window.PP = window.PP || {};
  window.PP.VoiceNeural = {
    capability, configure, enable, disable, removeDownload, speak, interrupt,
    isReady: () => state.ready,
    isLoading: () => !!state.loading,
    snapshot, onChange,
    listVoices: () => state.engine ? state.engine.listVoices() : [],
    // Constants exposed so callers / SW can pre-warm or filter.
    urls: { KOKORO_ESM, PIPER_ESM, KOKORO_MODEL },
    defaults: { KOKORO_DEFAULT_VOICE, PIPER_DEFAULT_VOICE, KOKORO_DEFAULT_DTYPE },
  };

  // Auto-warm if the user opted in previously AND asked us to load eagerly.
  // Default is lazy (wait for an explicit enable() click in settings) so we
  // never surprise visitors with an 80 MB download.
  const s0 = S();
  if (s0.neuralEnabled === true && s0.neuralAutoLoad === true) {
    state.config = readConfig();
    enable().catch(() => { /* error captured in snapshot */ });
  } else if (s0.neuralEnabled === true) {
    state.config = readConfig();
  }
})();
