/* Sticker Book — a book with one page per category showing earned + locked
 * stickers. Tap a sticker to hear its name. Page flips with a swish.
 *
 * Storage source: PP.Progress.app('learners').get('stickers.<catId>', [])
 * Full roster comes from PP.Letters / PP.Numbers / ... that the page loads.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const learners = PP.Progress.app('learners');

  // Roster builders: id → display
  const ROSTERS = {
    letters:   () => (PP.Letters   || []).map(l => ({ id: l.letter, label: l.letter, big: l.letter, sub: l.word, kind: 'letter' })),
    numbers:   () => (PP.Numbers   || []).map(n => ({ id: String(n.n), label: String(n.n), big: String(n.n), sub: n.word, kind: 'number' })),
    counting:  () => (PP.Numbers   || []).map(n => ({ id: String(n.n), label: 'Counted ' + n.n, big: String(n.n), sub: n.word, kind: 'count' })),
    colors:    () => (PP.Colors    || []).map(c => ({ id: c.id, label: c.label, swatch: c.hex, sub: c.label, kind: 'color' })),
    shapes:    () => (PP.Shapes    || []).map(s => ({ id: s.id, label: s.label, svg: s.svg, sub: s.label, kind: 'shape' })),
    animals:   () => (PP.Animals   || []).map(a => ({ id: a.id, label: a.label, big: a.emoji, sub: a.label, kind: 'emoji' })),
    bodyparts: () => (PP.BodyParts || []).map(p => ({ id: p.id, label: p.label, big: p.emoji, sub: p.label, kind: 'emoji' })),
    family:    () => (PP.Family    || []).map(r => ({ id: r.id, label: r.label, big: r.emoji, sub: r.label, kind: 'emoji' })),
    food:      () => (PP.Food      || []).map(f => ({ id: f.id, label: f.label, big: f.emoji, sub: f.label, kind: 'emoji' })),
    phonics:   () => (PP.Phonics   || []).map(w => ({ id: w.word, label: w.word, big: w.word, sub: w.emoji, kind: 'word' })),
    story:     () => Array.from({ length: 5 }).map((_, i) => ({ id: 'scene-' + (i+1), label: 'Scene ' + (i+1), big: '⭐', sub: 'Story ' + (i+1), kind: 'star' })),
    // Memory Meadow awards one badge per pair-count / theme variant cleared.
    // Keep this in sync with the rounds defined in js/game-memory.js.
    memory:    () => [
      { id: 'meadow-4',   label: 'First Match',   big: '🌱', sub: '4 cards',    kind: 'emoji' },
      { id: 'meadow-6',   label: 'Sprout',        big: '🌿', sub: '6 cards',    kind: 'emoji' },
      { id: 'meadow-8',   label: 'Bloomer',       big: '🌼', sub: '8 cards',    kind: 'emoji' },
      { id: 'meadow-12',  label: 'Meadow Master', big: '🏵️', sub: '12 cards',   kind: 'emoji' },
      { id: 'meadow-flip',label: 'Quick Flipper', big: '⚡',  sub: 'Few peeks', kind: 'emoji' },
      { id: 'meadow-full',label: 'Full Bloom',    big: '🌻', sub: 'All themes', kind: 'emoji' },
    ],
  };

  const CATS = (PP.Categories || []).slice();

  let currentIdx = 0;

  function init() {
    PP.Theme.apply();
    const m = PP.Progress.profile().ageMode || 'toddler';
    document.documentElement.setAttribute('data-age-mode', m);

    const root = $('#book');
    root.innerHTML = `
      <div class="ll-cat__bar">
        <button id="bookBack" class="ll-cat__back" type="button" aria-label="Back to home">←</button>
        <div class="ll-cat__title"><span aria-hidden="true">📖</span><span>Sticker Book</span></div>
        <div class="ll-cat__modes" id="bookTabs" role="tablist" aria-label="Pages"></div>
      </div>
      <div id="bookPage" class="ll-book-page" aria-live="polite"></div>
      <div class="ll-book-nav">
        <button id="bookPrev" class="pp-btn pp-btn--secondary pp-btn--big" type="button">◀ Prev</button>
        <span id="bookCount" class="ll-book-count"></span>
        <button id="bookNext" class="pp-btn pp-btn--primary pp-btn--big" type="button">Next ▶</button>
      </div>`;

    // Corner mascot
    const mascot = PP.Mascot.build();
    mascot.classList.add('ll-cat__mascot');
    PP.Mascot.setMood(mascot, 'happy');
    PP.Mascot.eyesFollow(mascot, true);
    document.body.appendChild(mascot);

    // Tabs (compact list of category icons)
    const tabs = $('#bookTabs');
    CATS.forEach((c, i) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'll-cat__mode ll-book-tab';
      t.dataset.idx = String(i);
      t.title = c.label;
      t.innerHTML = `<span aria-hidden="true">${c.icon}</span>`;
      t.addEventListener('click', () => goTo(i));
      tabs.appendChild(t);
    });

    $('#bookBack').addEventListener('click', () => { PP.Voice.cancel(); window.location.href = '../index.html'; });
    $('#bookPrev').addEventListener('click', () => goTo(currentIdx - 1));
    $('#bookNext').addEventListener('click', () => goTo(currentIdx + 1));

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') goTo(currentIdx - 1);
      else if (e.key === 'ArrowRight') goTo(currentIdx + 1);
    });

    renderPage();
  }

  function goTo(i) {
    const n = CATS.length;
    if (n === 0) return;
    const next = ((i % n) + n) % n;
    if (next === currentIdx) return;
    PP.Audio.pageFlip();
    const page = $('#bookPage');
    page.classList.add('is-flipping');
    setTimeout(() => {
      currentIdx = next;
      renderPage();
      page.classList.remove('is-flipping');
    }, 240);
  }

  function renderPage() {
    const cat = CATS[currentIdx];
    const roster = (ROSTERS[cat.id] || (() => []))();
    const owned  = learners.get(`stickers.${cat.id}`, []) || [];
    const ownedSet = new Set(owned);

    // Active tab styling
    document.querySelectorAll('.ll-book-tab').forEach(t => {
      t.classList.toggle('is-active', Number(t.dataset.idx) === currentIdx);
    });

    const ownedCount = roster.filter(r => ownedSet.has(r.id)).length;
    $('#bookCount').textContent = `${currentIdx + 1} / ${CATS.length}`;

    const page = $('#bookPage');
    page.innerHTML = `
      <h2 class="ll-book-title"><span aria-hidden="true">${cat.icon}</span> ${cat.label}</h2>
      <div class="ll-book-sub">${ownedCount} of ${roster.length} stickers collected</div>
      <div class="ll-book-grid" id="bookGrid"></div>
      <div class="ll-book-cta">
        <button class="pp-btn pp-btn--primary pp-btn--big" id="bookPlay">▶ Play ${cat.label}</button>
      </div>`;
    const grid = $('#bookGrid');
    roster.forEach(s => {
      const has = ownedSet.has(s.id);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'll-book-sticker ' + (has ? 'is-owned' : 'is-locked');
      tile.setAttribute('aria-label', has ? s.label : 'Locked');
      tile.innerHTML = renderStickerInner(s, has);
      tile.addEventListener('click', () => {
        if (has) {
          PP.Audio.sparkle();
          PP.Voice.speak(s.label, { interrupt: true });
          tile.classList.remove('pp-pop'); void tile.offsetWidth; tile.classList.add('pp-pop');
        } else {
          PP.Audio.pling();
          PP.Voice.speak('Play to unlock!', { interrupt: true });
        }
      });
      grid.appendChild(tile);
    });

    $('#bookPlay').addEventListener('click', () => {
      PP.Audio.pling();
      window.location.href = '../' + cat.page;
    });
  }

  function renderStickerInner(s, has) {
    if (!has) return `<span class="ll-book-sticker__lock">🔒</span>`;
    if (s.swatch) {
      return `<span class="ll-book-sticker__swatch" style="background:${s.swatch}"></span>
              <span class="ll-book-sticker__sub">${s.sub || ''}</span>`;
    }
    if (s.svg) {
      return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="ll-book-sticker__svg">
                <g fill="currentColor">${s.svg}</g>
              </svg>
              <span class="ll-book-sticker__sub">${s.sub || ''}</span>`;
    }
    return `<span class="ll-book-sticker__big">${s.big}</span>
            <span class="ll-book-sticker__sub">${s.sub || ''}</span>`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
