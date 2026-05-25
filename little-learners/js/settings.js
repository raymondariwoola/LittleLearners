/* Settings page — every control here writes through to a real backing store
 * (PP.Voice, PP.Audio, PP.Theme, PP.Progress) and the change takes effect
 * immediately. Nothing on this screen is decorative.
 *
 * The page is parent-gated. PP.Settings.open() navigates here after a gate.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  // ===== Public entry points =====
  function open() {
    (async () => {
      const already = sessionStorage.getItem('pp_parent_gate') === '1';
      const ok = already || await PP.UI.parentGate();
      if (!ok) return;
      sessionStorage.setItem('pp_parent_gate', '1');
      const inPages = window.location.pathname.indexOf('/pages/') !== -1;
      window.location.href = inPages ? 'settings.html' : 'pages/settings.html';
    })();
  }

  window.PP = window.PP || {};
  window.PP.Settings = { open };

  function isSettingsPage() { return !!document.getElementById('settings'); }

  async function init() {
    if (!isSettingsPage()) return;
    PP.Theme.apply();
    const gated = sessionStorage.getItem('pp_parent_gate') === '1';
    if (!gated) {
      const ok = await PP.UI.parentGate();
      if (!ok) { window.location.href = '../index.html'; return; }
      sessionStorage.setItem('pp_parent_gate', '1');
    }
    render();
    if (PP.Voice && PP.Voice.onChange) PP.Voice.onChange(renderVoiceSection);
  }

  // ===== Render =====
  function render() {
    const root = $('#settings');
    root.innerHTML = `
      <div class="ll-cat__bar">
        <button id="setBack" class="ll-cat__back" type="button" aria-label="Back">←</button>
        <div class="ll-cat__title"><span aria-hidden="true">⚙️</span><span>Settings</span></div>
        <div class="ll-cat__modes"></div>
      </div>

      <section class="ll-set">
        <div id="secProfile"  class="ll-set__card"></div>
        <div id="secVoice"    class="ll-set__card"></div>
        <div id="secNeural"   class="ll-set__card"></div>
        <div id="secSound"    class="ll-set__card"></div>
        <div id="secTheme"    class="ll-set__card"></div>
        <div id="secMotion"   class="ll-set__card"></div>
        <div id="secLimit"    class="ll-set__card"></div>
        <div id="secConfetti" class="ll-set__card"></div>
        <div id="secData"     class="ll-set__card"></div>
        <div id="secDanger"   class="ll-set__card ll-set__card--danger"></div>
        <p class="ll-set__foot">Little Learners · v${(PP.version || '1.0.0')} · All data stays on this device.</p>
      </section>`;

    $('#setBack').addEventListener('click', () => {
      const fromParent = document.referrer && document.referrer.indexOf('parent.html') !== -1;
      window.location.href = fromParent ? 'parent.html' : '../index.html';
    });

    renderProfileSection();
    renderVoiceSection();
    renderNeuralSection();
    renderSoundSection();
    renderThemeSection();
    renderMotionSection();
    renderLimitSection();
    renderConfettiSection();
    renderDataSection();
    renderDangerSection();

    // The voice tier modules (voice-pack.js + voice-neural.js) are injected
    // dynamically by shared/voice.js, so on first paint either may not exist
    // yet. Re-render the affected cards once they show up, and once
    // VoicePack has finished its manifest fetch.
    waitForVoiceModules().then(() => {
      try { renderVoiceSection(); } catch (_) {}
      try { renderNeuralSection(); } catch (_) {}
      if (window.PP && PP.VoicePack && PP.VoicePack.onChange) {
        PP.VoicePack.onChange(() => {
          try { renderVoiceSection(); } catch (_) {}
        });
      }
    });
  }

  // Poll for the dynamically-injected voice modules. Resolves as soon as
  // both globals appear, or after a generous timeout so we never hang the
  // UI if a script 404s. Cheap because the modules normally land within a
  // few hundred ms of DOMContentLoaded.
  function waitForVoiceModules(timeoutMs = 4000) {
    return new Promise(resolve => {
      const start = Date.now();
      (function tick() {
        const hasPack   = !!(window.PP && PP.VoicePack);
        const hasNeural = !!(window.PP && PP.VoiceNeural);
        if (hasPack && hasNeural) return resolve(true);
        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(tick, 80);
      })();
    });
  }

  function sectionShell(el, title, subtitle) {
    el.innerHTML = `
      <header class="ll-set__head">
        <h2>${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </header>
      <div class="ll-set__body"></div>`;
    return el.querySelector('.ll-set__body');
  }

  // ----- Profile -----
  function renderProfileSection() {
    const wrap = $('#secProfile');
    const body = sectionShell(wrap, '🧒 Child profile', 'Used to greet your little one.');
    const p = PP.Progress.profile();
    body.innerHTML = `
      <label class="ll-set__field">
        <span>Name</span>
        <input id="setName" type="text" maxlength="20" value="${escAttr(p.name || '')}" placeholder="First name" />
      </label>
      <div class="ll-set__field">
        <span>Age mode</span>
        <div id="setAge" class="ll-set__pills"></div>
      </div>`;

    const ageWrap = body.querySelector('#setAge');
    PP.AgeModes.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-set__pill' + (m.id === p.ageMode ? ' is-active' : '');
      b.innerHTML = `<span>${m.icon}</span><strong>${m.label}</strong><em>${m.caption}</em>`;
      b.addEventListener('click', () => {
        PP.Progress.setProfile({ ageMode: m.id });
        document.documentElement.setAttribute('data-age-mode', m.id);
        ageWrap.querySelectorAll('.ll-set__pill').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        PP.Audio.pling();
      });
      ageWrap.appendChild(b);
    });

    let nameTimer = null;
    body.querySelector('#setName').addEventListener('input', e => {
      const val = e.target.value.slice(0, 20);
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => PP.Progress.setProfile({ name: val.trim() }), 250);
    });
  }

  // ----- Voice -----
  function renderVoiceSection() {
    const wrap = $('#secVoice');
    if (!wrap) return;
    const body = sectionShell(wrap, '🗣️ Voice',
      "Pick how Hoot sounds. <strong>Hoot Premium</strong> uses a warm pre-recorded voice that's the same on every device. <strong>Device voice</strong> uses whatever your phone or computer has installed.");

    const mode = (PP.Voice.getVoiceMode && PP.Voice.getVoiceMode()) || 'premium';
    const packInfo = (PP.VoicePack && PP.VoicePack.getPackInfo && PP.VoicePack.getPackInfo()) || null;
    const packLoaded = !!(PP.VoicePack && PP.VoicePack.isLoaded && PP.VoicePack.isLoaded());

    const supported = PP.Voice.isSupported && PP.Voice.isSupported();
    const deviceWarning = !supported
      ? `<p class="ll-set__hint">Your browser doesn't support device speech. Hoot Premium will still work.</p>`
      : '';

    body.innerHTML = `
      <div id="vModeList" class="ll-set__pills" role="radiogroup" aria-label="Hoot's voice"></div>

      <div id="vPackInfo" class="ll-set__hint" aria-live="polite"></div>

      <div class="ll-set__row" style="margin-top:8px;">
        <button id="vTest" type="button" class="pp-btn pp-btn--primary">▶ Hear Hoot say hi</button>
      </div>

      <details id="vAdvanced" class="ll-set__details">
        <summary>Advanced — device voice tuning</summary>
        <div class="ll-set__detailsBody">
          ${deviceWarning}
          <label class="ll-set__field">
            <span>Speed <output id="vRateOut"></output></span>
            <input id="vRate" type="range" min="0.7" max="1.3" step="0.05" />
          </label>
          <label class="ll-set__field">
            <span>Pitch <output id="vPitchOut"></output></span>
            <input id="vPitch" type="range" min="0.8" max="1.4" step="0.02" />
          </label>
          <label class="ll-set__field">
            <span>Volume <output id="vVolOut"></output></span>
            <input id="vVol" type="range" min="0" max="1" step="0.05" />
          </label>
          <div class="ll-set__field">
            <span>Device storyteller <em id="vListCount"></em></span>
            <div id="vList" class="ll-voice-list"></div>
          </div>
        </div>
      </details>
    `;

    // ----- mode picker -----
    const modeOpts = [
      { id: 'premium', icon: '✨', label: 'Hoot Premium', sub: 'warm, same on every device' },
      { id: 'device',  icon: '📱', label: 'Device voice', sub: supported ? "use this device's voice" : 'not supported here' },
      { id: 'mute',    icon: '🔇', label: 'Mute',         sub: 'no voice, just sound effects' },
    ];
    const modeList = $('#vModeList');
    modeOpts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'radio';
      b.setAttribute('aria-checked', String(o.id === mode));
      b.className = 'll-set__pill' + (o.id === mode ? ' is-active' : '');
      if (o.id === 'device' && !supported) b.disabled = true;
      b.innerHTML = `<span>${o.icon}</span><strong>${o.label}</strong><em>${o.sub}</em>`;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        PP.Voice.setVoiceMode(o.id);
        modeList.querySelectorAll('.ll-set__pill').forEach(x => {
          x.classList.remove('is-active');
          x.setAttribute('aria-checked', 'false');
        });
        b.classList.add('is-active');
        b.setAttribute('aria-checked', 'true');
        updatePackInfo();
      });
      modeList.appendChild(b);
    });

    function updatePackInfo() {
      const el = $('#vPackInfo');
      if (!el) return;
      const m = (PP.Voice.getVoiceMode && PP.Voice.getVoiceMode()) || 'premium';
      if (m === 'mute') {
        el.innerHTML = 'Voice is off. Sound effects still play.';
        return;
      }
      if (m === 'device') {
        el.innerHTML = 'Using this device\u2019s voice. You can fine-tune it under <em>Advanced</em>.';
        return;
      }
      // Premium mode. Show pack status + a small pip indicating whether the
      // Hoot Plus neural tier is also armed for words the pack doesn't cover.
      const neural = (window.PP && PP.VoiceNeural) ? PP.VoiceNeural.snapshot() : null;
      const neuralPip = neural && neural.ready
        ? ` <span class="ll-set__pip ll-set__pip--on" title="Hoot Plus is active">✨ Hoot Plus on</span>`
        : '';
      const order = neural && neural.ready
        ? 'Order: recorded clip → Hoot Plus neural voice → device voice.'
        : 'Order: recorded clip → device voice for anything new. Turn on <em>Hoot Plus</em> below for an on-device voice instead.';
      if (packLoaded && packInfo) {
        el.innerHTML = `Hoot Premium pack loaded — <strong>${packInfo.count}</strong> phrases ready.${neuralPip}<br><span class="ll-set__hint">${order}</span>`;
      } else {
        el.innerHTML = `<strong>No voice pack found.</strong> Run <code>node tools/bake-voice.mjs</code> on macOS to generate one, then refresh. The app uses the device voice meanwhile.${neuralPip}`;
      }
    }
    updatePackInfo();

    // Repaint the pip when Hoot Plus toggles on/off elsewhere on the page.
    if (window.PP && PP.VoiceNeural && PP.VoiceNeural.onChange) {
      PP.VoiceNeural.onChange(() => updatePackInfo());
    }

    // Test button speaks a greeting through the active routing chain.
    $('#vTest').addEventListener('click', () => {
      const p = PP.Progress.profile();
      PP.Voice.cancel && PP.Voice.cancel();
      const line = PP.Phrases.greeting(p.name || '');
      PP.Voice.speak(line, { interrupt: true });
    });

    // ----- advanced (device voice tuning) -----
    if (supported) {
      const voices = (PP.Voice.getVoices && PP.Voice.getVoices()) || [];
      const cnt = $('#vListCount');
      if (cnt) cnt.textContent = `(${voices.length} available)`;
      bindSlider('#vRate',  '#vRateOut',  PP.Voice.getRate(),                                  v => `${v.toFixed(2)}\u00d7`,    v => PP.Voice.setRate(v));
      bindSlider('#vPitch', '#vPitchOut', PP.Voice.getPitch ? PP.Voice.getPitch() : 1.08,      v => v.toFixed(2),               v => PP.Voice.setPitch(v));
      bindSlider('#vVol',   '#vVolOut',   PP.Voice.getVolume ? PP.Voice.getVolume() : 1,       v => Math.round(v * 100) + '%',  v => PP.Voice.setVolume(v));
      renderVoiceList(voices, PP.Voice.getSelected && PP.Voice.getSelected());
    }
  }

  // ----- Neural voice (Tier 2) -----
  // This card only renders meaningfully when PP.VoiceNeural has loaded
  // and the device passes capability(). Otherwise we show a polite note so
  // parents understand why the option isn't available.
  function renderNeuralSection() {
    const wrap = $('#secNeural');
    if (!wrap) return;
    const body = sectionShell(wrap, '\u2728 Hoot Plus (neural voice)',
      'Optional. Lets Hoot speak <strong>any</strong> word \u2014 names, stories, brand-new sentences \u2014 in his own voice, with no internet after the first download.');

    if (!window.PP || !PP.VoiceNeural) {
      body.innerHTML = `<p class="ll-set__hint">Neural voice module not loaded.</p>`;
      return;
    }

    const cap = PP.VoiceNeural.capability();
    const snap = PP.VoiceNeural.snapshot();
    const s = PP.Progress.settings();
    const enabled = s.neuralEnabled === true;
    const catalog = (PP.VoiceNeural.voiceCatalog && PP.VoiceNeural.voiceCatalog()) || [];
    const defaultVoice = (PP.VoiceNeural.defaults && PP.VoiceNeural.defaults.PIPER_DEFAULT_VOICE) || (catalog[0] && catalog[0].id);
    const validIds = new Set(catalog.map(v => v.id));
    const currentVoice = (validIds.has(s.neuralVoice) ? s.neuralVoice : defaultVoice);

    if (!cap.capable) {
      body.innerHTML = `<p class="ll-set__hint">This device can't run an on-device voice model (${escHtml(cap.reason)}). Hoot Premium and the device voice still work great.</p>`;
      return;
    }

    body.innerHTML = `
      <div id="nVoiceList" class="ll-set__pills" role="radiogroup" aria-label="Voice"></div>

      <div class="ll-set__row" style="margin-top:8px;">
        <button id="nEnable"  type="button" class="pp-btn pp-btn--primary"></button>
        <button id="nDisable" type="button" class="pp-btn pp-btn--secondary" hidden>Turn off</button>
        <button id="nTest"    type="button" class="pp-btn pp-btn--mint" hidden>\u25B6 Hear it</button>
        <button id="nRemove"  type="button" class="pp-btn pp-btn--ghost" hidden>🗑 Remove download</button>
      </div>

      <label class="ll-set__field ll-set__field--inline" style="margin-top:8px;">
        <input id="nAuto" type="checkbox" />
        <span>Load Hoot Plus automatically when this app opens</span>
      </label>

      <div id="nProgress" class="ll-neural__progress" hidden>
        <div class="ll-neural__bar"><div id="nBar" class="ll-neural__fill"></div></div>
        <p id="nLabel" class="ll-set__hint"></p>
      </div>

      <p class="ll-set__hint" id="nStatus" aria-live="polite"></p>

      <details class="ll-set__details">
        <summary>What gets downloaded?</summary>
        <div class="ll-set__detailsBody">
          <p class="ll-set__hint"><strong>Piper</strong> voice (~20&nbsp;MB) from Hugging Face. WASM-only, runs offline after the first download.</p>
          <p class="ll-set__hint">Stored in your browser's Origin Private File System. Nothing leaves the device. Clearing site data removes it.</p>
        </div>
      </details>
    `;

    // ----- voice picker -----
    const vList = $('#nVoiceList');
    catalog.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'radio';
      const active = v.id === currentVoice;
      b.className = 'll-set__pill' + (active ? ' is-active' : '');
      b.setAttribute('aria-checked', String(active));
      b.innerHTML = `<span>\uD83C\uDFB6</span><strong>${escHtml(v.label)}</strong><em>${escHtml(v.size)}</em>`;
      b.addEventListener('click', () => {
        vList.querySelectorAll('.ll-set__pill').forEach(x => {
          x.classList.remove('is-active');
          x.setAttribute('aria-checked', 'false');
        });
        b.classList.add('is-active');
        b.setAttribute('aria-checked', 'true');
        PP.VoiceNeural.configure({ voice: v.id });
        updateButtons();
      });
      vList.appendChild(b);
    });

    // ----- enable / disable / test -----
    const enableBtn  = $('#nEnable');
    const disableBtn = $('#nDisable');
    const testBtn    = $('#nTest');
    const removeBtn  = $('#nRemove');
    const autoChk    = $('#nAuto');
    const status     = $('#nStatus');
    const prog       = $('#nProgress');
    const bar        = $('#nBar');
    const label      = $('#nLabel');

    autoChk.checked = (PP.Progress.settings().neuralAutoLoad === true);
    autoChk.addEventListener('change', () => {
      PP.Progress.setSettings({ neuralAutoLoad: autoChk.checked });
    });

    function paintFromSnapshot() {
      const sn = PP.VoiceNeural.snapshot();
      const ready = sn.ready;
      const loading = sn.loading;
      const err = sn.error;
      enableBtn.disabled = loading;
      enableBtn.textContent = ready
        ? '\u2713 Hoot Plus on'
        : (loading ? 'Downloading\u2026' : '\u2B07 Turn on Hoot Plus');
      enableBtn.hidden = ready;
      disableBtn.hidden = !ready;
      testBtn.hidden = !ready;
      // "Remove" is meaningful whenever the user has previously turned it on,
      // even if it's not currently loaded — the cached model still lives on
      // disk until they purge it.
      removeBtn.hidden = !(ready || PP.Progress.settings().neuralEnabled === true);

      if (loading) {
        prog.hidden = false;
        bar.style.width = (sn.progress.percent || 0) + '%';
        label.textContent = sn.progress.label || 'Working\u2026';
      } else if (ready) {
        prog.hidden = true;
      } else {
        prog.hidden = !err;
        if (err) {
          bar.style.width = '0%';
          label.textContent = err;
        }
      }

      if (ready) {
        const v = sn.voice ? ` Voice: <strong>${escHtml(sn.voice)}</strong>.` : '';
        status.innerHTML = `Hoot Plus is ready.${v} Hoot Premium recordings still take priority \u2014 this fills in for anything new.`;
      } else if (err) {
        status.innerHTML = `<strong>Couldn't turn on Hoot Plus.</strong> ${escHtml(err)}`;
      } else if (enabled) {
        status.innerHTML = 'Tap <strong>Turn on Hoot Plus</strong> to download the voice model.';
      } else {
        status.innerHTML = 'Off. Hoot will still speak using the pre-recorded pack and the device voice.';
      }
    }
    function updateButtons() { paintFromSnapshot(); }

    enableBtn.addEventListener('click', async () => {
      enableBtn.disabled = true;
      await PP.VoiceNeural.enable();
      paintFromSnapshot();
    });
    disableBtn.addEventListener('click', () => {
      PP.VoiceNeural.disable();
      paintFromSnapshot();
    });
    removeBtn.addEventListener('click', async () => {
      if (!confirm('Remove the downloaded Hoot Plus voice from this device? You can re-download it any time.')) return;
      removeBtn.disabled = true;
      label.textContent = 'Removing…';
      prog.hidden = false;
      bar.style.width = '0%';
      try {
        if (PP.VoiceNeural.removeDownload) await PP.VoiceNeural.removeDownload();
      } finally {
        removeBtn.disabled = false;
        paintFromSnapshot();
      }
    });
    testBtn.addEventListener('click', async () => {
      if (testBtn.disabled) return;
      const name = (PP.Progress.profile().name || 'friend');
      // First synthesis can take 15–60 s in single-threaded WASM mode.
      // Disable the button and show feedback so the user knows it's working.
      testBtn.disabled = true;
      const origText = testBtn.textContent;
      testBtn.textContent = '⏳ Generating…';
      try {
        await PP.VoiceNeural.speak(`Hi ${name}! It is wonderful to talk with you today.`, {
          rate: PP.Voice.getRate ? PP.Voice.getRate() : 1,
          volume: PP.Voice.getVolume ? PP.Voice.getVolume() : 1,
        });
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = origText;
      }
    });

    // Live progress updates from the engine.
    if (PP.VoiceNeural.onChange) PP.VoiceNeural.onChange(paintFromSnapshot);

    paintFromSnapshot();
    // Reflect cached snapshot state immediately (covers cases where the
    // engine warmed up before this section rendered).
    if (snap.ready) paintFromSnapshot();
  }

  function renderVoiceList(voices, current) {
    const list = $('#vList');
    if (!list) return;
    list.innerHTML = '';
    if (!voices.length) {
      list.innerHTML = `<p class="ll-set__hint">Loading voices… try again in a moment.</p>`;
      return;
    }
    const order = ['premium', 'enhanced', 'neural', 'standard', 'basic'];
    const groups = {};
    voices.forEach(v => {
      const q = PP.Voice.qualityFor ? PP.Voice.qualityFor(v).id : 'standard';
      (groups[q] = groups[q] || []).push(v);
    });

    order.forEach(key => {
      const vs = groups[key];
      if (!vs || !vs.length) return;
      const head = document.createElement('div');
      head.className = 'll-voice-group';
      head.textContent = labelForQuality(key) + (key === 'premium' || key === 'neural' ? ' · most human' : '');
      list.appendChild(head);
      vs.forEach(v => list.appendChild(voiceRow(v, current)));
    });
  }

  function labelForQuality(k) {
    return ({
      premium:  '✨ Premium', enhanced: '★ Enhanced', neural: '🌿 Natural',
      standard: '· Standard', basic:    '· Basic',
    })[k] || k;
  }

  function voiceRow(v, current) {
    const row = document.createElement('div');
    const isActive = current && current.name === v.name;
    row.className = 'll-voice' + (isActive ? ' is-active' : '');
    const q = PP.Voice.qualityFor ? PP.Voice.qualityFor(v) : { id: 'standard', label: 'Standard' };
    row.innerHTML = `
      <button type="button" class="ll-voice__pick" data-name="${escAttr(v.name)}" aria-pressed="${isActive}">
        <span class="ll-voice__name">${escHtml(v.name)}</span>
        <span class="ll-voice__lang">${escHtml(v.lang || '')}${v.localService ? ' · on device' : ''}</span>
      </button>
      <span class="ll-voice__badge ll-voice__badge--${q.id}">${q.label}</span>
      <button type="button" class="ll-voice__test" aria-label="Preview ${escAttr(v.name)}">▶</button>`;

    row.querySelector('.ll-voice__pick').addEventListener('click', () => {
      PP.Voice.setVoiceByName(v.name);
      $('#vList').querySelectorAll('.ll-voice').forEach(x => x.classList.remove('is-active'));
      row.classList.add('is-active');
      PP.Voice.speak('Hi! I will be your storyteller.', { interrupt: true });
    });
    row.querySelector('.ll-voice__test').addEventListener('click', () => previewVoice(v));
    return row;
  }

  function previewVoice(v) {
    if (!('speechSynthesis' in window)) return;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    const u = new SpeechSynthesisUtterance(`Hello! I'm ${v.name.split(/[\(]/)[0].trim()}.`);
    u.voice = v;
    u.pitch  = PP.Voice.getPitch  ? PP.Voice.getPitch()  : 1.08;
    u.rate   = PP.Voice.getRate   ? PP.Voice.getRate()   : 1.0;
    u.volume = PP.Voice.getVolume ? PP.Voice.getVolume() : 1;
    window.speechSynthesis.speak(u);
  }

  // ----- Sounds -----
  function renderSoundSection() {
    const body = sectionShell($('#secSound'), '🔔 Sound effects', 'Pops, dings, and unlock chimes.');
    body.innerHTML = `
      <div class="ll-set__row">
        <button id="sMute" type="button" class="pp-btn pp-btn--secondary"></button>
        <button id="sTest" type="button" class="pp-btn pp-btn--primary">🎵 Test</button>
      </div>
      <label class="ll-set__field">
        <span>Volume <output id="sVolOut"></output></span>
        <input id="sVol" type="range" min="0" max="1" step="0.05" />
      </label>`;

    const setLabel = () => $('#sMute').textContent = PP.Audio.isMuted() ? '🔕 Sounds muted' : '🔔 Sounds on';
    setLabel();
    $('#sMute').addEventListener('click', () => { PP.Audio.toggleMute(); setLabel(); if (!PP.Audio.isMuted()) PP.Audio.unlock(); });
    $('#sTest').addEventListener('click', () => PP.Audio.unlock());

    bindSlider('#sVol', '#sVolOut', PP.Audio.getVolume(), v => Math.round(v * 100) + '%', v => {
      PP.Audio.setVolume(v); PP.Audio.pling();
    });
  }

  // ----- Theme -----
  function renderThemeSection() {
    const body = sectionShell($('#secTheme'), '🌗 Theme', 'Auto switches to a calm night palette after sunset.');
    const s = PP.Progress.settings();
    const cur = s.themeOverride || (s.dayNightAuto === false ? 'day' : 'auto');
    body.innerHTML = `<div id="tList" class="ll-set__pills"></div>`;
    const opts = [
      { id: 'auto',  label: 'Auto',  icon: '🌓' },
      { id: 'day',   label: 'Day',   icon: '☀️' },
      { id: 'night', label: 'Night', icon: '🌙' },
    ];
    const list = body.querySelector('#tList');
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-set__pill' + (o.id === cur ? ' is-active' : '');
      b.innerHTML = `<span>${o.icon}</span><strong>${o.label}</strong>`;
      b.addEventListener('click', () => {
        list.querySelectorAll('.ll-set__pill').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        if (o.id === 'auto') PP.Theme.setAuto(true);
        else PP.Theme.setOverride(o.id);
      });
      list.appendChild(b);
    });
  }

  // ----- Motion -----
  function renderMotionSection() {
    const body = sectionShell($('#secMotion'), '🎢 Motion', 'Reduce bounces, flips, and confetti for kids sensitive to motion.');
    const s = PP.Progress.settings();
    const cur = s.reducedMotion === true ? 'reduced' : s.reducedMotion === false ? 'full' : 'auto';
    body.innerHTML = `<div id="mList" class="ll-set__pills"></div>`;
    const opts = [
      { id: 'auto',    label: 'Auto',    icon: '🔄', sub: 'follows device' },
      { id: 'full',    label: 'Full',    icon: '✨', sub: 'all animations' },
      { id: 'reduced', label: 'Reduced', icon: '🧘', sub: 'gentle' },
    ];
    const list = body.querySelector('#mList');
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-set__pill' + (o.id === cur ? ' is-active' : '');
      b.innerHTML = `<span>${o.icon}</span><strong>${o.label}</strong><em>${o.sub}</em>`;
      b.addEventListener('click', () => {
        list.querySelectorAll('.ll-set__pill').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        const val = o.id === 'reduced' ? true : o.id === 'full' ? false : null;
        PP.Progress.setSettings({ reducedMotion: val });
        PP.Theme.apply();
      });
      list.appendChild(b);
    });
  }

  // ----- Daily limit -----
  function renderLimitSection() {
    const body = sectionShell($('#secLimit'), '⏱️ Daily play time',
      'After this much active play, Hoot will gently suggest a break. Resets each day.');
    const cur = (() => {
      const v = PP.Progress.settings().dailyLimitMin;
      return typeof v === 'number' ? v : 20;
    })();
    body.innerHTML = `<div id="limList" class="ll-set__pills"></div>
      <p class="ll-set__hint" id="limNow"></p>`;
    const opts = [
      { v: 0,  label: 'Off' },
      { v: 10, label: '10 min' },
      { v: 15, label: '15 min' },
      { v: 20, label: '20 min' },
      { v: 30, label: '30 min' },
      { v: 45, label: '45 min' },
      { v: 60, label: '60 min' },
    ];
    const list = body.querySelector('#limList');
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-set__pill ll-set__pill--compact' + (o.v === cur ? ' is-active' : '');
      b.innerHTML = `<strong>${o.label}</strong>`;
      b.addEventListener('click', () => {
        list.querySelectorAll('.ll-set__pill').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        PP.Progress.setSettings({ dailyLimitMin: o.v });
        showLimitNow();
      });
      list.appendChild(b);
    });

    function showLimitNow() {
      const snap = PP.AutoPause && PP.AutoPause.snapshot && PP.AutoPause.snapshot();
      const minsUsed = snap ? Math.floor(snap.ms / 60000) : 0;
      $('#limNow').innerHTML = `Today so far: <strong>${minsUsed} min</strong>
        <button id="limReset" type="button" class="ll-link">Reset timer</button>`;
      $('#limReset').addEventListener('click', () => {
        if (PP.AutoPause && PP.AutoPause.reset) PP.AutoPause.reset();
        PP.UI.toast('Timer reset', { kind: 'good' });
        showLimitNow();
      });
    }
    showLimitNow();
  }

  // ----- Confetti -----
  function renderConfettiSection() {
    const body = sectionShell($('#secConfetti'), '🎉 Celebrations', 'How much confetti for big wins.');
    const cur = PP.Progress.settings().confettiLevel || 'full';
    body.innerHTML = `<div id="cList" class="ll-set__pills"></div>
      <div class="ll-set__row" style="margin-top:8px;">
        <button id="cTest" type="button" class="pp-btn pp-btn--secondary">🎊 Preview</button>
      </div>`;
    const opts = [
      { id: 'off',    label: 'Off',    icon: '🚫' },
      { id: 'gentle', label: 'Gentle', icon: '🍃' },
      { id: 'full',   label: 'Full',   icon: '🎉' },
    ];
    const list = body.querySelector('#cList');
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-set__pill' + (o.id === cur ? ' is-active' : '');
      b.innerHTML = `<span>${o.icon}</span><strong>${o.label}</strong>`;
      b.addEventListener('click', () => {
        list.querySelectorAll('.ll-set__pill').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        PP.Progress.setSettings({ confettiLevel: o.id });
      });
      list.appendChild(b);
    });
    body.querySelector('#cTest').addEventListener('click', () => {
      const lvl = PP.Progress.settings().confettiLevel || 'full';
      const n = lvl === 'off' ? 0 : lvl === 'gentle' ? 20 : 80;
      if (n && PP.Confetti && PP.Confetti.burst) {
        PP.Confetti.burst(window.innerWidth / 2, window.innerHeight / 2, n);
        PP.Audio.unlock();
      } else PP.UI.toast('Celebrations are off');
    });
  }

  // ----- Data -----
  function renderDataSection() {
    const body = sectionShell($('#secData'), '💾 Your data', 'Save or restore everything from a JSON file.');
    body.innerHTML = `
      <div class="ll-set__row">
        <button id="dExport" type="button" class="pp-btn pp-btn--mint">⬇️ Export progress</button>
        <label class="pp-btn pp-btn--lavender" style="cursor:pointer;">
          ⬆️ Import progress
          <input id="dImport" type="file" accept="application/json" hidden />
        </label>
      </div>
      <p class="ll-set__hint">Exports include profile, stickers, and settings. Nothing leaves this device.</p>`;
    body.querySelector('#dExport').addEventListener('click', exportJson);
    body.querySelector('#dImport').addEventListener('change', importJson);
  }

  // ----- Danger zone -----
  function renderDangerSection() {
    const body = sectionShell($('#secDanger'), '🧹 Reset', 'These actions cannot be undone.');
    body.innerHTML = `
      <div class="ll-set__row">
        <button id="rStickers" type="button" class="pp-btn pp-btn--secondary">🧽 Clear stickers</button>
        <button id="rAll"      type="button" class="pp-btn pp-btn--warn">💥 Reset everything</button>
      </div>
      <p class="ll-set__hint">Reset everything clears profile, stickers, settings, photos, and the daily timer.</p>`;
    body.querySelector('#rStickers').addEventListener('click', () => confirmAndDo({
      title: 'Clear all stickers?',
      msg: 'This removes every collected sticker. Profile and settings stay.',
      label: 'Yes, clear stickers',
      action: () => {
        PP.Progress.app('learners').reset();
        PP.UI.toast('Stickers cleared.', { kind: 'good' });
      },
    }));
    body.querySelector('#rAll').addEventListener('click', () => confirmAndDo({
      title: 'Reset everything?',
      msg: 'This deletes the child profile, all stickers, every setting, uploaded family photos, and the daily play timer. You will start over from onboarding.',
      label: 'Yes, reset everything',
      action: nukeEverything,
    }));
  }

  // ===== Helpers =====
  function bindSlider(sel, outSel, initial, format, onChange) {
    const el = $(sel), out = $(outSel);
    el.value = initial;
    out.textContent = format(Number(initial));
    el.addEventListener('input', () => {
      const v = Number(el.value);
      out.textContent = format(v);
      onChange(v);
    });
  }

  function confirmAndDo({ title, msg, label, action }) {
    const body = document.createElement('div');
    body.style.cssText = 'text-align:center;';
    body.innerHTML = `<p>${msg}</p>`;
    PP.UI.modal({
      title, bodyEl: body, mascotMood: 'thinking', dismissible: false,
      actions: [
        { label: 'Cancel' },
        { label, primary: true, onClick: (close) => {
            try { action(); } catch (e) { console.error(e); }
            close();
          } },
      ],
    });
  }

  function exportJson() {
    const payload = {
      generatedAt: new Date().toISOString(),
      app: 'little-learners',
      version: PP.version || '1.0.0',
      profile:  PP.Progress.profile(),
      settings: PP.Progress.settings(),
      learners: PP.Progress.app('learners').exportAll(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `little-learners-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    PP.UI.toast('Progress exported.', { kind: 'good' });
  }

  function importJson(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.profile)  PP.Progress.setProfile(data.profile);
        if (data.settings) PP.Progress.setSettings(data.settings);
        if (data.learners) PP.Progress.app('learners').importAll(data.learners);
        PP.UI.toast('Progress imported!', { kind: 'good' });
        render();
      } catch (err) {
        PP.UI.toast('That file did not look right.', { kind: 'warn' });
      }
    };
    r.readAsText(file);
    e.target.value = '';
  }

  // Full wipe: localStorage, sessionStorage (parent gate flag), IndexedDB photos, SW cache.
  function nukeEverything() {
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('pp_') === 0) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('pp_parent_gate');
    } catch (_) {}

    const dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.deleteDatabase('pp_family');
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      } catch (_) { resolve(); }
    });

    const cachePromise = (async () => {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.filter(n => n.indexOf('pp-') === 0).map(n => caches.delete(n)));
        }
      } catch (_) {}
    })();

    Promise.all([dbPromise, cachePromise]).then(() => {
      PP.UI.toast('Everything cleared. Starting over…', { kind: 'good' });
      setTimeout(() => { window.location.href = '../index.html'; }, 900);
    });
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
  function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
