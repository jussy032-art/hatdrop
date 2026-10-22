'use strict';
// "Скрытые оформления" box at the top of the appearance tab: a blocked theme disappears from the game for everyone
// (owners included) and nobody can apply it. Backend: /api/admin/themes/blocked{,/save} (theme_lock.py).
// Also makes the new controls easy to find: the appearance tab is renamed "Ивент и оформления", the sidebar gets a
// "Личные боссы" item (opens the leaderboard tab where admin-personal-boss.js renders its settings and scrolls there),
// and the player card shows its "Личный босс" box on the first tab instead of "Квесты и ордера".
(() => {
 const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k != null)); return n; };
 const fail = (e) => (typeof admErr === 'function' ? admErr(e) : toast((e && e.data && e.data.message) || 'Ошибка', true));
 const LABELS = { theme_meadow: 'Поляна', theme_halloween: 'Хэллоуин', theme_basement: 'Подвал', theme_hall: 'Зал' };

 function render(box, data) {
  const checks = data.themes.map(t => ({ id: t.id, input: el('input', { type: 'checkbox', checked: !!t.blocked }) }));
  const list = el('div', { className: 'adm-theme-lock' });
  for (const [i, t] of data.themes.entries()) {
   list.append(el('label', { className: 'adm-form' }, checks[i].input, el('span', { textContent: ' Скрыть «' + (LABELS[t.id] || t.name) + '»' })));
  }
  const save = el('button', { type: 'button', className: 'primary', textContent: 'Сохранить' });
  save.onclick = async () => {
   save.disabled = true;
   try {
    const next = await api('/api/admin/themes/blocked/save', { blocked: checks.filter(c => c.input.checked).map(c => c.id) });
    toast('Сохранено — изменения увидят при следующем обновлении игры');
    render(box, next);
   } catch (e) { fail(e); save.disabled = false; }
  };
  box.replaceChildren(
   el('h3', { textContent: '🎨 Скрытые оформления' }),
   el('p', { className: 'muted', textContent: 'Скрытое оформление пропадает из игры и лавки у всех, даже у тех, кто его получил, — применить его нельзя. Игроки с этим оформлением автоматически переходят на другое доступное (во время ивента — на Хэллоуин). Хотя бы одно оформление должно остаться.' }),
   list, el('div', { className: 'adm-form' }, save));
 }

 async function load(box) {
  box.replaceChildren(el('h3', { textContent: '🎨 Скрытые оформления' }), el('p', { className: 'muted', textContent: 'Загрузка…' }));
  try { render(box, await api('/api/admin/themes/blocked')); } catch (e) { fail(e); }
 }

 function initThemes() {
  const root = document.getElementById('admAppearance');
  if (!root) return;
  const box = el('div', { className: 'adm-box', id: 'admThemeLock' });
  root.prepend(box);
  let shown = false;
  const sync = () => { const now = !root.hidden; if (now && !shown) load(box); shown = now; };
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  sync();
 }

 function initNav() {
  const tabs = document.getElementById('admTabs');
  if (!tabs) return;
  const appearance = tabs.querySelector('button[data-tab="appearance"] .nav-tx');
  if (appearance) appearance.textContent = 'Ивент и оформления';
  const season = tabs.querySelector('button[data-tab="season"]');
  if (!season || tabs.querySelector('#admNavBoss')) return;
  // A section of its own, tab id "bosses": opens the leaderboard tab (that is where admin-personal-boss.js renders
  // #pbAdmin) but shows only the boss box, with its own title. admShow is wrapped so the id works from the menu,
  // the search (admin-ui.js indexes #admTabs buttons by data-tab) and anywhere else that calls admShow.
  document.head.append(el('style', { textContent: '#admSeason.pb-only>:not(#pbAdmin):not(#pbLoading){display:none!important}' }));
  const boss = el('button', { type: 'button', id: 'admNavBoss' },
   el('span', { className: 'nav-ic', textContent: '☠', ariaHidden: 'true' }), el('span', { className: 'nav-tx', textContent: 'Личные боссы' }));
  boss.dataset.tab = 'bosses';
  const leave = () => {
   const s = document.getElementById('admSeason');
   s?.classList.remove('pb-only');
   document.getElementById('pbLoading')?.remove();
   boss.classList.remove('on'); boss.setAttribute('aria-current', 'false');
  };
  const originalShow = window.admShow;
  if (typeof originalShow !== 'function') return;
  window.admShow = function (tab) {
   if (tab === 'bosses') return openBosses();
   leave();
   return originalShow.call(this, tab || 'overview');
  };
  admShow = window.admShow; // eslint-disable-line no-global-assign
  boss.onclick = () => admShow('bosses');
  function openBosses() {
   originalShow('season');
   const s = document.getElementById('admSeason');
   if (!s) return;
   s.classList.add('pb-only');
   season.classList.remove('on'); season.setAttribute('aria-current', 'false');
   boss.classList.add('on'); boss.setAttribute('aria-current', 'page');
   const title = document.getElementById('admTitle'); if (title) title.textContent = 'Личные боссы';
   const sub = document.getElementById('pageSubtitle'); if (sub) sub.textContent = 'Настройки, ручной призыв и активные боссы';
   if (!document.getElementById('pbAdmin') && !document.getElementById('pbLoading')) {
    const wait = el('div', { className: 'adm-box', id: 'pbLoading' }, el('p', { className: 'muted', textContent: 'Загружаем личных боссов…' }));
    s.prepend(wait);
    const watch = new MutationObserver(() => { if (document.getElementById('pbAdmin')) { wait.remove(); watch.disconnect(); } });
    watch.observe(s, { childList: true });
    setTimeout(() => { if (wait.isConnected) { watch.disconnect(); wait.firstChild.textContent = 'Не удалось загрузить личных боссов. Обновите страницу.'; } }, 12000);
   }
   window.scrollTo(0, 0);
  };
  season.after(boss);
 }

 // "Оформления игрока" in the player card: hide themes for this one player (/api/admin/user/themes{,/save})
 function renderUserThemes(box, key, data) {
  const cur = data.current ? 'theme_' + data.current : '';
  const rows = data.themes.map(t => ({ t, input: el('input', { type: 'checkbox', checked: !!(t.blocked || t.blocked_all), disabled: !!t.blocked_all }) }));
  const list = el('div', { className: 'adm-theme-lock' });
  for (const { t, input } of rows) {
   const notes = [t.owned ? 'есть у игрока' : 'нет у игрока', t.id === cur ? 'сейчас включено' : '', t.blocked_all ? 'скрыто для всех' : ''].filter(Boolean).join(', ');
   list.append(el('label', { className: 'adm-form' }, input, el('span', { textContent: ' Скрыть «' + (LABELS[t.id] || t.name) + '»' }), el('small', { className: 'muted', textContent: ' — ' + notes })));
  }
  const save = el('button', { type: 'button', className: 'primary', textContent: 'Сохранить для игрока' });
  save.onclick = async () => {
   save.disabled = true;
   try {
    const next = await api('/api/admin/user/themes/save', { key, blocked: rows.filter(r => r.input.checked && !r.t.blocked_all).map(r => r.t.id) });
    toast('Оформления игрока сохранены');
    renderUserThemes(box, key, next);
   } catch (e) { fail(e); save.disabled = false; }
  };
  box.replaceChildren(el('h3', { textContent: '🎨 Оформления игрока' }),
   el('p', { className: 'muted', textContent: 'Скрытое оформление пропадает у этого игрока из выбора и лавки, применить его он не сможет. Если оно сейчас включено — игрок перейдёт на другое доступное.' }),
   list, el('div', { className: 'adm-form' }, save));
 }
 async function userThemesBox(pane, key) {
  const box = el('div', { className: 'adm-box', id: 'admUserThemes' }, el('h3', { textContent: '🎨 Оформления игрока' }), el('p', { className: 'muted', textContent: 'Загрузка…' }));
  box.dataset.key = key;
  pane.append(box);
  try {
   const data = await api('/api/admin/user/themes', { key });
   if (box.isConnected && box.dataset.key === key) renderUserThemes(box, key, data);
  } catch (e) { fail(e); }
 }

 // the first card tab gets the per-player controls: "Личный босс" (admin-personal-boss.js, which admin-ui.js
 // would otherwise file under "Квесты и ордера") and "Оформления игрока"
 const renderUser = window.admRenderUser;
 if (typeof renderUser === 'function') {
  window.admRenderUser = function (u) {
   renderUser.apply(this, arguments);
   try {
    const root = document.getElementById('admUser');
    const panes = root ? root.querySelectorAll(':scope > .ud-pane') : [];
    if (!panes[0]) return;
    const box = [...root.querySelectorAll('.adm-box')].find(b => (b.querySelector('h3')?.textContent || '').trim() === 'Личный босс');
    if (box && box.parentElement !== panes[0]) panes[0].prepend(box);
    if (u && u.key) userThemesBox(panes[0], u.key);
   } catch (e) { console.error(e); }
  };
 }

 const init = () => { initThemes(); initNav(); };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
