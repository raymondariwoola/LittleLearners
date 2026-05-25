/* PP.VoiceNeural — in-browser neural TTS (Tier 2 of the voice stack).
 *
 * This module is intentionally a stub on first ship. It exposes the same
 * surface PP.Voice expects so we can wire the routing logic now and drop in
 * a real engine later without touching call sites. When `enable()` is called
 * with a real engine URL it lazily fetches the runtime + model, caches them,
 * and provides on-device synthesis for lines the pre-baked pack doesn't
 * cover (child names, story interpolations, dynamic letters/numbers).
 *
 * Why not ship a working model today:
 *   - The model file is ~25-80 MB (Kokoro-82M ONNX or Piper). Bundling it in
 *     git is wrong; hosting it on a CDN needs a stable URL we have to pick
 *     deliberately (Hugging Face Hub, a GitHub release, or jsDelivr).
 *   - WebGPU/WASM capability detection differs across iOS Safari, Android
 *     Chrome, and desktops. We need a real device pass before promising kids
 *     anything.
 *   - Pre-baked clips already cover ~80% of speech, so this can ship later
 *     as a v1.5 upgrade without leaving anyone silent.
 *
 * Activation path (when ready):
 *   1. Pick an engine (recommended: kokoro-js + onnxruntime-web from a CDN).
 *   2. Call PP.VoiceNeural.configure({ engine: 'kokoro', modelUrl: '...',
 *      voice: 'bella' }) from settings.js when the user opts in.
 *   3. Call PP.VoiceNeural.enable() to download + warm up. UI shows progress.
 *   4. PP.Voice.speak() will auto-route dynamic lines through synth().
 */
(function () {
  const state = {
    enabled: false,
    ready: false,
    loading: null,        // Promise while warming up
    error: null,
    config: null,         // { engine, modelUrl, voice }
    cache: new Map(),     // text -> Blob URL of synthesized audio
    progress: { loaded: 0, total: 0 },
  };

  const listeners = new Set();
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function notify() { listeners.forEach(fn => { try { fn(snapshot()); } catch (_) {} }); }

  function snapshot() {
    return {
      enabled: state.enabled,
      ready: state.ready,
      loading: !!state.loading,
      error: state.error ? String(state.error.message || state.error) : null,
      config: state.config,
      progress: { ...state.progress },
    };
  }

  // Detect whether the platform can plausibly run a neural model. We're
  // conservative so we never offer Tier 2 on a device that would then crash
  // or hang. WebAssembly is the floor; WebGPU is a nice-to-have for speed.
  function capability() {
    const hasWasm = typeof WebAssembly === 'object';
    const hasGpu  = typeof navigator !== 'undefined' && !!navigator.gpu;
    // Roughly avoid devices with <2 GB RAM; deviceMemory is in GB, often
    // missing on Safari (we treat undefined as "good enough").
    const memOk = (typeof navigator === 'undefined' || navigator.deviceMemory == null)
      ? true
      : navigator.deviceMemory >= 2;
    return {
      capable: hasWasm && memOk,
      webgpu: hasGpu,
      reason: !hasWasm ? 'no-wasm' : (!memOk ? 'low-memory' : 'ok'),
    };
  }

  function configure(cfg) {
    state.config = { ...(state.config || {}), ...cfg };
    notify();
  }

  // Placeholder loader. Real implementations would dynamically import the
  // engine module (e.g. kokoro-js) and stream the model with progress.
  async function enable() {
    if (state.ready) return true;
    if (state.loading) return state.loading;
    const cap = capability();
    if (!cap.capable) {
      state.error = new Error('Device cannot run neural voice (' + cap.reason + ')');
      notify();
      return false;
    }
    if (!state.config || !state.config.modelUrl) {
      // No model wired up yet — this is the expected v1 state. Silently
      // refuse so PP.Voice falls through to Tier 1 / Tier 3.
      state.error = new Error('Neural voice not configured');
      notify();
      return false;
    }
    state.loading = (async () => {
      try {
        // Hook for the future: replace this block with a real engine bootstrap.
        // const { Kokoro } = await import('https://cdn.example/kokoro-js/+esm');
        // state.engine = await Kokoro.fromUrl(state.config.modelUrl, { onProgress });
        throw new Error('Neural voice engine not implemented in this build');
      } catch (err) {
        state.error = err;
      } finally {
        state.loading = null;
        notify();
      }
    })();
    return state.loading.then(() => state.ready);
  }

  // Synthesize `text` to an Audio element and play it. Returns a Promise
  // that resolves true on successful playback, false otherwise (so the
  // caller can fall back to Tier 3 cleanly).
  async function speak(/* text, opts */) {
    if (!state.ready) return false;
    // Real implementation: check cache, call engine.synth(text), wrap the
    // returned Float32Array / Blob in an Audio element, await 'ended'.
    return false;
  }

  function disable() {
    state.enabled = false;
    state.ready = false;
    state.loading = null;
    state.cache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
    state.cache.clear();
    notify();
  }

  window.PP = window.PP || {};
  window.PP.VoiceNeural = {
    capability, configure, enable, disable, speak,
    isReady: () => state.ready,
    isLoading: () => !!state.loading,
    snapshot, onChange,
  };
})();
