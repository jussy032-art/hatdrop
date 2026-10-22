'use strict';
function bcEl(tag,props,...kids){const el=Object.assign(document.createElement(tag),props||{});el.append(...kids);return el}
let bcTimer=0,bcDraft={audience:'all',list:'',text:'',link:'',photo:'',buttons:[]};
function bcErr(e){const text=e?.data?.message||e?.code||'Ошибка';$('panelError').textContent=text;$('panelError').hidden=false;toast(text,true)}
function bcButtonEditor(value={text:'Играть',action:'app',target:'menu',style:'default',icon:''}){
 const row=bcEl('div',{className:'adm-box'}),text=bcEl('input',{value:value.text,maxLength:64,placeholder:'Надпись кнопки'}),action=bcEl('select'),target=bcEl('input',{value:value.target,placeholder:'Раздел игры или HTTPS-ссылка'}),style=bcEl('select'),icon=bcEl('input',{value:value.icon||'',placeholder:'ID эмодзи на кнопке',inputMode:'numeric'});
 for(const[v,l]of [['app','Раздел игры'],['url','HTTPS-ссылка']])action.append(bcEl('option',{value:v,textContent:l}));action.value=value.action;
 for(const[v,l]of [['default','Обычный цвет'],['primary','Синий'],['success','Зелёный'],['danger','Красный']])style.append(bcEl('option',{value:v,textContent:l}));style.value=value.style||'default';
 const emoji=bcEl('button',{type:'button',textContent:'Эмодзи на кнопку'});emoji.onclick=()=>admEmojiPicker(item=>{icon.value=item.id;row.dispatchEvent(new Event('change',{bubbles:true}))}).catch(bcErr);
 const remove=bcEl('button',{type:'button',textContent:'Удалить кнопку'});remove.onclick=()=>{row.remove();document.getElementById('bcComposer')?.dispatchEvent(new Event('change',{bubbles:true}))};
 row.read=()=>({text:text.value,action:action.value,target:target.value.trim(),style:style.value,icon:icon.value.trim()});row.append(text,action,target,style,icon,emoji,remove);return row;
}
async function admLoadBroadcast(){
 clearTimeout(bcTimer);const root=$('admBroadcast');
 try{
  const data=await api('/api/admin/broadcast/list');root.replaceChildren();const box=bcEl('div',{className:'adm-box',id:'bcComposer'},bcEl('h3',{textContent:'Рассылка в боте'}));
  box.append(bcEl('p',{className:'muted',textContent:`Получателей: ${data.users}. Фото, текст, premium-эмодзи и до 8 кнопок. Ссылка на пост копирует его как есть и заменяет редактор ниже.`}));
  const audience=bcEl('select');audience.append(bcEl('option',{value:'all',textContent:'Все пользователи'}),bcEl('option',{value:'list',textContent:'Выбранные пользователи'}));audience.value=bcDraft.audience;
  const list=bcEl('textarea',{rows:2,value:bcDraft.list,placeholder:'@username или Telegram ID через пробел'}),link=bcEl('input',{value:bcDraft.link,placeholder:'Ссылка на пост канала (необязательно)'}),text=bcEl('textarea',{rows:6,maxLength:3500,value:bcDraft.text,placeholder:'<b>жирный</b>, <i>курсив</i>, {name}, [emoji:ID:символ]. С фото — до 900 символов.'});
  const photo=bcEl('input',{value:bcDraft.photo,placeholder:'HTTPS-ссылка на фото или загруженный файл'}),file=bcEl('input',{type:'file',accept:'image/png,image/jpeg,image/webp'}),preview=bcEl('img',{alt:'Фото рассылки',src:bcDraft.photo,hidden:!bcDraft.photo});preview.style.cssText='max-width:240px;max-height:240px;object-fit:contain';
  const buttons=bcEl('div',{id:'bcButtons'});for(const b of bcDraft.buttons)buttons.append(bcButtonEditor(b));
  const payload=()=>({audience:audience.value,list:list.value,link:link.value.trim(),text:text.value,photo:photo.value.trim(),buttons:[...buttons.children].map(row=>row.read())});
  const remember=()=>{bcDraft=payload();list.hidden=audience.value!=='list';preview.hidden=!photo.value;if(preview.getAttribute('src')!==photo.value)preview.src=photo.value};box.addEventListener('input',remember);box.addEventListener('change',remember);
  file.onchange=async()=>{file.disabled=true;try{const r=await admUploadImage(file.files[0]);photo.value=r.url;remember()}catch(e){bcErr(e)}finally{file.disabled=false}};
  const clear=bcEl('button',{type:'button',textContent:'Убрать фото'});clear.onclick=()=>{photo.value='';file.value='';remember()};
  const emoji=bcEl('button',{type:'button',textContent:'Premium-эмодзи в текст'});emoji.onclick=()=>admEmojiPicker(item=>{text.setRangeText(`[emoji:${item.id}:${item.emoji||'⭐'}]`,text.selectionStart,text.selectionEnd,'end');remember();text.focus()}).catch(bcErr);
  const add=bcEl('button',{type:'button',textContent:'+ Добавить кнопку'});add.onclick=()=>{if(buttons.children.length>=8)return toast('До 8 кнопок',true);buttons.append(bcButtonEditor());remember()};
  const test=bcEl('button',{type:'button',textContent:'Отправить тест себе'});test.onclick=async()=>{test.disabled=true;try{await api('/api/admin/broadcast/test',payload());toast('Тест отправлен вам в бота')}catch(e){bcErr(e)}finally{test.disabled=false}};
  const start=bcEl('button',{type:'button',className:'primary',textContent:'Запустить рассылку'});start.onclick=async()=>{if(!confirm(audience.value==='all'?`Отправить всем пользователям (${data.users})?`:'Отправить выбранным пользователям?'))return;start.disabled=true;try{remember();const r=await api('/api/admin/broadcast/start',payload());toast('Рассылка запущена: '+r.total);admLoadBroadcast()}catch(e){bcErr(e)}finally{start.disabled=false}};
  box.append(bcEl('label',{},'Получатели',audience),list,bcEl('label',{},'Пост канала',link),bcEl('label',{},'Текст / подпись к фото',text),emoji,bcEl('label',{},'Фото до 5 МБ',file),photo,preview,clear,bcEl('h4',{textContent:'Кнопки'}),bcEl('p',{className:'muted',textContent:'Разделы: menu, upgrade, chests, leaders, quests, profile. Для ссылки выберите HTTPS-ссылка.'}),buttons,add,bcEl('div',{className:'adm-form'},test,start));root.append(box);remember();
  const history=bcEl('div',{className:'adm-box'},bcEl('h3',{textContent:'История рассылок'}));
  for(const row of data.rows)history.append(bcEl('p',{className:'muted',textContent:`${new Date(row.created*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} · ${row.kind==='photo'?'фото':row.kind==='post'?'пост':'текст'} · ${row.status==='running'?'идёт':'завершена'} · ${row.sent}/${row.total} · ошибок ${row.failed} · заблокировали ${row.blocked}${row.error?' · '+row.error:''}`}));
  if(!data.rows.length)history.append(bcEl('p',{className:'muted',textContent:'Рассылок пока нет.'}));const refresh=bcEl('button',{type:'button',textContent:'Обновить статус'});refresh.onclick=()=>{remember();admLoadBroadcast()};history.append(refresh);root.append(history);
 }catch(e){bcErr(e)}
}
