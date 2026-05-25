/* Hub — Little Learners landing page.
 * Responsibilities:
 *   - First-run profile onboarding (name + age mode)
 *   - Render category grid with sticker-progress rings
 *   - Greet child by name (voiced)
 *   - "Continue last activity" deep link
 *   - Bottom toolbar: age badge, settings, sticker book, parent zone
 *   - Auto-pause overlay after 20min, day/night theme already handled by PP.Theme
 */
(function () {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const learners = PP.Progress.app('learners');
  let mascotEl = null;

  // ===== First-run onboarding =====
  function needsOnboarding() {
    const p = PP.Progress.profile();
    return !p.name || !p.ageMode;
  }

  function showOnboarding() {
    return new Promise(resolve => {
      const root = $('#onboard');
      root.hidden = false;
      const mascot = PP.Mascot.build();
      mascot.classList.add('mascot--bob');
      PP.Mascot.setMood(mascot, 'waving');
      $('#onboardMascot').replaceChildren(mascot);

      // Age picker buttons
      const ageList = $('#onboardAges');
      ageList.replaceChildren(...PP.AgeModes.map(m => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'll-onboard__age';
        btn.dataset.id = m.id;
        btn.innerHTML = `
          <span class="ll-onboard__age__icon">${m.icon}</span>
          <span>${m.label}</span>
          <span class="ll-onboard__age__caption">${m.caption}</span>`;
        btn.addEventListener('click', () => {
          $$('.ll-onboard__age', ageList).forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          PP.Audio.pling();
        });
        return btn;
      }));
      // Default to toddler
      const first = $('.ll-onboard__age[data-id="toddler"]', ageList);
      if (first) first.classList.add('is-selected');

      const nameInput = $('#onboardName');
      nameInput.value = PP.Progress.profile().name || '';

      // Voice greeting on open (after user interaction guard — onboard is the
      // first interactive moment, so synth will work after the Save click).

      $('#onboardSave').addEventListener('click', () => {
        const name = (nameInput.value || '').trim().slice(0, 20);
        if (!name) {
          nameInput.focus();
          nameInput.setAttribute('aria-invalid', 'true');
          PP.UI.toast('Please add a name to continue');
          return;
        }
        nameInput.removeAttribute('aria-invalid');
        const ageMode = $('.ll-onboard__age.is-selected', ageList)?.dataset.id || 'toddler';
        PP.Progress.setProfile({ name, ageMode, createdAt: Date.now() });
        PP.Audio.unlock();
        root.hidden = true;
        resolve();
      });
    });
  }

  // ===== Greeting =====
  function applyAgeModeAttr() {
    const m = PP.Progress.profile().ageMode || 'toddler';
    document.documentElement.setAttribute('data-age-mode', m);
  }

  function greet() {
    const p = PP.Progress.profile();
    const last = learners.get('lastSeen', 0);
    const now = Date.now();
    learners.set('lastSeen', now);

    const greeting = PP.Phrases.greeting(p.name);
    $('#helloLine').textContent = greeting;

    // Only speak the greeting if the user hasn't been on this screen in the
    // last 5 minutes. Returning from a game after 30 seconds should not
    // replay "Hi Arianna!" every single time.
    const GREET_COOLDOWN_MS = 5 * 60 * 1000;
    const shouldSpeak = !last || (now - last) > GREET_COOLDOWN_MS;
    if (!shouldSpeak) return;

    // Speak after a tick so the page is settled
    setTimeout(() => {
      PP.Mascot.speak(mascotEl, true);
      PP.Voice.speak(greeting).then(() => PP.Mascot.speak(mascotEl, false));
    }, 350);
  }

  // ===== Daily mission =====
  // Pick 4 categories deterministically from today's date so the same child
  // gets the same suggestions across a day even after refreshes. Completion
  // is detected by comparing today's sticker counts against the baseline
  // captured the first time the mission was rendered.
  function _todayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function _seededShuffle(items, seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      const j = h % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function _stickerCount(catId) {
    const s = learners.get(`stickers.${catId}`, []) || [];
    return s.length;
  }

  function ensureMission() {
    const today = _todayKey();
    const cur = learners.get('mission', null);
    if (cur && cur.day === today && Array.isArray(cur.tasks) && cur.tasks.length === 4) {
      return cur;
    }
    const pool = (PP.Categories || []).map(c => c.id);
    const profileName = (PP.Progress.profile().name || 'friend');
    const tasks = _seededShuffle(pool, today + ':' + profileName).slice(0, 4);
    const baseline = {};
    tasks.forEach(id => { baseline[id] = _stickerCount(id); });
    const fresh = { day: today, tasks, baseline, celebrated: false };
    learners.set('mission', fresh);
    return fresh;
  }

  function _missionStatus(m) {
    return m.tasks.map(id => {
      const cat = (PP.Categories || []).find(c => c.id === id);
      const before = (m.baseline && typeof m.baseline[id] === 'number') ? m.baseline[id] : 0;
      const now = _stickerCount(id);
      return { id, cat, done: now > before };
    });
  }

  function renderMission() {
    const root = $('#missionCard');
    if (!root) return;
    const m = ensureMission();
    const status = _missionStatus(m);
    const doneCount = status.filter(s => s.done).length;
    const allDone = doneCount === status.length;
    root.hidden = false;
    root.classList.toggle('is-done', allDone);

    const dots = status.map(s => {
      const label = s.cat ? s.cat.label : s.id;
      const icon = s.cat ? s.cat.icon : '⭐';
      return `<span class="ll-mission__dot" data-done="${s.done}"><span class="em">${s.done ? '✅' : icon}</span>${label}</span>`;
    }).join('');

    const titleText = allDone ? "Mission complete! ⭐" : "Today's mission";
    const subText = allDone
      ? 'You finished all four! Great hooting!'
      : `Finish ${status.length - doneCount} more to wrap today.`;
    const ctaLabel = allDone ? 'See sticker book' : 'Start mission';

    root.innerHTML = `
      <div>
        <h2 class="ll-mission__title">${titleText}</h2>
        <p class="ll-mission__sub">${subText}</p>
        <div class="ll-mission__dots">${dots}</div>
      </div>
      <button type="button" class="pp-btn pp-btn--primary ll-mission__cta">${ctaLabel}</button>`;

    const cta = root.querySelector('.ll-mission__cta');
    cta.addEventListener('click', () => {
      PP.Audio.pling();
      if (allDone) { window.location.href = 'pages/stickers.html'; return; }
      const next = status.find(s => !s.done);
      if (!next || !next.cat) return;
      learners.set('lastCategory', next.id);
      window.location.href = next.cat.page;
    });

    if (allDone && !m.celebrated) {
      learners.set('mission.celebrated', true);
      try {
        const r = root.getBoundingClientRect();
        PP.Confetti.burst(r.left + r.width / 2, r.top + 40, 80);
      } catch (_) { /* confetti optional */ }
      PP.UI.toast('Daily mission complete! ⭐', { kind: 'good' });
    }
  }

  // ===== Category grid =====
  function renderGrid() {
    const ageMode = PP.Progress.profile().ageMode || 'toddler';
    const visibleCats = PP.Categories.filter(cat =>
      !window.PP || !PP.AgeConfig || PP.AgeConfig.isCategoryVisible(cat.id, ageMode)
    );
    const grid = $('#catGrid');
    grid.replaceChildren(...visibleCats.map(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'll-card';
      btn.dataset.cat = cat.id;
      btn.setAttribute('aria-label', cat.label);

      const stickers = learners.get(`stickers.${cat.id}`, []) || [];
      const target = stickerTargetFor(cat.id);
      const pct = target ? Math.min(100, Math.round((stickers.length / target) * 100)) : 0;

      btn.innerHTML = `
        <span class="ll-card__icon" aria-hidden="true">${cat.icon}</span>
        <span class="ll-card__label">${cat.label}</span>
        <span class="ll-card__progress">
          <span class="ll-card__progress-ring" style="--p:${pct}"></span>
          ${stickers.length}${target ? '/' + target : ''} ⭐
        </span>`;
      btn.addEventListener('click', () => onCategoryTap(cat, btn));
      return btn;
    }));
  }

  // Sticker targets are derived from the age-appropriate item count so the
  // ring fills to 100% once the child has seen everything for their tier.
  function stickerTargetFor(id) {
    const ageMode = PP.Progress.profile().ageMode || 'toddler';
    if (window.PP && PP.AgeConfig) {
      const n = (PP.AgeConfig.subsets[id] || {})[ageMode];
      if (n != null && n > 0) return n;
      if (n === null) {
        // "show all" — fall through to raw length below
      } else if (n === 0) return 1; // hidden category, shouldn't appear
    }
    const len = (arr) => Array.isArray(arr) ? arr.length : 0;
    const sizes = {
      letters:   len(PP.Letters)   || 26,
      numbers:   len(PP.Numbers)   || 20,
      colors:    len(PP.Colors)    || 12,
      animals:   len(PP.Animals)   || 15,
      shapes:    len(PP.Shapes)    || 10,
      bodyparts: len(PP.BodyParts) || 14,
      family:    len(PP.Family)    || 9,
      food:      len(PP.Food)      || 12,
      counting:  len(PP.Numbers)   || 20,
      phonics:   len(PP.Phonics)   || 10,
      story:     5,
      memory:    6,
    };
    return sizes[id] || 10;
  }

  function onCategoryTap(cat, btnEl) {
    PP.Audio.pling();
    btnEl.classList.remove('pp-pop'); void btnEl.offsetWidth; btnEl.classList.add('pp-pop');
    PP.Mascot.setMood(mascotEl, 'excited');
    PP.Voice.speak(cat.label, { interrupt: true });
    learners.set('lastCategory', cat.id);
    setTimeout(() => { window.location.href = cat.page; }, 280);
  }

  // ===== Continue last =====
  function renderContinue() {
    const last = learners.get('lastCategory', null);
    const btn = $('#continueBtn');
    if (!last) { btn.hidden = true; return; }
    const cat = PP.Categories.find(c => c.id === last);
    if (!cat) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.innerHTML = `▶ Continue ${cat.label}`;
    btn.addEventListener('click', () => {
      PP.Audio.pling();
      window.location.href = cat.page;
    });
  }

  // ===== Toolbar wiring =====
  function renderAgeBadge() {
    const m = PP.Progress.profile().ageMode || 'toddler';
    const cfg = PP.AgeModes.find(a => a.id === m) || PP.AgeModes[0];
    const el = $('#ageBadge');
    el.innerHTML = `${cfg.icon} <span>${cfg.label}</span>`;
    // Use onclick (single slot) so repeated renderAgeBadge() calls cannot
    // stack handlers and trigger the parent gate multiple times.
    el.onclick = async () => {
      const ok = await PP.UI.parentGate();
      if (ok) openAgeMenu();
    };
  }

  function openAgeMenu() {
    const body = document.createElement('div');
    body.style.display = 'grid';
    body.style.gap = '12px';
    body.style.gridTemplateColumns = 'repeat(2, 1fr)';
    PP.AgeModes.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-onboard__age';
      b.innerHTML = `
        <span class="ll-onboard__age__icon">${m.icon}</span>
        <span>${m.label}</span>
        <span class="ll-onboard__age__caption">${m.caption}</span>`;
      b.addEventListener('click', () => {
        PP.Progress.setProfile({ ageMode: m.id });
        applyAgeModeAttr();
        renderAgeBadge();
        renderGrid();
        renderMission();
        modal.close();
        PP.UI.toast(`${m.label} mode on`, { kind: 'good' });
      });
      body.appendChild(b);
    });
    const modal = PP.UI.modal({
      title: 'Pick an age mode',
      bodyEl: body,
      actions: [{ label: 'Done' }],
      mascotMood: 'happy',
    });
  }

  function _voiceIcon(muted) { return `<span aria-hidden="true">${muted ? '🔇' : '🔊'}</span><span class="tb-label">Voice</span>`; }
  function _sfxIcon(muted)   { return `<span aria-hidden="true">${muted ? '🔕' : '🔔'}</span><span class="tb-label">Sound</span>`; }

  function wireToolbar() {
    const voiceMuteEl = $('#voiceMute');
    const sfxMuteEl   = $('#sfxMute');

    voiceMuteEl.innerHTML = _voiceIcon(PP.Voice.isMuted());
    sfxMuteEl.innerHTML   = _sfxIcon(PP.Audio.isMuted());
    $('#settingsBtn').innerHTML = `<span aria-hidden="true">⚙️</span><span class="tb-label">Settings</span>`;
    $('#stickerBook').innerHTML = `<span aria-hidden="true">🏆</span><span class="tb-label">Stickers</span>`;
    $('#parentBtn').innerHTML   = `<span aria-hidden="true">🔒</span><span class="tb-label">Parents</span>`;

    voiceMuteEl.addEventListener('click', () => {
      const muted = PP.Voice.toggleMute();
      voiceMuteEl.innerHTML = _voiceIcon(muted);
      PP.UI.toast(muted ? 'Voice off' : 'Voice on');
    });
    sfxMuteEl.addEventListener('click', () => {
      const muted = PP.Audio.toggleMute();
      sfxMuteEl.innerHTML = _sfxIcon(muted);
      PP.UI.toast(muted ? 'Sounds off' : 'Sounds on');
    });

    $('#stickerBook').addEventListener('click', () => {
      PP.Audio.pageFlip();
      window.location.href = 'pages/stickers.html';
    });

    $('#parentBtn').addEventListener('click', async () => {
      const ok = await PP.UI.parentGate();
      if (!ok) return;
      sessionStorage.setItem('pp_parent_gate', '1');
      window.location.href = 'pages/parent.html';
    });

    const settingsBtn = $('#settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => PP.Settings.open());
  }

  // ===== Init =====
  async function init() {
    PP.Theme.apply();
    if (needsOnboarding()) await showOnboarding();
    applyAgeModeAttr();

    mascotEl = PP.Mascot.build();
    mascotEl.classList.add('mascot--bob');
    PP.Mascot.setMood(mascotEl, 'happy');
    PP.Mascot.eyesFollow(mascotEl, true);
    PP.Mascot.idle(mascotEl, true);
    $('#hubMascot').replaceChildren(mascotEl);

    renderGrid();
    renderMission();
    renderContinue();
    renderAgeBadge();
    wireToolbar();
    greet();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
