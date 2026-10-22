'use strict';
async function admUploadImage(file) {
 if(!file||file.size>5000000)throw {data:{message:'Выберите изображение до 5 МБ.'}};
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
 return api('/api/admin/media/upload',{data});
}
async function admEmojiPicker(select) {
 const data=await api('/api/admin/emojis');const modal=document.createElement('div');modal.className='modal';modal.style.zIndex=9999;
 const panel=Object.assign(document.createElement('div'),{className:'modal-card list-modal'});panel.style.maxHeight='80dvh';panel.style.overflow='auto';
 const title=Object.assign(document.createElement('h3'),{textContent:'Выберите эмодзи'});panel.append(title);
 for(const item of data.saved||[]){const button=Object.assign(document.createElement('button'),{type:'button',title:item.id});const img=Object.assign(document.createElement('img'),{src:'/api/admin/emoji-thumb/'+item.id,alt:item.emoji||'⭐'});img.style.width='28px';img.style.height='28px';button.append(img);button.onclick=()=>{select(item);modal.remove()};panel.append(button)}
 const id=Object.assign(document.createElement('input'),{placeholder:'Или custom emoji ID',inputMode:'numeric'}),fallback=Object.assign(document.createElement('input'),{value:'⭐',placeholder:'Запасной обычный эмодзи'}),add=Object.assign(document.createElement('button'),{type:'button',textContent:'Выбрать ID'}),close=Object.assign(document.createElement('button'),{type:'button',textContent:'Закрыть'});
 add.onclick=()=>{if(!/^\d{5,30}$/.test(id.value.trim()))return toast('Проверьте ID эмодзи',true);select({id:id.value.trim(),emoji:fallback.value||'⭐'});modal.remove()};close.onclick=()=>modal.remove();panel.append(id,fallback,add,close);modal.append(panel);document.body.append(modal);modal.onclick=e=>{if(e.target===modal)modal.remove()};
}
