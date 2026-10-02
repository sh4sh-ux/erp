// 견적서 이메일 sheet: one place to check 받는 사람·제목·내용 with the quote image attached, then
// [Gmail로 보내기] (sent from the user's own Gmail by the top page — no server, no cost) or
// [메일 앱으로] (phone share sheet / desktop mail app with the image saved for attaching).
const MSG={
 BAD_RECIPIENT:'받는 사람 메일 주소를 확인해 주세요.',
 BAD_MESSAGE:'메일 내용을 만들지 못했어요. 첨부 이미지를 다시 만든 뒤 시도해 주세요.',
 CANCELLED:'Gmail 연결이 취소됐어요. (아직 테스트 사용자로 등록되지 않은 계정이면 연결할 수 없어요.)',
 POPUP_BLOCKED:'팝업이 막혔어요. 주소창 오른쪽에서 팝업을 허용한 뒤 다시 눌러 주세요.',
 SCOPE_DENIED:'메일 보내기 권한이 허용되지 않았어요. 다시 누르고 권한 체크를 켜 주세요.',
 GMAIL_NOT_ENABLED:'Gmail 발송 설정이 아직 완료되지 않았어요. [메일 앱으로]를 이용해 주세요.',
 OAUTH_SETUP_REQUIRED:'이 주소에서는 Gmail 연결을 쓸 수 없어요. [메일 앱으로]를 이용해 주세요.',
 RATE_LIMIT:'Gmail 발송 한도에 도달했어요. 잠시 후 다시 시도해 주세요.',
 UNAVAILABLE:'Gmail에 연결하지 못했어요. 잠시 후 다시 시도하거나 [메일 앱으로]를 이용해 주세요.',
 MAIL_FAILED:'메일을 보내지 못했어요. 잠시 후 다시 시도하거나 [메일 앱으로]를 이용해 주세요.'
};
export function installMailUI({port,say}){
 const wait=new Map();
 const ask=(type,body={})=>new Promise(resolve=>{const requestId=crypto.randomUUID();wait.set(requestId,resolve);port().postMessage({type,requestId,...body});});
 const onMessage=m=>{if(typeof m?.type!=='string'||!m.type.startsWith('MAIL_'))return false;const f=wait.get(m.requestId);if(f){wait.delete(m.requestId);f(m);}return true;};
 let gmailFrom='';
 // Text identical in spirit to the legacy mailto version.
 function draft(q,docType){
  const d=docOf(docType),label=DOC_TYPES[docType]?docType:'견적서',co=coById(q.company_id),t=quoteTotals(q);
  const supplier=((db.settings||{}).name||'').trim();
  const lines=[`${co?co.name+' ':''}담당자님, 안녕하세요.`,`${supplier?supplier+' ':''}${label}를 보내드립니다.`,'',
   `· ${d.noLabel}: ${q.no||'-'}`,`· ${d.dateLabel}: ${q.date||'-'}`,`· ${d.grand}: ${won(t.total)} (공급가액 ${won(t.supply)} + 세액 ${won(t.vat)})`];
  if(d.showValid&&q.valid)lines.push(`· 유효기간: ${q.valid}`);
  if((q.memo||'').trim())lines.push('',`비고: ${q.memo.trim()}`);
  lines.push('','※ 상세 내역은 첨부한 이미지를 확인해 주세요.','감사합니다.');
  const s=db.settings||{};const sign=[supplier,s.phone,s.email].filter(Boolean).join(' · ');if(sign)lines.push('',sign);
  return {to:(co&&co.email||'').trim(),subject:`[${supplier||'견적'}] ${label} ${q.no||''}`.trim(),body:lines.join('\n')};
 }
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 async function open(q,docType){
  if(!q)return;document.querySelector('.nd-mail')?.remove();
  const {to,subject,body}=draft(q,docType);
  const ov=el('div','nd-mail');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','견적서 이메일');
  const box=el('div','nd-mail-box');
  const hd=el('div','nd-mail-hd');hd.append(el('b',null,'견적서 이메일'));const x=el('button','nd-mail-x','×');x.type='button';x.setAttribute('aria-label','닫기');hd.append(x);
  const from=el('div','nd-mail-from');
  const field=(label,node)=>{const f=el('label','nd-mail-f');f.append(el('span',null,label),node);return f;};
  const toIn=el('input');toIn.type='email';toIn.multiple=true;toIn.value=to;toIn.placeholder='거래처 메일 주소';toIn.autocomplete='email';
  const subIn=el('input');subIn.value=subject;
  const bodyIn=el('textarea');bodyIn.value=body;bodyIn.rows=9;
  const att=el('div','nd-mail-att');att.textContent='첨부 준비 중…';
  const msg=el('div','nd-mail-msg');msg.setAttribute('role','status');
  const act=el('div','nd-mail-act');
  const app=el('button','nd-mail-app','메일 앱으로');app.type='button';
  const send=el('button','nd-mail-send','Gmail로 보내기');send.type='button';
  act.append(app,send);
  box.append(hd,from,field('받는 사람',toIn),field('제목',subIn),field('내용',bodyIn),att,msg,act);ov.append(box);
  (document.getElementById('appView')||document.body).append(ov);(to?send:toIn).focus();
  const close=()=>{ov.remove();removeEventListener('keydown',esc,true);};const esc=e=>{if(e.key==='Escape'){e.stopPropagation();close();}};
  addEventListener('keydown',esc,true);x.onclick=close;ov.onclick=e=>{if(e.target===ov)close();};
  const showFrom=()=>{from.replaceChildren();if(gmailFrom){from.append(el('span',null,'보내는 메일 '),el('b',null,gmailFrom+' (Gmail)'));const off=el('button','nd-mail-off','연결 해제');off.type='button';off.onclick=async()=>{const r=await ask('MAIL_DISCONNECT');gmailFrom=r.email||'';showFrom();};from.append(off);}
   else from.append(el('span',null,'처음 한 번 Gmail 권한을 허용하면, 견적서를 첨부해 내 Gmail로 바로 보내요.'));};
  showFrom();
  // Warm up Google sign-in in the top page now, so the send click can open its window right away.
  ask('MAIL_PREPARE').then(r=>{gmailFrom=r.email||'';showFrom();if(r.unavailable){send.disabled=true;msg.textContent=MSG.OAUTH_SETUP_REQUIRED;}});
  let part=null;
  try{part=await quoteImageParts(q,docType);att.replaceChildren(el('span','nd-mail-clip','첨부'),el('span',null,part?part.fname:'첨부 이미지를 만들지 못했어요'));}
  catch{att.textContent='첨부 이미지를 만들지 못했어요';}
  let busy=false;
  send.onclick=async()=>{
   if(busy)return;msg.textContent='';msg.classList.remove('ok');
   if(!toIn.value.trim()){msg.textContent=MSG.BAD_RECIPIENT;toIn.focus();return;}
   busy=true;send.disabled=app.disabled=true;send.textContent='보내는 중…';
   const bytes=part?new Uint8Array(await part.blob.arrayBuffer()):null;
   const r=await ask('MAIL_SEND',{to:toIn.value,subject:subIn.value,body:bodyIn.value,filename:part?.fname||'',bytes});
   busy=false;send.disabled=app.disabled=false;send.textContent='Gmail로 보내기';
   if(r.type==='MAIL_DONE'){gmailFrom=r.from||gmailFrom;close();say(`${toIn.value.trim()}로 메일을 보냈어요${gmailFrom?' · '+gmailFrom:''}`);return;}
   msg.textContent=MSG[r.code]||MSG.MAIL_FAILED;if(r.code==='BAD_RECIPIENT')toIn.focus();
  };
  app.onclick=async()=>{
   const subjectV=subIn.value,bodyV=bodyIn.value,toV=toIn.value.trim();
   if(part){const file=new File([part.blob],part.fname,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:subjectV,text:bodyV});close();say(toV?`메일 앱에서 받는 사람 ${toV}를 입력해 보내세요`:'메일 앱을 선택해 보내세요');return;}catch(e){if(e?.name==='AbortError')return;}}
    downloadBlob(part.blob,part.fname);}
   close();location.href=`mailto:${encodeURIComponent(toV)}?subject=${encodeURIComponent(subjectV)}&body=${encodeURIComponent(bodyV)}`;
   say(part?'메일 앱을 열었어요 — 저장된 견적서 이미지를 첨부해 보내세요':'메일 앱을 열었어요');
  };
 }
 // The legacy button calls the global emailQuote(q,docType) on every render.
 window.emailQuote=(q,docType)=>open(q,docType);
 return {onMessage};
}
