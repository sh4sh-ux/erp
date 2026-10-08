/* 견적서 '다음 할 일' 줄 + 한 번에 끝나는 창(10/8 시안 1): 수주면 [납품 처리], 돈이 남았으면 [입금 받기].
   흔한 값(남은 수량 전부 · 남은 금액 전부 · 오늘)이 미리 채워져 있어 대부분 확인만 누르면 끝난다.
   저장은 앱과 똑같이: 납품 = 납품 기록 추가 → normalizeDeliveryStatus → 견적서 저장 → 재고 반영(syncStockForQuote),
   입금 = 입금 기록 추가(수금, 견적 연결). 견적서 저장을 따로 누를 필요가 없다.
   주의: build.mjs가 String.replace로 index.html에 끼워 넣으므로 달러+앰퍼샌드 같은 치환 특수 문자열을 쓰지 말 것. */
(()=>{
 'use strict';
 const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const won=v=>Math.round(v).toLocaleString('ko-KR');
 const say=t=>typeof toast==='function'?toast(t):alert(t);
 const METHODS=['계좌이체','카드','현금','기타'];
 let sheet=null;
 const current=()=>{if(typeof qtSel==='undefined'||!qtSel||qtSel==='__new__')return null;return (db.quotes||[]).find(q=>q.id===qtSel)||null;};
 // 견적 1건의 남은 납품(줄마다)·남은 금액
 // 줄 id가 없는 옛 견적서도 있어 복사본에 id를 붙여 계산한다(납품 저장도 이 복사본으로 — id가 한 번만 생긴다)
 const work=q=>ensureQuoteLineIds(JSON.parse(JSON.stringify(q)));
 function state(q){
  const lines=quoteDeliveryLines(q),done=quoteDeliveryQtyMap(q);
  const rest=lines.map(l=>({l,left:Math.max(0,(Number(l.qty)||0)-(done[l.id]||0))})).filter(r=>r.left>0);
  const ordered=quoteOrderedQty(q),delivered=quoteDeliveredQty(q);
  const amount=quoteAmount(q),paid=quotePaid(q.id),balance=amount-paid;
  return {rest,left:rest.reduce((s,r)=>s+r.left,0),ordered,delivered,amount,paid,balance};
 }
 const committed=q=>typeof QT_COMMITTED!=='undefined'?QT_COMMITTED.includes(q.status):['수주','부분납품','납품'].includes(q.status);
 const editing=new Map();   // 견적 id → 품목 편집 중인지(이 화면에서만 기억)
 const isEditing=q=>!q||q.status==='작성중'||editing.get(q.id)===true||(typeof qtHasUnsavedChanges==='function'&&qtHasUnsavedChanges());
 const taxedOf=q=>typeof isTaxed==='function'?isTaxed(q):!!q.tax_at;
 const noTaxOf=q=>typeof noTax==='function'?noTax(q):!!q.no_tax;
 const ok='<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2.5 6.5l2.5 2.5 4.5-6"/></svg>';
 // 머리 단계 줄(10/8 시안): 작성중·발송 = [발송함][수주 확정], 수주 뒤 = 수주 · 납품 · 입금 · 계산서 + 지금 할 일 버튼 하나
 function steps(q){
  if(!committed(q)){
   const sent=q.status==='발송',days=sent&&q.sent_at&&typeof daysSince==='function'?daysSince(q.sent_at):0;
   return {key:q.status+'|'+days,list:[{t:sent?'작성':'작성중',st:sent?'done':'cur'},{t:sent?(days>0?`발송 · ${days}일째 회신 대기`:'발송'):'발송',st:sent?'cur':'todo'},{t:'수주',st:'todo'},{t:'납품',st:'todo'}],
    acts:(sent?'':'<button type="button" class="nd-next-b" data-st="발송">발송함</button>')+'<button type="button" class="nd-next-b pri" data-st="수주">수주 확정</button>'};
  }
  const s=state(work(q)),dDone=s.left<=0,pDone=s.balance<=0,taxed=taxedOf(q),nt=noTaxOf(q);
  const list=[{t:'수주',st:'done'},{t:`납품 ${won(s.delivered)}/${won(s.ordered)}개`,st:dDone?'done':'cur',tab:'flow'},
   {t:pDone?`입금 ${won(s.paid)}원`:`입금 ${won(s.paid)} / ${won(s.amount)}원`,st:pDone?'done':dDone?'cur':'todo',tab:'flow'},
   {t:nt?'계산서 발행 안 함':taxed?'계산서 발행':'계산서 미발행',st:nt||taxed?'done':'todo',tab:'flow'}];
  const acts=!dDone?(pDone?'':'<button type="button" class="nd-next-b" data-qa="pay">입금 받기</button>')+'<button type="button" class="nd-next-b pri" data-qa="deliver">납품 처리</button>'
   :!pDone?'<button type="button" class="nd-next-b pri" data-qa="pay">입금 받기</button>':'';
  return {key:[s.left,s.delivered,s.balance,taxed,nt].join('|'),list,acts};
 }
 function bar(){
  const f=document.getElementById('qtForm');if(!f)return;
  const q=current();const anchor=f.querySelector('[role="tabpanel"]');
  f.dataset.ndSt=q?q.status:'new';
  editMode(f,q);
  const note=f.querySelector('.delivery-panel .quote-flow-body>.quote-flow-sub');const NOTE='저장된 납품 기록은 재고·매출의 근거라 고치거나 지울 수 없어요. 잘못 넣었다면 ··· → 삭제를 누르면 견적서를 취소(재고 되돌림)할 수 있어요.';
  if(note&&q&&(q.deliveries||[]).length&&note.textContent!==NOTE)note.textContent=NOTE;
  let el=f.querySelector(':scope .nd-next');
  if(!q||!anchor||q.status==='취소'){el?.remove();return;}
  const S=steps(q),key=q.id+'|'+q.status+'|'+S.key;
  if(el&&el.dataset.key===key&&el.nextElementSibling===anchor)return;
  if(!el){el=document.createElement('div');el.className='nd-next';}
  el.dataset.key=key;
  el.innerHTML=`<ol class="nd-steps">${S.list.map((x,i)=>`${i?`<li class="nd-step-ln ${x.st==='todo'?'':'on'}" aria-hidden="true"></li>`:''}<li class="nd-step ${x.st}">${x.tab?`<button type="button" data-tab="${x.tab}">`:'<span>'}<i>${x.st==='done'?ok:''}</i>${e(x.t)}${x.tab?'</button>':'</span>'}</li>`).join('')}</ol>${S.acts?`<div class="nd-next-act">${S.acts}</div>`:''}`;
  if(el.nextElementSibling!==anchor)anchor.before(el);
 }
 // 품목: 작성중이 아니면 보기 모드(입력칸 테두리·행 삭제·행 추가 숨김) + [편집]
 function editMode(f,q){
  const on=isEditing(q);f.classList.toggle('nd-view',!on);
  const host=f.querySelector('#qp-panel-items>.qt-sec-t')||null,mob=f.querySelector('#qp-panel-items .qp-cards>section:first-child>h3');
  let b=f.querySelector('.nd-edit-b');
  if(!q||q.status==='작성중'){b?.remove();return;}
  const where=mob&&mob.getClientRects().length?mob:host;if(!where)return;
  if(!b){b=document.createElement('button');b.type='button';b.className='nd-edit-b';}
  const t=on?'완료':'편집';if(b.textContent!==t)b.textContent=t;
  if(b.parentNode!==where)where.append(b);
 }
 function guard(){
  if(typeof qtHasUnsavedChanges==='function'&&qtHasUnsavedChanges()){say('고친 내용을 먼저 저장해 주세요. 저장한 뒤 다시 눌러 주세요.');return false;}
  return true;
 }
 function open(html){
  if(!sheet){sheet=document.createElement('dialog');sheet.className='nd-pay-sheet nd-qa-sheet';sheet.addEventListener('click',ev=>{if(ev.target===sheet)sheet.close();});(document.getElementById('appView')||document.body).append(sheet);}
  sheet.innerHTML=html;if(!sheet.open){sheet.tabIndex=-1;sheet.showModal();sheet.focus({preventScroll:true});}
  sheet.querySelector('[data-x]')?.addEventListener('click',()=>sheet.close());
  return sheet;
 }
 /* ── 납품 처리 ── */
 function deliver(){
  const q0=current();if(!q0||!guard())return;const q=work(q0);const s=state(q);if(!s.left)return;
  const qty=Object.fromEntries(s.rest.map(r=>[r.l.id,r.left]));let mode='all';
  const label=l=>`${e(l.name||'')}`,sub=(l,left)=>[l.color,l.spec].filter(Boolean).map(e).join(' · ')+(l.color||l.spec?' · ':'')+`남음 ${won(left)}`;
  const paint=()=>{
   const total=Object.values(qty).reduce((a,b)=>a+b,0);
   const d=open(`<div class="nd-ps-hd"><b>납품 처리</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
    <div class="nd-qa-body">
     <div class="nd-qa-seg" role="tablist"><button type="button" role="tab" aria-selected="${mode==='all'}" data-m="all">남은 수량 전부 (${won(s.left)}개)</button><button type="button" role="tab" aria-selected="${mode==='part'}" data-m="part">일부만</button></div>
     ${mode==='part'?`<div class="nd-qa-lines">${s.rest.map(r=>`<div class="nd-qa-ln"><div><span>${label(r.l)}</span><small>${sub(r.l,r.left)}</small></div><span class="nd-qa-step"><button type="button" data-d="${e(r.l.id)}" data-v="-1" aria-label="줄이기">−</button><input inputmode="numeric" data-q="${e(r.l.id)}" value="${qty[r.l.id]}" aria-label="납품 수량"><button type="button" data-d="${e(r.l.id)}" data-v="1" aria-label="늘리기">+</button></span></div>`).join('')}</div><p class="nd-qa-note">처음엔 남은 수량이 다 채워져 있어요. 이번에 못 보내는 것만 줄이세요.</p>`:''}
     <div class="nd-qa-fields"><label>납품일<input type="date" id="ndQaDate" value="${localDate()}"></label><label>메모 (선택)<input id="ndQaMemo" placeholder="예: 택배 1박스"></label></div>
     <p class="nd-qa-after">확인하면 납품이 기록되고 <b>재고가 ${won(total)}개 빠져요</b>. 상태는 ${total>=s.left?'<b>납품</b>':'<b>부분납품</b>'}이 돼요.</p>
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${total>0?'':'disabled'}>${won(total)}개 납품 확인</button></div>`);
   d.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;if(mode==='all')s.rest.forEach(r=>qty[r.l.id]=r.left);paint();});
   d.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const r=s.rest.find(x=>x.l.id===b.dataset.d);qty[r.l.id]=Math.max(0,Math.min(r.left,qty[r.l.id]+Number(b.dataset.v)));paint();});
   d.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const r=s.rest.find(x=>x.l.id===inp.dataset.q);const v=Math.floor(Number(String(inp.value).replace(/[^\d]/g,''))||0);qty[r.l.id]=Math.max(0,Math.min(r.left,v));paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    const btn=ev.currentTarget,date=d.querySelector('#ndQaDate').value||localDate(),memo=d.querySelector('#ndQaMemo').value.trim();
    const lines=s.rest.map(r=>({line_id:r.l.id,qty:qty[r.l.id]})).filter(x=>x.qty>0);if(!lines.length)return;
    btn.disabled=true;btn.textContent='저장 중…';
    const nq=JSON.parse(JSON.stringify(q));
    nq.deliveries.push({id:crypto.randomUUID(),date,lines,memo,created_at:new Date().toISOString()});
    normalizeDeliveryStatus(nq);
    const next=db.quotes.map(x=>x.id===nq.id?nq:x);
    if(!await saveTable('quotes',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
    db.quotes=next;qtEditing=null;qtBaseline='';d.close();renderQtList();renderQtDetail();
    if(stockDeltaForQuote(nq).moves.length&&!await syncStockForQuote(nq,{ask:false})){window.dispatchEvent(new Event('naro-incomplete-stock'));return;}
    say(`${won(lines.reduce((a,b)=>a+b.qty,0))}개 납품을 기록했어요 · 재고 반영 완료`);
   };
  };
  paint();
 }
 /* ── 입금 받기 ── */
 function pay(){
  const q=current();if(!q||!guard())return;const s=state(work(q));
  let amount=Math.max(0,s.balance),method='계좌이체',preset='all';
  const paint=()=>{
   const over=amount>s.balance&&s.balance>=0;
   const d=open(`<div class="nd-ps-hd"><b>입금 받기</b><span class="nd-qa-sub">${e(coName(q.company_id))} · 남은 금액 ${won(s.balance)}원</span></div>
    <div class="nd-qa-body">
     <label class="nd-qa-money">받은 금액<input id="ndQaAmt" inputmode="numeric" value="${amount?won(amount):''}" placeholder="0"><span>원</span></label>
     <div class="nd-qa-chips" role="group" aria-label="금액">${[['all','남은 금액 전부'],['half','절반'],['custom','직접 입력']].map(([k,t])=>`<button type="button" data-p="${k}" aria-pressed="${preset===k}">${t}</button>`).join('')}</div>
     <div class="nd-qa-chips" role="group" aria-label="입금 방법">${METHODS.map(m=>`<button type="button" data-me="${m}" aria-pressed="${method===m}">${m}</button>`).join('')}</div>
     <div class="nd-qa-fields"><label>입금일<input type="date" id="ndQaDate" value="${localDate()}"></label><label>메모 (선택)<input id="ndQaMemo" placeholder="예: 잔금"></label></div>
     ${over?`<p class="nd-qa-warn">남은 금액보다 ${won(amount-s.balance)}원 많아요. 초과 입금으로 기록돼요.</p>`:''}
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${amount>0?'':'disabled'}>${amount>0?won(amount)+'원 입금 확인':'금액을 넣어 주세요'}</button></div>`);
   const inp=d.querySelector('#ndQaAmt');
   inp.oninput=()=>{amount=Math.floor(Number(inp.value.replace(/[^\d]/g,''))||0);preset='custom';const go=d.querySelector('.nd-qa-go');go.disabled=!(amount>0);go.textContent=amount>0?won(amount)+'원 입금 확인':'금액을 넣어 주세요';};
   inp.onblur=()=>paint();
   d.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{preset=b.dataset.p;if(preset==='all')amount=Math.max(0,s.balance);else if(preset==='half')amount=Math.max(0,Math.round(s.balance/2));paint();if(preset==='custom'){const i=sheet.querySelector('#ndQaAmt');i.focus();i.select();}});
   d.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{method=b.dataset.me;paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    const btn=ev.currentTarget;if(!(amount>0))return;
    const date=d.querySelector('#ndQaDate').value||localDate(),memo=d.querySelector('#ndQaMemo').value.trim();
    btn.disabled=true;btn.textContent='저장 중…';
    const next=[...db.payments,{id:crypto.randomUUID(),date,company_id:q.company_id,quote_id:q.id,kind:'수금',method,amount,memo,created_at:new Date().toISOString()}];
    if(!await saveTable('payments',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
    db.payments=next;d.close();renderQtDetail();
    say(`${won(amount)}원 입금을 기록했어요`);
   };
  };
  paint();
 }
 document.addEventListener('click',ev=>{
  const t=ev.target.closest?.('#qtForm .nd-next [data-qa],#qtForm .nd-next [data-st],#qtForm .nd-next [data-tab],#qtForm .nd-edit-b');if(!t)return;ev.preventDefault();
  if(t.dataset.qa){t.dataset.qa==='deliver'?deliver():pay();return;}
  if(t.dataset.tab){document.getElementById('qp-tab-'+t.dataset.tab)?.click();return;}
  if(t.dataset.st){if(typeof qtEditing==='undefined'||!qtEditing)return;qtEditing.status=t.dataset.st;const sel=document.getElementById('fq_status');if(sel)sel.value=t.dataset.st;document.getElementById('qtSaveBtn')?.click();return;}
  const q=current();if(!q)return;
  if(isEditing(q)&&typeof qtHasUnsavedChanges==='function'&&qtHasUnsavedChanges()){say('고친 내용을 저장하면 보기 화면으로 돌아가요');return;}
  editing.set(q.id,!isEditing(q));bar();
 });
 document.addEventListener('click',ev=>{const h=ev.target.closest?.('#qtForm #fq_short>div>.hd');if(h)h.closest('#fq_short').classList.toggle('nd-open');});
 // 진행 탭의 '+ 납품 기록 추가' · '+ 입금 추가'도 같은 창으로(바로 저장 — 견적서 저장을 따로 누를 필요 없음)
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('#qtForm #fd_open,#qtForm #fp_open');const q=b&&current();if(!q)return;
  if(b.id==='fd_open'&&!(committed(q)&&state(work(q)).left>0))return;
  ev.preventDefault();ev.stopImmediatePropagation();b.id==='fd_open'?deliver():pay();
 },true);
 // 저장이 끝나면 품목은 다시 보기 화면으로
 document.addEventListener('click',ev=>{if(!ev.target.closest?.('#qtSaveBtn'))return;const id=typeof qtSel!=='undefined'?qtSel:null;setTimeout(function chk(n=0){if(typeof qtHasUnsavedChanges==='function'&&!qtHasUnsavedChanges()){editing.delete(id);bar();}else if(n<20)setTimeout(()=>chk(n+1),300);},300);},true);

 /* ── 지우기 · 취소 처리(10/8) ──
    저장소는 장부 규칙: 저장된 납품 기록은 지우거나 고칠 수 없고(추가만), 납품·재고·입금이 연결된 견적서는 지울 수 없다.
    → 연결된 기록이 없으면 진짜 지우기, 있으면 '취소 처리' = 상태만 취소로 저장(납품 기록은 그대로 남김) → 재고 되돌림(입고 기록 추가).
      취소된 견적은 매출·받을 금액·재고 계산에서 빠지고, 연결 입금은 거래처 입금으로 계속 계산된다.
    confirm() 대신 창을 쓴다(설치 앱·일부 브라우저에서 confirm이 아무 반응 없이 넘어간다). */
 const legacyDelete=typeof deleteQuote==='function'?deleteQuote:null;
 const linked=q=>({pays:(db.payments||[]).filter(p=>p.quote_id===q.id),moves:(db.stock_moves||[]).filter(m=>m.quote_id===q.id),dq:quoteDeliveredQty(q)});
 async function removeQuote(id){
  const q=(db.quotes||[]).find(x=>x.id===id);if(!q)return legacyDelete?.(id);
  const L=linked(q),paid=L.pays.reduce((a,p)=>a+(Number(p.amount)||0),0);
  const head=t=>`<div class="nd-ps-hd"><b>${t}</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')} · ${won(quoteAmount(q))}원</span></div>`;
  if(!L.pays.length&&!L.moves.length&&!L.dq&&!(q.deliveries||[]).length){
   const d=open(`${head('견적서를 지울까요?')}<div class="nd-qa-body"><p class="nd-qa-note">납품·입금 기록이 없는 견적서라 바로 지워져요. 되돌릴 수 없어요.</p></div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">지우기</button></div>`);
   d.querySelector('.nd-qa-del').onclick=async ev=>{
    const btn=ev.currentTarget;btn.disabled=true;btn.textContent='지우는 중…';
    const next=db.quotes.filter(x=>x.id!==id);
    if(!await saveTable('quotes',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
    db.quotes=next;qtSel=null;qtEditing=null;qtBaseline='';d.close();renderQtList();renderQtDetail();say('견적서를 지웠어요');
   };
   return;
  }
  const back=stockDeltaForQuote({...q,status:'취소'}),backQty=back.moves.reduce((a,m)=>a+(m.kind==='입고'?m.qty:-m.qty),0);
  if(q.status==='취소'&&!back.moves.length){
   open(`${head('이미 취소된 견적서예요')}<div class="nd-qa-body"><p class="nd-qa-note">납품·재고·입금 기록이 연결돼 있어 장부 규칙상 지울 수 없어요. '취소'로 남아 있고 매출·받을 금액·재고 계산에는 들어가지 않아요.</p></div>
    <div class="nd-ps-act nd-ps-one"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`);
   return;
  }
  const d=open(`${head(q.status==='취소'?'재고 되돌리기를 마칠까요?':'이 견적서는 지울 수 없어서 취소로 바꿔요')}
   <div class="nd-qa-body">
    <p class="nd-qa-note">납품·입금 기록은 장부라서 지우지 않고 남겨요. 대신 <b>취소</b>로 바꾸면 매출·받을 금액에서 빠져요.</p>
    <div class="nd-qa-lines">
     ${L.dq?`<div class="nd-qa-ln"><div><span>납품 기록 ${(q.deliveries||[]).length}건 · ${won(L.dq)}개</span></div><b class="nd-qa-tag mute">기록은 남김</b></div>`:''}
     ${back.moves.length?`<div class="nd-qa-ln"><div><span>재고</span></div><b class="nd-qa-tag">${backQty>0?`${won(backQty)}개 되돌림`:'되돌림'}</b></div>`:''}
     ${L.pays.length?`<div class="nd-qa-ln"><div><span>입금 ${L.pays.length}건 · ${won(paid)}원</span></div><b class="nd-qa-tag mute">거래처 입금으로 계산</b></div>`:''}
    </div>
    <p class="nd-qa-note">잘못 만든 견적이라면 취소한 뒤 새 견적서로 다시 만들면 돼요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">${q.status==='취소'?'재고 되돌리기':'취소 처리'}</button></div>`);
  d.querySelector('.nd-qa-del').onclick=async ev=>{
   const btn=ev.currentTarget;btn.disabled=true;btn.textContent='정리하는 중…';
   const fail=t=>{btn.disabled=false;btn.textContent='다시 시도';say(t);};
   let cur=(db.quotes||[]).find(x=>x.id===id);
   if(cur.status!=='취소'){
    const nq={...JSON.parse(JSON.stringify(cur)),status:'취소'};
    const next=db.quotes.map(x=>x.id===id?nq:x);
    if(!await saveTable('quotes',next))return fail('취소로 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    db.quotes=next;cur=nq;qtEditing=null;qtBaseline='';renderQtList();renderQtDetail();
   }
   if(stockDeltaForQuote(cur).moves.length&&!await syncStockForQuote(cur,{ask:false}))return fail('재고 되돌리기에 실패했어요. 다시 누르면 이어서 해요.');
   d.close();renderQtList();renderQtDetail();say('취소로 바꿨어요 · 재고 되돌림 완료');
  };
 }
 // 납품 기록 ×: 저장된 기록은 장부라 못 지움 → 안내 + [견적서 취소하기]. 아직 저장 안 한 기록은 바로 뺀다.
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('#qtForm [data-delivery-remove]');const q=b&&current();if(!q)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const rid=b.dataset.deliveryRemove;
  if(!(q.deliveries||[]).some(x=>x.id===rid)){
   if(typeof qtEditing!=='undefined'&&qtEditing){qtEditing.deliveries=(qtEditing.deliveries||[]).filter(x=>x.id!==rid);normalizeDeliveryStatus(qtEditing);renderQtDetail();}
   return;
  }
  const d=open(`<div class="nd-ps-hd"><b>저장된 납품 기록은 지울 수 없어요</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">납품 기록은 재고와 매출의 근거라서 저장한 뒤에는 고치거나 지울 수 없게 되어 있어요.</p>
    <p class="nd-qa-note">잘못 넣었다면 <b>견적서를 취소</b>하면 재고가 되돌아오고 매출에서 빠져요. 그다음 새 견적서로 다시 만들면 돼요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del" data-cancel-q>견적서 취소하기</button></div>`);
  d.querySelector('[data-cancel-q]').onclick=()=>removeQuote(q.id);
 },true);
 if(legacyDelete)window.deleteQuote=removeQuote;
 window.NaroQuoteActions={bar,deliver,pay,removeQuote};
})();
