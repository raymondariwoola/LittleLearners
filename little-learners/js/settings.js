/* Settings modal — reusable. Opens via PP.Settings.open().
 *
 * Surfaces voice (mute, rate, voice picker), audio (mute, volume),
 * theme (auto / day / night), and a reset.
 *
 * All writes go through PP.Voice, PP.Audio, PP.Theme, PP.Progress so this
 * file stays a pure UI layer.
 */
(function () {
  function open() {
    const body = document.createElement('div');
    body.className = 'll-settings';

    body.appendChild(section('🔊 Voice', voiceBlock()));
    body.appendChild(section('🔔 Sounds', audioBlock()));
    body.appendChild(section('🌗 Theme',  themeBlock()));
    body.appendChild(section('🧹 Reset',  resetBlock(close)));

    const m = PP.UI.modal({
      title: 'Settings',
      bodyEl: body,
      actions: [{ label: 'Done' }],
      mascotMood: 'happy',
    });
    function close() { m.close(); }
    return m;
  }

  function section(title, contentEl) {
    const s = document.createElement('section');
    s.className = 'll-settings__sec';
    const h = document.createElement('h3');
    h.textContent = title;
    s.appendChild(h);
    s.appendChild(contentEl);
    return s;
  }

  // ===== Voice =====
  function voiceBlock() {
    const wrap = document.createElement('div');
    wrap.className = 'll-settings__row';

    // Mute toggle
    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'pp-btn pp-btn--secondary';
    const setMuteLabel = () => muteBtn.textContent = PP.Voice.isMuted() ? '🔇 Voice muted' : '🔊 Voice on';
    setMuteLabel();
    muteBtn.addEventListener('click', () => { PP.Voice.toggleMute(); setMuteLabel(); });
    wrap.appendChild(muteBtn);

    // Rate slider
    const rate = document.createElement('label');
    rate.className = 'll-settings__field';
    const rateNow = PP.Voice.getRate ? PP.Voice.getRate() : 0.95;
    rate.innerHTML = `<span>Speed</span>
      <input type="range" min="0.6" max="1.2" step="0.05" value="${rateNow}" />
      <output>${rateNow.toFixed(2)}×</output>`;
    const slider = rate.querySelector('input');
    const out = rate.querySelector('output');
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      out.textContent = v.toFixed(2) + '×';
      PP.Voice.setRate(v);
    });
    wrap.appendChild(rate);

    // Voice picker
    const pick = document.createElement('label');
    pick.className = 'll-settings__field';
    pick.innerHTML = `<span>Storyteller</span><select></select>
      <button type="button" class="pp-btn pp-btn--icon" data-test aria-label="Test voice">🗣️</button>`;
    const sel = pick.querySelector('select');
    const test = pick.querySelector('[data-test]');

    function fillVoices() {
      const voices = (PP.Voice.getVoices && PP.Voice.getVoices()) || [];
      const cur = (PP.Voice.getSelected && PP.Voice.getSelected()) || null;
      sel.innerHTML = '';
      if (!voices.length) {
        const o = document.createElement('option');
        o.textContent = 'System default';
        sel.appendChild(o); sel.disabled = true;
        return;
      }
      sel.disabled = false;
      voices.forEach(v => {
        const o = document.createElement('option');
        o.value = v.name;
        o.textContent = `${v.name} (${v.lang || ''})`;
        if (cur && cur.name === v.name) o.selected = true;
        sel.appendChild(o);
      });
    }
    fillVoices();
    sel.addEventListener('change', () => PP.Voice.setVoiceByName && PP.Voice.setVoiceByName(sel.value));
    test.addEventListener('click', () => PP.Voice.speak('Hi! I am ready to read with you!', { interrupt: true }));
    if (PP.Voice.onChange) PP.Voice.onChange(fillVoices);
    wrap.appendChild(pick);

    return wrap;
  }

  // ===== Audio =====
  function audioBlock() {
    const wrap = document.createElement('div');
    wrap.className = 'll-settings__row';

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'pp-btn pp-btn--secondary';
    const setLabel = () => muteBtn.textContent = PP.Audio.isMuted() ? '🔕 Sounds muted' : '🔔 Sounds on';
    setLabel();
    muteBtn.addEventListener('click', () => { PP.Audio.toggleMute(); setLabel(); });
    wrap.appendChild(muteBtn);

    const vol = document.createElement('label');
    vol.className = 'll-settings__field';
    const vNow = PP.Audio.getVolume ? PP.Audio.getVolume() : 0.7;
    vol.innerHTML = `<span>Volume</span>
      <input type="range" min="0" max="1" step="0.05" value="${vNow}" />
      <output>${Math.round(vNow*100)}%</output>`;
    const slider = vol.querySelector('input');
    const out = vol.querySelector('output');
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      out.textContent = Math.round(v*100) + '%';
      PP.Audio.setVolume && PP.Audio.setVolume(v);
    });
    wrap.appendChild(vol);

    const test = document.createElement('button');
    test.type = 'button';
    test.className = 'pp-btn pp-btn--secondary';
    test.textContent = '🎵 Test';
    test.addEventListener('click', () => { PP.Audio.unlock && PP.Audio.unlock(); PP.Audio.correct(); });
    wrap.appendChild(test);

    return wrap;
  }

  // ===== Theme =====
  function themeBlock() {
    const wrap = document.createElement('div');
    wrap.className = 'll-settings__row';

    const options = [
      { id: 'auto', label: '🌓 Auto' },
      { id: 'day',  label: '☀️ Day'  },
      { id: 'night',label: '🌙 Night'},
    ];
    const current = PP.Progress.settings().theme || 'auto';
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pp-btn pp-btn--secondary' + (o.id === current ? ' is-active' : '');
      b.textContent = o.label;
      b.addEventListener('click', () => {
        wrap.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        if (o.id === 'auto') { PP.Theme.setAuto && PP.Theme.setAuto(true); PP.Theme.setOverride && PP.Theme.setOverride(null); }
        else { PP.Theme.setAuto && PP.Theme.setAuto(false); PP.Theme.setOverride && PP.Theme.setOverride(o.id); }
        PP.Theme.apply && PP.Theme.apply();
      });
      wrap.appendChild(b);
    });

    return wrap;
  }

  // ===== Reset =====
  function resetBlock(close) {
    const wrap = document.createElement('div');
    wrap.className = 'll-settings__row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pp-btn pp-btn--secondary';
    btn.textContent = '🧹 Clear my stickers';
    btn.addEventListener('click', async () => {
      const ok = await PP.UI.parentGate();
      if (!ok) return;
      const confirmEl = document.createElement('div');
      confirmEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;text-align:center;';
      confirmEl.innerHTML = `<p>This clears all sticker progress for Little Learners. Photos and profile are kept.</p>`;
      const m = PP.UI.modal({
        title: 'Are you sure?',
        bodyEl: confirmEl,
        mascotMood: 'thinking',
        actions: [
          { label: 'Cancel' },
          { label: 'Yes, clear', kind: 'warn', onClick: () => {
            PP.Progress.app('learners').reset();
            PP.UI.toast('Stickers cleared.', { kind: 'good' });
            m.close();
            close && close();
          } },
        ],
      });
    });
    wrap.appendChild(btn);
    return wrap;
  }

  window.PP = window.PP || {};
  window.PP.Settings = { open };
})();
