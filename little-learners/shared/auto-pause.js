/* PP.AutoPause — gentle screen-time reminder.
 *
 * Tracks accumulated *active* time across pages (stored under
 * pp_settings.activeMsToday with a YYYY-MM-DD stamp so it resets daily).
 * After 20 minutes of active play we show a friendly break modal that
 * requires the parent gate to dismiss. Idle and hidden time do not count.
 *
 * "Active" = the tab is visible AND there has been any pointer / key / touch
 * event in the last IDLE_WINDOW_MS.
 */
(function () {
  const LIMIT_MS = 20 * 60 * 1000;
  const TICK_MS  = 15 * 1000;
  const IDLE_WINDOW_MS = 60 * 1000;
  const STORAGE_KEY = 'autoPauseDay';

  let lastInteractionAt = Date.now();
  let lastTickAt = Date.now();
  let shown = false;

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function readState() {
    const s = (PP.Progress && PP.Progress.settings && PP.Progress.settings()) || {};
    const day = today();
    if (!s[STORAGE_KEY] || s[STORAGE_KEY].day !== day) {
      return { day, ms: 0 };
    }
    return { day, ms: s[STORAGE_KEY].ms || 0 };
  }

  function writeState(state) {
    if (!PP.Progress || !PP.Progress.setSettings) return;
    const patch = {}; patch[STORAGE_KEY] = state;
    PP.Progress.setSettings(patch);
  }

  function noteInteraction() { lastInteractionAt = Date.now(); }

  function tick() {
    const now = Date.now();
    const dt = now - lastTickAt;
    lastTickAt = now;

    const active = !document.hidden && (now - lastInteractionAt) < IDLE_WINDOW_MS;
    if (!active) return;

    const state = readState();
    state.ms += dt;
    writeState(state);

    if (state.ms >= LIMIT_MS && !shown) showBreak();
  }

  function showBreak() {
    if (shown) return;
    shown = true;
    if (PP.Voice && PP.Voice.cancel) PP.Voice.cancel();

    const body = document.createElement('div');
    body.style.cssText = 'text-align:center;font-family:"Baloo 2",sans-serif;';
    body.innerHTML = `
      <p style="font-size:18px;margin:6px 0 14px;">You've been playing for a while. Let's stretch, sip some water, and rest our eyes! 💧</p>
      <p style="color:var(--pp-ink-soft);">A grown-up can unlock more play time.</p>`;

    const modal = PP.UI.modal({
      title: '🌙 Time for a little break!',
      bodyEl: body,
      dismissible: false,
      mascotMood: 'sleepy',
      actions: [
        { label: '🏠 Go home', onClick: (close) => {
            close();
            const path = window.location.pathname;
            if (path.indexOf('/pages/') !== -1) window.location.href = '../index.html';
          }
        },
        { label: '👩‍🏫 Grown-up: more time', primary: true, onClick: async (close) => {
            const ok = await PP.UI.parentGate();
            if (!ok) return;
            writeState({ day: today(), ms: 0 });
            shown = false;
            close();
            PP.UI.toast('Have fun!', { kind: 'good' });
          }
        },
      ],
    });
  }

  function start() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
      window.addEventListener(ev, noteInteraction, { passive: true })
    );
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { lastInteractionAt = Date.now(); lastTickAt = Date.now(); }
    });
    setInterval(tick, TICK_MS);

    // If the saved counter is already over the limit when a new page loads, show immediately.
    const state = readState();
    if (state.ms >= LIMIT_MS) setTimeout(showBreak, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.PP = window.PP || {};
  window.PP.AutoPause = {
    reset() { writeState({ day: today(), ms: 0 }); shown = false; },
    snapshot() { return readState(); },
  };
})();
