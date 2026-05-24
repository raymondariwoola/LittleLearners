/* Story Mode — "Hoot's Big Day"
 *
 * A linked narrative across categories. Each scene uses one mini-activity
 * (find-the-letter, count, pick-color, find-animal, pick-shape).
 *
 * Each completed scene awards a story sticker (id "scene-N"). Finishing
 * the whole story awards a "story-master" sticker via the sticker book.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const learners = PP.Progress.app('learners');

  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    return shuffle(exclude ? arr.filter(x => x !== exclude) : arr.slice()).slice(0, n);
  }
  function choiceCount(ageMode) {
    return ({ toddler: 2, preschool: 3, kindergarten: 4, reader: 4 })[ageMode] || 3;
  }

  let mascot, ageMode, profile;

  const SCENES = [
    {
      id: 'scene-1',
      narration: name => `${name ? name + ', ' : ''}Professor Hoot lost his hat! His hat starts with the letter H. Can you find it?`,
      build: askLetter('H'),
    },
    {
      id: 'scene-2',
      narration: () => `Yay! Now Hoot wants to count his three little acorns. Tap each one!`,
      build: countItems('🌰', 3),
    },
    {
      id: 'scene-3',
      narration: () => `Look! The sun is up. Which colour is the sun?`,
      build: askColor('yellow'),
    },
    {
      id: 'scene-4',
      narration: () => `Time to meet a friend. Hoot says hoo-hoo. Which one is the owl?`,
      build: askAnimal('owl'),
    },
    {
      id: 'scene-5',
      narration: () => `Last thing! The moon is rising. Which shape is the moon tonight?`,
      build: askShape('crescent'),
    },
  ];

  function init() {
    PP.Theme.apply();
    profile = PP.Progress.profile();
    ageMode = profile.ageMode || 'toddler';
    document.documentElement.setAttribute('data-age-mode', ageMode);
    document.documentElement.setAttribute('data-category', 'story');

    const root = $('#cat');
    root.innerHTML = `
      <div class="ll-cat__bar">
        <button id="storyBack" class="ll-cat__back" type="button" aria-label="Back to home">←</button>
        <div class="ll-cat__title"><span aria-hidden="true">⭐</span><span>Story Mode</span></div>
        <div class="ll-cat__modes" id="storySteps" aria-label="Story progress"></div>
      </div>
      <div id="stage" class="ll-stage ll-story-stage" aria-live="polite"></div>`;

    mascot = PP.Mascot.build();
    mascot.classList.add('ll-cat__mascot');
    PP.Mascot.setMood(mascot, 'happy');
    PP.Mascot.eyesFollow(mascot, true);
    document.body.appendChild(mascot);

    $('#storyBack').addEventListener('click', () => { PP.Voice.cancel(); window.location.href = '../index.html'; });
    renderStepDots(0);
    startScene(0);
  }

  function renderStepDots(activeIdx) {
    const wrap = $('#storySteps');
    wrap.innerHTML = '';
    SCENES.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'll-story-dot ' + (i < activeIdx ? 'is-done' : i === activeIdx ? 'is-active' : '');
      d.textContent = i < activeIdx ? '⭐' : '○';
      wrap.appendChild(d);
    });
  }

  function startScene(idx) {
    renderStepDots(idx);
    if (idx >= SCENES.length) return finish();
    const scene = SCENES[idx];

    const stage = $('#stage');
    stage.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'll-story-card';
    card.innerHTML = `<div class="ll-prompt ll-story-line">${scene.narration(profile.name || '')}</div>`;
    stage.appendChild(card);

    PP.Mascot.setMood(mascot, 'curious');
    PP.Mascot.speak(mascot, true);
    PP.Voice.speak(scene.narration(profile.name || '')).then(() => {
      PP.Mascot.speak(mascot, false);
      PP.Mascot.setMood(mascot, 'happy');
      scene.build({
        stage,
        onSolved: () => {
          learners.addToSet(`stickers.story`, scene.id);
          PP.Audio.unlock();
          PP.UI.toast(`⭐ Story sticker unlocked!`, { kind: 'good' });
          PP.Mascot.setMood(mascot, 'celebrating');
          PP.Confetti.stars(window.innerWidth / 2, window.innerHeight / 2, 30);
          setTimeout(() => startScene(idx + 1), 1500);
        },
      });
    });
  }

  function finish() {
    const stage = $('#stage');
    stage.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'll-result';
    card.innerHTML = `
      <div class="ll-stars"><span class="ll-star">⭐</span><span class="ll-star">⭐</span><span class="ll-star">⭐</span></div>
      <div class="ll-prompt">The end! Wonderful job${profile.name ? ', ' + profile.name : ''}!</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;">
        <button id="storyAgain" class="pp-btn pp-btn--primary pp-btn--big" type="button">🔁 Play again</button>
        <button id="storyHome"  class="pp-btn pp-btn--secondary pp-btn--big" type="button">🏠 Home</button>
      </div>`;
    stage.appendChild(card);
    PP.Audio.fanfare();
    PP.Confetti.burst(window.innerWidth / 2, window.innerHeight / 2, 150);
    PP.Mascot.setMood(mascot, 'celebrating');
    PP.Voice.speak(`The end! Wonderful job${profile.name ? ', ' + profile.name : ''}!`);

    $('#storyAgain').addEventListener('click', () => { PP.Audio.pling(); startScene(0); });
    $('#storyHome').addEventListener('click', () => { PP.Audio.pling(); window.location.href = '../index.html'; });
  }

  // ===== Scene builders =====
  // Each returns a fn({stage, onSolved}) that appends interactive UI and calls onSolved when right.

  function askLetter(letterId) {
    return function ({ stage, onSolved }) {
      const target = (PP.Letters || []).find(l => l.letter === letterId);
      if (!target) return onSolved();
      const others = pickN((PP.Letters || []).filter(l => l !== target), choiceCount(ageMode) - 1);
      const items = shuffle([target, ...others]);
      renderChoices({
        stage,
        items,
        correctIdx: items.indexOf(target),
        render: i => `<span class="ll-tile__big">${i.letter}</span>`,
        speakLabel: i => `Letter ${i.letter}`,
      }, onSolved);
    };
  }

  function askColor(colorId) {
    return function ({ stage, onSolved }) {
      const target = (PP.Colors || []).find(c => c.id === colorId);
      if (!target) return onSolved();
      const others = pickN((PP.Colors || []).filter(c => c !== target), choiceCount(ageMode) - 1);
      const items = shuffle([target, ...others]);
      renderChoices({
        stage,
        items,
        correctIdx: items.indexOf(target),
        render: i => {
          const sw = document.createElement('span');
          sw.className = 'll-swatch';
          sw.style.background = i.hex;
          return sw;
        },
        speakLabel: i => i.label,
      }, onSolved);
    };
  }

  function askAnimal(animalId) {
    return function ({ stage, onSolved }) {
      const target = (PP.Animals || []).find(a => a.id === animalId);
      if (!target) return onSolved();
      const others = pickN((PP.Animals || []).filter(a => a !== target), choiceCount(ageMode) - 1);
      const items = shuffle([target, ...others]);
      renderChoices({
        stage,
        items,
        correctIdx: items.indexOf(target),
        render: i => `<span class="ll-tile__emoji">${i.emoji}</span>`,
        speakLabel: i => i.label,
      }, onSolved);
    };
  }

  function askShape(shapeId) {
    return function ({ stage, onSolved }) {
      const target = (PP.Shapes || []).find(s => s.id === shapeId);
      if (!target) return onSolved();
      const others = pickN((PP.Shapes || []).filter(s => s !== target), choiceCount(ageMode) - 1);
      const items = shuffle([target, ...others]);
      const fills = ['#ff8c66', '#ffd966', '#7fdca8', '#c9a3ff'];
      renderChoices({
        stage,
        items,
        correctIdx: items.indexOf(target),
        render: (i, idx) => `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <g fill="${fills[idx % fills.length]}" stroke="rgba(0,0,0,0.15)" stroke-width="2">${i.svg}</g></svg>`,
        speakLabel: i => i.label,
      }, onSolved);
    };
  }

  function countItems(emoji, n) {
    return function ({ stage, onSolved }) {
      const tray = document.createElement('div');
      tray.className = 'll-count-tray';
      stage.appendChild(tray);
      let counted = 0;
      for (let k = 0; k < n; k++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'll-count-bubble';
        b.textContent = emoji;
        b.addEventListener('click', () => {
          if (b.classList.contains('is-counted')) return;
          counted += 1;
          b.classList.add('is-counted');
          b.innerHTML = `${emoji}<span class="ll-count-num">${counted}</span>`;
          PP.Audio.ding();
          PP.Voice.speak(String(counted), { force: true });
          if (counted === n) {
            setTimeout(() => {
              PP.Voice.speak(`${n}!`).then(onSolved);
            }, 300);
          }
        });
        tray.appendChild(b);
      }
    };
  }

  // Shared choice renderer with the same no-fail flow as the main engine.
  function renderChoices({ stage, items, correctIdx, render, speakLabel }, onSolved) {
    const wrap = document.createElement('div');
    wrap.className = 'll-choices';
    stage.appendChild(wrap);
    const noFail = ageMode === 'toddler' || ageMode === 'preschool';
    let attempts = 0;
    let resolved = false;

    const buttons = items.map((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'll-choice';
      const r = render(item, idx);
      if (typeof r === 'string') btn.innerHTML = r; else btn.appendChild(r);
      // Hold-to-hear
      let hold = null;
      btn.addEventListener('pointerdown', () => {
        hold = setTimeout(() => PP.Voice.speak(speakLabel(item), { interrupt: true }), 600);
      });
      const stop = () => { if (hold) clearTimeout(hold); hold = null; };
      ['pointerup','pointerleave','pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
      btn.addEventListener('click', () => onTap(idx, btn));
      wrap.appendChild(btn);
      return btn;
    });

    function onTap(idx, btn) {
      if (resolved) return;
      if (idx === correctIdx) {
        resolved = true;
        buttons.forEach(b => b.disabled = true);
        btn.classList.add('is-correct');
        PP.Audio.correct();
        PP.Confetti.burst(btn.getBoundingClientRect().left + 40, btn.getBoundingClientRect().top + 40, 50);
        setTimeout(onSolved, 900);
      } else {
        attempts += 1;
        btn.classList.add('is-wrong');
        if (!noFail) PP.Audio.wrong();
        setTimeout(() => btn.classList.remove('is-wrong'), 600);
        if (attempts >= (noFail ? 2 : 3)) {
          // Reveal and proceed
          resolved = true;
          buttons.forEach(b => b.disabled = true);
          buttons[correctIdx].classList.add('is-correct');
          PP.Audio.sparkle();
          PP.Voice.speak(PP.Phrases.reveal(speakLabel(items[correctIdx]))).then(onSolved);
        } else {
          PP.Voice.speak(PP.Phrases.tryAgain());
          buttons[correctIdx].classList.add('is-hint');
          setTimeout(() => buttons[correctIdx].classList.remove('is-hint'), 1400);
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
