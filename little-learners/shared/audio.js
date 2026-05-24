/* PP.Audio — Web Audio SFX, suite-shared.
 * Ported from Clock Quest + new toddler-tuned sounds:
 *   pling, boing, swish, ding, unlock, rainbowChord
 *
 * Also loads parent-supplied MP3 sounds (animals/) lazily with graceful
 * fallback when files are missing.
 */
(function () {
  let ctx = null;
  function S() { return (window.PP && PP.Progress) ? PP.Progress.settings() : {}; }
  function saveS(p) { if (window.PP && PP.Progress) PP.Progress.setSettings(p); }
  let muted = !!S().sfxMuted;
  let masterVol = typeof S().sfxVolume === 'number' ? S().sfxVolume : 0.8;

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (_) {} }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.18, off = 0, attack = 0.01, release = 0.1) {
    if (muted) return;
    const c = getCtx(); if (!c) return;
    const t0 = c.currentTime + off;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol * masterVol, t0 + attack);
    gain.gain.linearRampToValueAtTime(vol * masterVol * 0.7, t0 + dur - release);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ===== Ported from Clock Quest =====
  function correct() {
    tone(523.25, 0.18, 'triangle', 0.20, 0);
    tone(659.25, 0.18, 'triangle', 0.20, 0.10);
    tone(783.99, 0.32, 'triangle', 0.22, 0.20);
  }
  function wrong() {
    tone(196.00, 0.18, 'sine', 0.22, 0);
    tone(146.83, 0.32, 'sine', 0.20, 0.12);
  }
  function fanfare() {
    tone(523.25, 0.14, 'triangle', 0.22, 0);
    tone(659.25, 0.14, 'triangle', 0.22, 0.12);
    tone(783.99, 0.14, 'triangle', 0.22, 0.24);
    tone(1046.5, 0.32, 'triangle', 0.25, 0.36);
    tone(783.99, 0.32, 'triangle', 0.20, 0.36);
  }
  function tick() { tone(1200, 0.04, 'square', 0.06, 0, 0.005, 0.02); }
  function sparkle() {
    [659.25, 783.99, 987.77, 1318.5, 1567.98].forEach((f, i) =>
      tone(f, 0.10, 'triangle', 0.16, i * 0.06));
  }

  // ===== New for Little Learners =====
  function pling() {
    // Soft xylophone tap
    tone(880.00, 0.12, 'triangle', 0.14, 0, 0.005, 0.08);
    tone(1318.5, 0.18, 'sine', 0.08, 0.01, 0.005, 0.10);
  }
  function boing() {
    // Pitch-rising plop for object pop-in
    if (muted) return;
    const c = getCtx(); if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.15);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.22 * masterVol, t0 + 0.02);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.28);
    osc.connect(gain).connect(c.destination);
    osc.start(t0); osc.stop(t0 + 0.32);
  }
  function swish() {
    if (muted) return;
    const c = getCtx(); if (!c) return;
    const t0 = c.currentTime;
    // Filtered noise burst
    const buf = c.createBuffer(1, c.sampleRate * 0.28, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(800, t0);
    bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.25);
    const g = c.createGain();
    g.gain.setValueAtTime(0.18 * masterVol, t0);
    g.gain.linearRampToValueAtTime(0, t0 + 0.28);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t0); src.stop(t0 + 0.30);
  }
  function ding() {
    tone(1318.5, 0.16, 'triangle', 0.18, 0);
    tone(1975.5, 0.24, 'sine', 0.10, 0.02);
  }
  function unlock() {
    // Magical reward: arpeggio + sparkle
    tone(523.25, 0.14, 'triangle', 0.20, 0);
    tone(783.99, 0.14, 'triangle', 0.22, 0.10);
    tone(1046.5, 0.14, 'triangle', 0.22, 0.20);
    tone(1318.5, 0.32, 'triangle', 0.24, 0.30);
    setTimeout(sparkle, 280);
  }
  function rainbowChord() {
    // C major triad with overtones held longer
    tone(261.63, 1.4, 'sine', 0.18, 0, 0.04, 0.6); // C4
    tone(329.63, 1.4, 'sine', 0.16, 0.02, 0.04, 0.6); // E4
    tone(392.00, 1.4, 'sine', 0.18, 0.04, 0.04, 0.6); // G4
    tone(523.25, 1.4, 'triangle', 0.10, 0.06, 0.04, 0.6); // C5
    setTimeout(sparkle, 200);
  }
  function pageFlip() {
    swish();
    setTimeout(() => tone(1500, 0.04, 'square', 0.05, 0, 0.005, 0.02), 120);
  }

  // ===== MP3 sample loader (parent-supplied) =====
  // Used by Animals etc. Falls back silently if files missing.
  const sampleCache = new Map();
  function loadSample(url) {
    if (sampleCache.has(url)) return sampleCache.get(url);
    const p = fetch(url, { cache: 'force-cache' })
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('404')))
      .then(buf => getCtx().decodeAudioData(buf))
      .catch(err => { sampleCache.delete(url); throw err; });
    sampleCache.set(url, p);
    return p;
  }
  function playSample(url, opts = {}) {
    if (muted) return Promise.resolve(false);
    const c = getCtx(); if (!c) return Promise.resolve(false);
    return loadSample(url).then(buf => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = (opts.volume ?? 0.9) * masterVol;
      src.connect(g).connect(c.destination);
      // 100ms silence before sample, per spec
      src.start(c.currentTime + (opts.delay ?? 0.1));
      return true;
    }).catch(() => false);
  }

  // ===== Settings =====
  function toggleMute() {
    muted = !muted;
    saveS({ sfxMuted: muted });
    return muted;
  }
  function setMuted(m) { if (!!m !== muted) toggleMute(); }
  function setVolume(v) {
    masterVol = Math.max(0, Math.min(1, v));
    saveS({ sfxVolume: masterVol });
  }
  function isMuted() { return muted; }
  function getVolume() { return masterVol; }

  const api = {
    correct, wrong, fanfare, tick, sparkle,
    pling, boing, swish, ding, unlock, rainbowChord, pageFlip,
    playSample,
    toggleMute, setMuted, setVolume, isMuted, getVolume,
  };
  window.PP = window.PP || {};
  window.PP.Audio = api;
  // Legacy global
  window.Audio = api;
})();
