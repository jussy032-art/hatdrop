'use strict';
// Personal bosses + HatCoin cashback percent: appended to the "Season" tab after it renders.
(() => {
 const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k != null)); return n; };
 const when = (t) => new Date(t * 1000).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
 const fail = (e) => (typeof seErr === 'function' ? seErr(e) : toast((e && e.data && e.data.message) || 'Ошибка', true));

 async function render(root) {
  let data;
  try { data = await api('/api/admin/personal-boss'); } catch (e) { fail(e); return; }
  root.querySelector('#pbAdmin')?.remove();
  const s = data.settings, box = el('div', { className: 'adm-box', id: 'pbAdmin' }, el('h3', { textContent: 'Личные боссы и кешбек HatCoin' }));
  const num = (value, min, max, step = 'any') => el('input', { type: 'number', min, max, step, value, required: true });
  const check = (on) => el('input', { type: 'checkbox', checked: !!on });
  const f = {
   enabled: check(s.enabled), give_hand: check(s.give_hand),
   hp_min: num(s.hp_min, 1, 1000000), hp_max: num(s.hp_max, 1, 1000000),
   interval_min_h: num(s.interval_min_h, .05, 720), interval_max_h: num(s.interval_max_h, .05, 720),
   duration_min: num(s.duration_min, 1, 1440, 1), price_mult_max: num(s.price_mult_max, 1, 100),
   active_days: num(s.active_days, 1, 365, 1),
   upgrade: num(s.rates.upgrade, 0, 1000), chests: num(s.rates.chests, 0, 1000),
   cashback: num(data.hatcoin_cashback_percent, 0, 1000),
  };
  const row = (label, input, hint) => el('label', {}, label, input, hint ? el('small', { className: 'muted', textContent: ' ' + hint }) : null);
  const st = data.stats;
  box.append(
   el('p', { className: 'muted', textContent: `Сейчас активно: ${st.active} · за 24 ч побеждено: ${st.defeated_24h}, ушло: ${st.expired_24h} · игроков в расписании: ${st.scheduled}` }),
   el('h4', { textContent: 'Кешбек HatCoin' }),
   row('Процент кешбека HatCoin от ставки, %', f.cashback, 'например 10 = 0.1 HatCoin за 1 GRAM ставки'),
   el('h4', { textContent: 'Личный босс' }),
   row('Включено ', f.enabled),
   row('HP (оборот GRAM) — минимум', f.hp_min), row('HP (оборот GRAM) — максимум', f.hp_max),
   row('Интервал появления — от, часов', f.interval_min_h), row('Интервал появления — до, часов', f.interval_max_h),
   row('Время жизни босса, минут', f.duration_min),
   row('Цена NFT для максимального HP, × от самого дешёвого', f.price_mult_max),
   row('Появляется игрокам, игравшим за последние, дней', f.active_days),
   row('Множитель урона: апгрейды', f.upgrade), row('Множитель урона: сундуки', f.chests),
   row('Давать «Руку Костяна» за победу ', f.give_hand),
  );
  const preview = el('div', { className: 'tc-info' }, el('b', { textContent: 'Награды по текущим ценам: ' }));
  for (const p of data.preview) preview.append(el('div', { textContent: `${Math.round(p.hp)} HP → ${p.reward ? `${p.reward.name} (${p.reward.value} GRAM, ×${p.reward.mult})` : 'каталог не загружен'}` }));
  box.append(preview);
  const save = el('button', { type: 'button', className: 'primary', textContent: 'Сохранить' });
  save.onclick = async () => {
   save.disabled = true;
   try {
    await api('/api/admin/personal-boss/save', {
     enabled: f.enabled.checked, give_hand: f.give_hand.checked,
     hp_min: +f.hp_min.value, hp_max: +f.hp_max.value, interval_min_h: +f.interval_min_h.value, interval_max_h: +f.interval_max_h.value,
     duration_min: +f.duration_min.value, price_mult_max: +f.price_mult_max.value, active_days: +f.active_days.value,
     rates: { upgrade: +f.upgrade.value, chests: +f.chests.value }, hatcoin_cashback_percent: +f.cashback.value,
    });
    toast('Сохранено'); render(root);
   } catch (e) { fail(e); } finally { save.disabled = false; }
  };
  const key = el('input', { placeholder: 'Ключ игрока (пусто — себе)' });
  const spawn = el('button', { type: 'button', textContent: 'Призвать босса сейчас' });
  spawn.onclick = async () => { spawn.disabled = true; try { await api('/api/admin/personal-boss/spawn', key.value.trim() ? { key: key.value.trim() } : {}); toast('Босс призван'); render(root); } catch (e) { fail(e); } finally { spawn.disabled = false; } };
  box.append(el('div', { className: 'adm-form' }, save), el('h4', { textContent: 'Тест / ручной вызов' }), el('div', { className: 'adm-form' }, key, spawn));
  if (data.active.length) {
   const list = el('div');
   for (const a of data.active) {
    const cancel = el('button', { type: 'button', textContent: 'Отменить' });
    cancel.onclick = async () => { if (!confirm('Убрать босса у игрока без награды?')) return; try { await api('/api/admin/personal-boss/cancel', { key: a.key }); render(root); } catch (e) { fail(e); } };
    list.append(el('div', { className: 'adm-form' }, el('span', { textContent: `${a.name}: ${(+a.damage).toFixed(2)} / ${a.hp} HP · до ${when(a.end)} · ${a.reward}` }), cancel));
   }
   box.append(el('h4', { textContent: 'Активные личные боссы' }), list);
  }
  root.append(box);
 }

 // "Личный босс" box in the user card (user management): summon / remove for this player.
 // The title starts with "Личн", so admin-ui.js files it under the player's content tab.
 function userBox(u) {
  const pb = u.personal_boss; if (!pb) return null;
  const box = el('div', { className: 'adm-box' }, el('h3', { textContent: 'Личный босс' }));
  const a = pb.active;
  if (a) {
   const leftMin = Math.max(0, Math.ceil((a.end - pb.now) / 60));
   box.append(el('p', { textContent: `Активен: ${(+a.damage).toFixed(2)} / ${a.hp} HP · осталось ${leftMin} мин · награда: ${a.reward.name} (${a.reward.value} GRAM)` }));
  } else {
   box.append(el('p', { className: 'muted', textContent: pb.next ? `Нет активного. Следующий по расписанию: ${when(pb.next)}` : 'Нет активного. Расписание ещё не назначено (игрок неактивен или боссы выключены).' }));
  }
  if (pb.history?.length) box.append(el('p', { className: 'muted', textContent: 'Последние: ' + pb.history.map((h) => `${({ defeated: 'побеждён', expired: 'ушёл', cancelled: 'отменён' })[h.status] || h.status} ${h.hp} HP`).join(' · ') }));
  const hp = el('input', { type: 'number', min: 1, max: 1000000, step: 1, placeholder: `HP: случайно ${pb.hp_min}–${pb.hp_max}`, 'aria-label': 'HP босса' });
  const go = el('button', { type: 'button', className: 'primary', textContent: 'Призвать босса', disabled: !!a });
  go.onclick = async () => {
   go.disabled = true;
   try { const r = await api('/api/admin/personal-boss/spawn', { key: u.key, for: 'user', ...(hp.value ? { hp: Number(hp.value) } : {}) }); toast('Босс призван'); admRenderUser(r.user); }
   catch (e) { fail(e); go.disabled = false; }
  };
  const form = el('div', { className: 'adm-form' }, hp, go);
  if (a) {
   const cancel = el('button', { type: 'button', textContent: 'Убрать босса' });
   cancel.onclick = async () => { if (!confirm('Убрать босса у игрока без награды?')) return; cancel.disabled = true; try { const r = await api('/api/admin/personal-boss/cancel', { key: u.key, for: 'user' }); toast('Босс убран'); admRenderUser(r.user); } catch (e) { fail(e); cancel.disabled = false; } };
   form.append(cancel);
  }
  box.append(form, el('p', { className: 'muted', textContent: 'Награда считается по HP: самый дешёвый NFT за минимум HP, дороже — к максимуму (настройки во вкладке «Сезон»).' }));
  return box;
 }
 const renderUser = window.admRenderUser;
 if (typeof renderUser === 'function') {
  window.admRenderUser = function (u) {
   renderUser.apply(this, arguments);
   try { const box = userBox(u); if (box) document.getElementById('admUser')?.append(box); } catch (e) { console.error(e); }
  };
 }

 const original = window.admLoadSeason;
 if (typeof original !== 'function') return;
 window.admLoadSeason = async function () { await original.apply(this, arguments); const root = document.getElementById('admSeason'); if (root) render(root); };
 // admin-management.js calls admLoadSeason by its global name; function declarations are writable globals
 admLoadSeason = window.admLoadSeason; // eslint-disable-line no-global-assign
})();
