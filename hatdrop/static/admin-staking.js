'use strict';
let stakingOffset=0;
const stakingAdminRequests=new Map();
async function stakingAdminSave(path,body){
 const signature=path+JSON.stringify(body);if(!stakingAdminRequests.has(signature))stakingAdminRequests.set(signature,crypto.randomUUID());
 const result=await api(path,{...body,request_id:stakingAdminRequests.get(signature)});stakingAdminRequests.delete(signature);return result;
}
async function admLoadStaking(){
 const root=$('stakingAdminRows');root.textContent='Загружаем…';
 try{
  const data=await api('/api/admin/staking',{query:$('stakingAdminSearch').value,offset:stakingOffset});
  $('stakingAdminPercent').value=data.base_percent_per_day??data.percent_per_day;$('stakingAdminAbovePercent').value=data.above_percent_per_day??.5;
  $('stakingAdminTotals').textContent=`Участников: ${data.totals.participants} · шляп: ${data.totals.hats} · начислено: ${fmt(data.totals.balance_ton,6)} GRAM · в сутки: ${fmt(data.totals.daily_ton,6)} GRAM`;
  root.replaceChildren();
  for(const user of data.rows){
   const box=admBox(user.name+' · '+user.id),open=admField('button',{type:'button',textContent:'Открыть пользователя'});
   open.onclick=()=>{admShow('users');admOpenUser(user.key)};
   box.append(admField('p',{textContent:`Шляп: ${user.count} · баланс: ${fmt(user.balance_ton,6)} GRAM · доход: ${fmt(user.daily_ton,6)} GRAM / сутки`}),open);
   const list=admField('div',{className:'adm-staking-gifts'});
   for(const prize of user.positions){const item=admField('div',{className:'adm-staking-gift'});item.append(admField('img',{src:prize.image||hatAsset(prize.tier),alt:''}),admField('span',{textContent:prize.name+' · '+fmt(prize.percent_per_day,4)+'% · '+fmt(prize.daily_ton,6)+' GRAM / сутки · забрать: '+timeLabel(prize.unlock_at)}));list.append(item)}
   if(user.count>user.positions.length)list.append(admField('p',{textContent:'Остальные шляпы — в карточке пользователя.'}));box.append(list);root.append(box);
  }
  if(!data.rows.length)root.append(admField('p',{className:'muted',textContent:'Нет участников по выбранному запросу.'}));
  $('stakingAdminPrev').disabled=stakingOffset===0;$('stakingAdminNext').disabled=data.next_offset===null;
  $('stakingAdminAudit').replaceChildren();for(const row of data.audit){const text=JSON.stringify(row);$('stakingAdminAudit').append(admField('p',{textContent:text}))}
 }catch(e){admErr(e);root.textContent='Не удалось загрузить стейкинг.'}
}
function admStakingUserBox(user){
 const data=user.staking;if(!data)return null;
 const box=admBox('Стейкинг пользователя');
 box.append(admField('p',{textContent:`Баланс начислений: ${fmt(data.balance_ton,6)} GRAM · ${fmt(data.daily_ton,6)} GRAM / сутки · шляп: ${data.positions.length}`}));
 const balance=admField('input',{type:'number',min:'0',step:'0.000001',value:data.balance_ton,'aria-label':'Баланс стейкинга GRAM'}),form=admField('div',{className:'adm-form'});
 for(const [mode,label]of [['set','Установить баланс'],['add','Добавить к балансу']]){const button=admField('button',{type:'button',textContent:label});button.onclick=async()=>{button.disabled=true;try{const result=await stakingAdminSave('/api/admin/staking/user',{key:user.key,action:'balance',mode,amount:Number(balance.value)});admRenderUser(result.user);toast('Баланс стейкинга сохранён')}catch(e){admErr(e)}finally{button.disabled=false}};form.append(button)}
 balance.setAttribute('aria-label','Баланс стейкинга GRAM');box.append(balance,form);
 const list=admField('div',{className:'adm-staking-gifts'});
 for(const prize of data.positions){
  const row=admField('article',{className:'adm-staking-position'}),header=admField('div',{className:'adm-staking-gift'});
  header.append(admField('img',{src:prize.image||hatAsset(prize.tier),alt:''}),admField('b',{textContent:prize.name}));
  row.append(header,admField('p',{textContent:`${fmt(prize.percent_per_day,4)}% · ${fmt(prize.daily_ton,6)} GRAM / сутки · начислено ${fmt(prize.earned_ton,6)} GRAM · забрать с ${timeLabel(prize.unlock_at)}`}));
  const hours=admField('input',{type:'number',min:'0',max:'87600',step:'0.01',value:Math.max(0,(prize.unlock_at-data.now)/3600).toFixed(2),'aria-label':'Часов до разблокировки шляпы'}),save=admField('button',{type:'button',textContent:'Изменить срок'});
  save.onclick=async()=>{save.disabled=true;try{const result=await stakingAdminSave('/api/admin/staking/user',{key:user.key,action:'unlock',prize_id:prize.id,hours:Number(hours.value)});admRenderUser(result.user);toast('Срок разблокировки изменён')}catch(e){admErr(e)}finally{save.disabled=false}};
  hours.setAttribute('aria-label','Часов до разблокировки шляпы');row.append(admField('label',{textContent:'Часов до возврата (0 — доступен сейчас)'}),hours,save);list.append(row);
 }
 if(!data.positions.length)list.append(admField('p',{className:'muted',textContent:'Шляп в стейкинге нет.'}));box.append(list);return box;
}
document.addEventListener('DOMContentLoaded',()=>{
 $('stakingAdminReload').onclick=admLoadStaking;
 $('stakingAdminSearch').oninput=()=>{clearTimeout(window.stakingSearchTimer);window.stakingSearchTimer=setTimeout(()=>{stakingOffset=0;admLoadStaking()},300)};
 $('stakingAdminPrev').onclick=()=>{stakingOffset=Math.max(0,stakingOffset-25);admLoadStaking()};$('stakingAdminNext').onclick=()=>{stakingOffset+=25;admLoadStaking()};
 $('stakingAdminSettings').onsubmit=async e=>{e.preventDefault();const button=$('stakingAdminSave');button.disabled=true;try{await stakingAdminSave('/api/admin/staking/settings',{percent_per_day:Number($('stakingAdminPercent').value),above_percent_per_day:Number($('stakingAdminAbovePercent').value)});toast('Ставка стейкинга сохранена');admLoadStaking()}catch(e){admErr(e)}finally{button.disabled=false}};
});

