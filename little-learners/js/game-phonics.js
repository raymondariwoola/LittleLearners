/* Phonics — Discover (hear word sounded out) / Practice (tap letters in order) / Quiz (jumbled) */
(function () {
  const WORDS = PP.Phonics;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }

  // ===== Discover: pick a word, hear it sounded out then said. =====
  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap a word to hear it!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-words-grid';
    ctx.ageItems(WORDS, 'phonics').forEach(w => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'll-tile ll-tile--word';
      t.innerHTML = `<span class="ll-tile__emoji">${w.emoji}</span><span class="ll-tile__big" style="font-size:34px">${w.word}</span>`;
      t.addEventListener('click', () => tapWord(ctx, w, t));
      grid.appendChild(t);
    });
    stage.appendChild(grid);
    ctx.say('Tap a word to sound it out!');
  }

  function tapWord(ctx, w, tile) {
    PP.Audio.pling();
    tile.classList.remove('pp-pop'); void tile.offsetWidth; tile.classList.add('pp-pop');
    PP.Mascot.setMood(ctx.mascot, 'thinking');
    PP.Voice.spell(w.word).finally(() => {
      PP.Mascot.setMood(ctx.mascot, 'excited');
      setTimeout(() => PP.Mascot.setMood(ctx.mascot, 'happy'), 1000);
    });
    ctx.awardSticker(w.word, w.word);
  }

  // ===== Practice / Quiz: tap-to-spell =====
  function practice(ctx) { runSpell(ctx, false); }
  function quiz(ctx)     { runSpell(ctx, true); }

  function runSpell(ctx, isQuiz) {
    const total = ctx.ageRounds(isQuiz ? 'quiz' : 'practice');
    const pool = ctx.ageItems(WORDS, 'phonics');
    let i = 0, starsTotal = 0;

    const next = () => {
      if (i >= total) {
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({ stars, onAgain: () => runSpell(ctx, isQuiz) });
        if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Phonics Quiz');
        return;
      }
      const target = pool[Math.floor(Math.random() * pool.length)];
      spellRound(ctx, target, isQuiz).then(stars => {
        starsTotal += stars;
        ctx.awardSticker(target.word, target.word);
        i += 1;
        setTimeout(next, 800);
      });
    };
    next();
  }

  function spellRound(ctx, word, isQuiz) {
    return new Promise(resolve => {
      ctx.stage.innerHTML = '';
      const prompt = document.createElement('div');
      prompt.className = 'll-prompt';
      prompt.textContent = `Spell ${word.word}! ${word.emoji}`;
      ctx.stage.appendChild(prompt);

      // Slot row showing the target with blanks.
      const slotRow = document.createElement('div');
      slotRow.className = 'll-spell-slots';
      const slots = word.word.split('').map(ch => {
        const s = document.createElement('span');
        s.className = 'll-spell-slot';
        s.dataset.want = ch;
        slotRow.appendChild(s);
        return s;
      });
      ctx.stage.appendChild(slotRow);

      // Letter bank: target letters + a couple of distractors, shuffled.
      const bankLetters = word.word.split('');
      const extras = ['A','E','I','O','U','S','T','N','R','L'].filter(c => !bankLetters.includes(c));
      const distractCount = isQuiz ? 3 : 2;
      for (let k = 0; k < distractCount; k++) bankLetters.push(extras[k % extras.length]);
      const bank = document.createElement('div');
      bank.className = 'll-spell-bank';
      ctx.stage.appendChild(bank);

      const tiles = shuffle(bankLetters).map(ch => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pp-btn pp-btn--mint ll-spell-tile';
        b.textContent = ch;
        b.dataset.ch = ch;
        bank.appendChild(b);
        return b;
      });

      let idx = 0;
      let attempts = 0;
      tiles.forEach(b => {
        b.addEventListener('click', () => {
          if (b.disabled) return;
          const want = slots[idx].dataset.want;
          if (b.dataset.ch === want) {
            b.disabled = true;
            b.classList.add('is-used');
            slots[idx].textContent = want;
            slots[idx].classList.add('is-filled');
            PP.Audio.ding();
            PP.Voice.speak(want, { force: true });
            idx += 1;
            if (idx >= slots.length) {
              setTimeout(() => {
                PP.Audio.fanfare();
                PP.Confetti.burst(window.innerWidth / 2, window.innerHeight / 2, 60);
                PP.Voice.speak(`${word.word}! ${word.word}!`);
                const stars = Math.max(1, 3 - attempts);
                setTimeout(() => resolve(stars), 1100);
              }, 250);
            }
          } else {
            attempts += 1;
            b.classList.remove('is-wrong'); void b.offsetWidth; b.classList.add('is-wrong');
            PP.Audio.wrong();
            const noFail = ctx.ageMode === 'toddler' || ctx.ageMode === 'preschool';
            if (attempts === 1) {
              PP.Voice.speak(PP.Phrases.tryAgain());
              // Hint: glow the correct tile
              const hint = tiles.find(t => !t.disabled && t.dataset.ch === want);
              if (hint) {
                hint.classList.add('is-hint');
                setTimeout(() => hint.classList.remove('is-hint'), 1400);
              }
            } else if (attempts >= 3 || (noFail && attempts >= 2)) {
              // Reveal: auto-place correct
              const hint = tiles.find(t => !t.disabled && t.dataset.ch === want);
              if (hint) hint.click();
            }
          }
        });
      });

      // Sound the word once.
      PP.Voice.spell(word.word);
    });
  }

  PP.Game.boot({
    catId: 'phonics', label: 'Phonics', icon: '🔡',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
