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
// Photo cards: 명함 · 사업자등록증 in 공급자 정보, 품목 이미지 in the item form. Same normalize → ASSET_UPLOAD →
// settings.assets path flow as before (files are added, never deleted); only the UI changed.
export function installAssets({db,request,save,notify}){
 let busy=false,queue=Promise.resolve();const urls=new Map();
 // The storage channel takes one request at a time: queue them.
 const call=(type,body)=>{const run=queue.then(()=>request(type,body));queue=run.catch(()=>{});return run;};
 const say=t=>{try{notify(t);}catch{}};
 async function read(path){
  if(urls.has(path))return urls.get(path);
  const {bytes}=await call('ASSET_READ',{path});const url=await dataUrl(bytes);urls.set(path,url);return url;
 }
 async function attach(target,kind,file,onState){
  if(busy)throw Error('다른 사진을 저장하고 있습니다. 잠시 후 다시 시도해 주세요.');busy=true;let uploaded=false;
  try{
   onState('정리하는 중…');const bytes=await normalize(file);
   onState('저장하는 중…');const result=await call('ASSET_UPLOAD',{kind,bytes});uploaded=true;
   await save('settings',{...db.settings,assets:{...(db.settings.assets||{}),[target]:result.path}});
   urls.set(result.path,await dataUrl(bytes));
   return result.path;
  }catch(e){throw Error((uploaded?'사진은 저장됐지만 연결하지 못했습니다. ':'')+e.message);}
  finally{busy=false;}
 }
 // The page CSP allows img-src 'self' data: only — blob: URLs render as broken images.
 const dataUrl=bytes=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('사진을 읽을 수 없습니다.'));r.readAsDataURL(new Blob([bytes],{type:'image/png'}));});
 function picker(onFile){const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;input.onchange=()=>{const f=input.files?.[0];input.value='';if(f)onFile(f);};return input;}
 function open(url,label){
  const ov=document.createElement('div');ov.className='nd-photo-view';ov.setAttribute('role','dialog');ov.setAttribute('aria-label',label);
  const img=document.createElement('img');img.src=url;img.alt=label;const x=document.createElement('button');x.type='button';x.className='nd-photo-view-x';x.setAttribute('aria-label','닫기');x.textContent='×';
  const cap=document.createElement('div');cap.className='nd-photo-view-cap';cap.textContent=label;
  ov.append(img,cap,x);const close=()=>{ov.remove();removeEventListener('keydown',esc,true);};const esc=e=>{if(e.key==='Escape'){e.stopPropagation();close();}};
  ov.onclick=e=>{if(e.target!==img)close();};addEventListener('keydown',esc,true);(document.getElementById('appView')||document.body).append(ov);x.focus();}
 // One card: preview (or empty drop-target), name, state line, [사진 첨부|바꾸기] [크게 보기].
 function card(label,target,kind,hint){
  const el=document.createElement('div');el.className='nd-photo';
  const shot=document.createElement('button');shot.type='button';shot.className='nd-photo-shot';shot.setAttribute('aria-label',label+' 사진 첨부');
  const img=document.createElement('img');img.alt=label;img.hidden=true;
  const plus=document.createElement('span');plus.className='nd-photo-empty';plus.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg><b>사진 첨부</b>';
  shot.append(img,plus);
  const name=document.createElement('div');name.className='nd-photo-name';name.textContent=label;
  const state=document.createElement('div');state.className='nd-photo-state';state.setAttribute('role','status');
  const act=document.createElement('div');act.className='nd-photo-act';
  const up=document.createElement('button');up.type='button';up.className='nd-photo-up';
  const big=document.createElement('button');big.type='button';big.className='nd-photo-big';big.textContent='크게 보기';
  act.append(up,big);
  const input=picker(async file=>{try{const path=await attach(target(),kind,file,t=>state.textContent=t);await show(path);state.textContent='저장 완료';say(label+' 사진 저장·다시 읽기 확인 완료');}catch(e){state.textContent=e.message;}});
  el.append(shot,name,state,act,input);
  let current='';
  async function show(path){current=path||'';img.hidden=true;plus.hidden=false;big.hidden=!current;up.textContent=current?'바꾸기':'사진 첨부';el.classList.toggle('has',!!current);
   if(!current){emptyText();return;}
   state.textContent='불러오는 중…';try{const url=await read(current);if(current!==path)return;img.src=url;img.hidden=false;plus.hidden=true;state.textContent='등록됨';}catch{state.textContent='사진을 불러오지 못했습니다 — 잠시 후 다시 시도합니다';setTimeout(()=>{if(current===path)current='\u0000retry';},4000);}}
  const emptyText=()=>{let ok=true;try{target();}catch{ok=false;}state.textContent=ok?'등록 안 됨':(hint||'등록 안 됨');};
  show('');
  const choose=()=>{let t;try{t=target();}catch(e){state.textContent=e.message;return;}if(t&&!busy)input.click();};
  shot.onclick=()=>{current&&!img.hidden?open(img.src,label):choose();};up.onclick=choose;big.onclick=()=>{if(!img.hidden)open(img.src,label);};
  return {el,refresh:()=>{let t='';try{t=target();}catch{}const path=t?db.settings.assets?.[t]:'';if((path||'')!==current)show(path);else if(!current&&!/중…/.test(state.textContent))emptyText();}};
 }
 // 공급자 정보: one section, two cards.
 const panel=document.createElement('section');panel.className='card nd-assets nd-docs-photos';
 const title=document.createElement('h3');title.textContent='명함·사업자등록증';
 const note=document.createElement('p');note.textContent='명함 보내기·사업자등록증 보내기에 쓰는 사진이에요. 연결된 클라우드에만 저장되고 공개 링크는 만들지 않아요. PNG·JPEG·WebP, 8MB 이하(자동으로 줄여서 저장).';
 const grid=document.createElement('div');grid.className='nd-photo-grid';
 const cards=[card('명함',()=>'card','card'),card('사업자등록증',()=>'registration','registration')];
 grid.append(...cards.map(c=>c.el));panel.append(title,note,grid);document.getElementById('view-settings').append(panel);
 // 품목: a photo row inside the item form for a saved item.
 const itemCard=card('품목 이미지',()=>{const id=typeof itSel==='string'?itSel:'';if(!id||id==='__new__'||!db.items.some(r=>r.id===id))throw Error('품목을 먼저 저장한 뒤 사진을 첨부할 수 있어요.');return 'product:'+id;},'product','품목을 저장한 뒤 첨부할 수 있어요');
 itemCard.el.classList.add('nd-photo-item');
 const placeItem=()=>{const form=document.getElementById('itForm');if(!form||form.classList.contains('hidden'))return;
  // Last block of the form body (inside its padding), after 옵션 및 가격 · 메모.
  const fields=[...form.querySelectorAll('.field')].filter(f=>!f.closest('.nd-photo-itembox')),body=fields.at(-1)?.parentElement||form;
  if(!body.contains(itemCard.el)){const box=itemCard.el.closest('.nd-photo-itembox')||Object.assign(document.createElement('div'),{className:'nd-photo-itembox',innerHTML:'<div class="nd-photo-ttl">품목 이미지</div>'});box.append(itemCard.el);const fa=body.querySelector(':scope>.form-actions');fa?fa.before(box):body.append(box);}
  itemCard.refresh();};
 const tick=()=>{cards.forEach(c=>c.refresh());placeItem();};
 new MutationObserver(()=>requestAnimationFrame(tick)).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
 tick();
}
