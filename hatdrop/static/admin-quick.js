'use strict';
/* "Быстрое управление" on top of the Overview tab: maintenance, game sections, the Halloween event
   and the admin action log. Every switch saves at once. Uses the shared api/$/toast/admErr helpers. */
const QUICK_SECTION_NAMES = { upgrade: 'Апгрейды', chests: 'Мины / Сундуки', leaders: 'Лидеры', quests: 'Лавка Костяна', staking: 'Стейкинг' };
const QUICK_LOG_NAMES = {
  'sections/save': 'Разделы игры', maintenance: 'Техработы', theme: 'Событие', event: 'Событие', balance: 'Баланс игрока',
  'user/flags': 'Флаги игрока', 'user/hatcoin': 'HatCoin игрока', 'withdrawals/resolve': 'Вывод', 'promos/create': 'Новый промокод',
  'promos/update': 'Промокод', 'quests/save': 'Задания', 'shop/save': 'Лавка', 'rtp/save': 'RTP', 'finance/entry': 'Финансы',
  'bot/messages/save': 'Тексты бота', 'admins/save': 'Админы', 'backup/restore': 'Восстановление базы', 'weapons/save': 'Оружие',
};
let quickBusy = false;

function quickEl(tag, props = {}, ...kids) { const el = document.createElement(tag); Object.assign(el, props); el.append(...kids); return el; }
function quickAgo(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return 'только что';
  if (s < 3600) return Math.floor(s / 60) + ' мин назад';
  if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
  return new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function quickDetails(row) {
  const d = row.details || {};
  if (d.sections && typeof d.sections === 'object') return Object.entries(d.sections).map(([k, v]) => `${QUICK_SECTION_NAMES[k] || k}: ${v ? 'открыт' : 'скрыт'}`).join(', ');
  if (row.path === 'maintenance') return 'enabled' in d ? (d.enabled ? 'включены' : 'выключены') : 'текст изменён';
  if (d.action) return { start: 'запущено', finish: 'завершено', save: 'настройки сохранены' }[d.action] || d.action;
  return Object.entries(d).map(([k, v]) => v === '…' ? k : `${k}: ${v}`).join(', ');
}

function quickShell() {
  let box = $('quickPanel');
  if (box) return box;
  box = quickEl('article', { id: 'quickPanel', className: 'panel quick-panel' });
  box.innerHTML = `
    <h2>Быстрое управление</h2>
    <div class="quick-grid">
      <section class="quick-card" id="quickMaint">
        <h3>Технические работы</h3>
        <p class="quick-state" id="quickMaintState">…</p>
        <input id="quickMaintText" maxlength="300" placeholder="Текст для игроков (необязательно)">
        <button type="button" class="button" id="quickMaintBtn">…</button>
      </section>
      <section class="quick-card" id="quickEvent">
        <h3>Событие «Хеллоуин»</h3>
        <p class="quick-state" id="quickEventState">…</p>
        <button type="button" class="button" id="quickEventBtn">…</button>
      </section>
      <section class="quick-card quick-wide">
        <h3>Разделы игры <small>нажмите, чтобы открыть или скрыть</small></h3>
        <div class="quick-chips" id="quickSections"></div>
      </section>
      <section class="quick-card quick-wide">
        <h3>Журнал действий <button type="button" class="quick-link" id="quickLogMore">показать всё</button></h3>
        <ol class="quick-log" id="quickLog"><li class="quick-muted">…</li></ol>
      </section>
    </div>`;
  $('admOverview').prepend(box);
  $('quickMaintBtn').onclick = quickToggleMaint;
  $('quickEventBtn').onclick = quickToggleEvent;
  $('quickLogMore').onclick = () => { box.dataset.full = box.dataset.full === '1' ? '0' : '1'; quickLoadLog(); };
  return box;
}

function quickRenderMaint(m) {
  const box = $('quickMaint'); box.dataset.on = String(!!m.enabled);
  $('quickMaintState').textContent = m.enabled ? '● Включены — игроки видят экран техработ' : '● Выключены — игра работает';
  if (document.activeElement !== $('quickMaintText')) $('quickMaintText').value = m.text || '';
  $('quickMaintBtn').textContent = m.enabled ? 'Выключить техработы' : 'Включить техработы';
  $('quickMaintBtn').className = m.enabled ? 'button primary' : 'button';
}
async function quickToggleMaint() {
  if (quickBusy) return;
  const on = $('quickMaint').dataset.on !== 'true';
  if (on && !confirm('Включить техработы? Игроки увидят экран «Технические работы» и не смогут играть.')) return;
  quickBusy = true; $('quickMaintBtn').disabled = true;
  try { quickRenderMaint(await api('/api/admin/maintenance', { enabled: on, text: $('quickMaintText').value })); toast(on ? 'Техработы включены' : 'Техработы выключены'); quickLoadLog(); }
  catch (e) { admErr(e); } finally { quickBusy = false; $('quickMaintBtn').disabled = false; }
}

function quickRenderEvent(ev) {
  const box = $('quickEvent'); box.dataset.on = String(!!ev.enabled);
  let state = ev.enabled ? '● Идёт' : '● Не запущено';
  if (ev.enabled && ev.remaining_seconds) { const h = Math.floor(ev.remaining_seconds / 3600), m = Math.floor(ev.remaining_seconds % 3600 / 60); state += ` · осталось ${h} ч ${m} мин`; }
  if (ev.quest_count != null) state += ` · заданий: ${ev.quest_count}`;
  $('quickEventState').textContent = state;
  $('quickEventBtn').textContent = ev.enabled ? 'Завершить событие' : 'Запустить событие';
  $('quickEventBtn').className = ev.enabled ? 'button' : 'button primary';
}
async function quickToggleEvent() {
  if (quickBusy) return;
  const on = $('quickEvent').dataset.on !== 'true';
  if (!confirm(on ? 'Запустить событие «Хеллоуин» для всех игроков?' : 'Завершить событие «Хеллоуин»? Событийные задания и предложения будут убраны.')) return;
  quickBusy = true; $('quickEventBtn').disabled = true;
  try { quickRenderEvent(await api('/api/admin/event', { id: 'halloween', action: on ? 'start' : 'finish' })); toast(on ? 'Событие запущено' : 'Событие завершено'); quickLoadLog(); }
  catch (e) { admErr(e); } finally { quickBusy = false; $('quickEventBtn').disabled = false; }
}

function quickRenderSections(r) {
  const root = $('quickSections'); root.replaceChildren();
  for (const key of Object.keys(r.labels)) {
    const on = r.sections[key] !== false;
    const chip = quickEl('button', { type: 'button', className: 'quick-chip' + (on ? ' on' : ''), textContent: `${on ? '●' : '○'} ${QUICK_SECTION_NAMES[key] || r.labels[key]}` });
    chip.title = on ? 'Открыт для игроков — нажмите, чтобы скрыть' : 'Скрыт: у игроков «В разработке» — нажмите, чтобы открыть';
    chip.onclick = async () => {
      if (quickBusy) return; quickBusy = true; chip.disabled = true;
      try { const res = await api('/api/admin/sections/save', { sections: { [key]: !on } }); quickRenderSections({ ...r, sections: res.sections }); toast(`${QUICK_SECTION_NAMES[key] || key}: ${!on ? 'открыт' : 'скрыт'}`); quickLoadLog(); }
      catch (e) { admErr(e); } finally { quickBusy = false; chip.disabled = false; }
    };
    root.append(chip);
  }
}

async function quickLoadLog() {
  try {
    const full = $('quickPanel').dataset.full === '1';
    const r = await api('/api/admin/log', { limit: full ? 100 : 8 });
    const list = $('quickLog'); list.replaceChildren();
    if (!r.rows.length) { list.append(quickEl('li', { className: 'quick-muted', textContent: 'Пока пусто — здесь появятся изменения настроек.' })); return; }
    for (const row of r.rows) {
      list.append(quickEl('li', {}, quickEl('time', { textContent: quickAgo(row.ts) }), quickEl('b', { textContent: row.name }),
        quickEl('span', { textContent: `${QUICK_LOG_NAMES[row.path] || row.path}${quickDetails(row) ? ' — ' + quickDetails(row) : ''}` })));
    }
    $('quickLogMore').textContent = full ? 'свернуть' : 'показать всё';
  } catch (e) { /* the log is optional; the rest of the panel still works */ }
}

async function admQuickLoad() {
  quickShell();
  const [maint, ev, sections] = await Promise.allSettled([api('/api/admin/maintenance', {}), api('/api/admin/event', { id: 'halloween', action: 'view' }), api('/api/admin/sections')]);
  if (maint.status === 'fulfilled') quickRenderMaint(maint.value);
  if (ev.status === 'fulfilled') quickRenderEvent(ev.value);
  if (sections.status === 'fulfilled') quickRenderSections(sections.value);
  quickLoadLog();
}
