'use strict';
let copyOffset=0,copySelected=null;
function copySelect(row){copySelected=row.key;$('copyKey').value=row.key;for(const language of ['ru','en','zh'])$('copy'+language).value=row.texts[language]||row.key;$('copyForm').hidden=false}
async function admLoadCopy(){
 try{const data=await api('/api/admin/copy',{query:$('copySearch').value,offset:copyOffset});$('copyCount').textContent='Надписей: '+data.count;const list=$('copyRows');list.replaceChildren();for(const row of data.rows){const button=document.createElement('button');button.type='button';button.style.cssText='display:block;width:100%;text-align:left;margin:6px 0;white-space:normal;overflow-wrap:anywhere';button.textContent=(row.changed?'● ':'')+row.texts.ru;button.onclick=()=>copySelect(row);list.append(button)}$('copyPrevious').disabled=copyOffset===0;$('copyNext').disabled=data.next_offset===null}catch(error){admErr(error)}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('copySearch').oninput=()=>{clearTimeout(window.copySearchTimer);window.copySearchTimer=setTimeout(()=>{copyOffset=0;admLoadCopy()},250)};
 $('copyPrevious').onclick=()=>{copyOffset=Math.max(0,copyOffset-30);admLoadCopy()};$('copyNext').onclick=()=>{copyOffset+=30;admLoadCopy()};
 $('copyNew').onclick=()=>{const key=$('copySearch').value.trim();if(key)copySelect({key,texts:{ru:key,en:key,zh:key}})};
 $('copyForm').onsubmit=async event=>{event.preventDefault();const button=$('copySave');button.disabled=true;try{await api('/api/admin/copy/save',{key:copySelected,texts:Object.fromEntries(['ru','en','zh'].map(language=>[language,$('copy'+language).value]))});toast('Текст сохранён');admLoadCopy()}catch(error){admErr(error)}finally{button.disabled=false}};
 $('copyReset').onclick=async()=>{if(!copySelected)return;try{await api('/api/admin/copy/save',{key:copySelected,reset:true});$('copyForm').hidden=true;admLoadCopy();toast('Стандартный текст восстановлен')}catch(error){admErr(error)}};
});
