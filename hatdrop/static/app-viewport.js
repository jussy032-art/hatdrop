
(()=>{'use strict';let connected=null,requested=false;const root=document.documentElement;
 function safe(){const app=window.Telegram?.WebApp;if(!app)return;for(const edge of ['top','bottom','left','right']){const system=Math.max(0,Number(app.safeAreaInset?.[edge])||0),content=Math.max(0,Number(app.contentSafeAreaInset?.[edge])||0);root.style.setProperty('--app-inset-'+edge,(system+content)+'px')}root.dataset.fullscreen=app.isFullscreen?'on':'off'}
 function connect(){const app=window.Telegram?.WebApp;if(!app)return;const native=!!app.initData||!['unknown','weba','webk','web'].includes(app.platform||'unknown');try{app.expand?.()}catch(_){}if(connected!==app){connected=app;for(const event of ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','viewportChanged'])try{app.onEvent?.(event,safe)}catch(_){}}
  safe();if(native&&!requested&&!app.isFullscreen&&app.requestFullscreen&&(!app.isVersionAtLeast||app.isVersionAtLeast('8.0'))){requested=true;try{app.requestFullscreen()}catch(_){}}
 }
 window.GameViewport={connect,safe};connect();document.getElementById('telegramSdk')?.addEventListener('load',connect);

 if(!window.Telegram?.WebApp?.initData)document.addEventListener('pointerdown',()=>{const app=window.Telegram?.WebApp;if(app?.initData)return;if(!document.fullscreenElement&&document.fullscreenEnabled)try{document.documentElement.requestFullscreen?.().catch(()=>{})}catch(_){}},{once:true});
})();
