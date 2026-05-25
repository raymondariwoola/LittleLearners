/* PP.UI — modal, toast, parent-gate helpers shared across the suite. */
(function () {
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function modal(opts) {
    // opts: { title, bodyEl, actions: [{ label, primary, onClick }], mascotMood, dismissible }
    const overlay = h('div', { class: 'pp-modal' });
    const card = h('div', { class: 'pp-modal__card' });
    if (opts.mascotMood && window.PP && PP.Mascot) {
      const m = PP.Mascot.build();
      m.classList.add('pp-modal__mascot');
      PP.Mascot.setMood(m, opts.mascotMood);
      card.appendChild(m);
    }
    if (opts.title) card.appendChild(h('h2', { class: 'pp-modal__title' }, opts.title));
    if (opts.bodyEl) card.appendChild(opts.bodyEl);
    if (opts.actions && opts.actions.length) {
      const row = h('div', { class: 'pp-modal__actions' });
      opts.actions.forEach(a => {
        const btn = h('button', {
          class: 'pp-btn ' + (a.primary ? 'pp-btn--primary' : 'pp-btn--secondary'),
          type: 'button',
          onclick: () => { if (a.onClick) a.onClick(close); else close(); },
        }, a.label);
        row.appendChild(btn);
      });
      card.appendChild(row);
    }
    overlay.appendChild(card);
    if (opts.dismissible !== false) {
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('pp-modal--in'));

    function close() {
      overlay.classList.remove('pp-modal--in');
      setTimeout(() => overlay.remove(), 250);
    }
    return { close, el: overlay, card };
  }

  function toast(message, opts = {}) {
    const t = h('div', { class: 'pp-toast ' + (opts.kind ? 'pp-toast--' + opts.kind : '') }, message);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('pp-toast--in'));
    setTimeout(() => {
      t.classList.remove('pp-toast--in');
      setTimeout(() => t.remove(), 300);
    }, opts.duration ?? 2200);
  }

  // Parent gate — "Tap the 7" between distractor digits. Math-light so adults
  // pass instantly while toddlers can't open settings/reset by accident.
  function parentGate() {
    return new Promise(resolve => {
      const targets = [3, 4, 5, 6, 7, 8, 9];
      const target = targets[Math.floor(Math.random() * targets.length)];
      const distractors = new Set();
      while (distractors.size < 2) {
        const d = targets[Math.floor(Math.random() * targets.length)];
        if (d !== target) distractors.add(d);
      }
      const digits = [target, ...distractors].sort(() => Math.random() - 0.5);

      const body = h('div', { class: 'pp-gate' }, [
        h('p', { class: 'pp-gate__prompt' }, `Parents only — tap the ${target}`),
        h('div', { class: 'pp-gate__digits' }, digits.map(d => h('button', {
          class: 'pp-gate__digit', type: 'button',
          onclick: () => {
            if (d === target) { m.close(); resolve(true); }
            else { m.card.classList.add('pp-modal__card--shake'); setTimeout(() => m.card.classList.remove('pp-modal__card--shake'), 400); }
          },
        }, String(d)))),
      ]);

      const m = modal({
        title: '🔒 Just a sec',
        bodyEl: body,
        actions: [{ label: 'Cancel', onClick: (close) => { close(); resolve(false); } }],
        mascotMood: 'curious',
      });
    });
  }

  const api = { h, modal, toast, parentGate };
  window.PP = window.PP || {};
  window.PP.UI = api;
})();
