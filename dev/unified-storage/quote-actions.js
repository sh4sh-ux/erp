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
 function bar(){
  const f=document.getElementById('qtForm');if(!f)return;
  const anchor=f.querySelector('#qp-panel-basic');const q=current();
  let el=f.querySelector(':scope .nd-next');
  if(!q||!anchor||!committed(q)){el?.remove();return;}
  const s=state(work(q)),canDeliver=s.left>0,canPay=s.balance>0;
  const key=[q.id,s.left,s.delivered,s.balance,q.status].join('|');
  if(el&&el.dataset.key===key&&el.nextElementSibling===anchor)return;
  if(!el){el=document.createElement('div');el.className='nd-next';}
  el.dataset.key=key;
  const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
  const title=canDeliver?`<b>다음 할 일: 납품</b><span>${won(s.delivered)} / ${won(s.ordered)}개 납품</span>`:canPay?`<b>다음 할 일: 입금</b><span>남은 금액 ${won(s.balance)}원</span>`:`<b>납품·입금 완료</b><span>할 일이 없어요</span>`;
  el.classList.toggle('done',!canDeliver&&!canPay);
  el.innerHTML=`<div class="nd-next-t">${title}</div>
   <div class="nd-next-prog"><span>납품 <i style="--p:${pct(s.delivered,s.ordered)}%"></i></span><span>입금 <i style="--p:${pct(s.paid,s.amount)}%"></i></span></div>
   <div class="nd-next-act">${canPay&&canDeliver?'<button type="button" class="nd-next-b" data-qa="pay">입금 받기</button>':''}${canDeliver?'<button type="button" class="nd-next-b pri" data-qa="deliver">납품 처리</button>':canPay?'<button type="button" class="nd-next-b pri" data-qa="pay">입금 받기</button>':''}</div>`;
  if(el.nextElementSibling!==anchor)anchor.before(el);
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
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('#qtForm .nd-next [data-qa]');if(!b)return;ev.preventDefault();b.dataset.qa==='deliver'?deliver():pay();});
 window.NaroQuoteActions={bar,deliver,pay};
})();
