/* Colors — Discover / Practice / Quiz */
(function () {
  const COLORS = PP.Colors;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    const pool = exclude ? arr.filter(x => x !== exclude) : arr.slice();
    return shuffle(pool).slice(0, n);
  }

  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a colour!';
    stage.appendChild(intro);

    const wheel = document.createElement('div');
    wheel.className = 'll-color-wheel';
    COLORS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-color-blob';
      b.style.background = c.hex;
      b.setAttribute('aria-label', c.label);
      b.addEventListener('click', () => tapColor(ctx, c, b));
      wheel.appendChild(b);
    });
    stage.appendChild(wheel);
    ctx.say('Tap a colour!');
  }

  function tapColor(ctx, c, btn) {
    PP.Audio.pling();
    btn.classList.remove('pp-pop'); void btn.offsetWidth; btn.classList.add('pp-pop');
    const closeFlash = flashTint(c);
    PP.Mascot.setMood(ctx.mascot, 'excited');
    ctx.say(`${c.label}! Like a ${c.example}. ${c.emoji}`).finally(() => {
      PP.Mascot.setMood(ctx.mascot, 'happy');
      closeFlash();
    });
    ctx.awardSticker(c.id, c.label);
  }

  // Returns the relative luminance (0–1) of a hex colour for contrast checks.
  function luminance(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  // Fills the whole screen with the chosen colour plus a big label + emoji
  // so toddlers clearly see and learn the colour. Stays up until the voice
  // line finishes (closed by the caller) with a min visible time of ~1.4s.
  function flashTint(c) {
    const t = document.createElement('div');
    t.className = 'll-tint-flash';
    if (luminance(c.hex) > 0.65) t.classList.add('ll-tint-flash--light');
    t.style.background = c.hex;
    t.innerHTML = `
      <span class="ll-tint-flash__emoji" aria-hidden="true">${c.emoji}</span>
      <span class="ll-tint-flash__label">${c.label}</span>`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    const shownAt = Date.now();
    let closed = false;
    return function close() {
      if (closed) return; closed = true;
      const elapsed = Date.now() - shownAt;
      const wait = Math.max(0, 1400 - elapsed);
      setTimeout(() => {
        t.classList.remove('is-in');
        setTimeout(() => t.remove(), 360);
      }, wait);
    };
  }

  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const total = isQuiz ? 8 : 5;
    let i = 0; let starsTotal = 0;

    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Colour Quiz');
        return;
      }
      const target = COLORS[Math.floor(Math.random() * COLORS.length)];
      const distractors = pickN(COLORS, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      ctx.askChoice({
        prompt: `Find the colour ${target.label}!`,
        items: items.map(c => ({ label: c.label, color: c })),
        correctIdx,
        render: (it) => {
          const sw = document.createElement('span');
          sw.className = 'll-swatch';
          sw.style.background = it.color.hex;
          sw.setAttribute('aria-label', it.color.label);
          return sw;
        },
      }).then(({ stars }) => {
        starsTotal += stars;
        ctx.awardSticker(target.id, target.label);
        i += 1;
        setTimeout(next, 700);
      });
    };
    next();
  }

  PP.Game.boot({
    catId: 'colors', label: 'Colors', icon: '🎨',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
