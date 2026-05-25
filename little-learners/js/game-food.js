/* Food — Discover / Practice / Quiz */
(function () {
  const FOODS = PP.Food;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    return shuffle(exclude ? arr.filter(x => x !== exclude) : arr.slice()).slice(0, n);
  }

  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a food!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-food-grid';
    ctx.ageItems(FOODS, 'food').forEach(f => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'll-tile ll-tile--food';
      t.innerHTML = `<span class="ll-tile__emoji">${f.emoji}</span><span class="ll-tile__sub">${f.label}</span>`;
      t.addEventListener('click', () => tap(ctx, f, t));
      grid.appendChild(t);
    });
    stage.appendChild(grid);
    ctx.say('Tap a food!');
  }

  function tap(ctx, f, tile) {
    PP.Audio.pling();
    tile.classList.remove('pp-pop'); void tile.offsetWidth; tile.classList.add('pp-pop');
    PP.Mascot.setMood(ctx.mascot, 'excited');
    ctx.say(`${f.label}! Yum!`).finally(() => PP.Mascot.setMood(ctx.mascot, 'happy'));
    ctx.awardSticker(f.id, f.label);
  }

  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const pool = ctx.ageItems(FOODS, 'food');
    const total = ctx.ageRounds(isQuiz ? 'quiz' : 'practice');
    let i = 0, starsTotal = 0;
    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Food Quiz');
        return;
      }
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = pickN(pool, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      ctx.askChoice({
        prompt: `Find the ${target.label.toLowerCase()}!`,
        items: items.map(f => ({ label: f.label, food: f })),
        correctIdx,
        render: it => `<span class="ll-tile__emoji">${it.food.emoji}</span>`,
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
    catId: 'food', label: 'Food', icon: '🍎',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
