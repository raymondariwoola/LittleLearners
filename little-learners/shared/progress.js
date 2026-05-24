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
})();
