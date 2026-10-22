(()=>{
'use strict';
const records=new Map(),dataCache=new Map();let runtime=null,frame=0;
function slugFor(image){
 if(image.closest('#prizeGrid,#stakingPositions,#stakingEligible'))return null;
 const value=image.dataset.nftSlug||image.getAttribute('src')||'';
 const match=value.match(/(?:nft-img\/|t\.me\/nft\/|^)([a-z][a-z0-9]{1,63}-[1-9][0-9]{0,10})(?:\.png|$)/i);return match?match[1].toLowerCase():null;
}
function loadRuntime(){
 if(window.lottie)return Promise.resolve(window.lottie);
 if(!runtime)runtime=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/static/vendor/lottie_light.min.js?v=5.13.0';script.onload=()=>window.lottie?resolve(window.lottie):reject(new Error('lottie'));script.onerror=()=>{runtime=null;script.remove();reject(new Error('lottie'))};document.head.append(script)});
 return runtime;
}
function loadData(slug){
 if(!dataCache.has(slug)){
  const promise=fetch('/nft-animation/'+slug+'.json').then(response=>{if(!response.ok)throw new Error('animation');return response.json()});
  dataCache.set(slug,promise);if(dataCache.size>48)dataCache.delete(dataCache.keys().next().value);
 }
 return dataCache.get(slug);
}
function position(record){
 const image=record.image,layer=record.layer;if(!layer)return;
 const style=getComputedStyle(image);Object.assign(layer.style,{left:image.offsetLeft+'px',top:image.offsetTop+'px',width:image.offsetWidth+'px',height:image.offsetHeight+'px',borderRadius:style.borderRadius,transform:style.transform,transformOrigin:style.transformOrigin});
}
function destroy(record){record.animation?.destroy();record.layer?.remove();record.image.classList.remove('telegram-gift-playing');resize.unobserve(record.image);intersection.unobserve(record.image);records.delete(record.image)}
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;synchronize()})}
async function start(record){
 record.loading=true;
 try{
  const [lottie,data]=await Promise.all([loadRuntime(),loadData(record.slug)]);
  if(!record.image.isConnected||records.get(record.image)!==record)return;
  const parent=record.image.parentElement;if(getComputedStyle(parent).position==='static')parent.style.position='relative';
  const layer=document.createElement('span');layer.className='telegram-gift-animation';layer.setAttribute('aria-hidden','true');parent.append(layer);record.layer=layer;position(record);
  const animation=lottie.loadAnimation({container:layer,renderer:'svg',loop:true,autoplay:false,animationData:structuredClone(data),rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:true}});record.animation=animation;
  animation.addEventListener('DOMLoaded',()=>{if(record.image.isConnected){record.ready=true;record.image.classList.add('telegram-gift-playing');schedule()}});
  animation.addEventListener('data_failed',()=>{record.failed=true;destroy(record)});
 }catch(_){record.failed=true;record.layer?.remove();record.layer=null}
 finally{record.loading=false;schedule()}
}
function synchronize(){
 let playing=0,loading=[...records.values()].filter(record=>record.loading).length;
 for(const record of [...records.values()]){
  if(!record.image.isConnected||slugFor(record.image)!==record.slug){destroy(record);continue}
  const visible=record.visible&&!document.hidden&&record.image.getClientRects().length>0;
  if(visible&&playing<6){playing++;if(!record.animation&&!record.loading&&!record.failed&&loading<2){loading++;start(record)}if(record.ready)record.animation.play()}
  else record.animation?.pause();
 }
}
const resize=new ResizeObserver(entries=>{for(const entry of entries){const record=records.get(entry.target);if(record)position(record)}});
const intersection=new IntersectionObserver(entries=>{for(const entry of entries){const record=records.get(entry.target);if(record)record.visible=entry.isIntersecting}schedule()},{rootMargin:'40px'});
function scan(root){
 const images=[...(root.matches?.('img')?[root]:[]),...root.querySelectorAll?.('img')||[]];
 for(const image of images){const slug=slugFor(image),old=records.get(image);if(old&&old.slug===slug)continue;if(old)destroy(old);if(!slug)continue;
  const record={image,slug,visible:false,loading:false,ready:false,failed:false};records.set(image,record);intersection.observe(image);resize.observe(image);image.addEventListener('load',()=>position(record),{once:true});
 }
 schedule();
}
function boot(){scan(document.body);new MutationObserver(changes=>{for(const change of changes){if(change.type==='attributes'&&change.target.tagName==='IMG')scan(change.target);for(const node of change.addedNodes)if(node.nodeType===1&&!node.closest?.('.telegram-gift-animation'))scan(node)}schedule()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','data-nft-slug']});document.addEventListener('visibilitychange',schedule)}
window.TelegramGiftMedia={scan};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
