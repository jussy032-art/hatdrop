'use strict';
let promoDraftRewards = [], promoEditing = null,promoPersonal=false;
function promoRewardLabel(r) {
  if(r.kind==='deposit_bonus')return `+${r.percent}% к первому пополнению`;
  if(r.kind==='free_spin')return `${r.count} Free Spin Coins`;
  return r.kind==='balance' ? `${r.amount} GRAM` : r.kind==='hatcoin' ? `${r.amount} HatCoin` : (r.name||r.weapon||r.gift||'Награда')+(r.model?' / '+r.model:'');
}
function promoConditionLabel(c) {
  return c.kind==='level' ? `Уровень от ${c.min}` : c.kind==='turnover' ? `Оборот от ${c.min} GRAM` : `Пополнения от ${c.min} GRAM ${c.hours ? 'за последние '+c.hours+' ч.' : 'за всё время'}`;
}
function promoDescribe(item) {
  return (item.rewards||[item]).map(promoRewardLabel).join(' + ');
}
function promoRenderDraft() {
  const box=$('admPromoRewards');box.replaceChildren();
  promoDraftRewards.forEach((reward,index)=>{
    const remove=admField('button',{type:'button',textContent:'Удалить'});
    remove.onclick=()=>{promoDraftRewards.splice(index,1);promoRenderDraft()};
    const row=admField('div',{className:'adm-form promo-draft-row'});row.append(admField('span',{textContent:promoRewardLabel(reward)}),remove);box.append(row);
  });
}
function promoReadReward() {
  const kind=$('admPromoRewardKind').value;
  if(kind==='deposit_bonus')return {kind,percent:Number($('admPromoDepositPercent').value)};
  if(kind==='free_spin')return {kind,tier:'random',chance:10,count:Number($('admPromoFreeCount').value)};
  if(kind==='balance'||kind==='hatcoin') {
    const amount=Number($('admPromoAmount').value);
    if(!Number.isFinite(amount)||amount<=0)throw Error('Укажите положительную сумму награды.');
    return {kind,amount};
  }
  if(kind==='gift') {
    if(!promoGift)throw Error('Выберите подарок.');
    return {kind,gift:promoGift.slug,name:promoGift.name};
  }
  const select=$('admPromoItem');
  if(!select.value)throw Error('Выберите оружие, прокрут или оформление.');
  return {kind,weapon:select.value,name:select.selectedOptions[0].textContent};
}
function promoAddCondition(value={kind:'turnover',min:1,hours:0}) {
  if($('admPromoConditions').children.length>=10)return toast('Не более 10 условий',true);
  const row=admField('div',{className:'adm-box promo-condition'});
  const kind=admField('select',{className:'gp-search','ariaLabel':'Вид условия'});
  for(const [id,label]of [['turnover','Оборот, GRAM'],['level','Уровень'],['deposit','Подтверждённые пополнения, GRAM']])kind.append(admField('option',{value:id,textContent:label}));kind.value=value.kind;
  const min=admField('input',{type:'number',className:'gp-search',value:value.min,min:.01,step:.01,ariaLabel:'Минимальное значение'});
  const period=admField('select',{className:'gp-search',ariaLabel:'Период пополнений'});
  for(const [id,label]of [['0','За всё время'],['1','За последний час'],['24','За последние 24 часа'],['custom','Другой период в часах']])period.append(admField('option',{value:id,textContent:label}));
  period.value=[0,1,24].includes(value.hours||0)?String(value.hours||0):'custom';
  const hours=admField('input',{type:'number',className:'gp-search',value:value.hours||1,min:.01,max:87600,step:.01,ariaLabel:'Период в часах'});
  const sync=()=>{period.hidden=kind.value!=='deposit';hours.hidden=kind.value!=='deposit'||period.value!=='custom';min.step=kind.value==='level'?'1':'.01';min.min=kind.value==='level'?'1':'.01'};
  kind.onchange=period.onchange=sync;sync();
  const remove=admField('button',{type:'button',textContent:'Удалить условие'});remove.onclick=()=>row.remove();
  row.readCondition=()=>({kind:kind.value,min:Number(min.value),hours:kind.value==='deposit'?(period.value==='custom'?Number(hours.value):Number(period.value)):0});
  row.append(kind,min,period,hours,remove);$('admPromoConditions').append(row);
}
function promoResetForm() {
  promoEditing=null;promoDraftRewards=[];promoGift=null;promoPersonal=false;$('admPromoOwner').value='';$('admPromoOwner').readOnly=false;$('admPromoLimit').readOnly=false;
  $('admPromoCode').value='';$('admPromoCode').readOnly=false;$('admPromoLimit').value=1;
  $('admPromoAmount').value='';$('admPromoSelected').textContent='Подарок не выбран';$('admPromoConditions').replaceChildren();promoRenderDraft();
  $('admPromoCreate').textContent='Создать промокод';$('admPromoCancelEdit').hidden=true;
}
function promoEdit(item) {
  promoPersonal=!!item.personal_referral;$('admPromoOwner').value=item.owner_uid||'';$('admPromoOwner').readOnly=promoPersonal||item.uses>0;$('admPromoLimit').readOnly=promoPersonal;
  promoEditing=item.code;promoDraftRewards=(item.rewards||[item]).map(r=>({...r}));promoRenderDraft();
  $('admPromoCode').value=item.code;$('admPromoCode').readOnly=true;$('admPromoLimit').value=item.limit;
  $('admPromoConditions').replaceChildren();(item.conditions||[]).forEach(promoAddCondition);
  $('admPromoCreate').textContent='Сохранить промокод';$('admPromoCancelEdit').hidden=false;
  $('admPromoCode').scrollIntoView({block:'center'});$('admPromoCode').focus();
}
async function admLoadReferralDefaults(){try{const r=await api('/api/admin/referral/defaults'),cfg=r.config;if(!cfg)return;$('refDefaultEnabled').checked=cfg.enabled;$('refDefaultPercent').value=cfg.deposit_percent;$('refDefaultCount').value=cfg.spin_count;$('refDefaultChance').value=cfg.spin_chance;$('refDefaultTier').value=cfg.spin_tier}catch(e){admErr(e)}}
function initPromoBuilder() {
  $('admPromoRewardKind').onchange=()=>{
    const kind=$('admPromoRewardKind').value;
    $('admPromoDepositField').hidden=kind!=='deposit_bonus';$('admPromoFreeField').hidden=kind!=='free_spin';
    $('admPromoAmount').hidden=!['balance','hatcoin'].includes(kind);$('admPromoGiftField').hidden=kind!=='gift'&&!(kind==='free_spin'&&$('admPromoFreeTier').value==='gift');$('admPromoItem').hidden=kind!=='item';
    $('admPromoAmount').step=kind==='hatcoin'?'.000001':'.01';
    if(kind==='item'&&!$('admPromoItem').options.length)admFillItems($('admPromoItem'));
  };
  $('admPromoFreeTier').onchange=()=>$('admPromoRewardKind').onchange();
  $('refDefaultsForm').onsubmit=async e=>{e.preventDefault();const b=$('refDefaultsSave');b.disabled=true;try{await api('/api/admin/referral/defaults',{save:true,config:{enabled:$('refDefaultEnabled').checked,deposit_percent:Number($('refDefaultPercent').value),spin_count:Number($('refDefaultCount').value),spin_chance:Number($('refDefaultChance').value),spin_tier:$('refDefaultTier').value}});toast('Настройки личных кодов сохранены')}catch(e){admErr(e)}finally{b.disabled=false}};
  $('admPromoChoose').onclick=admChoosePromoGift;
  $('admPromoAddReward').onclick=()=>{try{if(promoDraftRewards.length>=20)throw Error('Не более 20 наград.');promoDraftRewards.push(promoReadReward());$('admPromoAmount').value='';promoRenderDraft()}catch(e){toast(e.message,true)}};
  $('admPromoAddCondition').onclick=()=>promoAddCondition();$('admPromoCancelEdit').onclick=promoResetForm;
  $('admPromoCreate').onclick=async()=>{
    const button=$('admPromoCreate');if(button.disabled)return;
    let rewards;try{rewards=promoDraftRewards.length?[...promoDraftRewards]:[promoReadReward()]}catch(e){return toast(e.message,true)}
    const body={code:$('admPromoCode').value.trim(),limit:Number($('admPromoLimit').value),rewards,conditions:[...$('admPromoConditions').children].map(row=>row.readCondition())};
    if(promoPersonal)delete body.limit;else body.owner=$('admPromoOwner').value.trim();
    button.disabled=true;
    try{const result=await api(promoEditing?'/api/admin/promos/update':'/api/admin/promos/create',body);toast(promoEditing?'Промокод сохранён':`Создан промокод ${result.code}`);promoResetForm();await admLoadPromos()}
    catch(e){admErr(e)}finally{button.disabled=false}
  };
}

document.addEventListener('DOMContentLoaded',()=>{
 for(const id of ['admPromoFreeChance','refDefaultChance']){const el=$(id);el.value=10;el.disabled=true;el.closest('label')?.setAttribute('hidden','')}
 for(const id of ['admPromoFreeTier','refDefaultTier']){const el=$(id);el.value='random';el.disabled=true;el.closest('label')?.setAttribute('hidden','')}
});
