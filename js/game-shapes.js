/* Shapes — Discover / Practice / Quiz */
(function () {
  const SHAPES = PP.Shapes;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    const pool = exclude ? arr.filter(x => x !== exclude) : arr.slice();
    return shuffle(pool).slice(0, n);
  }
  function shapeSvg(shape, fill) {
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="${fill || 'currentColor'}" stroke="rgba(0,0,0,0.15)" stroke-width="2">${shape.svg}</g>
    </svg>`;
  }
  const SHAPE_FILLS = ['#ff8c66', '#ffd966', '#7fdca8', '#c9a3ff', '#ff9bc7', '#9bd4ff'];

  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a shape!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-shapes-grid';
    ctx.ageItems(SHAPES, 'shapes').forEach((s, i) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'll-tile ll-tile--shape';
      t.innerHTML = shapeSvg(s, SHAPE_FILLS[i % SHAPE_FILLS.length]);
      t.addEventListener('click', () => tapShape(ctx, s, t));
      grid.appendChild(t);
    });
    stage.appendChild(grid);
    ctx.say('Tap a shape!');
  }

  function tapShape(ctx, s, tile) {
    PP.Audio.pling();
    tile.classList.add('is-spinning');
    setTimeout(() => tile.classList.remove('is-spinning'), 900);
    PP.Mascot.setMood(ctx.mascot, 'excited');
    ctx.say(`${s.label}! ${s.fact}`).finally(() => PP.Mascot.setMood(ctx.mascot, 'happy'));
    ctx.awardSticker(s.id, s.label);
  }

  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const pool = ctx.ageItems(SHAPES, 'shapes');
    const total = ctx.ageRounds(isQuiz ? 'quiz' : 'practice');
    let i = 0; let starsTotal = 0;
    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Shape Quiz');
        return;
      }
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = pickN(pool, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      ctx.askChoice({
        prompt: `Find the ${target.label.toLowerCase()}!`,
        items: items.map(s => ({ label: s.label, shape: s })),
        correctIdx,
        render: (it, idx) => shapeSvg(it.shape, SHAPE_FILLS[idx % SHAPE_FILLS.length]),
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
    catId: 'shapes', label: 'Shapes', icon: '🔷',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
