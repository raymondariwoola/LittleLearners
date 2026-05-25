/* Numbers — Discover / Practice / Quiz */
(function () {
  const ALL = PP.Numbers;
  function poolFor(ctx) { return ctx.ageItems(ALL, 'numbers'); }
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    const pool = exclude ? arr.filter(x => x !== exclude) : arr.slice();
    return shuffle(pool).slice(0, n);
  }

  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a number to count!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-numbers-grid';
    poolFor(ctx).forEach(num => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'll-tile ll-tile--num';
      tile.innerHTML = `<span class="ll-tile__big">${num.n}</span>`;
      tile.addEventListener('click', () => tapNumber(ctx, num, tile));
      grid.appendChild(tile);
    });
    stage.appendChild(grid);
    ctx.say('Tap a number to count!');
  }

  function tapNumber(ctx, num, tile) {
    PP.Audio.pling();
    tile.classList.remove('pp-pop'); void tile.offsetWidth; tile.classList.add('pp-pop');
    PP.Mascot.setMood(ctx.mascot, 'thinking');

    // Animate that many objects bouncing into a tray with "boing" each.
    const tray = document.createElement('div');
    tray.className = 'll-num-tray';
    document.body.appendChild(tray);
    requestAnimationFrame(() => tray.classList.add('is-in'));

    const max = Math.min(num.n, 20);
    let i = 0;
    const tick = () => {
      if (i >= max) {
        // Count out loud
        PP.Voice.count(num.n).then(() => {
          setTimeout(() => {
            tray.classList.remove('is-in');
            setTimeout(() => tray.remove(), 260);
            PP.Mascot.setMood(ctx.mascot, 'happy');
          }, 600);
        });
        return;
      }
      const it = document.createElement('span');
      it.className = 'll-num-bubble';
      it.textContent = num.emoji;
      tray.appendChild(it);
      PP.Audio.boing();
      i += 1;
      setTimeout(tick, 220);
    };
    tick();
    ctx.awardSticker(String(num.n), `Number ${num.n}`);
  }

  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const pool = poolFor(ctx);
    const total = ctx.ageRounds(isQuiz ? 'quiz' : 'practice');
    let i = 0; let starsTotal = 0;
    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Number Quiz');
        return;
      }
      // Alternate between "find the number" and "how many?"
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = pickN(pool, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      const useHowMany = isQuiz && Math.random() < 0.5;
      const round = useHowMany
        ? {
            prompt: `How many ${target.emoji}?`,
            items: items.map(n => ({ label: String(n.n), num: n })),
            correctIdx,
            render: (it) => `<span class="ll-tile__big">${it.num.n}</span>`,
          }
        : {
            prompt: `Find the number ${target.n}!`,
            items: items.map(n => ({ label: String(n.n), num: n })),
            correctIdx,
            render: (it) => `<span class="ll-tile__big">${it.num.n}</span>`,
          };

      if (useHowMany) {
        // Render the visual group above choices: stash extra prompt content.
        round.prompt = 'How many?';
        // We'll inject the visual after askChoice mounts; simpler: include in prompt text via emoji.
        round.prompt = `How many ${target.emoji.repeat(target.n)}?`;
      }

      ctx.askChoice(round).then(({ stars }) => {
        starsTotal += stars;
        ctx.awardSticker(String(target.n), `Number ${target.n}`);
        i += 1;
        setTimeout(next, 700);
      });
    };
    next();
  }

  PP.Game.boot({
    catId: 'numbers', label: 'Numbers', icon: '🔢',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
