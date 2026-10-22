'use strict';
/* "Разделы игры" tab: a big on/off switch for the Coffins / Chests mode (saved at once),
   plus the list of all sections (saved with "Применить"). A hidden section stays in the
   players' menu greyed out with "В разработке · Скоро"; started rounds can still be finished. */
const SECTION_NAMES = { chests: 'Мины / Сундуки' };

function admChestCard(enabled) {
  let card = $('chestsSwitchCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'chestsSwitchCard';
    card.style.cssText = 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px;margin:0 0 14px;border:1px solid var(--line);border-radius:10px';
    card.innerHTML = '<div style="flex:1;min-width:200px"><b style="font-size:15px">Режим «Мины / Сундуки»</b>'
      + '<div id="chestsSwitchState" style="margin-top:4px"></div></div>'
      + '<button type="button" id="chestsSwitchBtn" class="button"></button>';
    $('sectionsForm').before(card);
    $('chestsSwitchBtn').onclick = admToggleChests;
  }
  card.dataset.enabled = String(enabled);
  card.style.background = enabled ? '#12352b' : '#3a1d22';
  $('chestsSwitchState').innerHTML = enabled
    ? '<span style="color:var(--green)">● Открыт для игроков</span>'
    : '<span style="color:var(--red)">● Скрыт: у игроков «В разработке · Скоро»</span>';
  const btn = $('chestsSwitchBtn');
  btn.textContent = enabled ? 'Скрыть режим' : 'Открыть режим';
  btn.className = enabled ? 'button' : 'button primary';
}

async function admToggleChests() {
  const card = $('chestsSwitchCard'), next = card.dataset.enabled !== 'true', btn = $('chestsSwitchBtn');
  btn.disabled = true;
  try {
    const r = await api('/api/admin/sections/save', { sections: { chests: next } });
    admChestCard(r.sections.chests);
    const box = $('sectionRows').querySelector('[data-section="chests"]');
    if (box) { box.checked = r.sections.chests; box.dispatchEvent(new Event('change')); }
    toast(r.sections.chests ? 'Режим открыт для игроков' : 'Режим скрыт: у игроков «В разработке»');
  } catch (e) { admErr(e); } finally { btn.disabled = false; }
}

async function admLoadSections() {
  try {
    const r = await api('/api/admin/sections'), root = $('sectionRows');
    root.replaceChildren();
    admChestCard(r.sections.chests !== false);
    for (const [key, label] of Object.entries(r.labels)) {
      const row = document.createElement('label'), input = document.createElement('input'), status = document.createElement('span');
      row.className = 'quest-launch';
      input.type = 'checkbox'; input.checked = r.sections[key]; input.dataset.section = key;
      status.textContent = input.checked ? 'Доступен' : 'Скоро';
      input.onchange = () => { status.textContent = input.checked ? 'Доступен' : 'Скоро'; };
      row.append(input, document.createTextNode((SECTION_NAMES[key] || label) + ' · '), status);
      root.append(row);
    }
  } catch (e) { admErr(e); }
}

document.addEventListener('DOMContentLoaded', () => {
  $('sectionsForm').onsubmit = async (e) => {
    e.preventDefault();
    const button = $('sectionsSave'); button.disabled = true;
    try {
      const sections = Object.fromEntries([...$('sectionRows').querySelectorAll('[data-section]')].map((x) => [x.dataset.section, x.checked]));
      const r = await api('/api/admin/sections/save', { sections });
      admChestCard(r.sections.chests);
      toast('Доступность разделов сохранена');
    } catch (err) { admErr(err); } finally { button.disabled = false; }
  };
});
