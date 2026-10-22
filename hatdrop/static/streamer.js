
(() => {
 'use strict';
 const root=document.documentElement,key='hatdrop.streamer.v1',coin='/static/streamer/iskra.png?v=1';
 let enabled=false,ids={},next=1;try{const saved=JSON.parse(localStorage.getItem(key)||'{}');enabled=saved.enabled===true;ids=saved.ids||{};next=saved.next||1}catch(_){}
 root.dataset.streamer=enabled?'on':'off';
 const names=new Map(),texts=new Map(),images=new Map();
 const save=()=>{try{localStorage.setItem(key,JSON.stringify({enabled,ids,next}))}catch(_){}};
 function name(id,raw,me=false){if(!enabled||me)return raw;id=String(id||raw||'anonymous');if(!ids[id]){ids[id]=next++;save()}return 'Игрок'+ids[id]}
 function bindName(el,id,raw,me=false,attribute=''){names.set(el,{id,raw,me,attribute});if(!attribute)el.dataset.playerName='';const value=name(id,raw,me);if(attribute)el.setAttribute(attribute,value);else el.textContent=value;if(names.size>300)for(const[n]of names)if(!n.isConnected)names.delete(n)}
 function avatar(el,me=false){el.dataset.otherPlayer=String(!me);return el}
 function text(node){if(!node.parentElement||node.parentElement.closest('script,style,textarea,input,[data-player-name],.admin-app'))return;const prior=texts.get(node);if(prior&&node.data===prior.masked)return;if(prior)texts.delete(node);if(enabled&&/\b(?:TON|GRAM)\b/.test(node.data)){const raw=node.data,masked=raw.replace(/\b(?:TON|GRAM)\b/g,'ИСК');texts.set(node,{raw,masked});node.data=masked}}
 function picture(img){const prior=images.get(img),src=img.getAttribute('src')||'';if(prior&&src===coin)return;if(prior)images.delete(img);if(enabled&&/(?:^|\/)(?:gram|ton)\.(?:png|webp|svg)(?:\?|$)/i.test(src)){images.set(img,src);img.src=coin;img.dataset.streamerCoin='true';if(img.alt==='TON'||img.alt==='GRAM')img.alt='Искры'}}
 function scan(node){if(node.nodeType===3){text(node);return}if(node.nodeType!==1&&node.nodeType!==9)return;if(node.nodeType===1&&node.matches('script,style,textarea,input'))return;if(node.tagName==='IMG')picture(node);const walk=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walk.nextNode())text(walk.currentNode);node.querySelectorAll?.('img').forEach(picture);for(const[n]of texts)if(!n.isConnected)texts.delete(n);for(const[n]of images)if(!n.isConnected)images.delete(n)}
 function setEnabled(value){enabled=value===true;root.dataset.streamer=enabled?'on':'off';save();
  for(const[el,n]of names){if(!el.isConnected){names.delete(el);continue}const value=name(n.id,n.raw,n.me);if(n.attribute)el.setAttribute(n.attribute,value);else el.textContent=value}
  if(!enabled){for(const[n,r]of texts){if(n.isConnected&&n.data===r.masked)n.data=r.raw}texts.clear();for(const[img,src]of images){if(img.isConnected&&img.getAttribute('src')===coin){img.src=src;delete img.dataset.streamerCoin;if(img.alt==='Искры')img.alt='GRAM'}}images.clear()}
  else scan(document.body);const cb=document.getElementById('streamerSetting');if(cb)cb.checked=enabled;
 }
 window.StreamerMode={name,bindName,avatar,setEnabled,get enabled(){return enabled}};
 function init(){setEnabled(enabled);document.getElementById('streamerSetting')?.addEventListener('change',e=>setEnabled(e.target.checked));new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')text(r.target);else if(r.type==='attributes')picture(r.target);else for(const n of r.addedNodes)scan(n)}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['src']})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
