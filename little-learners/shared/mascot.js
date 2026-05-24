/* PP.Mascot — Professor Hoot.
 *
 * SHARED across the Professor Hoot suite. The SVG geometry MUST match
 * Clock Quest's mascot.js exactly so children recognise the same character.
 *
 * Moods (CSS classes mascot--<mood>):
 *   happy | sad | excited | thinking | celebrating | singing | waving | curious | sleepy
 *
 * API:
 *   Mascot.build()             -> SVGElement
 *   Mascot.setMood(el, mood)   -> apply mood class (replaces previous)
 *   Mascot.speak(el, on)       -> toggle .speaking pulse for lip-sync illusion
 *   Mascot.wave(el)            -> one-shot wave
 *   Mascot.eyesFollow(el, on)  -> subtle pupil parallax toward pointer
 *   Mascot.idle(el, on)        -> gentle wiggle after periods of no input
 */
(function () {
  const MOODS = ['happy', 'sad', 'excited', 'thinking', 'celebrating', 'singing', 'waving', 'curious', 'sleepy'];

  function build() {
    const svg = `
<svg class="mascot" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="ppBodyGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#b89b75"/>
      <stop offset="100%" stop-color="#7a5e3f"/>
    </radialGradient>
    <radialGradient id="ppBellyGrad" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#fff5dc"/>
      <stop offset="100%" stop-color="#e8c98a"/>
    </radialGradient>
    <radialGradient id="ppEyeWhite" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e0e0"/>
    </radialGradient>
  </defs>

  <!-- Wings (behind body) -->
  <ellipse class="wing wing-l" cx="40" cy="120" rx="22" ry="40" fill="#6b4f33" transform="rotate(-15 40 120)"/>
  <ellipse class="wing wing-r" cx="160" cy="120" rx="22" ry="40" fill="#6b4f33" transform="rotate(15 160 120)"/>

  <!-- Body -->
  <ellipse cx="100" cy="120" rx="62" ry="68" fill="url(#ppBodyGrad)"/>

  <!-- Belly -->
  <ellipse cx="100" cy="135" rx="40" ry="48" fill="url(#ppBellyGrad)"/>

  <!-- Feet -->
  <ellipse cx="78" cy="184" rx="10" ry="5" fill="#ffb347"/>
  <ellipse cx="122" cy="184" rx="10" ry="5" fill="#ffb347"/>

  <!-- Eyes -->
  <g class="eye eye-l">
    <circle cx="78" cy="92" r="22" fill="url(#ppEyeWhite)" stroke="#3a2a1a" stroke-width="2"/>
    <circle class="eye-pupil" cx="78" cy="92" r="10" fill="#1a0f04"/>
    <circle class="eye-shine" cx="74" cy="88" r="3.5" fill="#fff"/>
  </g>
  <g class="eye eye-r">
    <circle cx="122" cy="92" r="22" fill="url(#ppEyeWhite)" stroke="#3a2a1a" stroke-width="2"/>
    <circle class="eye-pupil" cx="122" cy="92" r="10" fill="#1a0f04"/>
    <circle class="eye-shine" cx="118" cy="88" r="3.5" fill="#fff"/>
  </g>

  <!-- Eyelids (used for sleepy / blink) -->
  <rect class="lid lid-l" x="56" y="70" width="44" height="0" rx="8" fill="#7a5e3f"/>
  <rect class="lid lid-r" x="100" y="70" width="44" height="0" rx="8" fill="#7a5e3f"/>

  <!-- Beak -->
  <path class="beak" d="M 92 110 Q 100 122 108 110 Q 100 116 92 110 Z" fill="#ffb347" stroke="#c97f1f" stroke-width="1.5"/>

  <!-- Graduation cap -->
  <g class="cap">
    <rect x="62" y="38" width="76" height="14" rx="3" fill="#2a1437"/>
    <polygon points="100,18 152,38 100,52 48,38" fill="#2a1437"/>
    <circle cx="100" cy="32" r="3" fill="#ffd166"/>
    <line x1="100" y1="32" x2="138" y2="55" stroke="#ffd166" stroke-width="2"/>
    <circle cx="138" cy="58" r="4" fill="#ffd166"/>
  </g>

  <!-- Eyebrows (shown when sad / excited / thinking) -->
  <path class="brow brow-l" d="M 62 76 Q 78 70 92 76" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>
  <path class="brow brow-r" d="M 108 76 Q 122 70 138 76" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>

  <!-- Singing music notes (revealed when singing) -->
  <g class="notes" opacity="0">
    <text x="38" y="62" font-family="serif" font-size="22" fill="#ff9bc7">♪</text>
    <text x="148" y="56" font-family="serif" font-size="26" fill="#c9a3ff">♫</text>
    <text x="160" y="100" font-family="serif" font-size="20" fill="#7fdca8">♪</text>
  </g>

  <!-- Celebration sparkles (revealed when celebrating) -->
  <g class="sparkles" opacity="0">
    <circle cx="30" cy="40" r="3" fill="#ffd966"/>
    <circle cx="170" cy="36" r="3" fill="#ff9bc7"/>
    <circle cx="180" cy="120" r="3" fill="#7fdca8"/>
    <circle cx="20" cy="110" r="3" fill="#c9a3ff"/>
    <circle cx="100" cy="14" r="3" fill="#ff8c66"/>
  </g>
</svg>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = svg.trim();
    return wrap.firstChild;
  }

  function setMood(el, mood) {
    if (!el) return;
    MOODS.forEach(m => el.classList.remove('mascot--' + m));
    if (mood) el.classList.add('mascot--' + mood);
  }

  function speak(el, on) {
    if (!el) return;
    el.classList.toggle('speaking', !!on);
  }

  function wave(el) {
    if (!el) return;
    el.classList.remove('mascot--waving-once');
    // Reflow so the animation can restart
    void el.offsetWidth;
    el.classList.add('mascot--waving-once');
    setTimeout(() => el.classList.remove('mascot--waving-once'), 1200);
  }

  function eyesFollow(el, on) {
    if (!el) return;
    if (el._ppFollowHandler) {
      window.removeEventListener('pointermove', el._ppFollowHandler);
      el._ppFollowHandler = null;
    }
    if (!on) return;
    const pupils = el.querySelectorAll('.eye-pupil');
    const handler = (e) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-4, Math.min(4, (e.clientX - cx) / 80));
      const dy = Math.max(-3, Math.min(3, (e.clientY - cy) / 80));
      pupils.forEach(p => { p.setAttribute('transform', `translate(${dx} ${dy})`); });
    };
    el._ppFollowHandler = handler;
    window.addEventListener('pointermove', handler, { passive: true });
  }

  let idleTimers = new WeakMap();
  function idle(el, on) {
    if (!el) return;
    const prev = idleTimers.get(el);
    if (prev) { clearInterval(prev); idleTimers.delete(el); }
    el.classList.remove('mascot--idle-nudge');
    if (!on) return;
    const t = setInterval(() => {
      el.classList.remove('mascot--idle-nudge');
      void el.offsetWidth;
      el.classList.add('mascot--idle-nudge');
    }, 10000);
    idleTimers.set(el, t);
  }

  const api = { build, setMood, speak, wave, eyesFollow, idle, MOODS };
  window.PP = window.PP || {};
  window.PP.Mascot = api;
  // Legacy global for parity with Clock Quest source
  window.Mascot = api;
})();
