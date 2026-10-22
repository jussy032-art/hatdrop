
let depositNoticeShown='',depositNoticeBusy=false;
let coinCount=1,coinBatch=null;
let coinBusy=false,coinRequest='',receiptShown='',bossPollBusy=false,lastPersonalDamage=0,lastBossId='';
function progressionUI(){
 const markup=`<div id="freeCoinModal" class="modal" hidden><div class="modal-card coin-card"><h2>Шляпа <small class="coin-caption">(Free Spin)</small></h2><p class="coin-balance" aria-label="Монеты фриспина"><span>Монеты фриспина:</span><b id="coinBalance">0</b> <img src="/static/free-coins/coin.png" alt=""></p><div class="coin-viewport" id="coinViewport"><div class="coin-track" id="coinTrack"></div><i class="coin-marker top"></i><i class="coin-marker bottom"></i></div><label class="coin-fast">Быстрый прокрут<input id="coinFast" type="checkbox" role="switch"><span aria-hidden="true"></span></label><div class="coin-quantity"><span>Прокрутов</span><div><button id="coinMinus" type="button" aria-label="Меньше прокрутов">−</button><output id="coinCount">1</output><button id="coinPlus" type="button" aria-label="Больше прокрутов">+</button></div></div><p id="coinStatus" role="status"></p><button class="cta" id="coinSpin">Крутить · 1 <img src="/static/free-coins/coin.png" alt="Free Spin Coin"></button><button class="ghost" id="coinClose">Закрыть</button></div></div><div id="coinResultModal" class="modal" hidden><div class="modal-card coin-card"><h2 id="coinResultTitle"></h2><img id="coinResultImage" class="coin-result-image" alt=""><p id="coinResultText"></p><div id="coinResultAwards"></div><button class="cta" id="coinResultClose">Продолжить</button></div></div><div id="tournamentReceiptModal" class="modal" hidden><div class="modal-card coin-card"><h2 id="receiptTitle"></h2><p id="receiptPlace"></p><div id="receiptAwards"></div><p id="receiptNote"></p><button class="cta" id="receiptClaim">Забрать</button></div></div>`;
 document.body.insertAdjacentHTML('beforeend',markup+`<div id="depositNoticeModal" class="modal" hidden><div class="modal-card coin-card"><h2>Баланс обновлён</h2><img class="deposit-notice-icon" src="/images/gram.webp" alt=""><p id="depositNoticeSource"></p><b id="depositNoticeAmount"></b><p id="depositNoticeBonus"></p><p id="depositNoticeBalance"></p><button class="cta" id="depositNoticeClose">Понятно</button></div></div>`);
 $('depositNoticeClose').onclick=async()=>{if(depositNoticeBusy)return;depositNoticeBusy=true;$('depositNoticeClose').disabled=true;try{const result=await api('/api/deposits/notice/read',{id:depositNoticeShown});state.deposit_notices=result.deposit_notices;depositNoticeShown='';$('depositNoticeModal').hidden=true;showDepositNotice(state.deposit_notices)}catch(_){toast('Не удалось подтвердить. Повторите ещё раз.')}finally{depositNoticeBusy=false;$('depositNoticeClose').disabled=false}};
 addEventListener('resize',()=>{if(!$('freeCoinModal').hidden&&$('coinTrack').children.length>55){const cell=$('coinTrack').children[55];$('coinTrack').style.transition='none';$('coinTrack').style.transform=`translateX(${-cell.offsetLeft-cell.offsetWidth/2+$('coinViewport').clientWidth/2}px)`}});
 $('coinClose').onclick=()=>{if(!coinBusy)$('freeCoinModal').hidden=true};
 $('coinMinus').onclick=()=>{if(!coinBusy&&!coinBatch){coinCount=Math.max(1,coinCount-1);coinControls()}};
 $('coinPlus').onclick=()=>{if(!coinBusy&&!coinBatch){coinCount=Math.min(10,coinCount+1,Number(state?.free_spin_coins||1));coinControls()}};
 $('coinSpin').onclick=spinCoin;try{$('coinFast').checked=localStorage.getItem('coinFast')==='1'}catch(_){}$('coinFast').onchange=()=>{try{localStorage.setItem('coinFast',$('coinFast').checked?'1':'0')}catch(_){}};
 $('coinResultImage').onerror=function(){this.onerror=null;this.src='/images/hat.png'};
 $('coinResultClose').onclick=()=>{$('coinResultModal').hidden=true;if((state?.free_spin_coins||0)>0)openCoins()};
 $('receiptClaim').onclick=async()=>{const button=$('receiptClaim');button.disabled=true;try{await api('/api/tournament/receipt',{id:receiptShown});$('tournamentReceiptModal').hidden=true;state.tournament_receipts=(state.tournament_receipts||[]).filter(r=>r.id!==receiptShown);receiptShown='';showView('profile');await refresh()}catch(e){toast('Не удалось подтвердить. Попробуйте ещё раз.')}finally{button.disabled=false}};
 $('refOwnCodeBox').insertAdjacentHTML('beforeend','<button id="refCodeRename" class="ref-copy" type="button">Изменить промокод</button>');
 $('refCodeRename').onclick=()=>{$('refCodeCreateBtn').onclick();$('refCodeInput').value=state.referral.code;$('refCodeSave').textContent='Сохранить'};
 $('refCodeCopy').classList.add('ref-copy');
 $('refCodeBenefits').insertAdjacentHTML('afterend','<p id="refQualification" class="ref-hint"></p><button id="refVerify" class="ghost" type="button">Проверить уровень Telegram</button>');
 $('refVerify').onclick=async()=>{try{await api('/api/referral/verify');toast('Проверка уровня Telegram запрошена')}catch(e){toast('Не удалось запросить проверку')}};
 const hud=document.createElement('div');hud.id='bossLiveHud';hud.hidden=true;hud.innerHTML='<div class="boss-live-title"><span id="bossLiveName"></span><span id="bossLiveHp"></span></div><div class="boss-live-track" role="progressbar" aria-label="HP босса"><i id="bossLiveFill"></i></div><small id="bossLiveDamage" aria-live="polite"></small>';$('view-upgrade').prepend(hud);
 const originalRender=renderState;renderState=function(s){originalRender(s);renderProgression(s)};
 const originalPicker=renderGiftPicker;renderGiftPicker=function(){originalPicker();if(gpModels)return;const button=document.createElement('button');button.type='button';button.className='gp-item gp-free-coins';button.innerHTML='<img src="/static/free-coins/golden-hat.png" alt=""><span>Шляпа<small class="coin-caption">Free spin</small></span>';button.onclick=e=>{e.stopPropagation();$('giftPickModal').hidden=true;openCoins()};$('gpList').prepend(button)};
 const originalReferral=renderReferral;renderReferral=function(ref){originalReferral(ref);$('refCodeBenefits').textContent=`${ref.code_benefits?.spin_count||0} монета фриспина · +${ref.code_benefits?.deposit_percent||0}% к первому пополнению`;$('refQualification').textContent=`Друг засчитывается после достижения 2-го уровня в Telegram и пополнения от 1 GRAM. Ожидают подтверждения: ${ref.pending||0}. За каждые 10 подтверждённых друзей — монета фриспина. До награды: ${10-(ref.milestone_progress||0)}.`;$('refVerify').hidden=!ref.invited};
 setInterval(pollBoss,3000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollBoss()});
}
function coinControls(){
 const locked=coinBusy||!!coinBatch,available=Math.max(0,Number(state?.free_spin_coins||0));
 if(!coinBatch)coinCount=Math.max(1,Math.min(coinCount,10,available||1));
 $('coinBalance').textContent=available;$('coinCount').textContent=coinBatch?coinBatch.count:coinCount;
 $('coinMinus').disabled=locked||coinCount<=1;$('coinPlus').disabled=locked||coinCount>=Math.min(10,available);
 $('coinFast').disabled=locked;$('coinClose').disabled=coinBusy;$('coinSpin').disabled=coinBusy||(!coinRequest&&available<1);
 $('coinSpin').innerHTML=coinBusy?'Крутим...':(coinBatch?(coinBatch.count===1?'Продолжить прокрут':'Продолжить серию'):'Крутить')+' · '+(coinBatch?coinBatch.count-coinBatch.done:coinCount)+' <img src="/static/free-coins/coin.png" alt="Монет фриспина">';
}
function openCoins(){if(spinning||coinBusy)return;coinControls();if(!coinBatch)$('coinStatus').textContent='';$('freeCoinModal').hidden=false;if(coinBatch)return;buildCoinReel(false,8);requestAnimationFrame(()=>{const cell=$('coinTrack').children[2];if(cell)$('coinTrack').style.transform=`translateX(${-cell.offsetLeft-cell.offsetWidth/2+$('coinViewport').clientWidth/2}px)`})}
function buildCoinReel(win,index){const track=$('coinTrack');track.replaceChildren();for(let i=0;i<index+8;i++){const cell=document.createElement('div');cell.className='coin-cell';const hat=i===index?win:(index===8?[false,true,false,false,true,false,true,false][i%8]:crypto.getRandomValues(new Uint32Array(1))[0]%10<4);if(hat){const image=document.createElement('img');image.src='/static/free-coins/golden-hat.png';image.alt='Шляпа';cell.append(image)}else{const empty=document.createElement('span');empty.textContent='—';cell.append(empty)}track.append(cell)}track.style.transition='none';track.style.transform='translateX(0px)'}
function coinSeriesResult(batch){
 if(!batch.wins.length)return;
 $('coinResultTitle').textContent=batch.done===1?'Успех!':'Шляп выиграно: '+batch.wins.length;
 $('coinResultText').textContent=batch.done===1?'Подарок уже в инвентаре.':'Прокрутов: '+batch.done+'. Подарки уже в инвентаре.';
 const asset=result=>result.image&&result.image!=='/img/hat.png'?result.image:'/images/hat.png';
 $('coinResultImage').hidden=batch.wins.length!==1;$('coinResultImage').src=asset(batch.wins[0]);
 $('coinResultAwards').replaceChildren();
 if(batch.wins.length>1)for(const result of batch.wins){const row=document.createElement('div');row.className='receipt-award';const img=document.createElement('img');img.src=asset(result);img.alt='';img.onerror=()=>{img.onerror=null;img.src='/images/hat.png'};const name=document.createElement('span');name.textContent=result.name||'Шляпа волшебника';row.append(img,name);$('coinResultAwards').append(row)}
 $('freeCoinModal').hidden=true;$('coinResultModal').hidden=false;
}
async function spinCoin(){
 if(coinBusy||(!coinRequest&&!(state?.free_spin_coins>0)))return;
 if(!coinBatch)coinBatch={count:Math.min(coinCount,state.free_spin_coins,10),done:0,wins:[],fast:$('coinFast').checked};
 coinBusy=true;coinControls();let complete=false;
 try{
  while(coinBatch.done<coinBatch.count){
   $('coinStatus').textContent=coinBatch.count>1?(coinBatch.done+1)+' / '+coinBatch.count:'';coinRequest=coinRequest||crypto.randomUUID();
   const result=await api('/api/free-coins/spin',{request_id:coinRequest});const index=55;buildCoinReel(result.win,index);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const track=$('coinTrack'),cell=track.children[index],viewport=$('coinViewport'),offset=cell.offsetLeft+cell.offsetWidth/2-viewport.clientWidth/2;
   const reduced=document.documentElement.dataset.optimized==='on'||matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?180:coinBatch.fast?850:4400;
   track.style.transition=`transform ${duration}ms cubic-bezier(.12,.72,.15,1)`;track.style.transform=`translateX(${-offset}px)`;
   await new Promise(resolve=>setTimeout(resolve,duration+80));
   coinRequest='';coinBatch.done++;if(result.win)coinBatch.wins.push(result);state.free_spin_coins=result.free_spin_coins;$('coinBalance').textContent=result.free_spin_coins;
   $('coinStatus').textContent=(coinBatch.count>1?coinBatch.done+' / '+coinBatch.count+' · ':'')+(result.win?'Шляпа!':'Пустая ячейка');
   if(!result.free_spin_coins){selectedGift=null;setTier('random',true);break}
   if(coinBatch.done<coinBatch.count)await new Promise(resolve=>setTimeout(resolve,coinBatch.fast?180:450));
  }
  complete=true;
 }catch(e){
  if(['no_free_coins','section_hidden','section_disabled','bad_request'].includes(e.code)){coinRequest='';complete=true;$('coinStatus').textContent=e.data?.message||'Серия остановлена.'}
  else $('coinStatus').textContent='Ответ не получен. Нажмите «Продолжить серию»: повторное списание исключено.';
 }finally{
  coinBusy=false;
  if(complete){const batch=coinBatch;coinBatch=null;if(batch.wins.length)coinSeriesResult(batch);else if(batch.done)$('coinStatus').textContent=batch.done===1?'Промах. Попробуйте ещё раз.':'Серия завершена: '+batch.done+' прокрутов, без выигрыша.'}
  coinControls();try{await refresh()}catch(_){}
 }
}

function renderProgression(s){if(!$('coinBalance'))return;coinControls();renderLiveBoss(s.boss);showReceipt(s.tournament_receipts||[]);showDepositNotice(s.deposit_notices||[])}
function renderLiveBoss(boss){$('bossLiveHud').hidden=!boss||boss.status==='cancelled'||boss.status==='expired';if(!boss)return;const hp=Math.max(0,boss.remaining_hp??boss.hp-boss.damage);$('bossLiveName').textContent=boss.name;$('bossLiveHp').textContent=`${fmt(hp,2)} / ${fmt(boss.hp,2)} HP`;$('bossLiveFill').style.width=(boss.hp?hp/boss.hp*100:0)+'%';const bar=$('bossLiveHud').querySelector('[role=progressbar]');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',boss.hp);bar.setAttribute('aria-valuenow',hp);if(lastBossId===boss.id&&boss.personal_damage>lastPersonalDamage)$('bossLiveDamage').textContent='Урон по боссу: −'+fmt(boss.personal_damage-lastPersonalDamage,2)+' HP';if(boss.defeated)$('bossLiveDamage').textContent='Босс повержен';lastBossId=boss.id;lastPersonalDamage=boss.personal_damage||0}
function showReceipt(rows){if(receiptShown||coinBusy||document.querySelector('.modal:not([hidden])'))return;const row=rows[0];if(!row)return;receiptShown=row.id;$('receiptTitle').textContent=row.mode==='boss'?(row.victory?'Босс побеждён!':'Время вышло'):row.name;$('receiptPlace').textContent='Ваше место: '+row.place;$('receiptAwards').replaceChildren();for(const award of row.awards||[]){const card=document.createElement('div');card.className='receipt-award';if(award.image){const image=document.createElement('img');image.src=award.image;image.alt='';card.append(image)}const label=document.createElement('span');label.textContent=(award.amount!=null?'+'+award.amount+' ':'')+award.name;card.append(label);$('receiptAwards').append(card)}$('receiptNote').textContent=!row.victory?'К сожалению, босса не успели победить. Награды не выдаются.':row.awards?.length?'Награды получены: подарки — в инвентаре, монеты — на балансе.':'Спасибо за участие!';$('receiptClaim').textContent=row.awards?.length?'Забрать':'Понятно';$('tournamentReceiptModal').hidden=false}
async function pollBoss(){if(document.hidden||bossPollBusy||!state)return;bossPollBusy=true;try{const r=await api('/api/boss/status');Object.assign(state,r);renderProgression(state)}catch(_){}finally{bossPollBusy=false}}
function showDepositNotice(rows){if(depositNoticeShown||coinBusy||spinning||cxBusy||document.querySelector('.modal:not([hidden])'))return;const row=rows[0];if(!row)return;depositNoticeShown=row.id;$('depositNoticeSource').textContent=row.label;$('depositNoticeAmount').textContent='+'+fmt(row.amount,2)+' GRAM';$('depositNoticeBonus').textContent=row.bonus?'Бонус промокода: +'+fmt(row.bonus,2)+' GRAM':'';$('depositNoticeBonus').hidden=!row.bonus;$('depositNoticeBalance').textContent='Ваш баланс: '+fmt(row.balance,2)+' GRAM';$('depositNoticeModal').hidden=false;haptic('notification','success')}
progressionUI();
