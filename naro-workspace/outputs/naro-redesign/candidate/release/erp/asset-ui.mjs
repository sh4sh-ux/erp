async function normalize(file){
 if(file.size>8*1048576)throw Error('원본 이미지는 8MB 이하여야 합니다.');
 const head=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>head[i]===v),jpeg=head[0]===255&&head[1]===216&&head[2]===255,webp=new TextDecoder().decode(head.slice(0,4))==='RIFF'&&new TextDecoder().decode(head.slice(8,12))==='WEBP';
 if(!png&&!jpeg&&!webp)throw Error('PNG, JPEG, WebP 이미지만 지원합니다.');
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('이미지를 읽을 수 없습니다.');}
 try{
  if(bitmap.width>4096||bitmap.height>4096||bitmap.width*bitmap.height>16000000)throw Error('이미지는 가로·세로 4,096px 이하여야 합니다.');
  const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>1048576)throw Error('변환 이미지가 1MB를 초과합니다. 더 작은 이미지를 선택해 주세요.');return new Uint8Array(await blob.arrayBuffer());
 }finally{bitmap.close();}
}
export function installAssets({db,request,save,notify}){
 const panel=document.createElement('section');panel.className='card';panel.style.cssText='padding:20px;margin:12px 0;max-width:100%;overflow-wrap:anywhere';
 const title=document.createElement('h3');title.textContent='개인 클라우드 이미지';
 const note=document.createElement('p');note.textContent='명함·사업자등록증·품목 이미지를 연결한 개인 클라우드에 저장합니다. 공개 공유 링크는 만들지 않습니다. PNG/JPEG/WebP · 원본 8MB 이하 · 긴 변 1,600px PNG로 변환(최종 1MB 이하).';
 const kind=document.createElement('select');kind.setAttribute('aria-label','이미지 종류');for(const [value,label] of [['card','명함'],['registration','사업자등록증'],['product','품목 이미지']])kind.add(new Option(label,value));
 const item=document.createElement('select');item.setAttribute('aria-label','이미지 품목');item.hidden=true;item.style.maxWidth='100%';
 const refreshItems=()=>{const selected=item.value;item.replaceChildren(new Option('품목을 선택하세요',''));for(const row of db.items)item.add(new Option(row.name,row.id));item.value=selected;};
 const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;
 const upload=document.createElement('button');upload.type='button';upload.textContent='이미지 선택·저장';
 const view=document.createElement('button');view.type='button';view.textContent='저장된 이미지 보기';
 const preview=document.createElement('img');preview.alt='개인 클라우드에 저장된 이미지';preview.hidden=true;preview.style.cssText='max-width:100%;max-height:320px;object-fit:contain;margin-top:12px';
 const message=document.createElement('p');message.setAttribute('role','status');
 const key=()=>{if(kind.value==='product'){if(!item.value||!db.items.some(row=>row.id===item.value))throw Error('품목을 먼저 선택해 주세요.');return 'product:'+item.value;}return kind.value;};
 kind.onchange=()=>{item.hidden=kind.value!=='product';refreshItems();preview.hidden=true;preview.removeAttribute('src');message.textContent='';};item.onfocus=refreshItems;item.onchange=()=>{preview.hidden=true;preview.removeAttribute('src');};
 let busy=false;
 upload.onclick=()=>{if(!busy)input.click();};
 input.onchange=async()=>{
  const file=input.files?.[0];input.value='';if(!file||busy)return;busy=true;upload.disabled=view.disabled=kind.disabled=item.disabled=true;
  let uploaded=false;
  try{
   const target=key(),bytes=await normalize(file);
   if(!confirm('선택한 이미지를 현재 연결한 개인 클라우드에 저장할까요? 파일을 새로 저장하고 기존 이미지 파일은 삭제하지 않습니다.'))return;
   message.textContent='이미지를 저장하고 다시 확인하고 있습니다…';
   const result=await request('ASSET_UPLOAD',{kind:kind.value,bytes});uploaded=true;
   await save('settings',{...db.settings,assets:{...db.settings.assets,[target]:result.path}});
   message.textContent='이미지 저장·다시 읽기·자료 연결 완료';notify(message.textContent);
  }catch(error){message.textContent=(uploaded?'이미지 파일은 저장되었으나 자료 연결은 완료하지 못했습니다. ':'')+error.message;}
  finally{busy=false;upload.disabled=view.disabled=kind.disabled=item.disabled=false;}
 };
 view.onclick=async()=>{
  if(busy)return;busy=true;upload.disabled=view.disabled=true;
  try{const path=db.settings.assets?.[key()];if(!path)throw Error('등록된 이미지가 없습니다.');message.textContent='개인 클라우드에서 읽는 중…';const {bytes}=await request('ASSET_READ',{path});const reader=new FileReader();reader.onload=()=>{preview.src=reader.result;preview.hidden=false;};reader.readAsDataURL(new Blob([bytes],{type:'image/png'}));message.textContent='저장된 이미지 확인 완료';}
  catch(error){message.textContent=error.message;}
  finally{busy=false;upload.disabled=view.disabled=false;}
 };
 panel.append(title,note,kind,item,upload,view,input,message,preview);document.getElementById('view-settings').append(panel);
}
