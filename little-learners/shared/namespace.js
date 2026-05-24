/* Professor Hoot Learning Suite — global namespace.
 * Every shared module attaches itself to window.PP so future suite apps
 * (Clock Quest, Hoot Academy launcher, etc.) can share progress/voice/mascot.
 */
(function () {
  if (!window.PP) window.PP = { suite: 'professor-hoot', version: '1.0.0' };
})();
