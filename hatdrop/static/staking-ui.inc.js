
let stakingBusy=false,stakingLoading=false;
let stakingClockData=null,stakingClockSkew=0;
const stakingRequests=new Map();
const stakingDeferred=new Set();let stakingDepositCurrent=null;
let stakingPositionId=null;
let stakingInventoryGift=false;
let stakingGridSignature='';
function stakingNow(){return Math.floor((Date.now()+stakingClockSkew)/1000)}
function stakingRemaining(until){let s=Math.max(0,Math.ceil(until-stakingNow()));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;return `${d?d+tr('д')+' ':''}${String(h).padStart(2,'0')}:${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function stakingAccessible(){return !!(state?.staking?.positions?.length||state?.staking?.eligible?.length||state?.staking?.balance_ton>0)}
function stakingLockInfo(until,active=false){
 $('stakingLockText').textContent=active?'Шляпа находится в стейкинге. Первые 3 дня её нельзя вернуть в инвентарь.':'Ваша шляпа заблокирована на 3 дня после возврата из стейкинга. Продажа и вывод будут доступны после окончания таймера. Повторное внесение из инвентаря недоступно.';
 $('stakingLockTime').dataset.stakingUntil=until;$('stakingLockTime').textContent=stakingRemaining(until);$('stakingLockModal').hidden=false;
}
async function stakingLoad(){
 if(stakingLoading||stakingBusy)return;stakingLoading=true;
 try{const r=await api('/api/staking/state');if(state){state.staking=r.staking;renderStaking()}}
 catch(e){toast(e.message||'Не удалось загрузить стейкинг',true)}finally{stakingLoading=false}
}
async function stakingAction(action,prize){
 if(stakingBusy)return;const signature=action+':'+(prize?.id??'');
 if(!stakingRequests.has(signature))stakingRequests.set(signature,crypto.randomUUID());
 stakingBusy=true;for(const b of document.querySelectorAll('[data-staking-action]'))b.disabled=true;
 try{
  const r=await api('/api/staking/'+action,{request_id:stakingRequests.get(signature),...(prize?{prize_id:prize.id}:{})});
  stakingRequests.delete(signature);if(state)renderState({...state,...r});
  $('stakingAddModal').hidden=true;
  $('stakingDepositModal').hidden=true;
  toast(action==='add'?'Шляпа добавлена в стейкинг на 3 дня':action==='deposit/balance'?'Стоимость шляпы зачислена на баланс':action==='remove'?'Шляпа возвращена в инвентарь. Блокировка — 3 дня':`На основной баланс переведено ${fmt(r.payout_ton,6)} GRAM`);
 }catch(e){toast(e.message||'Не удалось выполнить действие',true)}
 finally{stakingBusy=false;$('stakingDepositCash').disabled=false;$('stakingDepositStake').disabled=!sectionAvailable('staking')||!state?.staking?.price_available;renderStaking()}
}
function stakingItem(prize,active){
 const card=document.createElement('article');card.className='stake-item';const image=document.createElement('img');image.src=prize.image||hatAsset(prize.tier);image.alt=prize.name;image.loading='lazy';
 const name=document.createElement('b');name.textContent=prize.name;
 if(active){card.dataset.staked=prize.id;card.setAttribute('role','button');card.tabIndex=0;card.onclick=()=>openStakingPosition(prize.id);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStakingPosition(prize.id)}};card.append(image,name);return card}
 const details=document.createElement('p');details.textContent=active?`${fmt(prize.daily_ton,6)} GRAM / сутки · начислено ${fmt(prize.earned_ton,6)} GRAM`:'Любая модель — одинаковая ставка';
 const button=document.createElement('button');button.className='wd-btn';button.dataset.stakingAction=active?'remove':'add';
 const until=active?prize.unlock_at:prize.staking_lock_until;
 if(until>stakingNow()){button.dataset.stakingUntil=until;button.textContent=stakingRemaining(until)}else button.textContent=active?'Вернуть в инвентарь':'Добавить в стейкинг';
 if(!active)button.textContent=tr('Выбрать, куда положить');
 button.disabled=stakingBusy;
 button.onclick=()=>!active?openStakingDeposit(prize):until>stakingNow()?stakingLockInfo(until,true):stakingAction('remove',prize);
 card.append(image,name,details,button);return card;
}
function renderStaking(){
 const data=state?.staking;if(!data||stakingBusy)return;
 if(stakingClockData!==data){stakingClockData=data;stakingClockSkew=data.now*1000-Date.now()}
 $('stakingRulesText').textContent=tr('Первые {count} шляп, внесённые в стейкинг всеми пользователями суммарно, получают {low}% в сутки. Начиная с {next}-й шляпы — {high}%. Лимит общий для всего сайта, а не для одного пользователя. Новые внесения не снижают ставку первых {count} шляп.',{count:data.rate_threshold??100,next:(data.rate_threshold??100)+1,low:data.base_percent_per_day??1,high:data.above_percent_per_day??.5})+' '+tr('В стейкинг можно отправить только шляпу, поступившую при пополнении. Для неё нужно выбрать: стейкинг или зачисление стоимости на баланс. Шляпы из обычного инвентаря не принимаются. Доход рассчитывается от флора обычной шляпы, независимо от модели и фона. Ставка каждой шляпы указана в её карточке. Первые 3 дня шляпа заморожена. После возврата в инвентарь — ещё 3 дня без продажи и вывода. Повторное внесение из инвентаря недоступно. Доход начисляется постепенно, без капитализации.');
 $('stakingBalance').textContent=fmt(data.balance_ton,6)+' GRAM';$('stakingDaily').textContent=fmt(data.daily_ton,6)+' '+tr('GRAM / сутки');
 $('stakingHatCount').textContent=tr('Шляп в стейкинге: {count}',{count:data.positions.length});
 $('stakingBase').textContent=data.price_available?`База для новой шляпы: ${fmt(data.base_ton,6)} GRAM. Доход: ${fmt(data.new_daily_ton,6)} GRAM в сутки.`:'Цена обычной шляпы на Portals пока недоступна. Уже внесённые шляпы продолжают приносить доход по своей фиксированной ставке.';
 $('stakingTransfer').disabled=stakingBusy||data.balance_ton<.000001;
 $('stakingAdd').hidden=!data.eligible.length;$('stakingAdd').disabled=stakingBusy;
 const signature=JSON.stringify(data.positions.map(p=>[p.id,p.image,p.name]));
 if(signature!==stakingGridSignature){stakingGridSignature=signature;const list=$('stakingPositions');list.replaceChildren();for(const p of data.positions)list.append(stakingItem(p,true))}
 $('stakingEmpty').hidden=data.positions.length>0;
 const eligible=$('stakingEligible');eligible.replaceChildren();for(const p of data.eligible)eligible.append(stakingItem(p,false));
 $('stakingEligibleEmpty').hidden=data.eligible.length>0;
 if(stakingDepositCurrent&&!data.eligible.some(p=>p.id===stakingDepositCurrent.id)){$('stakingDepositModal').hidden=true;stakingDepositCurrent=null}
 renderStakingPosition();
 stakingCheckDeposits();
}
function openStakingPosition(id){stakingInventoryGift=false;stakingPositionId=id;renderStakingPosition();$('stakingPositionModal').hidden=false}
function openInventoryGift(prize){stakingInventoryGift=true;stakingPositionId=prize.id;renderStakingPosition();$('stakingPositionModal').hidden=false}
function renderStakingPosition(){
 if(stakingPositionId===null)return;const data=state?.staking,active=data?.positions.find(p=>p.id===stakingPositionId),prize=active||(stakingInventoryGift?state?.prizes.find(p=>p.id===stakingPositionId):null);
 if(!prize){$('stakingPositionModal').hidden=true;stakingPositionId=null;return}
 $('stakingPositionTitle').textContent=prize.name;const image=$('stakingPositionImage'),source=prize.image||hatAsset(prize.tier);if(image.getAttribute('src')!==source)image.src=source;image.alt=prize.name;
 const earned=active?prize.earned_ton+Math.max(0,stakingNow()-data.now)*prize.daily_ton/86400:prize.staking_earned_ton||0;
 $('stakingPositionEarned').hidden=!active&&prize.staking_earned_ton==null;
 $('stakingPositionDaily').hidden=!active;$('stakingPositionReturn').hidden=!active;
 $('stakingPositionEarned').textContent=tr('Заработано с этой шляпы: {amount} GRAM',{amount:fmt(Math.floor(earned*1e6)/1e6,6)});
 if(active)$('stakingPositionDaily').textContent=tr('Доход в сутки: {amount} GRAM · {percent}%',{amount:fmt(prize.daily_ton,6),percent:prize.percent_per_day??data.percent_per_day});
 if(!active){$('stakingPositionTime').textContent=prize.staking_lock_until>stakingNow()?tr('До возврата: {time}',{time:stakingRemaining(prize.staking_lock_until)}):tr('Подарок находится в инвентаре. В стейкинг принимаются только новые поступления шляп.');return}
 const remaining=prize.unlock_at-stakingNow(),button=$('stakingPositionReturn');button.disabled=stakingBusy||remaining>0;
 button.textContent=remaining>0?stakingRemaining(prize.unlock_at):tr('Вернуть в инвентарь');
 $('stakingPositionTime').textContent=remaining>0?tr('До возврата: {time}',{time:stakingRemaining(prize.unlock_at)}):tr('Шляпу можно вернуть в инвентарь');
}
function openStakingDeposit(prize){
 if(stakingBusy)return;stakingDepositCurrent=prize;$('stakingAddModal').hidden=true;
 $('stakingDepositImage').src=prize.image||hatAsset(prize.tier);$('stakingDepositImage').alt=prize.name;$('stakingDepositName').textContent=prize.name;
 $('stakingDepositAmount').textContent=tr('На баланс (+10%): {amount} GRAM',{amount:fmt(prize.credit_ton,6)});
 $('stakingDepositHoldValue').textContent=tr('Стоимость шляпы в холде: {amount} GRAM',{amount:fmt(prize.value_ton,6)});
 $('stakingDepositDaily').textContent=tr('Доход стейкинга: {amount} GRAM в сутки от флора обычной шляпы',{amount:fmt(state.staking.new_daily_ton,6)});
 $('stakingDepositStake').disabled=!sectionAvailable('staking')||!state.staking.price_available;
 $('stakingDepositCash').disabled=false;$('stakingDepositModal').hidden=false;
}
function stakingCheckDeposits(){
 if(stakingBusy||spinning||coinBusy||cxBusy||document.querySelector('.modal:not([hidden])'))return;
 const prize=state?.staking?.eligible?.find(p=>!stakingDeferred.has(p.id));if(prize)openStakingDeposit(prize);
}
function stakingTick(){
 if(document.hidden)return;
 if(!$('stakingPositionModal').hidden)renderStakingPosition();
 stakingCheckDeposits();
 for(const el of document.querySelectorAll('[data-staking-until]')){
  const until=Number(el.dataset.stakingUntil);
  if(until>stakingNow())el.textContent=stakingRemaining(until);
  else if(el.matches('[data-staking-action]')){delete el.dataset.stakingUntil;el.textContent=el.dataset.stakingAction==='remove'?'Вернуть в инвентарь':'Добавить в стейкинг'}
  else if(el.classList.contains('staking-locked')){delete el.dataset.stakingUntil;el.textContent='Проверяем…';refresh()}
  else el.textContent='Блокировка завершена';
 }
 const d=state?.staking;if(currentView!=='staking'||!d)return;
 const live=d.balance_ton+Math.max(0,stakingNow()-d.now)*d.daily_ton/86400;
 $('stakingBalance').textContent=fmt(Math.floor(live*1e6)/1e6,6)+' GRAM';
 if(!stakingBusy)$('stakingTransfer').disabled=live<.000001;
}
document.addEventListener('DOMContentLoaded',()=>{
 $('stakingPositionClose').onclick=()=>{$('stakingPositionModal').hidden=true;stakingPositionId=null};
 $('stakingPositionReturn').onclick=()=>{const prize=state?.staking?.positions.find(p=>p.id===stakingPositionId);if(prize)stakingAction('remove',prize)};
 $('stakingDepositStake').onclick=()=>stakingAction('add',stakingDepositCurrent);
 $('stakingDepositCash').onclick=()=>stakingAction('deposit/balance',stakingDepositCurrent);
 $('stakingDepositLater').onclick=()=>{if(stakingBusy)return;stakingDeferred.add(stakingDepositCurrent.id);$('stakingDepositModal').hidden=true};
 $('stakingInfo').onclick=()=>$('stakingInfoModal').hidden=false;$('stakingInfoClose').onclick=()=>$('stakingInfoModal').hidden=true;
 $('menuStaking').onclick=()=>showView('staking');
 $('stakingAdd').onclick=()=>{renderStaking();$('stakingAddModal').hidden=false};
 $('stakingTransfer').onclick=()=>stakingAction('withdraw');
 $('stakingAddClose').onclick=()=>$('stakingAddModal').hidden=true;
 $('stakingLockClose').onclick=()=>$('stakingLockModal').hidden=true;
 for(const id of ['stakingInfoModal','stakingAddModal','stakingLockModal'])$(id).onclick=e=>{if(e.target===$(id))$(id).hidden=true};
});
setInterval(stakingTick,1000);
