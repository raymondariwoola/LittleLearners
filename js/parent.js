/* Parent Dashboard — math-gated stats, settings, and export/import.
 *
 * The page itself is reached from the hub only after PP.UI.parentGate().
 * As a safety net it re-gates on direct load (refresh / deep link).
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const learners = PP.Progress.app('learners');

  // Roster lengths so % calculations make sense. Derived from the live data
  // arrays so they stay accurate as datasets grow; fall back to known sizes
  // if a data module isn't loaded on this page.
  const _len = (arr, fb) => (Array.isArray(arr) && arr.length) ? arr.length : fb;
  const TOTAL = {
    letters:   _len(PP.Letters,   26),
    numbers:   _len(PP.Numbers,   20),
    colors:    _len(PP.Colors,    12),
    animals:   _len(PP.Animals,   15),
    shapes:    _len(PP.Shapes,    10),
    bodyparts: _len(PP.BodyParts, 14),
    family:    _len(PP.Family,    9),
    food:      _len(PP.Food,      12),
    counting:  _len(PP.Numbers,   20),
    phonics:   _len(PP.Phonics,   10),
    story:     5,
    memory:    6,
  };

  async function init() {
    PP.Theme.apply();

    // Safety re-gate when reaching this page directly.
    const lastGate = sessionStorage.getItem('pp_parent_gate');
    if (lastGate !== '1') {
      const ok = await PP.UI.parentGate();
      if (!ok) { window.location.href = '../index.html'; return; }
      sessionStorage.setItem('pp_parent_gate', '1');
    }

    render();
  }

  function render() {
    const root = $('#parent');
    const profile = PP.Progress.profile();
    const learnersData = learners.exportAll() || {};
    const stickers = learnersData.stickers || {};

    root.innerHTML = `
      <div class="ll-cat__bar">
        <button id="parentBack" class="ll-cat__back" type="button" aria-label="Back to home">←</button>
        <div class="ll-cat__title"><span aria-hidden="true">🔐</span><span>Parent Zone</span></div>
        <div class="ll-cat__modes"></div>
      </div>

      <section class="ll-parent">
        <header class="ll-parent__hero">
          <h1>${profile.name ? `${escapeHtml(profile.name)}'s progress` : 'Progress'}</h1>
          <p class="ll-parent__sub">Age mode: <strong>${(PP.AgeModes.find(a => a.id === profile.ageMode) || {}).label || '—'}</strong></p>
        </header>

        <div class="ll-parent__cards" id="parentStats"></div>

        <div class="ll-parent__row">
          <button id="openSettings" class="pp-btn pp-btn--primary pp-btn--big">⚙️ Settings</button>
          <button id="changeAge"    class="pp-btn pp-btn--secondary pp-btn--big">🧸 Change age mode</button>
        </div>

        <div class="ll-parent__row">
          <button id="exportBtn"    class="pp-btn pp-btn--mint pp-btn--big">⬇️ Export progress</button>
          <label class="pp-btn pp-btn--lavender pp-btn--big" style="cursor:pointer;">
            ⬆️ Import progress
            <input id="importInput" type="file" accept="application/json" hidden />
          </label>
        </div>

        <details class="ll-parent__details">
          <summary>About Little Learners</summary>
          <p>Part of the Professor Hoot Learning Suite. No ads. No tracking. All progress lives on this device.</p>
        </details>
      </section>`;

    // Stats grid
    const grid = $('#parentStats');
    const adaptiveSnap = (PP.Adaptive && PP.Adaptive.snapshot) ? PP.Adaptive.snapshot() : {};
    (PP.Categories || []).forEach(cat => {
      const owned = (stickers[cat.id] || []).length;
      const total = TOTAL[cat.id] || 10;
      const pct = Math.min(100, Math.round((owned / total) * 100));
      // Heatmap chip: blend explicit sticker % with the adaptive confidence
      // bucket so a child who scored well but hasn't unlocked every sticker
      // still reads as "Strong". Sticker % is the primary signal.
      const adapt = adaptiveSnap[cat.id];
      let chipLabel = 'Needs repetition';
      let chipClass = 'is-coral';
      if (pct >= 80 || (adapt && adapt.conf >= 0.8 && adapt.plays >= 3)) {
        chipLabel = 'Strong'; chipClass = 'is-mint';
      } else if (pct >= 30 || (adapt && adapt.conf >= 0.5)) {
        chipLabel = 'Emerging'; chipClass = 'is-sun';
      }
      const card = document.createElement('div');
      card.className = 'll-parent__stat';
      card.innerHTML = `
        <div class="ll-parent__stat-row">
          <span class="ll-parent__stat-icon" aria-hidden="true">${cat.icon}</span>
          <strong>${cat.label}</strong>
          <span class="ll-parent__chip ${chipClass}">${chipLabel}</span>
          <span class="ll-parent__stat-num">${owned}/${total}</span>
        </div>
        <div class="ll-parent__bar"><span style="width:${pct}%"></span></div>`;
      grid.appendChild(card);
    });

    $('#parentBack').addEventListener('click', () => {
      sessionStorage.removeItem('pp_parent_gate');
      window.location.href = '../index.html';
    });
    $('#openSettings').addEventListener('click', () => PP.Settings.open());
    $('#changeAge').addEventListener('click', openAgeMenu);
    $('#exportBtn').addEventListener('click', exportJson);
    $('#importInput').addEventListener('change', importJson);
  }

  function openAgeMenu() {
    const body = document.createElement('div');
    body.style.cssText = 'display:grid;gap:12px;grid-template-columns:repeat(2,1fr);';
    PP.AgeModes.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-onboard__age';
      b.innerHTML = `<span class="ll-onboard__age__icon">${m.icon}</span>
        <span>${m.label}</span>
        <span class="ll-onboard__age__caption">${m.caption}</span>`;
      b.addEventListener('click', () => {
        PP.Progress.setProfile({ ageMode: m.id });
        modal.close();
        PP.UI.toast(`${m.label} mode on`, { kind: 'good' });
        render();
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

  function exportJson() {
    const payload = {
      generatedAt: new Date().toISOString(),
      app: 'little-learners',
      version: PP.version || '1.0.0',
      profile: PP.Progress.profile(),
      settings: PP.Progress.settings(),
      learners: PP.Progress.app('learners').exportAll(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `little-learners-${stamp}.json`;
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
