/* PP.Voice — Web Speech API wrapper, suite-shared.
 * Ported from Clock Quest with toddler-tuned extensions:
 *   - spell(word)  — "C... A... T... CAT!"
 *   - count(n)     — "one, two, three, FOUR!" (last stressed)
 *   - cheer()      — randomised exclamation
 *   - askChild(q)  — same as speak() but with rising intonation guaranteed
 *
 * Storage uses pp_settings (PP.Progress.settings) so voice prefs travel
 * across every suite app.
 */
(function () {
  const synth = window.speechSynthesis;
  const supported = !!synth;
  let voices = [];
  let selectedVoice = null;
  let voiceQuality = 'standard';
  const listeners = new Set();

  function S() { return (window.PP && PP.Progress) ? PP.Progress.settings() : {}; }
  function saveS(patch) { if (window.PP && PP.Progress) PP.Progress.setSettings(patch); }

  let muted = !!S().voiceMuted;
  let rate = (typeof S().voiceRate === 'number') ? S().voiceRate : 1.0;
  let pitch = (typeof S().voicePitch === 'number') ? S().voicePitch : 1.08;
  let voiceVol = (typeof S().voiceVolume === 'number') ? S().voiceVolume : 1.0;
  let savedVoiceName = S().voiceName || null;

  // High-quality friendly voices in roughly best-first order.
  const FRIENDLY_NAMES = [
    'Ava', 'Zoe', 'Allison', 'Susan', 'Samantha', 'Karen', 'Moira',
    'Tessa', 'Fiona', 'Serena', 'Kate', 'Martha',
    'Daniel', 'Oliver', 'Tom',
    'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Libby', 'Microsoft Sonia',
    'Microsoft Michelle', 'Microsoft Ana',
    'Microsoft Guy', 'Microsoft Ryan',
    'Google UK English Female', 'Google US English',
  ];
  const AVOID = [
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
    'deranged', 'good news', 'hysterical', 'jester', 'organ', 'pipe organ',
    'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
    'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley',
    'fred', 'ralph', 'junior', 'kathy', 'princess', 'vicki',
  ];

  function scoreVoice(v) {
    const n = v.name.toLowerCase();
    if (AVOID.some(b => n.includes(b))) return -1000;
    let s = 0;
    if (n.includes('(premium)') || n.includes(' premium')) s += 100;
    if (n.includes('(enhanced)') || n.includes(' enhanced')) s += 60;
    if (n.includes('(natural)') || n.includes('neural') || n.includes('online')) s += 70;
    if (n.includes('siri')) s += 80;
    if (v.localService) s += 5;
    const idx = FRIENDLY_NAMES.findIndex(name => v.name.includes(name));
    if (idx >= 0) s += Math.max(0, 40 - idx);
    if (v.lang === 'en-US' || v.lang === 'en-GB') s += 5;
    if (v.lang === 'en-AU' || v.lang === 'en-IE') s += 3;
    if (/female|samantha|karen|aria|jenny|zoe|ava|allison|moira|tessa|fiona|susan/i.test(v.name)) s += 3;
    return s;
  }
  function detectQuality(v) {
    if (!v) return 'none';
    const n = v.name.toLowerCase();
    if (n.includes('(premium)') || n.includes('siri')) return 'premium';
    if (n.includes('(enhanced)')) return 'enhanced';
    if (n.includes('(natural)') || n.includes('neural') || n.includes('online')) return 'neural';
    if (FRIENDLY_NAMES.some(name => v.name.includes(name))) return 'standard';
    return 'basic';
  }

  function loadVoices() {
    if (!supported) return;
    voices = synth.getVoices()
      .filter(v => v.lang && v.lang.toLowerCase().startsWith('en'))
      .filter(v => scoreVoice(v) > -1000);
    if (!voices.length) voices = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    if (!voices.length) return;

    if (savedVoiceName) {
      const found = voices.find(v => v.name === savedVoiceName);
      if (found) { selectedVoice = found; voiceQuality = detectQuality(found); notify(); return; }
    }
    voices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    selectedVoice = voices[0];
    voiceQuality = detectQuality(selectedVoice);
    notify();
  }
  function notify() { listeners.forEach(fn => { try { fn(); } catch (_) {} }); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  if (supported) {
    loadVoices();
    if (synth.onvoiceschanged !== undefined) synth.addEventListener('voiceschanged', loadVoices);
  }

  // Effective rate — toddler mode slows things down a touch.
  function effectiveRate(opts) {
    let r = opts.rate ?? rate;
    const profile = (window.PP && PP.Progress) ? PP.Progress.profile() : {};
    if (profile.ageMode === 'toddler' && !opts.absoluteRate) r *= 0.88;
    return r;
  }

  function speak(text, opts = {}) {
    if (!supported || muted || !text) return Promise.resolve();
    // `force: true` is an explicit "speak now" alias used by a few games for
    // counting/feedback chimes. Treat it as a request to interrupt any
    // currently-queued speech regardless of how `interrupt` is set.
    const shouldInterrupt = opts.force === true ? true : (opts.interrupt !== false);
    if (shouldInterrupt) synth.cancel();
    const basePitch = opts.pitch ?? pitch;
    const baseRate = effectiveRate(opts);
    const jitter = (Math.random() - 0.5) * 0.05;
    const usePitch = basePitch + jitter;
    const chunks = chunkSentences(text);
    return chainChunks(chunks, usePitch, baseRate, opts);
  }

  function chunkSentences(text) {
    const parts = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text];
    return parts.map(s => s.trim()).filter(Boolean);
  }
  function chainChunks(chunks, pitch, baseRate, opts) {
    return chunks.reduce((p, chunk, i) => p.then(() => {
      return speakOne(chunk, {
        ...opts,
        pitch: pitch + (/[?]$/.test(chunk) ? 0.08 : 0) + (i > 0 ? -0.01 : 0),
        rate: baseRate * (chunk.length < 10 ? 0.94 : 1.0),
      });
    }).then(() => pause(i < chunks.length - 1 ? 90 : 0)), Promise.resolve());
  }
  function pause(ms) { return new Promise(r => setTimeout(r, ms)); }
  function speakOne(text, opts = {}) {
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      if (selectedVoice) u.voice = selectedVoice;
      u.pitch = Math.max(0, Math.min(2, opts.pitch ?? pitch));
      u.rate = Math.max(0.1, Math.min(2, opts.rate ?? rate));
      u.volume = Math.max(0, Math.min(1, opts.volume ?? voiceVol));
      u.onend = resolve;
      u.onerror = resolve;
      setTimeout(() => synth.speak(u), 8);
    });
  }

  function cancel() { if (supported) synth.cancel(); }

  // ===== Extended toddler helpers =====
  function spell(word, opts = {}) {
    if (!word) return Promise.resolve();
    const letters = word.toUpperCase().split('');
    const rateMul = (opts.rate ?? 1) * 0.85;
    return letters.reduce((p, ch, i) => p.then(() =>
      speak(ch + '...', { interrupt: i === 0, rate: rateMul, pitch: 1.05 })
    ), Promise.resolve()).then(() =>
      speak(word.toUpperCase() + '!', { interrupt: false, rate: rateMul * 1.05, pitch: 1.15 })
    );
  }

  const NUMBER_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
  function numWord(n) { return (n >= 0 && n < NUMBER_WORDS.length) ? NUMBER_WORDS[n] : String(n); }

  function count(n, opts = {}) {
    if (!Number.isFinite(n) || n < 1) return Promise.resolve();
    const last = Math.min(n, 20);
    let p = Promise.resolve();
    for (let i = 1; i <= last; i++) {
      const isLast = i === last;
      const word = numWord(i);
      p = p.then(() => speak(isLast ? word.toUpperCase() + '!' : word + ',', {
        interrupt: i === 1,
        rate: (opts.rate ?? 1) * (isLast ? 0.9 : 1.0),
        pitch: isLast ? 1.2 : 1.05,
      }));
    }
    return p;
  }

  const CHEERS = [
    "Wow!", "Amazing!", "Yes!", "Brilliant!", "You did it!",
    "Fantastic!", "Hooray!", "Wonderful!", "Yay!", "Awesome!",
    "Oh, well done!", "Beautiful!",
  ];
  function cheer(name) {
    const phrase = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    const tag = name ? (Math.random() < 0.5 ? ` ${name}!` : '') : '';
    return speak(phrase + tag, { pitch: 1.18, rate: 1.0 });
  }

  function ask(question, opts = {}) {
    // Force the rising question intonation by appending a "?" if missing.
    const q = /[?]\s*$/.test(question) ? question : question + '?';
    return speak(q, { ...opts, pitch: (opts.pitch ?? 1.08) + 0.04 });
  }

  // ===== Settings =====
  function setVoiceByName(name) {
    const found = voices.find(v => v.name === name);
    if (!found) return;
    selectedVoice = found;
    voiceQuality = detectQuality(found);
    savedVoiceName = name;
    saveS({ voiceName: name });
    notify();
  }
  function setRate(r) {
    rate = Math.max(0.6, Math.min(1.6, r));
    saveS({ voiceRate: rate });
  }
  function setPitch(p) {
    pitch = Math.max(0.6, Math.min(1.6, p));
    saveS({ voicePitch: pitch });
  }
  function setVolume(v) {
    voiceVol = Math.max(0, Math.min(1, v));
    saveS({ voiceVolume: voiceVol });
  }
  // Friendly label for the quality bucket — used by the settings UI.
  const QUALITY_LABEL = {
    premium: 'Premium', enhanced: 'Enhanced', neural: 'Natural',
    standard: 'Standard', basic: 'Basic', none: '—',
  };
  function qualityFor(v) {
    const q = detectQuality(v);
    return { id: q, label: QUALITY_LABEL[q] || 'Standard' };
  }
  function toggleMute() {
    muted = !muted;
    if (muted) cancel();
    saveS({ voiceMuted: muted });
    notify();
    return muted;
  }
  function setMuted(m) { if (!!m !== muted) toggleMute(); }

  const api = {
    speak, cancel, ask, spell, count, cheer,
    setVoiceByName, setRate, setPitch, setVolume, toggleMute, setMuted,
    getVoices: () => voices.slice(),
    getSelected: () => selectedVoice,
    getQuality: () => voiceQuality,
    qualityFor,
    isMuted: () => muted,
    getRate: () => rate,
    getPitch: () => pitch,
    getVolume: () => voiceVol,
    isSupported: () => supported,
    onChange,
  };
  window.PP = window.PP || {};
  window.PP.Voice = api;
  // Legacy global
  window.Voice = api;
})();

/* PP.Phrases — toddler-friendly phrase bank.
 * Soft, never punishing. Used by every category for praise / retry.
 */
(function () {
  const correct = [
    "That's right!", "Yes! You got it.", "Brilliant!", "Amazing!",
    "Wow, well done!", "Spot on!", "Yes, that's the one.",
    "Oh, perfect!", "Fantastic!", "You did it!",
  ];
  const tryAgain = [
    "Oops, try again!", "Hmm, not quite — have another go.",
    "Almost! Try one more time.", "Nearly! Try again.",
    "So close! Have another look.",
  ];
  const reveal = (label) => [
    `This one is ${label}! Let's try another.`,
    `It's ${label}. Good try!`,
    `That's ${label}. Let's keep playing!`,
  ];
  const idle = [
    "Take your time...", "Which one do you think?",
    "Have a look...", "You can do it!",
  ];
  const greeting = (name) => name
    ? [`Hi ${name}! What do you want to learn today?`, `Hello ${name}! Let's play!`, `Hi ${name}! I missed you!`]
    : ["Hi there! What do you want to learn today?", "Hello! Let's play!"];
  const farewell = ["Bye for now!", "See you soon!", "Come back and play again!"];
  const newRound = ["Here we go!", "Let's play!", "Get ready!"];
  const lastQuestion = ["Last one!", "One more!", "Final question!"];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  window.PP = window.PP || {};
  window.PP.Phrases = {
    correct: () => pick(correct),
    tryAgain: () => pick(tryAgain),
    reveal: (label) => pick(reveal(label)),
    idle: () => pick(idle),
    greeting: (name) => pick(greeting(name)),
    farewell: () => pick(farewell),
    newRound: () => pick(newRound),
    lastQuestion: () => pick(lastQuestion),
  };
})();
