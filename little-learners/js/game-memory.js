/* Memory Meadow — flip & match game.
 *
 * Three modes piggyback on the standard mode tabs:
 *   - Discover : 4 cards (2 pairs), animal emojis, very forgiving
 *   - Practice : 6 cards (3 pairs), shapes
 *   - Quiz     : 8 cards (4 pairs), food
 * Clearing a board awards the matching meadow sticker. Finishing all
 * three earns the bonus "Full Bloom" badge; clearing quiz with three
 * stars unlocks "Quick Flipper".
 *
 * Adaptive integration: ctx.adaptive.roundBoost bumps the pair count by
 * one extra pair in kindergarten/reader when the child is consistently
 * confident, capped at 6 pairs (12 cards) which also awards the
 * Meadow Master sticker.
 */
(function () {
  const learners = PP.Progress.app('learners');

  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }

  // Theme builders return arrays of { id, label, face } where `face` is the
  // visible content on the card front. We fall back to a hard-coded list if
  // a data module isn't loaded yet.
  function themes() {
    const animalPool = (PP.Animals && PP.Animals.length)
      ? PP.Animals.map(a => ({ id: 'a-' + a.id, label: a.label, face: a.emoji }))
      : ['🐶', '🐱', '🐰', '🐼', '🦊', '🐸', '🐮', '🐧'].map((e, i) => ({ id: 'a-' + i, label: e, face: e }));
    const foodPool = (PP.Food && PP.Food.length)
      ? PP.Food.map(f => ({ id: 'f-' + f.id, label: f.label, face: f.emoji }))
      : ['🍎', '🍌', '🍇', '🍓', '🥕', '🥦', '🍞', '🧀'].map((e, i) => ({ id: 'f-' + i, label: e, face: e }));
    const shapePool = (PP.Shapes && PP.Shapes.length)
      ? PP.Shapes.map(s => ({ id: 's-' + s.id, label: s.label, face: shapeSvg(s) }))
      : ['🔴', '🟦', '🔺', '⭐', '🟢', '🟡'].map((e, i) => ({ id: 's-' + i, label: e, face: e }));
    return { animals: animalPool, food: foodPool, shapes: shapePool };
  }

  function shapeSvg(s) {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:60%;height:60%">
      <g fill="currentColor" stroke="rgba(0,0,0,0.15)" stroke-width="2">${s.svg}</g>
    </svg>`;
  }

  function agePairs(ctx, base) {
    // Toddlers start with fewer pairs so the board isn't overwhelming.
    const offsets = { toddler: -1, preschool: 0, kindergarten: 0, reader: 1 };
    return Math.max(2, base + (offsets[ctx.ageMode] || 0));
  }
  function discover(ctx) { startBoard(ctx, { pairs: agePairs(ctx, 2), theme: 'animals', stickerId: 'meadow-4',  label: 'Pair up the animals!' }); }
  function practice(ctx) { startBoard(ctx, { pairs: agePairs(ctx, 3), theme: 'shapes',  stickerId: 'meadow-6',  label: 'Match the shapes!'    }); }
  function quiz(ctx)     { startBoard(ctx, { pairs: agePairs(ctx, 4), theme: 'food',    stickerId: 'meadow-8',  label: 'Find the food pairs!' }); }

  function startBoard(ctx, cfg) {
    // Adaptive bump: one extra pair when the child is on a roll.
    const boost = (ctx.adaptive && ctx.adaptive.roundBoost > 0) ? 1 : 0;
    const pairs = Math.min(6, cfg.pairs + boost);
    const pool = themes()[cfg.theme] || themes().animals;
    const picks = shuffle(pool).slice(0, pairs);
    const deck = shuffle(picks.concat(picks).map((card, i) => ({ ...card, slot: i })));

    const stage = ctx.stage;
    stage.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = cfg.label;
    stage.appendChild(intro);

    const board = document.createElement('div');
    board.className = 'll-memory';
    // Columns scale with pair count so the layout stays roomy on mobile.
    const cols = (deck.length <= 4) ? 2 : (deck.length <= 8 ? 4 : 4);
    board.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    stage.appendChild(board);

    const tiles = deck.map((card, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'll-memory__card';
      btn.setAttribute('aria-label', 'Card ' + (i + 1));
      btn.innerHTML = `
        <span class="ll-memory__face ll-memory__back" aria-hidden="true">🌼</span>
        <span class="ll-memory__face ll-memory__front" aria-hidden="true">${card.face}</span>`;
      btn.addEventListener('click', () => flip(btn, card));
      board.appendChild(btn);
      return btn;
    });

    let first = null;        // { btn, card }
    let lock = false;
    let matches = 0;
    let peeks = 0;            // distinct flips
    const startedAt = Date.now();

    function flip(btn, card) {
      if (lock) return;
      if (btn.classList.contains('is-flipped') || btn.classList.contains('is-matched')) return;
      btn.classList.add('is-flipped');
      PP.Audio.pling();
      peeks += 1;
      if (!first) { first = { btn, card }; return; }
      lock = true;
      if (first.card.id === card.id && first.btn !== btn) {
        // Match
        setTimeout(() => {
          first.btn.classList.add('is-matched');
          btn.classList.add('is-matched');
          ctx.cheer();
          first = null; lock = false;
          matches += 1;
          if (matches === pairs) finish();
        }, 320);
      } else {
        // No match — flip back after a brief peek so the child can study.
        setTimeout(() => {
          first.btn.classList.remove('is-flipped');
          btn.classList.remove('is-flipped');
          first = null; lock = false;
        }, 850);
      }
    }

    function finish() {
      // Stars: 3 if peeks <= pairs*2 + 2, 2 if <= pairs*3, else 1.
      const perfect = pairs * 2;
      let stars = 1;
      if (peeks <= perfect + 2) stars = 3;
      else if (peeks <= pairs * 3) stars = 2;

      // Record into the adaptive engine so Memory contributes to mastery.
      try {
        if (PP.Adaptive && PP.Adaptive.recordResult) {
          PP.Adaptive.recordResult(ctx.catId, { stars, attempts: Math.max(0, peeks - perfect), revealed: false });
        }
      } catch (_) { /* non-critical */ }

      ctx.awardSticker(cfg.stickerId, 'Meadow ' + (pairs * 2) + ' cards');
      // Bonus stickers based on play quality and breadth.
      if (deck.length >= 12) ctx.awardSticker('meadow-12', 'Meadow Master');
      if (stars === 3 && pairs >= 4) ctx.awardSticker('meadow-flip', 'Quick Flipper');
      const cleared = learners.get('mem.cleared', []) || [];
      if (!cleared.includes(cfg.theme)) {
        cleared.push(cfg.theme);
        learners.set('mem.cleared', cleared);
      }
      if (cleared.length >= 3) ctx.awardSticker('meadow-full', 'Full Bloom');

      setTimeout(() => {
        ctx.showResult({
          stars,
          message: stars === 3 ? 'Brilliant memory!' : (stars === 2 ? 'Great job!' : 'Nice try — let\'s play again!'),
          onAgain: () => startBoard(ctx, cfg),
        });
      }, 700);
    }
  }

  PP.Game.boot({
    catId: 'memory', label: 'Memory Meadow', icon: '🧠',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
