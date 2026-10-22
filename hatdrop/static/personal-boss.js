'use strict';
// Personal boss on the player side: spawn notice with rules, HP bar the skeleton hangs on, countdown,
// hit / death animations and the reward window. Data: state.personal_boss and /api/state/personal-boss.
(() => {
 // the game script runs in a closure; it hands this file what it needs as window.HatDrop (end of the game script in index.html)
 const HD = window.HatDrop;
 if (!HD) return;
 const T = (s, v) => { try { return HD.tr(s, v); } catch (_) { return s; } };
 const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
 const num = (n, d = 2) => { try { return HD.fmt(n, d); } catch (_) { return (+n).toFixed(d); } };
 const busyGame = () => { try { return HD.busy(); } catch (_) { return false; } };
 const otherModal = () => [...document.querySelectorAll('.modal:not([hidden])')].some((m) => !m.classList.contains('pb-modal'));
 const reduced = () => document.documentElement.dataset.optimized === 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches;

 // ---------- pixel art (viewBox 0 0 76 100 = 38x50 cells of 2 units; the bar top sits at y=38) ----------
 const PAL = { K: '#22140c', W: '#efe4c8', S: '#bfae86', D: '#1a0d07', E: '#ff9a2a', Y: '#fff3b0', L: '#fffaf0' };
 const sprite = (rows, ox, oy, px = 2) => rows.map((row, r) => {
  let out = '';
  for (let i = 0; i < row.length;) {
   const c = row[i]; let j = i; while (j < row.length && row[j] === c) j++;
   if (c !== '.') out += `<rect${c === 'E' || c === 'Y' ? ' class="pb-eye"' : ''} x="${ox + i * px}" y="${oy + r * px}" width="${(j - i) * px}" height="${px}" fill="${PAL[c]}"/>`;
   i = j;
  }
  return out;
 }).join('');
 const SKULL = ['....KKKKKK....', '..KKWWWWWWKK..', '.KWLLWWWWWWWK.', 'KWLWWWWWWWWWSK', 'KWWWWWWWWWWWSK', 'KWDDDDWWDDDDSK', 'KWDEEDWWDEEDSK',
  'KWDEYDWWDYEDSK', 'KWDDDDWWDDDDSK', 'KSWWWWKKWWWWSK', '.KSWWWKKWWWSK.', '.KSSWWWWWWSSK.', '..KWKWKWKWKWK.'];
 const JAW = ['KWKWKWKWKWKK', 'KSWWWWWWWWSK', '.KSSWWWWSSK.', '..KKKKKKKK..'];
 const CRACK = ['K.', '.K', 'K.', '.K'];
 const TORSO = ['.KKKKKKKKKKKKKKKK.', 'KWWWWWWWWWWWWWWWWK', '.KKKKKKKWWKKKKKKK.', '..KWWWWKWWKWWWWK..', '.KWKKKKKWWKKKKKWK.', '.KWK...KWWK...KWK.',
  '..KWWWWKWWKWWWWK..', '.KWKKKKKWWKKKKKWK.', '.KWK...KWWK...KWK.', '..KWWWWKWWKWWWWK..', '...KKKKKWWKKKKK...', '.......KWWK.......', '.......KWWK.......',
  '....KKKKWWKKKK....', '...KWWWWWWWWWWK...', '...KWDDWWWWDDWK...', '....KWWK..KWWK....', '.....KK....KK.....'];
 const LEGS = ['..KWK..KWK..', '..KWK..KWK..', '..KWK..KWK..', '..KWK..KWK..', '.KWWK..KWWK.', '..KWK..KWK..', '..KWK..KWK..', '..KWK..KWK..',
  '..KWK..KWK..', '.KWWK..KWWK.', 'KWWWK..KWWWK', 'KKKKK..KKKKK'];
 const ARM = ['..K.K.K....', '..KWKWKWK..', '..KWWWWWK..', '...KWWWK...', '....KWK....', '....KWK....', '....KWK....', '....KWWK...', '.....KWWK..',
  '......KWWK.', '.......KWWK', '........KWK', '........KWK', '........KWK'];
 const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));
 const HAND = ['..KKKKK..', '.KWWWWWK.', 'KWWSWSWWK', 'KWKWKWKWK', 'KWKWKWKWK', 'KWKWKWKWK', '.K.K.K.K.'];
 function skeleton(cls, withArms = false, viewBox = '0 0 76 100') {
  return `<svg class="${cls} pb-skel" viewBox="${viewBox}" aria-hidden="true" shape-rendering="crispEdges">
<g class="pb-mantle">
<path fill="#100e1c" d="M24 32H52V40H58V56H62V78H68V92H58V98H50V92H42V98H32V92H24V98H14V90H8V78H14V54H18V40H24Z"/>
<path fill="#30213d" d="M24 38H52V46H56V66H60V86H54V92H48V86H40V92H34V86H26V92H18V86H14V78H20V52H24Z"/>
<path fill="#4b3052" d="M24 42H30V58H26V76H22V86H18V78H22V56H24ZM48 42H52V62H56V82H52V76H48Z"/>
<path fill="#1d182c" d="M32 54H44V88H40V92H34V86H30Z"/>
<path fill="#94603b" d="M14 86H18V90H24V94H28V90H34V94H40V90H46V94H52V90H58V86H62V90H60V94H54V98H48V94H42V98H32V94H26V98H20V94H14Z"/>
</g>
${withArms ? `<g class="pb-scythe"><path fill="#17101a" d="M62 8H68V94H62Z"/><path fill="#805039" d="M64 10H66V92H64Z"/><path fill="#dfad62" d="M62 24H68V28H62ZM62 70H68V74H62Z"/><path fill="#130f1c" d="M30 4H60V8H70V14H74V36H70V26H66V20H58V16H36V20H24V16H28Z"/><path fill="#c6c3b2" d="M32 6H58V10H68V16H70V26H68V20H62V16H54V12H34V16H28V14H30Z"/><path fill="#fff0cb" d="M32 6H58V8H34V12H30V14H28V12H32Z"/><path fill="#746c79" d="M36 12H54V14H58V16H36Z"/></g>` : ''}
<g class="pb-legs">${sprite(LEGS, 26, 74)}</g>
<g class="pb-torso"><path fill="#16101e" d="M22 38H54V46H50V68H26V46H22Z"/>${sprite(TORSO.slice(0, 11), 20, 38)}<path fill="#8e5436" d="M20 40H28V44H34V48H42V44H48V40H56V44H50V48H44V52H32V48H26V44H20Z"/><path fill="#edb65c" d="M34 47H42V55H34Z"/><path fill="#7e362e" d="M36 49H40V53H36Z"/></g>
${withArms ? `<g class="pb-armsbig"><path fill="#15101f" d="M18 38H24V46H20V62H14V72H4V64H8V48H12V42H18ZM52 38H58V44H62V54H68V68H58V58H54V48H52Z"/><path fill="#4b3052" d="M14 44H20V48H16V62H12V66H8V62H12V48H14ZM56 44H60V56H64V62H60V56H56Z"/>${sprite(HAND, 2, 64, 1)}${sprite(HAND, 58, 61, 1)}</g>` : ''}
<g class="pb-head"><path fill="#100d19" d="M28 0H48V4H54V10H58V24H56V36H50V40H24V36H20V14H22V8H26V4H28Z"/><path fill="#48304f" d="M28 6H34V4H46V8H52V14H54V30H50V18H46V12H32V16H26V30H24V14H28Z"/><path fill="#795055" d="M28 8H32V6H44V8H34V12H30V16H26V22H24V14H28Z"/>${sprite(SKULL, 24, 6)}<path fill="#281c32" d="M26 8H50V12H54V18H50V16H44V14H30V18H24V14H26Z"/><path fill="#c38a47" d="M26 12H30V14H26ZM48 14H52V16H48Z"/><g class="pb-crack">${sprite(CRACK, 42, 8)}</g></g>
<g class="pb-jaw">${sprite(JAW, 26, 30)}</g>
</svg>`;
 }
 const HANDS = `<svg class="pb-hands" viewBox="0 0 96 18" aria-hidden="true" shape-rendering="crispEdges"><g>${sprite(HAND, 9, 0)}</g><g>${sprite(HAND, 69, 0)}</g></svg>`;
 const WISP = `<svg class="pb-wisp" viewBox="0 0 30 44" aria-hidden="true"><path d="M15 2C6 2 3 10 3 18v20l4-4 4 5 4-5 4 5 4-5 4 4V18C27 10 24 2 15 2Z" fill="#e8f4ff" opacity=".85"/><circle cx="11" cy="16" r="2" fill="#2a1a3a"/><circle cx="19" cy="16" r="2" fill="#2a1a3a"/><ellipse cx="15" cy="23" rx="2" ry="2.6" fill="#2a1a3a"/></svg>`;

 // ---------- state ----------
 let view = null, skew = 0, lastId = '', lastRemaining = null, introFor = '', resultFor = '', dyingFor = '', pollTimer = 0, polling = false, hudShown = null;

 const left = () => view ? Math.max(0, view.end - (Date.now() / 1000 + skew)) : 0;
 const clock = (s) => { s = Math.ceil(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
 const durationText = (v) => { const m = Math.round((v.end - v.start) / 60); return m % 60 === 0 ? (m === 60 ? T('1 час') : T('{n} ч', { n: m / 60 })) : T('{n} мин', { n: m }); };
 const rateText = (v) => { const u = +(v.rates?.upgrade ?? 1), c = +(v.rates?.chests ?? 1); return u === 1 && c === 1 ? T('1 GRAM ставки = 1 HP урона') : T('1 GRAM ставки = 1 HP урона (апгрейды ×{u}, сундуки ×{c})', { u, c }); };

 function hud() {
  let node = document.getElementById('pbHud');
  if (node) return node;
  const host = document.getElementById('view-upgrade');
  if (!host) return null;
  node = document.createElement('div');
  node.id = 'pbHud'; node.hidden = true;
  node.innerHTML = `<div class="pb-row"><span class="pb-title">☠ ${esc(T('Личный босс'))}</span><span class="pb-timer"></span></div>${skeleton('pb-body')}<div class="pb-bar" role="progressbar" aria-label="${esc(T('HP личного босса'))}" aria-valuemin="0"><i class="pb-ghost"></i><i class="pb-fill"></i><span class="pb-hp"></span></div>${HANDS}<div class="pb-reward"><img alt="" decoding="async"><span></span></div><button class="pb-info" type="button" aria-label="${esc(T('Правила личного босса'))}">?</button>`;
  node.querySelector('.pb-info').onclick = () => view && openIntro(view, true);
  const live = document.getElementById('bossLiveHud');
  if (live && live.parentNode === host) live.after(node); else host.prepend(node);
  return node;
 }
 function chip() {
  let node = document.getElementById('pbChip');
  if (node) return node;
  node = document.createElement('button');
  node.id = 'pbChip'; node.type = 'button'; node.hidden = true;
  node.innerHTML = `${skeleton('pb-chip-skull', false, '20 2 36 38')}<span><b>${esc(T('Личный босс'))}</b><br><span class="pb-chip-time"></span></span>`;
  node.onclick = () => { try { HD.showView('upgrade'); } catch (_) {} };
  document.body.append(node);
  return node;
 }
 function setHudVisible(on) {
  const node = hud(); if (!node) return;
  if (node.hidden === !on && hudShown === on) return;
  node.hidden = !on; hudShown = on;
  try { HD.fitUpgrade(); } catch (_) {}
 }

 function paintBar(v) {
  const node = hud(); if (!node) return;
  const frac = v.hp > 0 ? Math.max(0, Math.min(1, v.remaining / v.hp)) : 0;
  node.querySelector('.pb-fill').style.transform = `scaleX(${frac})`;
  node.querySelector('.pb-ghost').style.transform = `scaleX(${frac})`;
  node.querySelector('.pb-hp').textContent = `${num(v.remaining, 2)} / ${num(v.hp, 0)} HP`;
  const bar = node.querySelector('.pb-bar'); bar.setAttribute('aria-valuemax', v.hp); bar.setAttribute('aria-valuenow', v.remaining);
  node.classList.toggle('low', frac < .3);
  const img = node.querySelector('.pb-reward img'); if (img.getAttribute('src') !== v.reward.image) img.src = v.reward.image;
  node.querySelector('.pb-reward span').textContent = v.reward.name;
 }

 function playHit(amount) {
  const node = hud(); if (!node || node.hidden) return;
  node.classList.remove('hit'); void node.offsetWidth; node.classList.add('hit');
  setTimeout(() => node.classList.remove('hit'), 420);
  const pop = document.createElement('span'); pop.className = 'pb-dmg'; pop.textContent = '−' + num(amount, 2) + ' HP';
  node.append(pop); setTimeout(() => pop.remove(), 1200);
  try { HD.haptic('impact', 'light'); } catch (_) {}
 }

 function tick() {
  const node = document.getElementById('pbHud'), c = document.getElementById('pbChip');
  if (!view || view.status !== 'active') { if (c) c.hidden = true; return; }
  const s = left(), text = clock(s);
  if (node) { const t = node.querySelector('.pb-timer'); t.textContent = '⏳ ' + text; t.classList.toggle('urgent', s < 300); }
  document.querySelectorAll('[data-pb-left]').forEach((e) => { e.textContent = text; });
  const onUpgrade = !document.getElementById('view-upgrade')?.hidden;
  const box = chip(); box.hidden = onUpgrade || otherModal(); box.querySelector('.pb-chip-time').textContent = text;
  if (s <= 0) poll(true);
 }

 // ---------- modals ----------
 function modal(id, cls, inner) {
  document.getElementById(id)?.remove();
  const node = document.createElement('div');
  node.id = id; node.className = `modal pb-modal ${cls}`; node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true');
  node.innerHTML = `<div class="modal-card">${inner}</div>`;
  document.body.append(node);
  return node;
 }
 const dirt = () => Array.from({ length: 8 }, (_, i) => `<i class="pb-dirt" style="--x:${(i % 2 ? 1 : -1) * (14 + i * 9)}px;--y:${-40 - (i * 13) % 50}px;--d:${(i * .07).toFixed(2)}s;margin-left:${(i - 4) * 6}px"></i>`).join('');
 const award = (a, i) => `<div class="pb-award" style="--i:${i}"><img src="${esc(a.image)}" alt=""><span>${esc(a.name)}</span>${a.value != null ? `<small>≈ ${esc(num(a.value, 2))} GRAM</small>` : ''}${a.already ? `<small>${esc(T('уже в коллекции'))}</small>` : ''}</div>`;
 const rewardCards = (v) => [{ name: v.reward.name, image: v.reward.image, value: v.reward.value }, ...(v.hand ? [{ name: v.hand.name, image: v.hand.image }] : [])].map(award).join('');

 function openIntro(v, rules = false) {
  introFor = v.id;
  const node = modal('pbIntro', 'pb-intro', `
   <div class="pb-scene"><i class="pb-moon"></i>${skeleton('pb-big', true)}${dirt()}</div>
   <span class="pb-kicker">${esc(T('ВСТРЕЧА НА КЛАДБИЩЕ'))}</span>
   <h2>${esc(rules ? T('Правила личного босса') : T('Появился личный босс!'))}</h2>
   <p class="pb-countdown">${esc(T('Осталось'))}: <b data-pb-left>${clock(left())}</b></p>
   <div class="pb-rules"><ul>
    <li>${esc(T('Скелет-Жнец пришёл только за тобой — у других игроков его нет.'))}</li>
    <li>${esc(T('Здоровье босса: {hp} HP. Каждая ставка в апгрейдах и сундуках бьёт его:', { hp: num(v.hp, 0) }))} ${esc(rateText(v))}.</li>
    <li>${esc(T('Победи его за {time} — иначе он уйдёт вместе с наградой.', { time: durationText(v) }))}</li>
    <li>${esc(T('Здоровье и таймер видны над колесом апгрейда.'))}</li>
   </ul></div>
   <p>${esc(T('Награда за победу:'))}</p>
   <div class="pb-awards">${rewardCards(v)}</div>
   <div class="pb-actions"><button class="cta" type="button" data-pb-go>${esc(rules ? T('Понятно') : T('В бой!'))}</button></div>`);
  node.querySelector('[data-pb-go]').onclick = async () => {
   node.remove();
   if (!v.intro_seen) { v.intro_seen = true; try { await HD.api('/api/personal-boss/ack', { id: v.id, kind: 'intro' }); } catch (_) {} }
   try { HD.showView('upgrade'); } catch (_) {}
  };
  if (!rules) { try { HD.haptic('notification', 'warning'); } catch (_) {} }
  node.querySelector('[data-pb-go]').focus();
 }

 function openResult(v) {
  resultFor = v.id;
  const won = v.status === 'defeated';
  const node = modal('pbResult', won ? 'pb-win' : 'pb-gone', won ? `
   <div class="pb-scene"><i class="pb-rays"></i>${skeleton('pb-big', true)}${WISP}</div>
   <h2>${esc(T('Босс повержен!'))}</h2>
   <p>${esc(T('Скелет рассыпался. Награды уже твои: подарок — в инвентаре, снаряжение — в коллекции.'))}</p>
   <div class="pb-awards">${(v.awards || []).map(award).join('')}</div>
   <div class="pb-actions"><button class="cta" type="button" data-pb-claim>${esc(T('Забрать'))}</button></div>` : `
   <div class="pb-scene"><i class="pb-moon"></i>${skeleton('pb-big', true)}</div>
   <h2>${esc(T('Босс ушёл'))}</h2>
   <p>${esc(T('Время вышло — скелет скрылся вместе с наградой. Следующий личный босс появится в случайный момент.'))}</p>
   <div class="pb-actions"><button class="cta" type="button" data-pb-claim>${esc(T('Понятно'))}</button></div>`);
  const button = node.querySelector('[data-pb-claim]');
  button.onclick = async () => {
   button.disabled = true;
   try {
    const r = await HD.api('/api/personal-boss/ack', { id: v.id, kind: 'result' });
    node.remove(); view = r.personal_boss; if (HD.state) HD.state.personal_boss = view;
    if (won) { try { await HD.refresh(); } catch (_) {} }
   } catch (_) { button.disabled = false; try { HD.toast(T('Не удалось подтвердить. Попробуйте ещё раз.')); } catch (__) {} }
  };
  try { HD.haptic('notification', won ? 'success' : 'error'); } catch (_) {}
  button.focus();
 }

 function finishInHud(v) {
  dyingFor = v.id;
  const node = hud();
  const onUpgrade = node && !document.getElementById('view-upgrade')?.hidden && !node.hidden;
  if (!onUpgrade || reduced()) { setHudVisible(false); openResult(v); return; }
  paintBar({ ...v, remaining: 0 });
  node.classList.add('dying');
  setTimeout(() => { node.classList.remove('dying'); setHudVisible(false); openResult(v); }, 1750);
 }

 // ---------- main render ----------
 function render(v, fresh = true) {
  if (v && fresh && v.now) skew = v.now - Date.now() / 1000;
  view = v || null;
  if (!view) { setHudVisible(false); tick(); schedule(); return; }
  if (view.status === 'active') {
   hud();
   if (!document.getElementById('pbHud')?.classList.contains('dying')) setHudVisible(true);
   paintBar(view);
   if (lastId === view.id && lastRemaining != null && view.remaining < lastRemaining - 1e-9) playHit(lastRemaining - view.remaining);
   if (!view.intro_seen && introFor !== view.id) {
    if (!otherModal() && !busyGame()) openIntro(view);
   }
  } else if (resultFor !== view.id && dyingFor !== view.id) {
   if (busyGame() || otherModal()) setTimeout(() => { if (view && view.id === v.id) render(view, false); }, 600);
   else if (view.status === 'defeated') finishInHud(view);
   else { setHudVisible(false); openResult(view); }
  }
  lastId = view.id; lastRemaining = view.status === 'active' ? view.remaining : 0;
  tick(); schedule();
 }

 async function poll(now = false) {
  if (polling || (document.hidden && !now)) return schedule();
  polling = true;
  try { const r = await HD.api('/api/state/personal-boss'); if (HD.state) HD.state.personal_boss = r.personal_boss; render(r.personal_boss); }
  catch (_) { schedule(); }
  finally { polling = false; }
 }
 function schedule() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, view && view.status === 'active' ? 4000 : 20000);
 }

 // the game calls this after every state render (refresh() after every round)
 HD.onState = (s) => { try { if (s && 'personal_boss' in s) render(s.personal_boss); } catch (e) { console.error(e); } };
 setInterval(tick, 1000);
 document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(true); });
 try { const s = HD.state; if (s && 'personal_boss' in s) render(s.personal_boss); else poll(true); } catch (_) { poll(true); }
})();
