/* Animals — Discover / Practice / Quiz
 * Discover: tap → animal pops, plays MP3 if present, else speaks onomatopoeia.
 * Practice: "Find the cow!"
 * Quiz: "Who says Moo?"
 */
(function () {
  const ANIMALS = PP.Animals;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    return shuffle(exclude ? arr.filter(x => x !== exclude) : arr.slice()).slice(0, n);
  }

  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap an animal!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-animals-grid';
    ctx.ageItems(ANIMALS, 'animals').forEach(a => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'll-tile ll-tile--animal';
      t.innerHTML = `<span class="ll-tile__emoji">${a.emoji}</span><span class="ll-tile__sub">${a.label}</span>`;
      t.addEventListener('click', () => tapAnimal(ctx, a, t));
      grid.appendChild(t);
    });
    stage.appendChild(grid);
    ctx.say('Tap an animal!');
  }

  function tapAnimal(ctx, a, tile) {
    PP.Audio.pling();
    tile.classList.remove('pp-pop'); void tile.offsetWidth; tile.classList.add('pp-pop');
    PP.Mascot.setMood(ctx.mascot, 'excited');
    ctx.awardSticker(a.id, a.label);

    // Try MP3 first; if it fails just speak the sound.
    PP.Audio.playSample(a.soundUrl).then(ok => {
      if (!ok) PP.Audio.boing();
      ctx.say(`${a.label}! ${a.sound}`).finally(() => PP.Mascot.setMood(ctx.mascot, 'happy'));
    });
  }

  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const pool = ctx.ageItems(ANIMALS, 'animals');
    const total = ctx.ageRounds(isQuiz ? 'quiz' : 'practice');
    let i = 0, starsTotal = 0;
    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Animal Quiz');
        return;
      }
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = pickN(pool, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);
      const usePrompt = isQuiz && Math.random() < 0.5
        ? `Who says ${target.sound}`
        : `Find the ${target.label.toLowerCase()}!`;

      ctx.askChoice({
        prompt: usePrompt,
        items: items.map(a => ({ label: a.label, animal: a })),
        correctIdx,
        render: it => `<span class="ll-tile__emoji">${it.animal.emoji}</span>`,
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
    catId: 'animals', label: 'Animals', icon: '🐾',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
