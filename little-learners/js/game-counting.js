/* Counting — Discover (tap items one by one) / Practice (count then pick number) / Quiz */
(function () {
  const NUMS = PP.Numbers;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    return shuffle(exclude ? arr.filter(x => x !== exclude) : arr.slice()).slice(0, n);
  }
  function poolFor(ctx) {
    return (ctx.ageMode === 'toddler' || ctx.ageMode === 'preschool')
      ? NUMS.filter(n => n.n <= 10)
      : NUMS;
  }

  // ===== Discover: a tray of N items. Tap each in order to count out loud. =====
  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Pick a group, then tap each one to count!';
    stage.appendChild(intro);

    const groupRow = document.createElement('div');
    groupRow.className = 'll-numbers-grid';
    poolFor(ctx).forEach(num => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-tile ll-tile--num';
      b.innerHTML = `<span class="ll-tile__big">${num.n}</span><span class="ll-tile__sub">${num.emoji.repeat(Math.min(num.n, 3))}…</span>`;
      b.addEventListener('click', () => startCount(ctx, num));
      groupRow.appendChild(b);
    });
    stage.appendChild(groupRow);
    ctx.say('Pick a number to count!');
  }

  function startCount(ctx, num) {
    PP.Audio.pling();
    // Clear and present the tray.
    ctx.stage.innerHTML = '';
    const prompt = document.createElement('div');
    prompt.className = 'll-prompt';
    prompt.textContent = `Tap each ${num.emoji} to count!`;
    ctx.stage.appendChild(prompt);

    const tray = document.createElement('div');
    tray.className = 'll-count-tray';
    ctx.stage.appendChild(tray);

    const bubbles = [];
    for (let k = 0; k < num.n; k++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-count-bubble';
      b.textContent = num.emoji;
      tray.appendChild(b);
      bubbles.push(b);
    }

    let counted = 0;
    bubbles.forEach((b) => {
      b.addEventListener('click', () => {
        if (b.classList.contains('is-counted')) return;
        counted += 1;
        b.classList.add('is-counted');
        b.innerHTML = `${num.emoji}<span class="ll-count-num">${counted}</span>`;
        PP.Audio.ding();
        PP.Voice.speak(String(counted), { force: true });
        if (counted === num.n) {
          setTimeout(() => {
            PP.Confetti.stars(window.innerWidth / 2, window.innerHeight / 2, 20);
            PP.Audio.fanfare();
            PP.Voice.speak(`${num.n} ${num.emoji}! ${num.word}!`).finally(() => {
              PP.Mascot.setMood(ctx.mascot, 'happy');
            });
            ctx.awardSticker(String(num.n), `Counted to ${num.n}`);
          }, 350);
        }
      });
    });

    // Back-to-grid button
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'pp-btn pp-btn--secondary';
    back.style.marginTop = '18px';
    back.textContent = '🔢 Pick another number';
    back.addEventListener('click', () => discover(ctx));
    ctx.stage.appendChild(back);
  }

  // ===== Practice / Quiz: "How many?" =====
  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const pool = poolFor(ctx);
    const total = isQuiz ? 8 : 5;
    let i = 0, starsTotal = 0;
    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Counting Quiz');
        return;
      }
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = pickN(pool, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      ctx.askChoice({
        prompt: `Count them! ${target.emoji.repeat(target.n)}`,
        items: items.map(n => ({ label: String(n.n), num: n })),
        correctIdx,
        render: it => `<span class="ll-tile__big">${it.num.n}</span>`,
      }).then(({ stars }) => {
        starsTotal += stars;
        ctx.awardSticker(String(target.n), `Counted ${target.n}`);
        i += 1;
        setTimeout(next, 700);
      });
    };
    next();
  }

  PP.Game.boot({
    catId: 'counting', label: 'Counting', icon: '🧮',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
