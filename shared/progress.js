/* PP.Progress — suite-wide localStorage wrapper.
 * - All app data: pp_<app>_<key>
 * - Shared profile: pp_profile_*   (name, age, avatar, etc.) — read by every suite app.
 * - Settings (voice, sound, etc.): pp_settings_*
 *
 * Usage:
 *   const p = PP.Progress.app('learners');
 *   p.set('stars.letters', 5);
 *   p.get('stars.letters');           // 5
 *   p.inc('plays.colors');            // increment counter
 *   PP.Progress.profile();            // { name, age, avatar }
 *   PP.Progress.setProfile({ name: 'Arianna' });
 */
(function () {
  const PREFIX = 'pp_';
  const PROFILE_KEY = PREFIX + 'profile';
  const SETTINGS_KEY = PREFIX + 'settings';

  function safeParse(s, fallback) {
    if (s == null) return fallback;
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }
  function readBlob(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }
  function writeBlob(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('[PP.Progress] storage write failed', key, e); }
  }

  // Set a value at a dotted path inside an object.
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }
  function getPath(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }

  function app(name) {
    const KEY = PREFIX + name;
    function load() { return readBlob(KEY, {}); }
    function save(data) { writeBlob(KEY, data); }

    return {
      key: KEY,
      raw: load,
      get(path, fallback) {
        const v = getPath(load(), path);
        return v === undefined ? fallback : v;
      },
      set(path, value) {
        const data = load();
        setPath(data, path, value);
        save(data);
        return value;
      },
      inc(path, by = 1) {
        const cur = this.get(path, 0) || 0;
        return this.set(path, cur + by);
      },
      push(path, value, maxLen) {
        const arr = this.get(path, []) || [];
        arr.push(value);
        if (maxLen && arr.length > maxLen) arr.splice(0, arr.length - maxLen);
        this.set(path, arr);
        return arr;
      },
      addToSet(path, value) {
        const arr = this.get(path, []) || [];
        if (!arr.includes(value)) { arr.push(value); this.set(path, arr); }
        return arr;
      },
      remove(path) {
        const data = load();
        const parts = path.split('.');
        let cur = data;
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur && cur[parts[i]];
          if (!cur) return;
        }
        delete cur[parts[parts.length - 1]];
        save(data);
      },
      reset() { writeBlob(KEY, {}); },
      exportAll() { return load(); },
      importAll(data) { if (data && typeof data === 'object') save(data); },
    };
  }

  // Shared profile across the whole suite.
  function profile() {
    return readBlob(PROFILE_KEY, { name: '', age: '', avatar: '', ageMode: 'toddler' });
  }
  function setProfile(patch) {
    const cur = profile();
    const next = Object.assign({}, cur, patch || {});
    writeBlob(PROFILE_KEY, next);
    return next;
  }

  function settings() {
    return readBlob(SETTINGS_KEY, {
      voiceMuted: false,
      voiceRate: 1.0,
      voiceName: null,
      sfxMuted: false,
      sfxVolume: 0.8,
      musicOn: false,
      reducedMotion: null, // null = follow OS
      dayNightAuto: true,
    });
  }
  function setSettings(patch) {
    const cur = settings();
    const next = Object.assign({}, cur, patch || {});
    writeBlob(SETTINGS_KEY, next);
    return next;
  }

  window.PP = window.PP || {};
  window.PP.Progress = { app, profile, setProfile, settings, setSettings };

  // ===== PP.Adaptive — lightweight, local-first difficulty model =====
  // Tracks rolling per-skill confidence in 0..1 so games can make small,
  // age-appropriate adjustments (an extra distractor, a longer round) when
  // a child is breezing through. Also exposes a mastery bucket parents can
  // read in the dashboard ("strong" / "emerging" / "needs repetition").
  //
  // Storage lives under the existing `learners` blob so it ships with the
  // same export/import flow:
  //   learners.adaptive.<catId> = { conf, plays, mastered, lastAt }
  //
  // Everything is best-effort: if nothing has been recorded for a category
  // we return safe defaults that produce the existing baseline behaviour.
  (function defineAdaptive() {
    const learners = () => app('learners');
    // EMA smoothing factor — small so a single great round doesn't slam the
    // difficulty up; over ~5-6 rounds confidence settles meaningfully.
    const ALPHA = 0.35;

    function _state(catId) {
      const s = learners().get(`adaptive.${catId}`, null);
      return s && typeof s === 'object'
        ? { conf: 0.5, plays: 0, mastered: 0, lastAt: 0, ...s }
        : { conf: 0.5, plays: 0, mastered: 0, lastAt: 0 };
    }

    // Map a single round outcome to a 0..1 score.
    //  - 3 stars, 0 attempts            => 1.00
    //  - 3 stars, 1 attempt             => 0.80
    //  - 2 stars                        => 0.55
    //  - 1 star or revealed             => 0.30
    //  - 0 stars                        => 0.10
    function _scoreFor({ stars = 0, attempts = 0, revealed = false } = {}) {
      if (revealed) return 0.3;
      if (stars >= 3) return attempts <= 0 ? 1.0 : 0.8;
      if (stars === 2) return 0.55;
      if (stars === 1) return 0.3;
      return 0.1;
    }

    function recordResult(catId, result = {}) {
      if (!catId) return null;
      const s = _state(catId);
      const score = _scoreFor(result);
      s.conf = Math.max(0, Math.min(1, s.conf * (1 - ALPHA) + score * ALPHA));
      s.plays = (s.plays || 0) + 1;
      if (score >= 0.8) s.mastered = (s.mastered || 0) + 1;
      s.lastAt = Date.now();
      learners().set(`adaptive.${catId}`, s);
      return s;
    }

    function confidence(catId) { return _state(catId).conf; }

    // Translate confidence + age mode into concrete game knobs. Keep toddler
    // gentle on purpose; older modes get the most lift.
    function level(catId, ageMode = 'toddler') {
      const s = _state(catId);
      const conf = s.conf;
      // Need a handful of plays before we trust the signal.
      const trusted = (s.plays || 0) >= 3;
      let choiceBoost = 0;
      let roundBoost = 0;
      let hintDelayMs = 8000;
      let bucket = 'emerging';
      if (conf >= 0.75) bucket = 'strong';
      else if (conf < 0.4) bucket = 'needs-repetition';

      if (trusted && conf >= 0.8 && ageMode !== 'toddler') {
        choiceBoost = 1;
        roundBoost = ageMode === 'reader' ? 2 : 1;
        hintDelayMs = 10000;
      } else if (trusted && conf <= 0.35) {
        // Struggling: a touch more guidance, slightly shorter rounds.
        roundBoost = -1;
        hintDelayMs = 6500;
      }
      return { conf, plays: s.plays || 0, bucket, choiceBoost, roundBoost, hintDelayMs };
    }

    function snapshot() {
      const all = learners().get('adaptive', {}) || {};
      const out = {};
      Object.keys(all).forEach(id => { out[id] = _state(id); });
      return out;
    }

    function reset(catId) {
      if (catId) learners().remove(`adaptive.${catId}`);
      else learners().set('adaptive', {});
    }

    window.PP.Adaptive = { recordResult, confidence, level, snapshot, reset };
  })();
})();
