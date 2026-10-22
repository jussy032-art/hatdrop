(() => {
 'use strict';
 const root=document.documentElement,host=document.querySelector('.bg-wide');if(!host)return;
 const scene=document.createElement('div');scene.id='basementScene';scene.setAttribute('aria-hidden','true');
 scene.innerHTML='<div id="basementWorld"><img class="basement-dim" alt="" decoding="async"><img class="basement-lit" alt="" decoding="async"></div>';
 host.appendChild(scene);
 const world=scene.firstElementChild,NS='http://www.w3.org/2000/svg';
 const button=document.getElementById('skyBtn');
 const icon=document.createElementNS(NS,'svg');icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('aria-hidden','true');icon.setAttribute('shape-rendering','crispEdges');icon.classList.add('sky-bulb');
 icon.innerHTML='<path d="M5 1h6v1h2v2h1v5h-2v3H4V9H2V4h1V2h2zM5 13h6v2H5zM6 15h4v1H6z"/><path d="M6 4h2v2H6zM5 5h1v3H5z" fill="#fff8da"/>';button?.appendChild(icon);
 const nav=document.querySelector('.tabbar');
 if(nav)for(const side of ['left','right']){const detail=document.createElement('span');detail.className='bs-nav-detail bs-nav-'+side;detail.setAttribute('aria-hidden','true');nav.appendChild(detail)}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let loaded=false,previousSky=root.dataset.sky,previousActive=root.dataset.basement==='on',flickerTimer=0,sequenceTimer=0;
 const canAnimate=()=>root.dataset.optimized!=='on'&&!reduced.matches&&!document.hidden&&window.Telegram?.WebApp?.isActive!==false;
 function clearSequence(){clearTimeout(sequenceTimer);world.classList.remove('bs-igniting','bs-flickering')}
 function sequence(element,ignition){
  element.classList.remove('bs-igniting','bs-flickering');if(!canAnimate())return;
  void element.offsetWidth;element.classList.add(ignition?'bs-igniting':'bs-flickering');
  if(element===world){clearTimeout(sequenceTimer);sequenceTimer=setTimeout(clearSequence,1300)}
  else element.addEventListener('animationend',()=>element.classList.remove('bs-igniting','bs-flickering'),{once:true});
 }
 function scheduleFlicker(){
  clearTimeout(flickerTimer);flickerTimer=0;
  if(root.dataset.basement!=='on'||root.dataset.sky==='night'||!canAnimate())return;
  flickerTimer=setTimeout(()=>{flickerTimer=0;if(root.dataset.basement==='on'&&root.dataset.sky!=='night'&&canAnimate()){sequence(world,false);window.GameAudio?.effect('lamp-flicker');scheduleFlicker()}},22000+Math.random()*26000);
 }
 window.BasementLight={preview(stage,on){stage.classList.remove('bs-igniting','bs-flickering');if(on)sequence(stage,true)}};
 function sync(){
  const active=root.dataset.basement==='on';
  if(active&&!loaded){loaded=true;for(const [selector,name]of [['.basement-lit','day'],['.basement-dim','night']]){const image=world.querySelector(selector);if(!image)continue;image.addEventListener('load',()=>dispatchEvent(new Event('resize')));}}
  if(active&&button){const dim=root.dataset.sky==='night';const label=({en:dim?'Turn light on':'Turn light off',zh:dim?'开灯':'关灯',ru:dim?'Включить свет':'Выключить свет'})[root.dataset.lang]|| (dim?'Включить свет':'Выключить свет');button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(!dim));}
  scene.classList.toggle('basement-paused',document.hidden||window.Telegram?.WebApp?.isActive===false);
  nav?.classList.toggle('basement-paused',scene.classList.contains('basement-paused'));
  const sky=root.dataset.sky,changed=sky!==previousSky||active!==previousActive;
  if(!active||sky==='night'||!canAnimate())clearSequence();
  else if(changed&&previousActive&&previousSky==='night')sequence(world,true);
  if(changed||!canAnimate()||!flickerTimer)scheduleFlicker();
  previousSky=sky;previousActive=active;
 }
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-basement','data-sky','data-lang','data-optimized']});reduced.addEventListener('change',sync);

 document.addEventListener('click',event=>{
  if(root.dataset.basement!=='on')return;const target=event.target.closest('button');if(!target||target.disabled)return;
  let sound=target.matches('.kq-tab')?'shop-tab':target.matches('.shop-card')?'shop-open':target.matches('.weapon-card')?'gear-preview':target.matches('#wpApply')?'equip':target.matches('#settingsBtn')?'settings-open':target.matches('[data-cz]')?'switch':null;
  if(sound)window.GameAudio?.effect(sound);
 });
 document.addEventListener('change',event=>{if(root.dataset.basement==='on'&&event.target.matches('.pixel-switch-input'))queueMicrotask(()=>window.GameAudio?.effect('switch'))});
 document.addEventListener('visibilitychange',sync);window.Telegram?.WebApp?.onEvent?.('activated',sync);window.Telegram?.WebApp?.onEvent?.('deactivated',sync);sync();
})();
