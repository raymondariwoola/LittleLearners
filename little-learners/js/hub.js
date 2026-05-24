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
        const ageMode = $('.ll-onboard__age.is-selected', ageList)?.dataset.id || 'toddler';
        PP.Progress.setProfile({ name, ageMode, createdAt: Date.now() });
        PP.Audio.unlock();
        root.hidden = true;
        resolve();
      }, { once: true });
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
    learners.set('lastSeen', Date.now());

    const greeting = PP.Phrases.greeting(p.name);
    $('#helloLine').textContent = greeting;
    // Speak after a tick so the page is settled
    setTimeout(() => {
      PP.Mascot.speak(mascotEl, true);
      PP.Voice.speak(greeting).then(() => PP.Mascot.speak(mascotEl, false));
    }, 350);
  }

  // ===== Category grid =====
  function renderGrid() {
    const grid = $('#catGrid');
    grid.replaceChildren(...PP.Categories.map(cat => {
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

  // Loose targets for the progress ring; will refine per category later.
  function stickerTargetFor(id) {
    return ({
      letters: 26, numbers: 20, colors: 12, animals: 15, shapes: 10,
      bodyparts: 14, family: 9, food: 12, counting: 10, phonics: 10, story: 5,
    })[id] || 10;
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
    el.addEventListener('click', async () => {
      const ok = await PP.UI.parentGate();
      if (ok) openAgeMenu();
    });
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

  function wireToolbar() {
    $('#voiceMute').addEventListener('click', (e) => {
      const muted = PP.Voice.toggleMute();
      e.currentTarget.textContent = muted ? '🔇' : '🔊';
      PP.UI.toast(muted ? 'Voice off' : 'Voice on');
    });
    $('#sfxMute').addEventListener('click', (e) => {
      const muted = PP.Audio.toggleMute();
      e.currentTarget.textContent = muted ? '🔕' : '🔔';
      PP.UI.toast(muted ? 'Sounds off' : 'Sounds on');
    });
    $('#voiceMute').textContent = PP.Voice.isMuted() ? '🔇' : '🔊';
    $('#sfxMute').textContent = PP.Audio.isMuted() ? '🔕' : '🔔';

    $('#stickerBook').addEventListener('click', () => {
      PP.Audio.pageFlip();
      PP.UI.toast('Sticker book coming soon');
      // Phase 6 will route to pages/stickers.html
    });

    $('#parentBtn').addEventListener('click', async () => {
      const ok = await PP.UI.parentGate();
      if (ok) PP.UI.toast('Parent zone coming in Phase 6');
    });
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
