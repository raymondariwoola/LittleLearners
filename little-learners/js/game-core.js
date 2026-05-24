/* PP.Game — shared category-page engine.
 *
 * Every category page boots with:
 *   PP.Game.boot({
 *     catId: 'letters', label: 'Letters', icon: '🔤',
 *     modes: {
 *       discover: (ctx) => { ... },
 *       practice: (ctx) => { ... },
 *       quiz:     (ctx) => { ... },
 *     },
 *     defaultMode: 'discover',
 *   });
 *
 * ctx provides:
 *   ctx.stage           — the activity container element
 *   ctx.say(text)       — speak with mascot lip-sync
 *   ctx.cheer()         — random celebratory phrase
 *   ctx.askChoice(opts) — standard no-fail multiple choice (see below)
 *   ctx.awardSticker(id, label?)
 *   ctx.choiceCount()   — number of choices appropriate for current age mode
 *   ctx.mascot          — the corner mascot element
 *   ctx.ageMode         — 'toddler' | 'preschool' | 'kindergarten' | 'reader'
 *
 * askChoice({ prompt, items, correctIdx, render, choicesContainer? })
 *   items:        array of { label, hidden, ... }   render() chooses what to draw
 *   render(item): returns HTML or Element for one choice button
 *   correctIdx:   which item is the right answer
 *   returns Promise<{ stars, attempts, revealed }>
 *
 * Toddler/Preschool: always returns 3 stars, no harsh feedback.
 * Kindergarten+:     soft "bwonk", stars based on attempts (3/2/1).
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const CHOICE_COUNT_BY_AGE = { toddler: 2, preschool: 3, kindergarten: 4, reader: 4 };

  function boot(opts) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init(opts));
    } else {
      init(opts);
    }
  }

  function init(opts) {
    PP.Theme.apply();
    const profile = PP.Progress.profile();
    const ageMode = profile.ageMode || 'toddler';
    document.documentElement.setAttribute('data-age-mode', ageMode);
    document.documentElement.setAttribute('data-category', opts.catId);

    // ===== Chrome =====
    const root = $('#cat');
    root.innerHTML = `
      <div class="ll-cat__bar">
        <button id="catBack" class="ll-cat__back" type="button" aria-label="Back to home">←</button>
        <div class="ll-cat__title">
          <span class="ll-cat__title-icon" aria-hidden="true">${opts.icon}</span>
          <span>${opts.label}</span>
        </div>
        <div class="ll-cat__modes" role="tablist" aria-label="Activity mode">
          <button class="ll-cat__mode" data-mode="discover" type="button" role="tab">Discover</button>
          <button class="ll-cat__mode" data-mode="practice" type="button" role="tab">Practice</button>
          <button class="ll-cat__mode" data-mode="quiz"     type="button" role="tab">Quiz</button>
        </div>
      </div>
      <div id="stage" class="ll-stage" aria-live="polite"></div>`;

    // Corner mascot
    const mascot = PP.Mascot.build();
    mascot.classList.add('ll-cat__mascot');
    PP.Mascot.setMood(mascot, 'happy');
    PP.Mascot.eyesFollow(mascot, true);
    PP.Mascot.idle(mascot, true);
    document.body.appendChild(mascot);

    // Mute toggles (top-right)
    const toolbar = document.createElement('div');
    toolbar.className = 'll-cat__tools';
    toolbar.innerHTML = `
      <button id="voiceMute" class="pp-btn pp-btn--icon pp-btn--secondary" type="button" aria-label="Mute voice">🔊</button>
      <button id="sfxMute"   class="pp-btn pp-btn--icon pp-btn--secondary" type="button" aria-label="Mute sounds">🔔</button>`;
    document.body.appendChild(toolbar);
    $('#voiceMute', toolbar).textContent = PP.Voice.isMuted() ? '🔇' : '🔊';
    $('#sfxMute', toolbar).textContent = PP.Audio.isMuted() ? '🔕' : '🔔';
    $('#voiceMute', toolbar).addEventListener('click', e => {
      e.currentTarget.textContent = PP.Voice.toggleMute() ? '🔇' : '🔊';
    });
    $('#sfxMute', toolbar).addEventListener('click', e => {
      e.currentTarget.textContent = PP.Audio.toggleMute() ? '🔕' : '🔔';
    });

    // Back to hub
    $('#catBack').addEventListener('click', () => {
      PP.Voice.cancel();
      window.location.href = '../index.html';
    });

    // ===== ctx shared with each mode =====
    const ctx = {
      get stage() { return $('#stage'); },
      mascot,
      ageMode,
      catId: opts.catId,
      catLabel: opts.label,
      profile,
      choiceCount: () => CHOICE_COUNT_BY_AGE[ageMode] || 3,
      say,
      cheer,
      askChoice,
      celebrate,
      awardSticker,
      noFail: ageMode === 'toddler' || ageMode === 'preschool',
    };

    function say(text, opts = {}) {
      PP.Mascot.speak(mascot, true);
      return PP.Voice.speak(text, opts).then(() => PP.Mascot.speak(mascot, false));
    }
    function cheer() {
      PP.Mascot.setMood(mascot, 'celebrating');
      PP.Audio.correct();
      const p = PP.Voice.cheer(profile.name);
      setTimeout(() => PP.Mascot.setMood(mascot, 'happy'), 1400);
      return p;
    }
    function celebrate(opts = {}) {
      PP.Mascot.setMood(mascot, 'celebrating');
      PP.Audio.fanfare();
      PP.Confetti.burst(window.innerWidth / 2, window.innerHeight / 2, 120);
      setTimeout(() => PP.Mascot.setMood(mascot, 'happy'), 1600);
    }
    function awardSticker(id, label) {
      const learners = PP.Progress.app('learners');
      const path = `stickers.${opts.catId}`;
      const list = learners.get(path, []) || [];
      if (!list.includes(id)) {
        learners.addToSet(path, id);
        PP.Audio.unlock();
        PP.UI.toast(`⭐ Sticker unlocked: ${label || id}`, { kind: 'good', duration: 2200 });
      }
    }

    // ===== askChoice — the no-fail multiple-choice loop =====
    function askChoice({ prompt, items, correctIdx, render, repeatable = true }) {
      return new Promise(resolve => {
        const wrap = $('#stage');
        wrap.replaceChildren();

        const promptEl = document.createElement('div');
        promptEl.className = 'll-prompt';
        promptEl.textContent = prompt;
        wrap.appendChild(promptEl);

        const choices = document.createElement('div');
        choices.className = 'll-choices';
        wrap.appendChild(choices);

        const correctItem = items[correctIdx];
        let attempts = 0;
        let revealed = false;
        let replayTimer = null;
        let buttons = [];

        items.forEach((item, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'll-choice';
          btn.dataset.idx = String(idx);
          const r = render(item, idx);
          if (typeof r === 'string') btn.innerHTML = r; else btn.appendChild(r);

          // Hold-to-hear
          let holdTimer = null;
          btn.addEventListener('pointerdown', () => {
            holdTimer = setTimeout(() => {
              btn.classList.add('holding');
              PP.Voice.speak(item.label, { interrupt: true });
            }, 600);
          });
          const cancelHold = () => {
            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
            btn.classList.remove('holding');
          };
          btn.addEventListener('pointerup', cancelHold);
          btn.addEventListener('pointerleave', cancelHold);
          btn.addEventListener('pointercancel', cancelHold);

          btn.addEventListener('click', () => onTap(idx, btn));
          choices.appendChild(btn);
          buttons.push(btn);
        });

        // Speak prompt + auto-replay after 8s if no answer
        say(prompt);
        scheduleReplay();

        function scheduleReplay() {
          clearTimeout(replayTimer);
          replayTimer = setTimeout(() => {
            if (!revealed) {
              say(prompt);
              PP.Mascot.setMood(mascot, 'thinking');
              // After a hint nudge, gently sparkle the correct one in toddler mode
              if (ctx.noFail && attempts >= 1) hintCorrect();
            }
          }, 8000);
        }

        function hintCorrect() {
          const correctBtn = buttons[correctIdx];
          if (!correctBtn) return;
          correctBtn.classList.add('is-hint');
          PP.Audio.sparkle();
        }

        function onTap(idx, btn) {
          clearTimeout(replayTimer);
          if (revealed) return;

          if (idx === correctIdx) {
            buttons.forEach(b => b.disabled = true);
            btn.classList.add('is-correct');
            revealed = true;
            cheer();
            PP.Confetti.burst(...buttonCenter(btn), 50);
            const stars = ctx.noFail ? 3 : Math.max(1, 3 - attempts);
            setTimeout(() => resolve({ stars, attempts, revealed: false }), 1100);
          } else {
            attempts += 1;
            btn.classList.add('is-wrong');
            if (!ctx.noFail) PP.Audio.wrong();
            setTimeout(() => btn.classList.remove('is-wrong'), 600);

            if (attempts === 1) {
              say(PP.Phrases.tryAgain());
              // Gentle glow on the right answer (no sparkle yet)
              buttons[correctIdx].classList.add('is-hint');
              setTimeout(() => buttons[correctIdx].classList.remove('is-hint'), 1600);
            } else if (attempts === 2) {
              say(PP.Phrases.tryAgain());
              hintCorrect();
            } else {
              // 3rd wrong → reveal & move on (counts as correct in toddler/preschool)
              revealed = true;
              buttons.forEach(b => b.disabled = true);
              buttons[correctIdx].classList.add('is-correct');
              PP.Audio.sparkle();
              say(PP.Phrases.reveal(correctItem.label)).then(() => {
                const stars = ctx.noFail ? 1 : 0;
                resolve({ stars, attempts, revealed: true });
              });
              return;
            }
            scheduleReplay();
          }
        }
      });
    }

    function buttonCenter(btn) {
      const r = btn.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }

    // ===== Results screen =====
    ctx.showResult = function showResult({ stars = 3, onAgain, onHome, message } = {}) {
      const wrap = $('#stage');
      wrap.replaceChildren();
      const card = document.createElement('div');
      card.className = 'll-result';
      const starRow = document.createElement('div');
      starRow.className = 'll-stars';
      const total = Math.max(1, Math.min(3, stars));
      for (let i = 0; i < total; i++) {
        const s = document.createElement('span'); s.className = 'll-star'; s.textContent = '⭐';
        starRow.appendChild(s);
      }
      card.appendChild(starRow);
      const msg = document.createElement('div');
      msg.className = 'll-prompt';
      msg.textContent = message || (ctx.profile.name ? `Wonderful, ${ctx.profile.name}!` : 'Wonderful!');
      card.appendChild(msg);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;';
      const again = document.createElement('button');
      again.type = 'button'; again.className = 'pp-btn pp-btn--primary pp-btn--big';
      again.textContent = '🔁 Play again';
      again.addEventListener('click', () => { PP.Audio.pling(); if (onAgain) onAgain(); });
      const home = document.createElement('button');
      home.type = 'button'; home.className = 'pp-btn pp-btn--secondary pp-btn--big';
      home.textContent = '🏠 Home';
      home.addEventListener('click', () => { PP.Audio.pling(); window.location.href = '../index.html'; });
      actions.appendChild(again); actions.appendChild(home);
      card.appendChild(actions);

      wrap.appendChild(card);

      celebrate();
      say(message || PP.Phrases.correct());
    };

    // ===== Mode switcher =====
    const modeBtns = $$('.ll-cat__mode');
    modeBtns.forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));

    function switchMode(name) {
      const fn = opts.modes[name];
      if (!fn) return;
      modeBtns.forEach(b => b.classList.toggle('is-active', b.dataset.mode === name));
      PP.Voice.cancel();
      PP.Audio.swish();
      $('#stage').classList.add('ll-stage--switching');
      setTimeout(() => {
        $('#stage').classList.remove('ll-stage--switching');
        $('#stage').replaceChildren();
        try { fn(ctx); } catch (err) { console.error('[PP.Game] mode crashed', err); }
      }, 220);
    }

    // Boot default mode
    const defaultMode = opts.defaultMode || 'discover';
    modeBtns.find(b => b.dataset.mode === defaultMode)?.classList.add('is-active');
    try { opts.modes[defaultMode](ctx); } catch (err) { console.error('[PP.Game] boot crashed', err); }

    // Expose for ad-hoc use
    ctx.switchMode = switchMode;
    window.PP.GameCtx = ctx;
  }

  // ===== Round runner (used by Practice & Quiz) =====
  // Runs a sequence of askChoice rounds, then shows results.
  function runRounds({ ctx, total, makeRound, awardSticker, finalMessage }) {
    let i = 0;
    let starsTotal = 0;
    const run = () => {
      if (i >= total) {
        // Average to 1-3
        const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
        ctx.showResult({
          stars,
          message: finalMessage || (ctx.profile.name ? `You did it, ${ctx.profile.name}!` : 'You did it!'),
          onAgain: () => runRounds({ ctx, total, makeRound, awardSticker, finalMessage }),
        });
        if (awardSticker) awardSticker();
        return;
      }
      const round = makeRound(i);
      if (i === total - 1) ctx.say(PP.Phrases.lastQuestion());
      ctx.askChoice(round).then(({ stars }) => {
        starsTotal += stars;
        i += 1;
        setTimeout(run, 750);
      });
    };
    run();
  }

  window.PP = window.PP || {};
  window.PP.Game = { boot, runRounds };
})();
