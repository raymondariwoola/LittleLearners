/* PP.Theme — day/night CSS variable switcher.
 * Auto-applies "night" theme after 18:00 unless the parent has overridden.
 */
(function () {
  function S() { return (window.PP && PP.Progress) ? PP.Progress.settings() : {}; }
  function saveS(p) { if (window.PP && PP.Progress) PP.Progress.setSettings(p); }

  function isAfterDusk() {
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  }

  function compute() {
    const s = S();
    if (s.themeOverride === 'day') return 'day';
    if (s.themeOverride === 'night') return 'night';
    if (s.dayNightAuto === false) return 'day';
    return isAfterDusk() ? 'night' : 'day';
  }

  function apply() {
    const theme = compute();
    document.documentElement.setAttribute('data-theme', theme);
    // Reduced motion
    const rm = S().reducedMotion;
    if (rm === true) document.documentElement.setAttribute('data-reduced-motion', 'on');
    else if (rm === false) document.documentElement.removeAttribute('data-reduced-motion');
    else {
      // follow OS
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          document.documentElement.setAttribute('data-reduced-motion', 'on');
        } else {
          document.documentElement.removeAttribute('data-reduced-motion');
        }
      } catch (_) {}
    }
    return theme;
  }

  function setOverride(theme) {
    saveS({ themeOverride: theme }); apply();
  }
  function setAuto(on) { saveS({ dayNightAuto: !!on, themeOverride: null }); apply(); }

  // Re-check periodically so we cross 18:00 without a refresh.
  if (typeof window !== 'undefined') {
    apply();
    setInterval(apply, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
  }

  window.PP = window.PP || {};
  window.PP.Theme = { apply, setOverride, setAuto, current: compute };
})();
