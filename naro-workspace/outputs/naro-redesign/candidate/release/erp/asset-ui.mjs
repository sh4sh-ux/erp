async function normalize(file,maxSide=1600){
 if(file.size>8*1048576)throw Error('원본 이미지는 8MB 이하여야 합니다.');
 const head=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>head[i]===v),jpeg=head[0]===255&&head[1]===216&&head[2]===255,webp=new TextDecoder().decode(head.slice(0,4))==='RIFF'&&new TextDecoder().decode(head.slice(8,12))==='WEBP';
 if(!png&&!jpeg&&!webp)throw Error('PNG, JPEG, WebP 이미지만 지원합니다.');
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('이미지를 읽을 수 없습니다.');}
 try{
  if(bitmap.width>4096||bitmap.height>4096||bitmap.width*bitmap.height>16000000)throw Error('이미지는 가로·세로 4,096px 이하여야 합니다.');
  const ratio=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>1048576)throw Error('변환 이미지가 1MB를 초과합니다. 더 작은 이미지를 선택해 주세요.');return new Uint8Array(await blob.arrayBuffer());
 }finally{bitmap.close();}
}
// Photo cards: 명함 · 사업자등록증 in 공급자 정보, 품목 이미지 in the item form. Same normalize → ASSET_UPLOAD →
// settings.assets path flow as before (files are added, never deleted); only the UI changed.
export function installAssets({db,request,save,notify}){
 let busy=false,queue=Promise.resolve();const urls=new Map();
 // The storage channel takes one request at a time: queue them.
 // 응답이 오지 않는 요청이 줄을 영원히 막지 않도록 45초 뒤 실패로 정리한다.
 const call=(type,body)=>{const run=queue.then(()=>Promise.race([request(type,body),new Promise((_,rej)=>setTimeout(()=>rej(Error('응답이 늦어 중단했어요. 다시 눌러 주세요.')),45000))]));queue=run.catch(()=>{});return run;};
 const say=t=>{try{notify(t);}catch{}};
 async function read(path){
  if(urls.has(path))return urls.get(path);
  const {bytes}=await call('ASSET_READ',{path});const url=await dataUrl(bytes);urls.set(path,url);return url;
 }
 async function attach(target,kind,file,onState){
  if(busy)throw Error('다른 사진을 저장하고 있습니다. 잠시 후 다시 시도해 주세요.');busy=true;let uploaded=false;
  try{
   onState('정리하는 중…');const bytes=await normalize(file,kind==='product'?900:1600);
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
  const name=document.createElement('div');name.className='nd-photo-name';const nameT=document.createElement('span');nameT.textContent=label;name.append(nameT);
  const state=document.createElement('div');state.className='nd-photo-state';state.setAttribute('role','status');
  const setState=t=>{if(state.textContent!==t)state.textContent=t;};
  const act=document.createElement('div');act.className='nd-photo-act';
  const up=document.createElement('button');up.type='button';up.className='nd-photo-up';
  const big=document.createElement('button');big.type='button';big.className='nd-photo-big';big.textContent='크게 보기';
  const del=document.createElement('button');del.type='button';del.className='nd-photo-del';del.textContent='삭제';
  act.append(up,big,del);
  const input=picker(async file=>{try{const path=await attach(target(),kind,file,t=>setState(t));await show(path);setState('저장 완료');say(label+' 사진 저장·다시 읽기 확인 완료');}catch(e){setState(e.message);}});
  name.append(state);el.append(shot,name,act,input);
  let current='';const tries={};
  async function show(path){current=path||'';img.hidden=true;plus.hidden=false;big.hidden=!current;del.hidden=!current;up.textContent=current?'바꾸기':'사진 첨부';el.classList.toggle('has',!!current);
   if(!current){emptyText();return;}
   setState('불러오는 중…');try{const url=await read(current);if(current!==path)return;img.src=url;img.hidden=false;plus.hidden=true;setState('등록됨');}catch{setState('사진을 불러오지 못했어요');if((tries[path]=(tries[path]||0)+1)<3)setTimeout(()=>{if(current===path)current='\u0000retry';},4000);}}
  const emptyText=()=>{let ok=true;try{target();}catch{ok=false;}setState(ok?'등록 안 됨':(hint||'등록 안 됨'));};
  show('');
  // 누를 때마다 반드시 눈에 보이는 반응: 파일 창을 열거나, 왜 못 여는지 상태 줄과 알림에 알린다.
  const choose=()=>{let t;try{t=target();}catch(e){setState(e.message);el.classList.add('warn');say(e.message);return;}el.classList.remove('warn');
   if(busy){const m='다른 사진을 저장하고 있어요. 잠시 후 다시 눌러 주세요.';setState(m);say(m);return;}if(t)input.click();};
  shot.onclick=()=>{current&&!img.hidden?open(img.src,label):choose();};up.onclick=choose;big.onclick=()=>{if(!img.hidden)open(img.src,label);};
  del.onclick=async()=>{let t;try{t=target();}catch(e){setState(e.message);return;}if(!current||busy)return;
   if(!confirm(label+' 사진을 지울까요?\n(클라우드의 원본 파일은 남겨 두고, 이 화면에서만 연결을 끊어요.)'))return;
   busy=true;setState('지우는 중…');
   try{const a={...(db.settings.assets||{})};delete a[t];await save('settings',{...db.settings,assets:a});await show('');setState('지움');say(label+' 사진을 지웠어요');}
   catch(e){setState('지우지 못했어요: '+e.message);}finally{busy=false;}};
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
 // 칸 제목이 이미 '품목 이미지'라 아래 줄 이름은 '사진'(공급자 정보: 제목 '명함·사업자등록증' · 줄 '명함'과 같은 짜임).
 itemCard.el.querySelector('.nd-photo-name>span').textContent='사진';
 itemCard.el.classList.add('nd-photo-item');
 const placeItem=()=>{const form=document.getElementById('itForm');if(!form||form.classList.contains('hidden'))return;
  // Last block of the form body (inside its padding), after 옵션 및 가격 · 메모.
  const fields=[...form.querySelectorAll('.field')].filter(f=>!f.closest('.nd-photo-itembox')),body=fields.at(-1)?.parentElement||form;
  if(!body.contains(itemCard.el)){const box=itemCard.el.closest('.nd-photo-itembox')||Object.assign(document.createElement('div'),{className:'nd-photo-itembox',innerHTML:'<div class="nd-photo-ttl">품목 이미지</div>'});box.append(itemCard.el);const fa=body.querySelector(':scope>.form-actions');fa?fa.before(box):body.append(box);}
  itemCard.refresh();};
 // 견적서 출력(시안 A): 사진이 등록된 품목은 품명 칸에 작은 사진 — 인쇄·이미지·공유·이메일·복사 공통.
 // 그리는 쪽(build.mjs가 drawQuoteCanvas·printQuote에 넣은 몇 줄)은 동기라, 여기서 사진을 미리 읽어 두고 naroQuotePhoto로 건넨다.
 // 품명 줄바꿈: 글자 중간이 아니라 띄어쓰기 단위로 나눈다("디자인공임 / [Design Fee]"). 한 단어가 한 줄보다 길 때만 글자 단위.
 // 품명/품번: 이름 끝의 [품번]을 떼어 둘째 줄(회색)로. 괄호가 없으면 품목에 등록된 코드를 쓴다.
 window.naroSplitName=l=>{const raw=String(l?.name||'').trim();const m=/^(.*\S)\s*\[([^\]]+)\]$/.exec(raw);if(m)return {name:m[1],code:m[2].trim()};
  const it=l?.item_id&&db.items.find(i=>i.id===l.item_id);const code=(it?.code||'').trim();return {name:raw,code:code&&!raw.includes(code)?code:''};};
 window.naroWrapWords=(ctx,text,width)=>{const words=String(text||'').split(/(\s+)/).filter(w=>w!=='');const lines=[];let cur='';
  const hard=w=>{let part='';for(const ch of w){if(part&&ctx.measureText(part+ch).width>width){lines.push(part);part=ch;}else part+=ch;}return part;};
  for(const w of words){if(/^\s+$/.test(w)){if(cur)cur+=' ';continue;}const next=cur+w;
   if(ctx.measureText(next).width<=width){cur=next;continue;}
   if(cur.trim()){lines.push(cur.trimEnd());cur='';}
   cur=ctx.measureText(w).width>width?hard(w):w;}
  if(cur.trim())lines.push(cur.trimEnd());return lines.length?lines:[''];};
 const thumbs=new Map();
 const pathOf=id=>id?db.settings?.assets?.['product:'+id]||'':'';
 window.naroQuotePhoto=(l,prev)=>{const id=l?.item_id,path=pathOf(id),t=id&&thumbs.get(id);if(!path||!t||t.path!==path)return null;
  return {first:!(prev&&prev.item_id===id&&pathOf(prev.item_id)),img:t.img,url:t.url};};
 async function preload(q){
  for(const id of new Set((q?.lines||[]).map(l=>l.item_id).filter(Boolean))){const path=pathOf(id);if(!path||thumbs.get(id)?.path===path)continue;
   try{const url=await read(path);const img=new Image();img.src=url;await img.decode();thumbs.set(id,{path,url,img});}catch{}}}
 const origPrint=window.printQuote,origParts=window.quoteImageParts;
 if(typeof origPrint==='function')window.printQuote=async(q,docType)=>{try{await preload(q);}catch{}return origPrint(q,docType);};
 if(typeof origParts==='function')window.quoteImageParts=async(q,docType)=>{try{await preload(q);}catch{}return origParts(q,docType);};
 const tick=()=>{cards.forEach(c=>c.refresh());placeItem();};
 new MutationObserver(()=>requestAnimationFrame(tick)).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
 tick();
}
