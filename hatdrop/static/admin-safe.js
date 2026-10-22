'use strict';
/* Admin opened inside the Telegram app (fullscreen): Telegram draws the clock, the notch and its own
   buttons on top of the page. Read their size and expose it as --app-inset-* so the layout can step
   below them. Outside Telegram the CSS falls back to env(safe-area-inset-*). */
(() => {
  const root = document.documentElement;
  let hooked = null;
  function apply() {
    const app = window.Telegram?.WebApp;
    if (!app) return;
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const system = Math.max(0, Number(app.safeAreaInset?.[edge]) || 0);
      const content = Math.max(0, Number(app.contentSafeAreaInset?.[edge]) || 0);
      root.style.setProperty('--app-inset-' + edge, system + content + 'px');
    }
  }
  function connect() {
    const app = window.Telegram?.WebApp;
    if (!app) return;
    if (hooked !== app) {
      hooked = app;
      for (const ev of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged']) {
        try { app.onEvent?.(ev, apply); } catch (_) {}
      }
    }
    apply();
  }
  connect();
  document.getElementById('telegramSdk')?.addEventListener('load', connect);
})();
