/* Body Parts — Discover (figure with hotspots) / Practice / Quiz */
(function () {
  const PARTS = PP.BodyParts;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    return shuffle(exclude ? arr.filter(x => x !== exclude) : arr.slice()).slice(0, n);
  }

  // Cartoon figure with circle "hotspots" sized per data.
  function figureSvg(highlightId) {
    const hotspots = PARTS.map(p => {
      const isHi = p.id === highlightId;
      return `<circle class="ll-fig-hot ${isHi ? 'is-hi' : ''}" data-id="${p.id}"
        cx="${p.cx}" cy="${p.cy}" r="${p.r}" />`;
    }).join('');
    return `
    <svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" class="ll-figure" role="img" aria-label="Cartoon body">
      <!-- head -->
      <circle cx="100" cy="60" r="42" fill="#ffd9b3" stroke="#a0734a" stroke-width="2"/>
      <!-- hair -->
      <path d="M58 50 C 60 18, 140 18, 142 50 L 140 36 C 130 22, 70 22, 60 36 Z" fill="#664433"/>
      <!-- eyes -->
      <circle cx="88" cy="58" r="4" fill="#222"/>
      <circle cx="112" cy="58" r="4" fill="#222"/>
      <!-- nose -->
      <path d="M100 64 L96 74 L104 74 Z" fill="#d99974"/>
      <!-- mouth -->
      <path d="M88 82 Q100 92 112 82" stroke="#b04050" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- ears -->
      <ellipse cx="58" cy="60" rx="6" ry="10" fill="#ffd9b3" stroke="#a0734a" stroke-width="2"/>
      <ellipse cx="142" cy="60" rx="6" ry="10" fill="#ffd9b3" stroke="#a0734a" stroke-width="2"/>
      <!-- neck -->
      <rect x="92" y="100" width="16" height="18" fill="#ffd9b3" stroke="#a0734a" stroke-width="2"/>
      <!-- body / shirt -->
      <path d="M50 130 Q100 116 150 130 L156 220 Q100 230 44 220 Z" fill="#7fdca8" stroke="#3f8c66" stroke-width="2"/>
      <!-- arms -->
      <path d="M50 130 Q22 180 28 240" stroke="#ffd9b3" stroke-width="20" fill="none" stroke-linecap="round"/>
      <path d="M150 130 Q178 180 172 240" stroke="#ffd9b3" stroke-width="20" fill="none" stroke-linecap="round"/>
      <!-- hands -->
      <circle cx="28" cy="240" r="12" fill="#ffd9b3" stroke="#a0734a" stroke-width="2"/>
      <circle cx="172" cy="240" r="12" fill="#ffd9b3" stroke="#a0734a" stroke-width="2"/>
      <!-- pants -->
      <path d="M50 220 L60 350 L96 350 L100 240 L104 350 L140 350 L150 220 Z" fill="#5aa9ff" stroke="#2f6da8" stroke-width="2"/>
      <!-- knees -->
      <circle cx="82" cy="280" r="6" fill="#3f8ccc" opacity="0.0"/>
      <circle cx="118" cy="280" r="6" fill="#3f8ccc" opacity="0.0"/>
      <!-- feet -->
      <ellipse cx="78" cy="358" rx="16" ry="8" fill="#664433"/>
      <ellipse cx="122" cy="358" rx="16" ry="8" fill="#664433"/>
      <!-- belly highlight -->
      <ellipse cx="100" cy="190" rx="22" ry="14" fill="#5fc090" opacity="0.4"/>
      <!-- tummy hint -->
      <g>${hotspots}</g>
    </svg>`;
  }

  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a body part!';
    stage.appendChild(intro);

    const wrap = document.createElement('div');
    wrap.className = 'll-figure-wrap';
    wrap.innerHTML = figureSvg();
    stage.appendChild(wrap);

    wrap.querySelectorAll('.ll-fig-hot').forEach(hot => {
      hot.addEventListener('click', () => {
        const id = hot.dataset.id;
        const part = PARTS.find(p => p.id === id);
        if (!part) return;
        PP.Audio.pling();
        hot.classList.add('is-hi');
        setTimeout(() => hot.classList.remove('is-hi'), 900);
        PP.Mascot.setMood(ctx.mascot, 'excited');
        ctx.say(`${part.label}!`).finally(() => PP.Mascot.setMood(ctx.mascot, 'happy'));
        ctx.awardSticker(part.id, part.label);
      });
    });

    ctx.say('Tap a body part!');
  }

  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const total = isQuiz ? 8 : 5;
    let i = 0, starsTotal = 0;
    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Body Quiz');
        return;
      }
      const target = PARTS[Math.floor(Math.random() * PARTS.length)];
      const distractors = pickN(PARTS, ctx.choiceCount() - 1, target);
      const items = shuffle([target, ...distractors]);
      const correctIdx = items.indexOf(target);

      ctx.askChoice({
        prompt: `Find the ${target.label.toLowerCase()}!`,
        items: items.map(p => ({ label: p.label, part: p })),
        correctIdx,
        render: it => `<span class="ll-tile__emoji">${it.part.emoji}</span><span class="ll-tile__sub">${it.part.label}</span>`,
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
    catId: 'bodyparts', label: 'Body Parts', icon: '🧒',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
