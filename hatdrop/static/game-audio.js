

(() => {
  'use strict';
  const manifest = {"meadow": {"day": {"music": ["/static/audio/meadow-day-music.ogg?v=1", "/static/audio/meadow-day-music.mp3?v=1"], "ambience": ["/static/audio/meadow-day-ambience.ogg?v=1", "/static/audio/meadow-day-ambience.mp3?v=1"], "effects": {"navigation": "/static/audio/navigation.mp3?v=1", "spin": "/static/audio/upgrade-spin.mp3?v=1", "success": "/static/audio/upgrade-success.mp3?v=1", "miss": "/static/audio/upgrade-miss.mp3?v=1", "open": "/static/audio/meadow-chest-open.mp3?v=1", "reveal": "/static/audio/meadow-gold-reveal.mp3?v=1"}}, "night": {"music": ["/static/audio/meadow-night-music.ogg?v=1", "/static/audio/meadow-night-music.mp3?v=1"], "ambience": ["/static/audio/meadow-night-ambience.ogg?v=1", "/static/audio/meadow-night-ambience.mp3?v=1"], "effects": {"navigation": "/static/audio/navigation.mp3?v=1", "spin": "/static/audio/upgrade-spin.mp3?v=1", "success": "/static/audio/upgrade-success.mp3?v=1", "miss": "/static/audio/upgrade-miss.mp3?v=1", "open": "/static/audio/meadow-chest-open.mp3?v=1", "reveal": "/static/audio/meadow-gold-reveal.mp3?v=1"}}}, "halloween": {"day": {"effects": {"navigation": "/static/audio/halloween-navigation.mp3?v=1", "spin": "/static/audio/halloween-upgrade-spin.mp3?v=1", "success": "/static/audio/halloween-upgrade-success.mp3?v=1", "miss": "/static/audio/halloween-upgrade-miss.mp3?v=1", "open": "/static/audio/halloween-coffin-open.mp3?v=1", "reveal": "/static/audio/halloween-candy-reveal.mp3?v=1"}, "music": ["/static/audio/halloween-day-music.ogg?v=1", "/static/audio/halloween-day-music.mp3?v=1"], "ambience": ["/static/audio/halloween-day-ambience.ogg?v=3", "/static/audio/halloween-day-ambience.mp3?v=3"]}, "night": {"effects": {"navigation": "/static/audio/halloween-navigation.mp3?v=1", "spin": "/static/audio/halloween-upgrade-spin.mp3?v=1", "success": "/static/audio/halloween-upgrade-success.mp3?v=1", "miss": "/static/audio/halloween-upgrade-miss.mp3?v=1", "open": "/static/audio/halloween-coffin-open.mp3?v=1", "reveal": "/static/audio/halloween-candy-reveal.mp3?v=1"}, "music": ["/static/audio/halloween-night-music.ogg?v=1", "/static/audio/halloween-night-music.mp3?v=1"], "ambience": ["/static/audio/halloween-night-ambience.ogg?v=3", "/static/audio/halloween-night-ambience.mp3?v=3"]}}, "basement": {"day": {"music": ["/static/audio/basement-day-music.ogg?v=1", "/static/audio/basement-day-music.mp3?v=1"], "ambience": ["/static/audio/basement-day-ambience.ogg?v=4", "/static/audio/basement-day-ambience.mp3?v=4"], "effects": {"navigation": "/static/audio/basement-navigation.mp3?v=1", "success": "/static/audio/basement-success.mp3?v=1", "miss": "/static/audio/basement-miss.mp3?v=1", "spin": "/static/audio/basement-spin.mp3?v=1", "open": "/static/audio/basement-open.mp3?v=1", "reveal": "/static/audio/basement-reveal.mp3?v=1", "light": "/static/audio/basement-light.mp3?v=1", "shop-open": "/static/audio/basement-shop-open.mp3?v=1", "shop-tab": "/static/audio/basement-shop-tab.mp3?v=1", "purchase": "/static/audio/basement-purchase.mp3?v=1", "equip": "/static/audio/basement-equip.mp3?v=1", "gear-preview": "/static/audio/basement-gear-preview.mp3?v=1", "settings-open": "/static/audio/basement-settings-open.mp3?v=1", "reward": "/static/audio/basement-reward.mp3?v=1", "switch": "/static/audio/basement-switch.mp3?v=1", "light-on": "/static/audio/basement-light-on.mp3?v=1", "lamp-flicker": "/static/audio/basement-lamp-flicker.mp3?v=1"}}, "night": {"music": ["/static/audio/basement-night-music.ogg?v=1", "/static/audio/basement-night-music.mp3?v=1"], "ambience": ["/static/audio/basement-night-ambience.ogg?v=4", "/static/audio/basement-night-ambience.mp3?v=4"], "effects": {"navigation": "/static/audio/basement-navigation.mp3?v=1", "success": "/static/audio/basement-success.mp3?v=1", "miss": "/static/audio/basement-miss.mp3?v=1", "spin": "/static/audio/basement-spin.mp3?v=1", "open": "/static/audio/basement-open.mp3?v=1", "reveal": "/static/audio/basement-reveal.mp3?v=1", "light": "/static/audio/basement-light.mp3?v=1", "shop-open": "/static/audio/basement-shop-open.mp3?v=1", "shop-tab": "/static/audio/basement-shop-tab.mp3?v=1", "purchase": "/static/audio/basement-purchase.mp3?v=1", "equip": "/static/audio/basement-equip.mp3?v=1", "gear-preview": "/static/audio/basement-gear-preview.mp3?v=1", "settings-open": "/static/audio/basement-settings-open.mp3?v=1", "reward": "/static/audio/basement-reward.mp3?v=1", "switch": "/static/audio/basement-switch.mp3?v=1", "light-on": "/static/audio/basement-light-on.mp3?v=1", "lamp-flicker": "/static/audio/basement-lamp-flicker.mp3?v=1"}}}};
  const channels = ['music','ambience','effects'];
  const key = 'hatdrop.audio.v1';
  let prefs = {music:true, ambience:true, effects:true};
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    channels.forEach(channel => {if (typeof saved[channel] === 'boolean') prefs[channel] = saved[channel];});
  } catch (_) {}
  let context, master, unlocked = false, generation = 0, lastKey = '';
  const decodedSizes=new Map();const MAX_AUDIO_BYTES=64*1024*1024;
  const buffers = new Map(), loops = new Map(), effects = new Set();
  const root = document.documentElement;
  const hallDays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const scene=()=>({theme:root.dataset.hall==='on'?'hall':root.dataset.basement==='on'?'basement':root.dataset.halloween==='on'?'halloween':'meadow',sky:root.dataset.sky==='night'?'night':'day',curtains:root.dataset.hallCurtains==='closed'?'closed':'open',weekday:hallDays[new Date().getDay()]});
  const hallTracksCache=new Map();
  function tracksFor(c){if(c.theme!=='hall')return manifest[c.theme]?.[c.sky]||{};const key=c.weekday+'-'+c.sky+'-'+c.curtains;if(!hallTracksCache.has(key)){const state=c.sky+'-'+c.curtains,base='/static/hall/audio/';const effectNames={navigation:'navigation',spin:'spin-loop',success:'success',miss:'miss',open:'menu-open',reveal:'gift-reveal','shop-open':'shop-open','shop-tab':'navigation',purchase:'purchase',equip:'equip','gear-preview':'emerald-shimmer','settings-open':'menu-open',reward:'gift-reveal',switch:'navigation',light:'day-to-night','light-on':'night-to-day','lamp-flicker':'lamp-flicker','curtains-open':'curtains-open','curtains-close':'curtains-close','spin-start':'spin-start','spin-stop':'spin-stop'};hallTracksCache.set(key,{music:['ogg','mp3'].map(x=>base+'music/hall-'+c.weekday+'-'+state+'.'+x),ambience:['ogg','mp3'].map(x=>base+'ambience/hall-ambience-'+state+'.'+x+'?v=calm2'),effects:Object.fromEntries(Object.entries(effectNames).map(([k,v])=>[k,base+'effects/hall-'+v+'.mp3?v=calm2']))})}return hallTracksCache.get(key)}
  const active = () => !document.hidden && window.Telegram?.WebApp?.isActive !== false;
  const available = channel => Object.values(manifest).some(theme => Object.values(theme).some(sky => !!sky[channel]));
  function stopLoop(channel, seconds = .6) {
    const playing = loops.get(channel);
    if (!playing || !context) return;
    loops.delete(channel);
    const now=context.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value,now);
    playing.gain.gain.linearRampToValueAtTime(0,now+seconds);
    try {playing.source.stop(now+seconds+.02);} catch (_) {}
  }
  function stopEffects() {
    for (const source of effects) {try {source.stop();} catch (_) {}}
    effects.clear();
  }
  function trimBuffers(){
    let total=[...decodedSizes.values()].reduce((a,b)=>a+b,0);
    for(const [url,size] of decodedSizes){
      if(total<=MAX_AUDIO_BYTES)break;
      if([...loops.values()].some(loop=>Array.isArray(loop.url)?loop.url.includes(url):loop.url===url))continue;
      buffers.delete(url);decodedSizes.delete(url);total-=size;
    }
  }
  async function buffer(url) {
    if (Array.isArray(url)) {
      for (const candidate of url) {
        try {return await buffer(candidate);} catch (_) {}
      }
      throw new Error('Audio unavailable');
    }
    if (!buffers.has(url)) buffers.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error('Audio unavailable');
      return response.arrayBuffer();
    }).then(bytes => context.decodeAudioData(bytes)).then(data=>{decodedSizes.set(url,data.length*data.numberOfChannels*4);trimBuffers();return data}).catch(error => {buffers.delete(url);decodedSizes.delete(url);throw error;}));
    const pending=buffers.get(url);if(pending){buffers.delete(url);buffers.set(url,pending);if(decodedSizes.has(url)){const size=decodedSizes.get(url);decodedSizes.delete(url);decodedSizes.set(url,size)}}return pending;
  }
  function renderControls() {
    document.querySelectorAll('[data-audio-channel]').forEach(input => {
      const channel=input.dataset.audioChannel;
      input.checked=prefs[channel] === true;
      input.closest('[data-audio-row]').hidden=!available(channel);
    });
    const note=document.getElementById('audioSceneNote');
    if (note) note.textContent='Музыка и окружение включаются независимо.';
    const off=document.getElementById('audioAllOff');
    if (off) off.disabled=!channels.some(channel => prefs[channel]);
  }
  async function reconcile(force = false) {
    const current=scene(), enabled=active();
    const signature=JSON.stringify([current,prefs,enabled,unlocked]);
    if (!force && signature===lastKey) return;
    lastKey=signature;
    const run=++generation;
    renderControls();
    const tracks=tracksFor(current);
    await Promise.all(['music','ambience'].map(async channel => {
      const url=tracks[channel];
      if (!enabled || !unlocked || !prefs[channel] || !url) {stopLoop(channel,enabled ? .08 : .02);return;}
      if (loops.get(channel)?.url===url) return;
      stopLoop(channel);
      try {
        const data=await buffer(url);
        if (generation!==run || !active() || !prefs[channel] || context.state!=='running') return;
        const source=context.createBufferSource(), gain=context.createGain();
        source.buffer=data;source.loop=true;source.connect(gain);gain.connect(master);
        gain.gain.setValueAtTime(0,context.currentTime);
        gain.gain.linearRampToValueAtTime(channel==='music' ? .85 : .7,context.currentTime+(current.theme==='hall'?1.6:.65));
        loops.set(channel,{source,gain,url});
        source.onended=()=>{source.disconnect();gain.disconnect();};
        source.start();
      } catch (_) {                                                      }
    }));
    trimBuffers();
    if (!enabled || !prefs.effects) stopEffects();
  }
  async function unlock() {
    if (!channels.some(channel => prefs[channel]) || !active()) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context=new Audio(); master=context.createGain();master.gain.value=.46;master.connect(context.destination);
      }
      await context.resume();
      unlocked=context.state==='running';
      await reconcile(true);
    } catch (_) {}
  }
  function save() {
    try {localStorage.setItem(key,JSON.stringify(prefs));} catch (_) {}
    reconcile();
  }
  function allOff() {
    channels.forEach(channel => prefs[channel]=false);
    stopEffects();save();
  }
  async function effect(name, duration) {
    if (!prefs.effects || !active() || !unlocked || !context) return;
    const current=scene();let url=tracksFor(current).effects?.[name];
    if(current.theme==='hall'&&name==='spin'&&duration>0&&duration<2)url='/static/hall/audio/effects/hall-spin-fast.mp3?v=calm2';
    if (!url) return;
    const run=generation;
    try {
      const data=await buffer(url);
      if (generation!==run || !prefs.effects || !active()) return;
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=data;gain.gain.value=.6;source.connect(gain);gain.connect(master);
      if (duration>0) source.playbackRate.value=data.duration/duration;
      if(effects.size>=6){const oldest=effects.values().next().value;try{oldest.stop()}catch(_){}effects.delete(oldest)}
      effects.add(source);source.onended=()=>{effects.delete(source);source.disconnect();gain.disconnect();};source.start();
    } catch (_) {}
  }
  document.addEventListener('change',event=>{
    const channel=event.target?.dataset?.audioChannel;
    if (!channels.includes(channel)) return;
    prefs[channel]=event.target.checked === true;save();unlock();
  });
  document.getElementById('audioAllOff')?.addEventListener('click',allOff);
  document.addEventListener('pointerdown',()=>{if (!unlocked) unlock();},{passive:true});
  document.addEventListener('visibilitychange',()=>reconcile());
  new MutationObserver(()=>reconcile()).observe(root,{attributes:true,attributeFilter:['data-sky','data-halloween','data-basement','data-hall','data-hall-curtains']});
  setInterval(()=>reconcile(),1000);
  renderControls();
  window.GameAudio={allOff,effect,getState:()=>({preferences:{...prefs},scene:scene(),unlocked,
    playing:[...loops.keys()],sources:Object.fromEntries([...loops].map(([channel,playing])=>[channel,playing.url])),loaded:[...buffers.keys()],cacheBytes:[...decodedSizes.values()].reduce((a,b)=>a+b,0),effectVoices:effects.size})};
  unlock();
})();
