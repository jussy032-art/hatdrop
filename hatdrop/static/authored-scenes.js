
(()=>{'use strict';const root=document.documentElement,host=document.querySelector('.bg-wide');if(!host)return;
 const stage=document.createElement('div');stage.id='authoredBackdrop';stage.setAttribute('aria-hidden','true');host.append(stage);
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),tall=matchMedia('(max-aspect-ratio: 1/1)'),cache=new Map();let revision=0,previous=null,settleTimer=0,inFlight=false;
 const kind=()=>root.dataset.hall==='on'?'hall':root.dataset.basement==='on'?'basement':root.dataset.halloween==='on'?'halloween':'meadow';
 const url=(name)=>'/static/scenes/'+name+'.svg?v=7';
 const names={meadow:{day:'meadow-day',night:'meadow-night'},halloween:{day:'halloween-nightfall-gray-calm',night:'halloween-nightfall'},basement:{day:'basement-day',night:'basement-night'}};
 async function loaded(src){
  let ready=cache.get(src);
  if(!ready){
   ready=(async()=>{const img=new Image();img.decoding='async';img.alt='';img.src=src;await new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)return resolve();img.onload=resolve;img.onerror=reject});try{await img.decode()}catch(_){}return img})();
   cache.set(src,ready);ready.catch(()=>{if(cache.get(src)===ready)cache.delete(src)});
  }else{cache.delete(src);cache.set(src,ready)}
  while(cache.size>4)cache.delete(cache.keys().next().value);
  const template=await ready,image=template.cloneNode();try{await image.decode()}catch(_){}return image;
 }

 async function show(src,theme,id,duration){
  const image=await loaded(src);if(id!==revision)return false;
  image.className='authored-frame';image.dataset.scene=theme;image.style.opacity='0';stage.append(image);
  const old=[...stage.children].filter(e=>e!==image);for(const node of old){const alpha=getComputedStyle(node).opacity;node.style.transition='none';node.style.opacity=alpha}
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(id!==revision){image.remove();return false}
  for(const node of old){node.style.transition=`opacity ${duration}ms ease-in-out`;node.style.opacity='0'}image.style.transition=`opacity ${duration}ms ease-in-out`;image.style.opacity='1';
  await new Promise(resolve=>setTimeout(resolve,duration+30));if(id!==revision)return false;for(const node of old)node.remove();return true;
 }
 async function sync(){
  const theme=kind(),sky=root.dataset.sky==='night'?'night':'day',still=root.dataset.optimized==='on'||motion.matches||document.hidden;
  const curtains=root.dataset.hallCurtains==='closed'?'closed':'open',portrait=theme==='halloween'&&tall.matches;root.dataset.scenePortrait=portrait?'on':'off';if(previous&&theme===previous.theme&&sky===previous.sky&&still===previous.still&&curtains===previous.curtains&&portrait===previous.portrait)return;
  const old=previous,interrupted=inFlight;previous={theme,sky,still,curtains,portrait};const id=++revision;clearTimeout(settleTimer);inFlight=true;
  const base=theme==='hall'?'':names[theme][sky]+(portrait?'-m':''),steady=theme==='hall'?'/static/hall/room/'+sky+'-'+curtains+'.png?v=1':url(base+(still?'-still':''));
  try{
   const switchingSky=old&&old.theme===theme&&old.sky!==sky;
   if(theme!=='hall'&&theme!=='halloween'&&switchingSky&&!still&&!interrupted){
    const duration=theme==='meadow'?9000:theme==='halloween'?3000:1300;
    const transition=theme==='meadow'?(sky==='night'?'meadow-day-to-night':'meadow-night-to-day'):theme+'-smooth-to-'+sky;
    if(!await show(url(transition),theme,id,140))return;


    settleTimer=setTimeout(()=>{if(id===revision)inFlight=false},duration);
   }else{

    const enteringHalloween=theme==='halloween'&&old&&old.theme!==theme&&!still;
    if(enteringHalloween)stage.classList.add('scene-glitch');
    if(!await show(steady,theme,id,motion.matches?0:still?140:enteringHalloween?100:old?650:0))return;
    stage.classList.remove('scene-glitch');if(id===revision)inFlight=false;
   }
  }catch(_){if(id===revision){inFlight=false;previous=null}}
 }
 let scheduled=false;function schedule(){if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;sync()})}}
 new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-hall','data-hall-curtains','data-theme','data-sky','data-halloween','data-basement','data-optimized']});motion.addEventListener('change',schedule);tall.addEventListener('change',schedule);document.addEventListener('visibilitychange',schedule);
 window.SceneBackground={get state(){return previous},get transitioning(){return inFlight},refresh:schedule};schedule();
})();
