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
 const call=(type,body)=>{const run=queue.then(()=>request(type,body));queue=run.catch(()=>{});return run;};
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
  const name=document.createElement('div');name.className='nd-photo-name';name.textContent=label;
  const state=document.createElement('div');state.className='nd-photo-state';state.setAttribute('role','status');
  const setState=t=>{if(state.textContent!==t)state.textContent=t;};
  const act=document.createElement('div');act.className='nd-photo-act';
  const up=document.createElement('button');up.type='button';up.className='nd-photo-up';
  const big=document.createElement('button');big.type='button';big.className='nd-photo-big';big.textContent='크게 보기';
  const del=document.createElement('button');del.type='button';del.className='nd-photo-del';del.textContent='삭제';
  act.append(up,big,del);
  const input=picker(async file=>{try{const path=await attach(target(),kind,file,t=>setState(t));await show(path);setState('저장 완료');say(label+' 사진 저장·다시 읽기 확인 완료');}catch(e){setState(e.message);}});
  el.append(shot,name,state,act,input);
  let current='';
  async function show(path){current=path||'';img.hidden=true;plus.hidden=false;big.hidden=!current;del.hidden=!current;up.textContent=current?'바꾸기':'사진 첨부';el.classList.toggle('has',!!current);
   if(!current){emptyText();return;}
   setState('불러오는 중…');try{const url=await read(current);if(current!==path)return;img.src=url;img.hidden=false;plus.hidden=true;setState('등록됨');}catch{setState('사진을 불러오지 못했습니다 — 잠시 후 다시 시도합니다');setTimeout(()=>{if(current===path)current='\u0000retry';},4000);}}
  const emptyText=()=>{let ok=true;try{target();}catch{ok=false;}setState(ok?'등록 안 됨':(hint||'등록 안 됨'));};
  show('');
  const choose=()=>{let t;try{t=target();}catch(e){setState(e.message);return;}if(t&&!busy)input.click();};
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
 itemCard.el.classList.add('nd-photo-item');
 const placeItem=()=>{const form=document.getElementById('itForm');if(!form||form.classList.contains('hidden'))return;
  // Last block of the form body (inside its padding), after 옵션 및 가격 · 메모.
  const fields=[...form.querySelectorAll('.field')].filter(f=>!f.closest('.nd-photo-itembox')),body=fields.at(-1)?.parentElement||form;
  if(!body.contains(itemCard.el)){const box=itemCard.el.closest('.nd-photo-itembox')||Object.assign(document.createElement('div'),{className:'nd-photo-itembox',innerHTML:'<div class="nd-photo-ttl">품목 이미지</div>'});box.append(itemCard.el);const fa=body.querySelector(':scope>.form-actions');fa?fa.before(box):body.append(box);}
  itemCard.refresh();};
 // 견적서 출력: 사진이 등록된 품목이 있을 때만 '품목 사진' 쪽을 덧붙인다 (인쇄·이미지·공유·이메일·복사 공통).
 // 사진이 없으면 원래 견적서와 똑같다.
 const photoItems=q=>{const seen=new Map();
  for(const l of (q?.lines||[])){if(!(l.name||'').trim()||!l.item_id)continue;const path=db.settings?.assets?.['product:'+l.item_id];if(!path)continue;
   const it=db.items.find(i=>i.id===l.item_id);const e=seen.get(l.item_id)||{path,name:(it?.name||l.name||'').trim(),code:(it?.code||'').trim(),colors:new Set()};
   if((l.color||'').trim())e.colors.add(l.color.trim());seen.set(l.item_id,e);}
  return [...seen.values()];};
 async function loadPhotos(q){const list=photoItems(q);const out=[];
  for(const e of list){try{out.push({...e,url:await read(e.path)});}catch{}}return out;}
 const caption=e=>[e.name+(e.code?` [${e.code}]`:''),[...e.colors].join('·')].filter(Boolean);
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const origPrint=window.printQuote,origParts=window.quoteImageParts;
 if(typeof origPrint==='function')window.printQuote=async(q,docType)=>{
  let photos=[];try{photos=await loadPhotos(q);}catch{}
  if(!photos.length)return origPrint(q,docType);
  const inject=()=>{const pa=document.getElementById('printArea');if(!pa||pa.querySelector('.nd-pphotos'))return;
   const page=document.createElement('div');page.className='p-wrap nd-pphotos';
   page.innerHTML='<div class="p-eyebrow">ITEM PHOTOS</div><div class="nd-pp-title">품목 사진</div><div class="nd-pp-grid">'+photos.map(e=>{const [n,c]=caption(e);return `<figure><div class="nd-pp-img"><img src="${e.url}" alt=""></div><figcaption><b>${esc(n)}</b>${c?`<span>${esc(c)}</span>`:''}</figcaption></figure>`;}).join('')+'</div>';
   pa.append(page);};
  const p=window.print,op=window.openPrintPreview;
  window.print=(...a)=>{inject();return p.apply(window,a);};window.openPrintPreview=(...a)=>{inject();return op(...a);};
  try{return origPrint(q,docType);}finally{window.print=p;window.openPrintPreview=op;}
 };
 if(typeof origParts==='function')window.quoteImageParts=async(q,docType)=>{
  let photos=[];try{photos=await loadPhotos(q);}catch{}
  if(!photos.length)return origParts(q,docType);
  const title=DOC_TYPES[docType]?docType:'견적서';const base=drawQuoteCanvas(q,title);
  const SC=2,PW=794,MX=53,CW=688,GAP=12,COLS=4,CARD=(CW-GAP*(COLS-1))/COLS,IMG=CARD,CAPH=46;
  const rows=Math.ceil(photos.length/COLS),secH=60+28+rows*(IMG+CAPH+GAP)+48;
  const c=document.createElement('canvas');c.width=base.width;c.height=base.height+secH*SC;
  const x=c.getContext('2d');x.drawImage(base,0,0);x.scale(SC,SC);const top=base.height/SC;
  x.fillStyle='#fff';x.fillRect(0,top,PW,secH);x.fillStyle='#ECEDEF';x.fillRect(MX,top,CW,1);
  const F=(w,px)=>`${w} ${px}px ${typeof QIMG_FONT==='string'?QIMG_FONT:'sans-serif'}`;
  x.fillStyle='#8A8F98';x.font=F(700,11);x.fillText('ITEM PHOTOS',MX,top+44);
  x.fillStyle='#111';x.font=F(800,20);x.fillText('품목 사진',MX,top+72);
  const fit=(t,w)=>{if(x.measureText(t).width<=w)return t;while(t&&x.measureText(t+'…').width>w)t=t.slice(0,-1);return t+'…';};
  for(let i=0;i<photos.length;i++){const e=photos[i],cx=MX+(i%COLS)*(CARD+GAP),cy=top+88+Math.floor(i/COLS)*(IMG+CAPH+GAP);
   x.fillStyle='#F4F5F7';x.beginPath();x.roundRect(cx,cy,CARD,IMG,12);x.fill();
   try{const im=new Image();im.src=e.url;await im.decode();const r=Math.min((IMG-16)/im.width,(IMG-16)/im.height),w=im.width*r,h=im.height*r;
    x.save();x.beginPath();x.roundRect(cx,cy,CARD,IMG,12);x.clip();x.drawImage(im,cx+(CARD-w)/2,cy+(IMG-h)/2,w,h);x.restore();}catch{}
   const [n,col]=caption(e);x.textAlign='left';x.fillStyle='#111';x.font=F(700,12.5);x.fillText(fit(n,CARD),cx,cy+IMG+20);
   if(col){x.fillStyle='#8A8F98';x.font=F(400,11.5);x.fillText(fit(col,CARD),cx,cy+IMG+37);}}
  const blob=await new Promise(res=>c.toBlob(res,'image/png'));if(!blob)return null;
  const safe=v=>String(v||'').replace(/[\\/:*?"<>|]/g,'_');
  return {blob,fname:`${title}_${safe(q.no)}_${safe(coName(q.company_id))}.png`};
 };
 const tick=()=>{cards.forEach(c=>c.refresh());placeItem();};
 new MutationObserver(()=>requestAnimationFrame(tick)).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
 tick();
}
