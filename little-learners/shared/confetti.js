/* PP.Confetti — particle bursts.
 * Lazy-creates a full-screen canvas if one isn't on the page already.
 * Respects prefers-reduced-motion (reduces particle count drastically).
 */
(function () {
  let canvas = null, ctx = null, particles = [], rafId = null;

  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = document.getElementById('pp-confetti') || document.getElementById('confetti');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'pp-confetti';
      canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
    return canvas;
  }
  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  const COLORS = [
    '#ffd166', '#ff8c66', '#7fdca8', '#c9a3ff',
    '#ff9bc7', '#4ecdc4', '#fff5dc', '#ffe590',
  ];

  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function burst(x, y, count = 80) {
    ensureCanvas();
    if (prefersReducedMotion()) count = Math.min(20, Math.round(count / 4));
    const cx = (x == null) ? canvas.width / 2 : x;
    const cy = (y == null) ? canvas.height / 2 : y;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 8;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 4,
        size: 5 + Math.random() * 7,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        life: 1,
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
      });
    }
    if (!rafId) loop();
  }

  function hearts(x, y, count = 20) {
    ensureCanvas();
    if (prefersReducedMotion()) count = Math.min(6, count);
    const cx = (x == null) ? canvas.width / 2 : x;
    const cy = (y == null) ? canvas.height / 2 : y;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const sp = 2 + Math.random() * 4;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        size: 14 + Math.random() * 10,
        color: ['#ff6b6b', '#ff9bc7', '#ff8c66'][Math.floor(Math.random() * 3)],
        rot: 0, vrot: (Math.random() - 0.5) * 0.05,
        life: 1, shape: 'heart',
      });
    }
    if (!rafId) loop();
  }

  function stars(x, y, count = 14) {
    ensureCanvas();
    const cx = (x == null) ? canvas.width / 2 : x;
    const cy = (y == null) ? canvas.height / 2 : y;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        size: 16 + Math.random() * 10,
        color: ['#ffd166', '#ffe590', '#fff5dc'][Math.floor(Math.random() * 3)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.25,
        life: 1, shape: 'star',
      });
    }
    if (!rafId) loop();
  }

  function drawHeart(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(s * 0.5, -s * 0.3, s, s * 0.1, 0, s);
    c.bezierCurveTo(-s, s * 0.1, -s * 0.5, -s * 0.3, 0, s * 0.3);
    c.closePath();
    c.fill();
  }
  function drawStar(c, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.vy += 0.25; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vrot; p.life -= 0.012;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      else if (p.shape === 'heart') drawHeart(ctx, p.size / 2);
      else if (p.shape === 'star') drawStar(ctx, p.size / 2);
      ctx.restore();
    }
    if (particles.length) rafId = requestAnimationFrame(loop);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); rafId = null; }
  }

  const api = { burst, hearts, stars };
  window.PP = window.PP || {};
  window.PP.Confetti = api;
  window.Confetti = api;
})();
