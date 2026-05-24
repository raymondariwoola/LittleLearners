/* Family — Discover (with photo upload to IndexedDB) / Practice / Quiz
 *
 * Photos are stored as Blob in IndexedDB under db 'pp_family', store 'photos',
 * keyed by role id. Reads return an object URL which we revoke on page unload.
 *
 * Add Photo / Remove Photo are parent-gated.
 */
(function () {
  const ROLES = PP.Family;
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function pickN(arr, n, exclude) {
    return shuffle(exclude ? arr.filter(x => x !== exclude) : arr.slice()).slice(0, n);
  }

  // -------- IndexedDB photo store --------
  const DB_NAME = 'pp_family', STORE = 'photos', VERSION = 1;
  let _dbPromise = null;
  function openDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
    return _dbPromise;
  }
  function putPhoto(id, blob) {
    return openDb().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }
  function getPhoto(id) {
    return openDb().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    }));
  }
  function delPhoto(id) {
    return openDb().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }

  const _objectUrls = new Map();
  function objectUrlFor(id, blob) {
    if (_objectUrls.has(id)) URL.revokeObjectURL(_objectUrls.get(id));
    const url = URL.createObjectURL(blob);
    _objectUrls.set(id, url);
    return url;
  }
  window.addEventListener('beforeunload', () => {
    _objectUrls.forEach(u => URL.revokeObjectURL(u));
  });

  // -------- Discover --------
  function discover(ctx) {
    const stage = ctx.stage;
    const intro = document.createElement('div');
    intro.className = 'll-prompt';
    intro.textContent = 'Tap your family!';
    stage.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'll-family-grid';
    stage.appendChild(grid);

    ROLES.forEach(r => {
      const card = document.createElement('div');
      card.className = 'll-family-card';
      card.dataset.id = r.id;
      card.innerHTML = `
        <button type="button" class="ll-family-tap" aria-label="${r.label}">
          <span class="ll-family-photo" data-photo></span>
          <span class="ll-family-emoji">${r.emoji}</span>
        </button>
        <div class="ll-family-label">${r.label}</div>
        <div class="ll-family-tools">
          <button type="button" class="pp-btn pp-btn--icon" data-add aria-label="Add photo">📷</button>
          <button type="button" class="pp-btn pp-btn--icon" data-remove aria-label="Remove photo" hidden>🗑️</button>
        </div>`;
      grid.appendChild(card);

      const photoEl  = card.querySelector('[data-photo]');
      const addBtn   = card.querySelector('[data-add]');
      const removeBtn= card.querySelector('[data-remove]');
      const tap      = card.querySelector('.ll-family-tap');

      // Try to load saved photo
      getPhoto(r.id).then(blob => {
        if (blob) showPhoto(card, photoEl, removeBtn, blob, r.id);
      }).catch(() => {});

      tap.addEventListener('click', () => {
        PP.Audio.pling();
        tap.classList.remove('pp-pop'); void tap.offsetWidth; tap.classList.add('pp-pop');
        PP.Mascot.setMood(ctx.mascot, 'excited');
        ctx.say(`${r.label}!`).finally(() => PP.Mascot.setMood(ctx.mascot, 'happy'));
        ctx.awardSticker(r.id, r.label);
      });

      addBtn.addEventListener('click', async () => {
        const ok = await PP.UI.parentGate();
        if (!ok) return;
        pickFile().then(blob => {
          if (!blob) return;
          putPhoto(r.id, blob).then(() => {
            showPhoto(card, photoEl, removeBtn, blob, r.id);
            PP.UI.toast(`Photo added for ${r.label}!`, { kind: 'good' });
          }).catch(() => PP.UI.toast('Could not save photo.', { kind: 'warn' }));
        });
      });

      removeBtn.addEventListener('click', async () => {
        const ok = await PP.UI.parentGate();
        if (!ok) return;
        delPhoto(r.id).then(() => {
          // Free the blob URL we created for this card so long sessions
          // with repeated add/remove cycles don't slowly leak memory.
          if (_objectUrls.has(r.id)) {
            URL.revokeObjectURL(_objectUrls.get(r.id));
            _objectUrls.delete(r.id);
          }
          card.classList.remove('has-photo');
          photoEl.style.backgroundImage = '';
          removeBtn.hidden = true;
          PP.UI.toast('Photo removed.', { kind: 'good' });
        });
      });
    });

    ctx.say('Tap your family! Grown-ups can add photos.');
  }

  function showPhoto(card, photoEl, removeBtn, blob, id) {
    const url = objectUrlFor(id, blob);
    photoEl.style.backgroundImage = `url("${url}")`;
    card.classList.add('has-photo');
    removeBtn.hidden = false;
  }

  function pickFile() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      // Some mobile browsers (notably stricter iOS Safari flows) ignore
      // .click() on inputs that aren't in the DOM. Attach it hidden, then
      // clean it up once we get the change event.
      inp.style.position = 'fixed';
      inp.style.left = '-9999px';
      inp.style.opacity = '0';
      const cleanup = () => { if (inp.parentNode) inp.parentNode.removeChild(inp); };
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0];
        cleanup();
        if (!f) return resolve(null);
        // Downscale on the client to keep IndexedDB lean (≤ 720px).
        downscale(f, 720).then(resolve).catch(() => resolve(f));
      });
      document.body.appendChild(inp);
      inp.click();
    });
  }
  function downscale(file, maxDim) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('blob fail')), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')); };
      img.src = url;
    });
  }

  // -------- Practice / Quiz --------
  function practice(ctx) { runRounds(ctx, false); }
  function quiz(ctx)     { runRounds(ctx, true); }

  function runRounds(ctx, isQuiz) {
    const total = isQuiz ? 8 : 5;
    let i = 0, starsTotal = 0;

    // Preload photo blobs once so choice render is sync-ish.
    const photoMap = new Map();
    Promise.all(ROLES.map(r => getPhoto(r.id).then(b => b && photoMap.set(r.id, objectUrlFor(r.id, b))).catch(()=>{})))
      .then(start);

    function start() {
      const next = () => {
        if (i >= total) {
          const stars = Math.max(1, Math.min(3, Math.round(starsTotal / total)));
          ctx.showResult({ stars, onAgain: () => runRounds(ctx, isQuiz) });
          if (isQuiz && stars >= 2) ctx.awardSticker('quiz-' + Date.now(), 'Family Quiz');
          return;
        }
        const target = ROLES[Math.floor(Math.random() * ROLES.length)];
        const distractors = pickN(ROLES, ctx.choiceCount() - 1, target);
        const items = shuffle([target, ...distractors]);
        const correctIdx = items.indexOf(target);

        ctx.askChoice({
          prompt: `Find ${target.label}!`,
          items: items.map(r => ({ label: r.label, role: r })),
          correctIdx,
          render: it => {
            const url = photoMap.get(it.role.id);
            return url
              ? `<span class="ll-family-photo is-pure" style="background-image:url('${url}')"></span>`
              : `<span class="ll-tile__emoji">${it.role.emoji}</span>`;
          },
        }).then(({ stars }) => {
          starsTotal += stars;
          ctx.awardSticker(target.id, target.label);
          i += 1;
          setTimeout(next, 700);
        });
      };
      next();
    }
  }

  PP.Game.boot({
    catId: 'family', label: 'Family', icon: '👨‍👩‍👧',
    modes: { discover, practice, quiz },
    defaultMode: 'discover',
  });
})();
