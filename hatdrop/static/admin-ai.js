'use strict';
const aiUi={initialized:false,catalog:null,configured:false,cid:'',active:'',timer:0,pending:null,loading:false};
function aiNode(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function aiNotice(message,error=false){const node=$('aiNotice');node.textContent=message||'';node.classList.toggle('error',error);node.hidden=!message}
function aiBusy(busy){$('aiSend').disabled=busy||!aiUi.configured||!aiUi.catalog;$('aiSend').textContent=busy?'Генерация…':$('aiMode').value==='chat'?'Отправить':'Сгенерировать';$('aiSaveKey').disabled=busy;$('aiNewChat').disabled=busy;$('aiClearKey').disabled=busy||!aiUi.configured}
function aiConfig(data){aiUi.configured=!!data.configured;$('aiKeyState').textContent=data.configured?'Ключ сохранён · …'+data.key_tail:'Ключ ещё не добавлен';aiBusy(!!aiUi.active)}
function aiModels(){
 const mode=$('aiMode').value,select=$('aiModel'),old=select.value;select.replaceChildren();
 for(const model of aiUi.catalog?.[mode==='image'?'images':'text']||[]){const opt=document.createElement('option');opt.value=model.id;opt.textContent=model.name+(mode!=='image'&&model.ratio?' · ×'+model.ratio:'');select.append(opt)}
 if([...select.options].some(o=>o.value===old))select.value=old;
 $('aiQualityLabel').hidden=mode!=='image';aiQuality();aiBusy(!!aiUi.active);
 $('aiPrompt').placeholder=mode==='image'?'Опишите изображение: сюжет, стиль, цвета…':mode==='post'?'О чём написать пост? Укажите аудиторию, тон и важные детали…':'Задайте вопрос или опишите задачу…';
}
function aiQuality(){const model=(aiUi.catalog?.[$('aiMode').value==='image'?'images':'text']||[]).find(m=>m.id===$('aiModel').value),quality=$('aiQuality'),old=quality.value;quality.replaceChildren();for(const name of Object.keys(model?.tiers||{})){const opt=document.createElement('option');opt.value=name;opt.textContent=({auto:'Авто',low:'Низкое',medium:'Среднее',high:'Высокое'})[name]||name;quality.append(opt)}if([...quality.options].some(o=>o.value===old))quality.value=old;else if([...quality.options].some(o=>o.value==='medium'))quality.value='medium';aiTariff()}
function aiTariff(){const mode=$('aiMode').value,model=(aiUi.catalog?.[mode==='image'?'images':'text']||[]).find(m=>m.id===$('aiModel').value);$('aiTariff').textContent=mode==='image'&&model?.tiers?.[$('aiQuality').value]!=null?'Тариф: '+fmt(model.tiers[$('aiQuality').value],0)+' токенов за изображение.':model?.ratio?'Ставка ×'+model.ratio+'. Расход зависит от размера запроса и ответа.':''}
function aiInit(){if(aiUi.initialized)return;aiUi.initialized=true;
 $('aiKeyForm').onsubmit=async event=>{event.preventDefault();const key=$('aiKey').value.trim();if(!key)return;const button=$('aiSaveKey');button.disabled=true;try{const result=await api('/api/admin/ai/key',{key});$('aiKey').value='';aiConfig(result);aiNotice('Ключ сохранён на сервере.');await aiDashboard()}catch(e){aiNotice(e.data?.message||'Не удалось сохранить ключ',true)}finally{aiBusy(!!aiUi.active)}};
 $('aiClearKey').onclick=async()=>{try{const result=await api('/api/admin/ai/key',{clear:true});aiConfig(result);aiRenderStats(null);aiNotice('Ключ удалён.')}catch(e){aiNotice(e.data?.message||'Не удалось удалить ключ',true)}};
 $('aiReload').onclick=()=>admLoadAI();$('aiNewChat').onclick=()=>{aiUi.cid='';aiUi.pending=null;$('aiChatTitle').textContent='Новый чат';$('aiMessages').replaceChildren(aiNode('p','ai-empty','Выберите модель и напишите запрос.'));$('aiPrompt').focus()};
 $('aiMode').onchange=aiModels;$('aiModel').onchange=aiQuality;$('aiQuality').onchange=aiTariff;
 $('aiPromptForm').onsubmit=aiSend;
 $('aiPrompt').onkeydown=event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();$('aiPromptForm').requestSubmit()}};
}
async function aiDashboard(){if(!aiUi.configured){aiRenderStats(null);return}try{const result=await api('/api/admin/ai/dashboard');aiConfig(result);aiRenderStats(result.stats);if(result.conversations)aiConversations(result.conversations)}catch(e){aiNotice(e.data?.message||'Статистика TokenWave недоступна',true)}}
function aiRenderStats(stats){$('aiRemaining').textContent=stats?.unlimited?'∞':stats?.remaining==null?'—':fmt(stats.remaining,0);$('aiUsed').textContent=stats?.used==null?'—':fmt(stats.used,0);$('aiRequests').textContent=stats?.totals?.requests==null?'—':fmt(stats.totals.requests,0);const rows=$('aiUsageRows');rows.replaceChildren();for(const item of stats?.recent||[]){const row=document.createElement('tr');for(const value of [item.at?new Date(item.at*1000).toLocaleString('ru-RU'):'—',item.model,item.in==null?'—':fmt(item.in,0),item.out==null?'—':fmt(item.out,0),item.spent==null?'—':fmt(item.spent,0)])row.append(aiNode('td','',value));rows.append(row)}if(!rows.children.length){const row=document.createElement('tr'),cell=aiNode('td','muted',stats?'Запросов пока нет':'Добавьте ключ, чтобы увидеть расход.');cell.colSpan=5;row.append(cell);rows.append(row)}}
function aiConversations(items){const root=$('aiConversations');root.replaceChildren();for(const item of items){const button=aiNode('button',item.id===aiUi.cid?'on':'',item.title||'Чат');button.type='button';button.onclick=()=>aiOpenConversation(item.id);root.append(button)}if(!items.length)root.append(aiNode('p','muted','Здесь появятся ваши чаты.'))}
async function aiOpenConversation(id){try{const result=await api('/api/admin/ai/conversation',{id});aiUi.cid=id;$('aiChatTitle').textContent=result.conversation.title;aiRenderMessages(result.conversation.messages||[])}catch(e){aiNotice(e.data?.message||'Не удалось открыть чат',true)}}
function aiRenderMessages(messages){const root=$('aiMessages');root.replaceChildren();for(const message of messages){const card=aiNode('article','ai-message '+message.role);card.append(aiNode('b','ai-message-who',message.role==='user'?'Вы':message.model||'AI'));card.append(aiNode('div','ai-message-text',message.content||''));if(message.image){const image=document.createElement('img');image.src=message.image;image.alt='Сгенерированное изображение';image.loading='lazy';card.append(image);const link=aiNode('a','button','Скачать изображение');link.href=message.image;link.download='image.'+message.image.split('.').pop();link.target='_blank';link.rel='noopener';card.append(link)}else if(message.role==='assistant'){const copy=aiNode('button','','Копировать');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(message.content);toast('Текст скопирован')}catch(_){toast('Не удалось скопировать',true)}};card.append(copy)}if(message.usage?.total_tokens!=null)card.append(aiNode('small','muted','Токены запроса: '+fmt(message.usage.total_tokens,0)));root.append(card)}if(!messages.length)root.append(aiNode('p','ai-empty','Выберите модель и напишите запрос.'));root.scrollTop=root.scrollHeight}
async function aiSend(event){event.preventDefault();if(aiUi.active)return;const prompt=$('aiPrompt').value.trim();if(!prompt||!$('aiModel').value)return;
 const payload={mode:$('aiMode').value,model:$('aiModel').value,prompt,conversation_id:aiUi.cid,quality:$('aiMode').value==='image'?$('aiQuality').value:''},signature=JSON.stringify(payload);
 if(!aiUi.pending||aiUi.pending.signature!==signature)aiUi.pending={signature,payload:{...payload,request_id:crypto.randomUUID()}};
 aiBusy(true);aiNotice('Запрос отправляется…');
 try{const result=await api('/api/admin/ai/generate',aiUi.pending.payload);aiUi.pending=null;aiUi.active=result.job.id;aiUi.cid=result.job.conversation_id;$('aiPrompt').value='';await aiOpenConversation(aiUi.cid);aiNotice('Модель готовит ответ…');aiPoll()}
 catch(e){aiNotice(e.data?.message||'Ответ не получен. Повтор с тем же текстом не создаст второй запрос.',true);aiBusy(false)}
}
async function aiPoll(){clearTimeout(aiUi.timer);if(!aiUi.active)return;if($('admAI').hidden){aiUi.timer=setTimeout(aiPoll,3000);return}
 try{const response=await api('/api/admin/ai/job',{id:aiUi.active}),job=response.job;if(['queued','running'].includes(job.status)){aiUi.timer=setTimeout(aiPoll,1200);return}aiUi.active='';aiBusy(false);await aiOpenConversation(job.conversation_id);aiNotice(job.status==='done'?'Готово.':job.error||'Генерация прервана.',job.status!=='done');await aiDashboard()}
 catch(e){aiNotice(e.data?.message||'Не удалось получить статус. Проверяем ещё раз…',true);aiUi.timer=setTimeout(aiPoll,3000)}
}
async function admLoadAI(){aiInit();if(aiUi.loading)return;aiUi.loading=true;try{
 const status=await api('/api/admin/ai/status');aiConfig(status);aiConversations(status.conversations||[]);
 if(!aiUi.catalog){try{aiUi.catalog=await api('/api/admin/ai/models');aiModels()}catch(e){aiNotice(e.data?.message||'Не удалось загрузить модели TokenWave',true)}}
 const active=(status.jobs||[]).find(j=>['queued','running'].includes(j.status));if(active){aiUi.active=active.id;aiUi.cid=active.conversation_id;aiBusy(true);aiPoll()}
 if(aiUi.cid)await aiOpenConversation(aiUi.cid);else if(status.conversations?.length)await aiOpenConversation(status.conversations[0].id);else aiRenderMessages([]);
 const last=status.jobs?.[0];if(last&&['error','interrupted'].includes(last.status))aiNotice(last.error||'Предыдущая генерация не завершилась.',true);
 await aiDashboard();
}catch(e){aiNotice(e.data?.message||'Не удалось загрузить AI',true)}finally{aiUi.loading=false;aiBusy(!!aiUi.active)}}
