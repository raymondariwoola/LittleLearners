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

  // Voice routing mode. 'premium' tries the pre-baked pack first then falls
  // through to neural / device speech. 'device' skips the pack entirely.
  // 'mute' is equivalent to muted=true and is stored separately so we can
  // remember the user's preferred non-mute tier across mute toggles.
  function getVoiceMode() {
    const m = (S().voiceMode || 'premium');
    return (m === 'premium' || m === 'device' || m === 'mute') ? m : 'premium';
  }
  function setVoiceMode(mode) {
    const m = (mode === 'premium' || mode === 'device' || mode === 'mute') ? mode : 'premium';
    saveS({ voiceMode: m });
    // Mute mode is implemented by flipping the existing mute flag so legacy
    // checks (PP.Voice.isMuted, mute button labels) keep working.
    if (m === 'mute' && !muted) toggleMute();
    else if (m !== 'mute' && muted) toggleMute();
    notify();
  }

  function speak(input, opts = {}) {
    if (!input) return Promise.resolve();
    // Inputs may be plain strings or String wrappers tagged by PP.Phrases
    // with a `.phraseId`. Extract both so we can route through the pack.
    const phraseId = (typeof input === 'object' && input && input.phraseId) || null;
    const text = (typeof input === 'string') ? input : String(input || '');
    if (muted) return Promise.resolve();

    const shouldInterrupt = opts.force === true ? true : (opts.interrupt !== false);
    if (shouldInterrupt) cancelAll();

    const mode = opts.engine || getVoiceMode();
    const allowPack = mode !== 'device' && opts.engine !== 'device';
    const baseVol = opts.volume ?? voiceVol;
    const baseRate = effectiveRate(opts);

    // Tier 1: pre-baked pack.
    if (allowPack && window.PP && PP.VoicePack && PP.VoicePack.isLoaded()) {
      const meta = PP.VoicePack.match(phraseId ? { phraseId, toString: () => text } : text);
      if (meta) {
        return PP.VoicePack.play(meta, {
          interrupt: shouldInterrupt,
          rate: baseRate,
          volume: baseVol,
        }).then(ok => { if (!ok) return speakDeviceFallback(text, opts); });
      }
    }

    // Tier 2: neural synth (no-op until configured + enabled).
    if (allowPack && window.PP && PP.VoiceNeural && PP.VoiceNeural.isReady()) {
      return PP.VoiceNeural.speak(text, { rate: baseRate, volume: baseVol })
        .then(ok => ok ? undefined : speakDeviceFallback(text, opts));
    }

    return speakDeviceFallback(text, opts);
  }

  // Cancel every active speech tier. Used when an interrupt is requested.
  // Order doesn't matter — each tier no-ops if it has nothing playing.
  function cancelAll() {
    if (supported) synth.cancel();
    if (window.PP && PP.VoicePack   && PP.VoicePack.interrupt)   PP.VoicePack.interrupt();
    if (window.PP && PP.VoiceNeural && PP.VoiceNeural.interrupt) PP.VoiceNeural.interrupt();
  }

  // Tier 3 — the original Web Speech path. Pulled into its own function so
  // every higher tier can fall back to it cleanly on a miss / failure.
  function speakDeviceFallback(text, opts = {}) {
    if (!supported || !text) return Promise.resolve();
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

  function cancel() { cancelAll(); }

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

  // Stable-id cheer pool. The ids map to clips in the voice pack so the
  // celebratory line plays in Hoot's voice when the pack is loaded.
  const CHEERS = [
    ['cheer-01', 'Wow!'],
    ['cheer-02', 'Amazing!'],
    ['cheer-03', 'Yes!'],
    ['cheer-04', 'Brilliant!'],
    ['cheer-05', 'You did it!'],
    ['cheer-06', 'Fantastic!'],
    ['cheer-07', 'Hooray!'],
    ['cheer-08', 'Wonderful!'],
    ['cheer-09', 'Yay!'],
    ['cheer-10', 'Awesome!'],
    ['cheer-11', 'Oh, well done!'],
    ['cheer-12', 'Beautiful!'],
  ];
  function cheer(name) {
    const [id, phrase] = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    const tag = name ? (Math.random() < 0.5 ? ` ${name}!` : '') : '';
    // If we're appending a name we lose the pack match (no clip exists for
    // "Brilliant! Sky!"). In that case fall through to the device tier with
    // the original text so the name still gets spoken.
    if (tag) return speak(phrase + tag, { pitch: 1.18, rate: 1.0 });
    const wrapped = new String(phrase); // eslint-disable-line no-new-wrappers
    wrapped.phraseId = id;
    return speak(wrapped, { pitch: 1.18, rate: 1.0 });
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
    setVoiceMode, getVoiceMode,
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

  // Stop all audio when the user navigates away from the page. Without this,
  // WebAudio clips from voice-pack.js can continue playing briefly after the
  // next page has already started loading, causing two voices to overlap.
  window.addEventListener('pagehide', () => { try { cancelAll(); } catch (_) {} });
})();

/* PP.Phrases — toddler-friendly phrase bank.
 * Soft, never punishing. Used by every category for praise / retry.
 *
 * Every public method returns a String *instance* (not a primitive) tagged
 * with a `.phraseId` property. Plain `textContent` / template usage still
 * works because String boxes coerce, but `PP.Voice.speak()` can detect the
 * id and look up a pre-baked clip in PP.VoicePack. Keep these ids stable —
 * they map 1:1 to filenames in audio/voice/hoot-en-v1/.
 */
(function () {
  // Each entry = [id, text]. Add new ones at the end so existing manifest
  // entries stay valid.
  const correct = [
    ['praise-01', "That's right!"],
    ['praise-02', "Yes! You got it."],
    ['praise-03', "Brilliant!"],
    ['praise-04', "Amazing!"],
    ['praise-05', "Wow, well done!"],
    ['praise-06', "Spot on!"],
    ['praise-07', "Yes, that's the one."],
    ['praise-08', "Oh, perfect!"],
    ['praise-09', "Fantastic!"],
    ['praise-10', "You did it!"],
  ];
  const tryAgain = [
    ['retry-01', "Oops, try again!"],
    ['retry-02', "Hmm, not quite \u2014 have another go."],
    ['retry-03', "Almost! Try one more time."],
    ['retry-04', "Nearly! Try again."],
    ['retry-05', "So close! Have another look."],
  ];
  // Reveal lines carry a {label} slot, so we can't pre-bake the full sentence.
  // We still hand back stable ids so the pack can supply intro/outro halves
  // if a future bake gets fancy; today VoicePack treats them as fallbacks.
  const reveal = (label) => [
    ['reveal-01', `This one is ${label}! Let's try another.`],
    ['reveal-02', `It's ${label}. Good try!`],
    ['reveal-03', `That's ${label}. Let's keep playing!`],
  ];
  const idle = [
    ['idle-01', "Take your time..."],
    ['idle-02', "Which one do you think?"],
    ['idle-03', "Have a look..."],
    ['idle-04', "You can do it!"],
  ];
  // Greetings interpolate the child's name; pack still ships a name-less
  // variant under greeting-anon-*, and the neural tier handles named ones.
  const greeting = (name) => name ? [
    ['greeting-name-01', `Hi ${name}! What do you want to learn today?`],
    ['greeting-name-02', `Hello ${name}! Let's play!`],
    ['greeting-name-03', `Hi ${name}! I missed you!`],
  ] : [
    ['greeting-anon-01', "Hi there! What do you want to learn today?"],
    ['greeting-anon-02', "Hello! Let's play!"],
  ];
  const farewell = [
    ['farewell-01', "Bye for now!"],
    ['farewell-02', "See you soon!"],
    ['farewell-03', "Come back and play again!"],
  ];
  const newRound = [
    ['round-01', "Here we go!"],
    ['round-02', "Let's play!"],
    ['round-03', "Get ready!"],
  ];
  const lastQuestion = [
    ['last-01', "Last one!"],
    ['last-02', "One more!"],
    ['last-03', "Final question!"],
  ];

  // Returns a String wrapper carrying the phrase id. Implicit coercion keeps
  // `${phrase}` and `textContent = phrase` working unchanged.
  function tag(id, text) {
    const s = new String(text); // eslint-disable-line no-new-wrappers
    s.phraseId = id;
    return s;
  }
  function pick(arr) {
    const [id, text] = arr[Math.floor(Math.random() * arr.length)];
    return tag(id, text);
  }

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
    // Catalog used by tools/bake-voice.mjs to enumerate the phrase pack.
    _catalog: {
      correct, tryAgain, idle, farewell, newRound, lastQuestion,
      greetingAnon: greeting(null),
    },
  };
})();

/* Auto-loader for the voice pack + neural shim. We inject these as sibling
 * script tags next to voice.js so the 14 HTML entry points don't each have
 * to be edited when we add a new tier. Each tier is independently optional
 * and PP.Voice degrades gracefully if a tier file fails to load.
 */
(function () {
  if (window.PP && PP.VoicePack && PP.VoiceNeural) return; // already loaded

  // Find the <script> tag that loaded voice.js so we can resolve sibling
  // module paths regardless of the current page depth (/ vs /pages/).
  const here = document.currentScript
    || Array.from(document.scripts).find(s => /\/shared\/voice\.js(\?|$)/.test(s.src));
  const base = here ? here.src.replace(/voice\.js(\?.*)?$/, '') : '';

  function injectOnce(name) {
    if (!base) return;
    const url = base + name;
    if (Array.from(document.scripts).some(s => s.src === url)) return;
    const s = document.createElement('script');
    s.src = url;
    s.defer = false;
    s.async = false;
    document.head.appendChild(s);
  }
  injectOnce('voice-pack.js');
  injectOnce('voice-neural.js');
})();

