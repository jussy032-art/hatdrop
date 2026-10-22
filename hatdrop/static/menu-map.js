/* Local menu art direction. Existing section buttons retain their handlers. */
(() => {
  const menu = document.getElementById('view-menu');
  const HD = window.HatDrop;
  if (!menu || !HD) return;
  const title = menu.querySelector('.title');
  const badge = menu.querySelector('.halloween-badge');
  const boss = document.createElement('button');
  boss.type = 'button'; boss.id = 'menuPersonalBoss';
  boss.className = 'menu-card menu-wide mc-boss';
  boss.innerHTML = '<span class="mc-medal"><span class="map-gate" aria-hidden="true"></span></span><span class="mc-text"><b class="mc-title">Босс</b><small class="mc-sub">Здесь пока тихо…</small></span><span class="map-seal">ВОРОТА ЗАКРЫТЫ</span>';
  menu.querySelector('.menu-grid').append(boss);
  const footer = document.createElement('p');
  footer.className = 'map-footer'; footer.textContent = 'У каждой тропы — своя история'; menu.append(footer);
  document.getElementById('menuStaking').classList.add('mc-staking');
  const labels = {menuChests:'01 · СКЛЕП',menuLeaders:'02 · ЗАЛ СЛАВЫ',menuStaking:'03 · МАГИЧЕСКИЙ АЛТАРЬ',menuPersonalBoss:'04 · ЗА СТАРЫМИ ВОРОТАМИ'};
  for (const [id,label] of Object.entries(labels)) {
    const el = document.createElement('span'); el.className='map-location';el.textContent=label;
    document.getElementById(id).prepend(el);
  }
  let current = null;
  const countdown = () => {
    if (current?.status !== 'active') return;
    const seconds=Math.max(0,Math.ceil(current.end-Date.now()/1000));
    const time=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    boss.querySelector('.map-seal').textContent=Math.max(0,Math.ceil(current.remaining))+' HP · '+time;
    if(!seconds){boss.disabled=true;boss.classList.remove('map-boss-active');boss.querySelector('.mc-sub').textContent='Время встречи вышло'}
  };
  function sync(s) {
    const halloween = document.documentElement.dataset.halloween === 'on';
    title.textContent = halloween ? 'КЛАДБИЩЕ' : 'МЕНЮ';
    badge.textContent = 'ВЫБЕРИ СВОЙ ПУТЬ';
    const v = s?.personal_boss; current = v;
    const active = v?.status === 'active' && v.end > Date.now()/1000;
    boss.classList.toggle('map-boss-active', !!active); boss.disabled = !active;
    boss.querySelector('.mc-sub').textContent = active ? 'Твой противник уже ждёт' : 'Здесь пока тихо…';
    const seal = boss.querySelector('.map-seal');
    seal.textContent = active ? Math.max(0,Math.ceil(v.remaining))+' HP · В БОЙ' : 'ВОРОТА ЗАКРЫТЫ';
    const portrait=boss.querySelector('.map-gate');portrait.replaceChildren();
    if(active){const source=document.querySelector('#pbHud .pb-body');if(source){const art=source.cloneNode(true);art.setAttribute('class','pb-skel map-boss-portrait');portrait.append(art)}countdown()}
    if (!s) {
      const chest = document.getElementById('menuChests'); chest.hidden=false; chest.disabled=true; chest.classList.add('section-soon');
      chest.querySelector('.mc-title').textContent=halloween?'МИНЫ':'СУНДУКИ';
      chest.querySelector('.mc-sub').textContent='Склеп ещё запечатан';
      if(!chest.querySelector('.section-status')){const tag=document.createElement('span');tag.className='section-status';tag.textContent='СКОРО';chest.append(tag)}
      if(halloween) for(const [id,file] of [['menuChests','halloween-coffin-v2.png?v=2'],['menuLeaders','halloween-leaders.png?v=1'],['menuStaking','halloween-staking.png?v=1']]) document.getElementById(id).querySelector('.mc-art').src='/static/themes/menu-icons/'+file;
    }
  }
  boss.onclick=()=>{if(current?.status!=='active')return;HD.showView('upgrade');requestAnimationFrame(()=>document.querySelector('#pbHud .pb-info')?.click())};
  const prev=HD.onState; HD.onState=s=>{prev?.(s);sync(s)};
  new MutationObserver(()=>sync(HD.state)).observe(document.documentElement,{attributes:true,attributeFilter:['data-halloween']});
  sync(HD.state);
  setInterval(countdown,1000);
})();
