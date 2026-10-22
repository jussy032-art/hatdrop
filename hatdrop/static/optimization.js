
(() => {
 'use strict';
 const root=document.documentElement,key='hatdrop.performance.v1';
 let enabled=false,decided=false,previousFocus=null;
 try{const p=JSON.parse(localStorage.getItem(key)||'{}');enabled=p.enabled===true;decided=p.decided===true}catch(_){}
 const copy={
  ru:{title:'Режим оптимизации',intro:'Настройте плавность игры',recommend:'На этом устройстве рекомендуем включить оптимизацию для более плавной игры.',normal:'Выберите, сколько анимаций оставить. Этот режим можно изменить в настройках профиля.',note:'Упрощает фоновые эффекты и декоративные анимации.',apply:'Применить'},
  en:{title:'Optimization mode',intro:'Choose your animation settings',recommend:'We recommend optimization on this device for smoother play.',normal:'Choose how many animations to keep. You can change this in profile settings.',note:'Simplifies background effects and decorative animations.',apply:'Apply'},
  zh:{title:'优化模式',intro:'设置游戏流畅度',recommend:'建议在此设备上启用优化，让游戏更流畅。',normal:'选择保留多少动画。您可以在个人设置中更改。',note:'简化背景效果和装饰动画。',apply:'应用'}
 };
 const words=()=>copy[root.dataset.lang]||copy.ru;
 const dialog=document.getElementById('optimizationModal'),intro=document.getElementById('optimizationIntroToggle'),setting=document.getElementById('optimizationSetting');
 if(!dialog||!intro||!setting)return;
 function render(){
  const t=words();
  document.querySelectorAll('[data-optimization-text]').forEach(e=>{e.textContent=t[e.dataset.optimizationText]||''});
  for(const input of [intro,setting])input.setAttribute('aria-label',t.title);
  setting.checked=enabled;
 }
 function apply(value,persist=true){
  enabled=value===true;
  root.dataset.optimized=enabled?'on':'off';
  if(persist){decided=true;try{localStorage.setItem(key,JSON.stringify({enabled,decided:true}))}catch(_){}}
  render();
  window.dispatchEvent(new CustomEvent('hatdrop:performancechange',{detail:{enabled}}));
 }
 function close(){
  dialog.hidden=true;
  const tour=document.getElementById('tourLayer');if(tour)tour.inert=false;
  if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
 }
 document.getElementById('optimizationApply').addEventListener('click',()=>{apply(intro.checked);close()});
 setting.addEventListener('change',()=>apply(setting.checked));
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();apply(enabled);close()}
  if(e.key==='Tab'){
   const controls=[intro,document.getElementById('optimizationApply')];
   if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[1].focus()}
   else if(!e.shiftKey&&document.activeElement===controls[1]){e.preventDefault();controls[0].focus()}
  }
 });
 new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-lang']});
 apply(enabled,false);


 function sampleFrames(){
  return new Promise(resolve=>{
   let raf=0,last=0,done=false;const deltas=[];
   const finish=()=>{if(done)return;done=true;cancelAnimationFrame(raf);clearTimeout(timeout);resolve(deltas.length>=18?deltas.sort((a,b)=>a-b)[Math.floor(deltas.length*.75)]:null)};
   const tick=t=>{
    if(document.hidden){finish();return}
    if(last&&t-last<180)deltas.push(t-last);last=t;
    if(deltas.length>=36)finish();else raf=requestAnimationFrame(tick);
   };
   const timeout=setTimeout(finish,1800);raf=requestAnimationFrame(tick);
  });
 }
 async function firstVisit(){
  if(decided)return;
  await new Promise(resolve=>setTimeout(resolve,550));
  const frameTime=await sampleFrames();
  if(decided)return;
  if(document.hidden){document.addEventListener('visibilitychange',()=>{if(!document.hidden)firstVisit()},{once:true});return}
  const cores=Number(navigator.hardwareConcurrency)||0,memory=Number(navigator.deviceMemory)||0;
  const recommended=(cores>0&&cores<=4)||(memory>0&&memory<=2)||navigator.connection?.saveData===true||matchMedia('(prefers-reduced-motion: reduce)').matches||(frameTime!==null&&frameTime>32);
  const t=words();document.getElementById('optimizationRecommendation').textContent=recommended?t.recommend:t.normal;
  intro.checked=recommended;
  previousFocus=document.activeElement;
  const tour=document.getElementById('tourLayer');if(tour)tour.inert=true;
  dialog.hidden=false;intro.focus({preventScroll:true});
 }

 window.HatDropPerformance={setEnabled:apply,get enabled(){return enabled}};
 firstVisit();
})();
