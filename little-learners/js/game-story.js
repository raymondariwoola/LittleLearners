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
  let SCENES = [];

  // ===== Randomized scene generators =====
  // Each generator returns a fresh scene { id, narration(name), build(ctx) }
  // with a randomly chosen target and a random narration variant, so no two
  // playthroughs feel identical.

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function nameLead(name) { return name ? `${name}, ` : ''; }

  function sceneLetter() {
    const letters = (PP.Letters || []);
    const target = pick(letters);
    const lines = [
      (n) => `${nameLead(n)}Professor Hoot lost his ${target.word.toLowerCase()}! It starts with the letter ${target.letter}. Can you find ${target.letter}?`,
      (n) => `${nameLead(n)}Hoot is thinking of a ${target.word.toLowerCase()} ${target.emoji}. What letter does ${target.word} start with? Find ${target.letter}!`,
      (n) => `${nameLead(n)}Look! ${target.emoji} ${target.word} starts with ${target.letter}. Tap the letter ${target.letter}!`,
      (n) => `${nameLead(n)}Can you help Hoot? Tap the letter ${target.letter}, like in ${target.word}!`,
    ];
    return {
      id: `letter-${target.letter}`,
      narration: pick(lines),
      build: askLetter(target.letter),
    };
  }

  function sceneColor() {
    const colors = (PP.Colors || []);
    const target = pick(colors);
    const lines = [
      (n) => `${nameLead(n)}Hoot sees a ${target.example} ${target.emoji}. What colour is it?`,
      (n) => `${nameLead(n)}Find the colour ${target.label}, like a ${target.example}!`,
      (n) => `${nameLead(n)}Look at this ${target.example} ${target.emoji}! Tap the ${target.label} one.`,
      (n) => `${nameLead(n)}Hoot painted something ${target.label}! Can you point to ${target.label}?`,
    ];
    return {
      id: `color-${target.id}`,
      narration: pick(lines),
      build: askColor(target.id),
    };
  }

  function sceneAnimal() {
    const animals = (PP.Animals || []);
    if (!animals.length) return null;
    const target = pick(animals);
    const sound = target.sound ? ` It says ${target.sound}.` : '';
    const lines = [
      (n) => `${nameLead(n)}Hoot wants to meet a friend.${sound} Which one is the ${target.label}?`,
      (n) => `${nameLead(n)}Listen carefully!${sound} Find the ${target.label}!`,
      (n) => `${nameLead(n)}Who's that in the bushes? ${target.emoji || ''} Tap the ${target.label}!`,
      (n) => `${nameLead(n)}Time to say hello to the ${target.label}!${sound}`,
    ];
    return {
      id: `animal-${target.id}`,
      narration: pick(lines),
      build: askAnimal(target.id),
    };
  }

  function sceneShape() {
    const shapes = (PP.Shapes || []);
    if (!shapes.length) return null;
    const target = pick(shapes);
    const lines = [
      (n) => `${nameLead(n)}Hoot is drawing in the sand. Find the ${target.label}!`,
      (n) => `${nameLead(n)}Look up at the clouds! Which one is a ${target.label}?`,
      (n) => `${nameLead(n)}Can you spot the ${target.label} shape?`,
      (n) => `${nameLead(n)}Tap the ${target.label}, ${target.label === 'Circle' ? 'round and round!' : "you've got this!"}`,
    ];
    return {
      id: `shape-${target.id}`,
      narration: pick(lines),
      build: askShape(target.id),
    };
  }

  function sceneCount() {
    const things = [
      { emoji: '🌰', label: 'acorns' },
      { emoji: '🍎', label: 'apples' },
      { emoji: '⭐', label: 'stars' },
      { emoji: '🌸', label: 'flowers' },
      { emoji: '🐞', label: 'ladybugs' },
      { emoji: '🐝', label: 'busy bees' },
      { emoji: '🍪', label: 'cookies' },
      { emoji: '🎈', label: 'balloons' },
      { emoji: '🍓', label: 'strawberries' },
      { emoji: '🐠', label: 'little fish' },
      { emoji: '🦋', label: 'butterflies' },
      { emoji: '🍂', label: 'leaves' },
    ];
    const t = pick(things);
    const n = randInt(2, 5);
    const lines = [
      (nm) => `${nameLead(nm)}Help Hoot count the ${t.label}! Tap each one.`,
      (nm) => `${nameLead(nm)}One, two, three… can you count the ${t.label}?`,
      (nm) => `${nameLead(nm)}Hoot found ${t.label} ${t.emoji}! Tap them one by one to count.`,
      (nm) => `${nameLead(nm)}Let's count to ${n}! Tap each ${t.label.replace(/s$/, '')}.`,
    ];
    return {
      id: `count-${t.emoji}-${n}`,
      narration: pick(lines),
      build: countItems(t.emoji, n),
    };
  }

  function shuffleArr(a) { return a.slice().sort(() => Math.random() - 0.5); }

  // Build a fresh story for this play: always at least one of each scene type
  // we can run (depending on which data files loaded), shuffled, capped at 5–6.
  function buildScenes() {
    const generators = [sceneLetter, sceneColor, sceneAnimal, sceneShape, sceneCount];
    // Always include each type once if its data is present, then add 1–2 random extras.
    const baseline = generators.map(g => g()).filter(Boolean);
    const extras = [pick(generators)(), pick(generators)()].filter(Boolean);
    const chosen = shuffleArr([...baseline, ...extras]).slice(0, Math.min(6, baseline.length + 1));
    // Stamp unique scene index so the sticker id is unique per play.
    return chosen.map((s, i) => ({ ...s, id: `${s.id}-i${i}` }));
  }

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
    SCENES = buildScenes();
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

    $('#storyAgain').addEventListener('click', () => { PP.Audio.pling(); SCENES = buildScenes(); startScene(0); });
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
