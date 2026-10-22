'use strict';
async function seBossEditor(cur) {
 const running=cur&&!cur.finished,box=seEl('div',{className:'adm-box se-boss-editor'}),mode=seEl('select',{disabled:!!running});
 mode.append(seEl('option',{value:'normal',textContent:'Обычный лидерборд'}),seEl('option',{value:'boss',textContent:'Лидерборд с боссом'}));mode.value=cur?.mode||'normal';
 const fields=seEl('div'),boss=cur?.boss||{};
 const number=(value,min,max,step='any')=>seEl('input',{type:'number',min,max,step,value});
 const name=seEl('input',{value:boss.name||'',placeholder:'Имя босса',maxLength:60}),hp=number(boss.hp||100000,1,1000000000),ratio=number(boss.ton_per_hp||1,.000001,1000000),damage=number(boss.damage||0,0,1000000000);
 const rates={upgrade:number(boss.damage_rates?.upgrade??1,0,1000),chests:number(boss.damage_rates?.chests??1,0,1000)};
 const file=seEl('input',{type:'file',accept:'image/png,image/jpeg,image/webp'}),image=seEl('img',{src:boss.image||'',alt:'Предпросмотр босса',hidden:!boss.image});image.style.maxWidth='220px';image.style.maxHeight='220px';image.style.objectFit='contain';
 let asset=boss.image||'';const upload=seEl('p',{className:'muted',textContent:'Прозрачный PNG будет плавно парить. Сплошное изображение заполнит рамку.'});
 file.onchange=async()=>{file.disabled=true;try{const r=await admUploadImage(file.files[0]);asset=r.url;image.src=r.url;image.hidden=false;upload.textContent=r.transparent?'Прозрачный фон: плавное парение':'Сплошное изображение: без движения'}catch(e){seErr(e)}finally{file.disabled=false}};
 let items=[];try{items=(await api('/api/admin/levels')).items||[]}catch(e){seErr(e)}
 const rewards=seEl('div'),editors=[];
 function addReward(old={kind:'free_coin',amount:1}){
  const row=seEl('div',{className:'adm-form'}),kind=seEl('select'),amount=number(old.amount||1,.000001,100000),item=seEl('select'),remove=seEl('button',{type:'button',textContent:'Убрать'});
  for(const[v,l]of [['hatcoin','HatCoin'],['balance','GRAM'],['free_coin','Монеты фриспина'],['item','Снаряжение или оформление'],['gift','Подарок (сохранённый)']])kind.append(seEl('option',{value:v,textContent:l,disabled:v==='gift'&&old.kind!=='gift'}));kind.value=old.kind;
  for(const w of items)if(!w.default)item.append(seEl('option',{value:w.id,textContent:w.name}));item.value=old.weapon||item.value;
  const saved=seEl('span',{textContent:old.name||old.target?.name||''});
  const sync=()=>{amount.hidden=!['hatcoin','balance','free_coin'].includes(kind.value);amount.step=kind.value==='free_coin'?'1':'any';amount.min=kind.value==='free_coin'?'1':'.000001';item.hidden=kind.value!=='item';saved.hidden=kind.value!=='gift'};kind.onchange=sync;sync();
  const editor={read:()=>kind.value==='gift'?old:kind.value==='item'?{kind:'item',weapon:item.value}:{kind:kind.value,amount:Number(amount.value)}};
  remove.onclick=()=>{editors.splice(editors.indexOf(editor),1);row.remove()};editors.push(editor);row.append(kind,amount,item,saved,remove);rewards.append(row);
 }
 for(const reward of cur?.participant_rewards||[])addReward(reward);
 const add=seEl('button',{type:'button',textContent:'＋ Награда каждому участнику'});add.onclick=()=>addReward();
 fields.append(seEl('label',{},'Название босса',name),seEl('label',{},'Изображение до 5 МБ',file),image,upload,seEl('label',{},'Максимум HP',hp),seEl('label',{},'GRAM оборота за 1 HP',ratio),seEl('label',{},'Множитель урона: апгрейды',rates.upgrade),seEl('label',{},'Множитель урона: сундуки',rates.chests));
 if(running)fields.append(seEl('label',{},'Уже нанесённый общий урон (HP)',damage));
 fields.append(seEl('p',{className:'muted',textContent:'Новые коэффициенты применяются к следующим ставкам. Уже нанесённый игроками урон сохраняется. Множитель 0 отключает урон этого режима.'}),seEl('h4',{textContent:'Награды всем участникам с уроном'}),rewards,add);
 const sync=()=>fields.hidden=mode.value!=='boss';mode.onchange=sync;sync();box.append(seEl('label',{},'Режим рейтинга',mode),fields);
 return {node:box,read(){if(mode.value!=='boss')return {mode:'normal'};if(!asset)throw {data:{message:'Загрузите изображение босса.'}};return {mode:'boss',boss:{name:name.value,image:asset,hp:Number(hp.value),ton_per_hp:Number(ratio.value),damage_rates:{upgrade:Number(rates.upgrade.value),chests:Number(rates.chests.value)},...(running&&Number(damage.value)!==Number(boss.damage||0)?{damage:Number(damage.value)}:{})},participant_rewards:editors.map(e=>e.read())}}};
}
