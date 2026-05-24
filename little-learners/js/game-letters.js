/* Letters — Discover / Practice / Quiz */
(function () {
  const LETTERS = PP.Letters;

  function shuffle(arr) { return arr.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    const pool = exclude ? arr.filter(x => x !== exclude) : arr.slice();
    return shuffle(pool).slice(0, n);
  }

  // ===== Discover: full A-Z grid =====
  function discover(ctx) {
    const stage = ctx.stage;
    stage.classList.add('ll-stage--grid');

    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a letter to hear it!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-letters-grid';
    LETTERS.forEach(l => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'll-tile ll-tile--letter';
      tile.dataset.letter = l.letter;
      tile.innerHTML = `<span class="ll-tile__big">${l.letter}</span><span class="ll-tile__sub">${l.letter.toLowerCase()}</span>`;
      tile.addEventListener('click', () => tapLetter(ctx, l, tile));
      grid.appendChild(tile);
    });
    stage.appendChild(grid);

    ctx.say('Tap a letter to hear it!');
  }

  function tapLetter(ctx, l, tile) {
    PP.Audio.pling();
    tile.classList.remove('pp-pop'); void tile.offsetWidth; tile.classList.add('pp-pop');
    PP.Mascot.setMood(ctx.mascot, 'excited');
    showLetterCard(ctx, l).finally(() => PP.Mascot.setMood(ctx.mascot, 'happy'));
    // Mark this letter as explored — counts toward sticker
    ctx.awardSticker(l.letter, l.letter);
  }

  function showLetterCard(ctx, l) {
    return new Promise(resolve => {
      const card = document.createElement('div');
      card.className = 'll-letter-card';
      card.innerHTML = `
        <span class="ll-letter-card__big">${l.letter}</span>
        <span class="ll-letter-card__emoji">${l.emoji}</span>
        <span class="ll-letter-card__word">${l.word}</span>`;
      document.body.appendChild(card);
      requestAnimationFrame(() => card.classList.add('is-in'));
      // Speak: letter name → sound → example word
      const speech = ctx.say(`${l.letter}! ${l.sound}. ${l.word}!`);
      const close = () => {
        card.classList.remove('is-in');
        setTimeout(() => { card.remove(); resolve(); }, 280);
      };
      speech.finally(() => setTimeout(close, 600));
      card.addEventListener('click', close);
    });
  }

  // ===== Practice: "Find the letter X!" =====
  function practice(ctx) {
    runRounds(ctx, false);
  }
  function quiz(ctx) {
    runRounds(ctx, true);
  }

  function runRounds(ctx, isQuiz) {
    const total = isQuiz ? 8 : 5;
    let i = 0; let starsTotal = 0;
    const used = new Set();

    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({
          stars,
          message: isQuiz ? 'Great quiz!' : 'Nice playing!',
          onAgain: () => runRounds(ctx, isQuiz),
        });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Letter Quiz');
        return;
      }
      const target = pickUnused(LETTERS, used);
      used.add(target.letter);
      const distractors = pickN(LETTERS, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      ctx.askChoice({
        prompt: `Find the letter ${target.letter}!`,
        items: items.map(l => ({ label: `Letter ${l.letter}`, letter: l })),
        correctIdx,
        render: (item) => `<span class="ll-tile__big">${item.letter.letter}</span>`,
      }).then(({ stars }) => {
        starsTotal += stars;
        ctx.awardSticker(target.letter, target.letter);
        i += 1;
        setTimeout(next, 700);
      });
    };

    function pickUnused(pool, usedSet) {
      const remaining = pool.filter(x => !usedSet.has(x.letter));
      const choosable = remaining.length ? remaining : pool;
      return choosable[Math.floor(Math.random() * choosable.length)];
    }

    next();
  }

  PP.Game.boot({
    catId: 'letters', label: 'Letters', icon: '🔤',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
