'use strict';
let kdData=null,kdSection='welcome';
function kdDraft() {
  if (!kdData) return;
  kdData.dialogues[kdSection]={text:$('kdText').value,pose:$('kdPose').value};
}
function kdPreview() {
  kdDraft();
  const row=kdData?.dialogues[kdSection];if (!row) return;
  $('kdPreviewText').textContent=row.text;
  $('kdPreviewImage').src='/static/kostyan-tour/'+row.pose+'.png?v=1';
  $('kdPreview').dataset.theme=$('kdTheme').value;
  const index=kdData.sections.findIndex(section=>section.id===kdSection);
  $('kdPreviewNext').textContent=index===kdData.sections.length-1?'Сначала':'Далее';
  $('kdCounter').textContent=$('kdText').value.length+' / 600';
}
function kdSelect(id) {
  kdDraft();kdSection=id;
  const row=kdData.dialogues[id];$('kdText').value=row.text;$('kdPose').value=row.pose;
  document.querySelectorAll('#kdSections button').forEach(button=>button.classList.toggle('on',button.dataset.id===id));
  $('kdEditing').textContent='Раздел: '+kdData.sections.find(section=>section.id===id).label;
  kdPreview();
}
async function admLoadKostyan() {
  $('kdSave').disabled=true;
  try {
    const data=await api('/api/admin/kostyan');kdData=data;
    $('kdSections').replaceChildren();$('kdPose').replaceChildren();
    for (const pose of data.poses) {
      const option=document.createElement('option');option.value=pose.id;option.textContent=pose.label;$('kdPose').append(option);
    }
    for (const section of data.sections) {
      const button=document.createElement('button');button.type='button';button.textContent=section.label;button.dataset.id=section.id;button.onclick=()=>kdSelect(section.id);$('kdSections').append(button);
    }

    const initial=kdSection;kdSection=initial in data.dialogues?initial:'welcome';
    $('kdText').value=data.dialogues[kdSection].text;$('kdPose').value=data.dialogues[kdSection].pose;
    kdSelect(kdSection);
  } catch(error) {admErr(error);}
  finally {$('kdSave').disabled=!kdData;}
}
function initKostyanAdmin() {
  $('kdText').addEventListener('input',kdPreview);$('kdPose').addEventListener('change',kdPreview);$('kdTheme').addEventListener('change',kdPreview);
  $('kdReload').onclick=admLoadKostyan;
  $('kdPreviewNext').onclick=()=>{const index=kdData.sections.findIndex(section=>section.id===kdSection);kdSelect(kdData.sections[(index+1)%kdData.sections.length].id);};
  $('kdSave').onclick=async()=>{
    if (!kdData) return;kdDraft();$('kdSave').disabled=true;
    try {await api('/api/admin/kostyan',{action:'save',dialogues:kdData.dialogues});toast('Фразы и позы Костяна сохранены');}
    catch(error){admErr(error);}finally{$('kdSave').disabled=false;}
  };
  $('kdReset').onclick=async()=>{
    if (!confirm('Вернуть исходные фразы и позы Костяна?'))return;
    try {await api('/api/admin/kostyan',{action:'reset'});await admLoadKostyan();toast('Диалоги восстановлены');}catch(error){admErr(error);}
  };
}
