/**
 * Voren — Global theme (dark mode)
 * Loaded by every page in /pages/. Single source of truth for the
 * site-wide theme preference — there is no per-page or per-feature
 * variant of this.
 *
 * Two responsibilities:
 *   1. Applies the saved theme synchronously, the moment this file runs
 *      (which is why it's linked as the very first thing in <head>, on
 *      every page, unminified and unblocked by `defer`/`async`) — so the
 *      correct theme is set before the page paints. No light-mode flash
 *      on a dark preference.
 *   2. Exposes window.VorenTheme so any page's UI (today: the Settings
 *      modal in dashboard.js) can read or change the preference without
 *      touching localStorage directly.
 *
 * The actual dark-mode colors live in assets/css/variables.css, as
 * overrides of the same custom properties every other stylesheet in the
 * project already reads from — this file only ever toggles one HTML
 * attribute (data-theme) and one localStorage key. It never touches CSS.
 */
(function () {
  var STORAGE_KEY = 'voren-theme';

  function get() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function apply(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function set(theme) {
    var normalized = theme === 'dark' ? 'dark' : 'light';
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch (e) {}
    apply(normalized);
    return normalized;
  }

  function toggle() {
    return set(get() === 'dark' ? 'light' : 'dark');
  }

  // Runs the instant this script executes — before the rest of <head>
  // finishes and long before <body> paints.
  apply(get());

  window.VorenTheme = { get: get, set: set, toggle: toggle, STORAGE_KEY: STORAGE_KEY };
})();
