
(() => {
 'use strict';
 const world=document.getElementById('meadowWorld'),root=document.documentElement;
 if(!world)return;
 const NS='http://www.w3.org/2000/svg';
 const wheel=document.querySelector('.wheel-wrap');
 let anchorX=.5,anchor=.4,frame=0,lastWheelSize=Math.min(innerWidth*.88,innerHeight*.4,350);

 const landmarks={meadow:{x:.5,y:.531,width:.109},halloween:{x:.5,y:.568,width:.12},basement:{x:.5,y:.501,width:.115}};
 function fit(){
  frame=0;
  const w=innerWidth,h=innerHeight,dpr=devicePixelRatio||1,box=wheel?.getBoundingClientRect();
  if(box?.width&&box.height){let centre=wheel.offsetWidth*.5;for(let node=wheel;node;node=node.offsetParent)centre+=node.offsetLeft;anchorX=centre/w;anchor=(box.top+box.height*.67)/h;lastWheelSize=box.width;}
  const target=Math.max(0,Math.min(h,h*anchor)),wheelSize=lastWheelSize;
  for(const kind of ['meadow','halloween','basement']){
   const img=kind==='meadow'?world.querySelector('.day'):kind==='basement'?document.querySelector('#basementWorld .basement-lit'):document.getElementById('halloweenNightPng');
   const ratio=kind==='halloween'&&root.dataset.scenePortrait==='on'?941/1672:1672/941;
   const l=landmarks[kind];
   // halloween: plain cover, centred, pinned to the bottom (the grave sits behind the buttons)
   const cover=kind==='halloween';
   const height=Math.ceil((cover?Math.max(h,w/ratio):Math.max(h,w/ratio,target/l.y,(h-target)/(1-l.y),wheelSize*(kind==='basement'?.48:.65)/(l.width*ratio)))*dpr)/dpr;
   const width=Math.ceil(height*ratio*dpr)/dpr;
   const x=cover?Math.round((w-width)/2*dpr)/dpr:Math.max(w-width,Math.min(0,Math.round((w*anchorX-width*l.x)*dpr)/dpr));
   const y=cover?h-height:Math.max(h-height,Math.min(0,Math.round((target-height*l.y)*dpr)/dpr));
   const targetNode=root;
   const vars=kind==='basement'?{'--bs-scene-w':width,'--bs-scene-h':height,'--bs-scene-x':x,'--bs-scene-y':y}:kind==='meadow'?{'--ms-w':width,'--ms-h':height,'--ms-rest-x':x,'--ms-top':y}:{'--hw-scene-w':width,'--hw-scene-h':height,'--hw-scene-x':x,'--hw-scene-y':y};
   for(const [k,v]of Object.entries(vars))targetNode.style.setProperty(k,v+'px');
  }
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit)};
 fit();new ResizeObserver(schedule).observe(wheel);
 addEventListener('resize',schedule,{passive:true});window.window.visualViewport?.addEventListener('resize',schedule);
 for(const img of [...world.querySelectorAll('.ms-img'),document.getElementById('halloweenNightPng')])img?.addEventListener('load',schedule);
 new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-theme','data-halloween','data-basement','data-scene-portrait']});
 new ResizeObserver(schedule).observe(document.getElementById('view-upgrade'));
 new MutationObserver(schedule).observe(document.getElementById('view-upgrade'),{attributes:true,attributeFilter:['hidden','style','class']});
 document.fonts?.ready.then(schedule);
 if(window.PerformanceObserver){try{new PerformanceObserver(schedule).observe({type:'layout-shift',buffered:true})}catch(_){}}
})();
