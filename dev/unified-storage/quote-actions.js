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
   return {key:q.status+'|'+days,sum:sent?{t:days>0?`회신 대기 · ${days}일째`:'회신 대기',s:'거래처가 확정하면 수주 확정을 누르세요'}:{t:'작성중',s:'보냈으면 발송함, 확정됐으면 수주 확정'},list:[{t:sent?'작성':'작성중',st:sent?'done':'cur'},{t:sent?(days>0?`발송 · ${days}일째 회신 대기`:'발송'):'발송',st:sent?'cur':'todo'},{t:'수주',st:'todo'},{t:'납품',st:'todo'}],
    acts:(sent?'':'<button type="button" class="nd-next-b" data-st="발송">발송함</button>')+'<button type="button" class="nd-next-b pri" data-st="수주">수주 확정</button>'};
  }
  const s=state(work(q)),dDone=s.left<=0,pDone=s.balance<=0,taxed=taxedOf(q),nt=noTaxOf(q);
  const list=[{t:'수주',st:'done'},{t:`납품 ${won(s.delivered)}/${won(s.ordered)}개`,st:dDone?'done':'cur',tab:'flow'},
   {t:pDone?`입금 ${won(s.paid)}원`:`입금 ${won(s.paid)} / ${won(s.amount)}원`,st:pDone?'done':dDone?'cur':'todo',tab:'flow'},
   {t:nt?'계산서 발행 안 함':taxed?'계산서 발행':'계산서 미발행',st:nt||taxed?'done':'todo',tab:'flow'}];
  const acts=!dDone?(pDone?'':'<button type="button" class="nd-next-b" data-qa="pay">입금 받기</button>')+'<button type="button" class="nd-next-b pri" data-qa="deliver">납품 처리</button>'
   :!pDone?'<button type="button" class="nd-next-b pri" data-qa="pay">입금 받기</button>':'';
  const taxTxt=nt?'계산서 발행 안 함':taxed?'계산서 발행':'계산서 미발행';
  const sum=!dDone?{t:`납품 ${won(s.delivered)} / ${won(s.ordered)}개`,s:`입금 ${won(s.paid)}원 · ${taxTxt}`}:!pDone?{t:`입금 ${won(s.balance)}원 남음`,s:`납품 완료 · ${taxTxt}`}:{t:'납품·입금 완료',s:taxTxt};
  return {key:[s.left,s.delivered,s.balance,taxed,nt].join('|'),list,acts,sum};
 }
 function bar(){
  const f=document.getElementById('qtForm');if(!f)return;
  const q=current();const anchor=f.querySelector('[role="tabpanel"]');
  f.dataset.ndSt=q?q.status:'new';
  editMode(f,q);
  {const info=f.querySelector('#qp-panel-basic');let lk=info?.querySelector(':scope>.nd-log-link');
   if(!q||!window.NaroChangeLog){lk?.remove();}else if(info&&!lk){lk=document.createElement('button');lk.type='button';lk.className='nd-log-link';lk.textContent='이 견적서의 변경 기록 보기';lk.onclick=()=>{const c=current();if(c)window.NaroChangeLog.open({ref:c.id,title:`${c.no||''} · ${coName(c.company_id)}`});};info.append(lk);}}
  recs(f,q);
  const note=f.querySelector('.delivery-panel .quote-flow-body>.quote-flow-sub');const NOTE='저장된 납품 기록은 재고·매출의 근거라 고치거나 지울 수 없어요. 잘못 넣었다면 ··· → 삭제를 누르면 견적서를 취소(재고 되돌림)할 수 있어요.';
  if(note&&q&&(q.deliveries||[]).length&&note.textContent!==NOTE)note.textContent=NOTE;
  let el=f.querySelector(':scope .nd-next');
  cancelToggle();
  if(q&&anchor&&q.status==='취소'){
   const key='c|'+q.id+'|'+(q.cancelled_at||'')+'|'+(q.cancel_reason||'');
   if(!el){el=document.createElement('div');}
   if(el.dataset.key!==key){el.className='nd-next nd-cancelled';el.dataset.key=key;el.innerHTML=`<div class="nd-cx"><b>취소됨</b><span>${[q.cancelled_at?md(q.cancelled_at):'',q.cancel_reason||''].filter(Boolean).map(e).join(' · ')||'매출·받을 금액·재고에서 빠졌어요'}</span></div><div class="nd-next-act"><button type="button" class="nd-next-b" data-restore>되살리기</button></div>`;}
   if(el.nextElementSibling!==anchor)anchor.before(el);return;
  }
  if(el?.classList.contains('nd-cancelled')){el.remove();el=null;}
  if(!q||!anchor){el?.remove();return;}
  const S=steps(q),key=q.id+'|'+q.status+'|'+S.key;
  if(el&&el.dataset.key===key&&el.nextElementSibling===anchor)return;
  if(!el){el=document.createElement('div');el.className='nd-next';}
  el.dataset.key=key;
  el.innerHTML=`<button type="button" class="nd-sum" data-tab="flow"><b>${e(S.sum.t)}</b><span>${e(S.sum.s)}</span></button><ol class="nd-steps">${S.list.map((x,i)=>`${i?`<li class="nd-step-ln ${x.st==='todo'?'':'on'}" aria-hidden="true"></li>`:''}<li class="nd-step ${x.st}">${x.tab?`<button type="button" data-tab="${x.tab}">`:'<span>'}<i>${x.st==='done'?ok:''}</i>${e(x.t)}${x.tab?'</button>':'</span>'}</li>`).join('')}</ol>${S.acts?`<div class="nd-next-act">${S.acts}</div>`:''}`;
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
 function deliver(start='all'){
  const q0=current();if(!q0||!guard())return;const q=work(q0);const s=state(q);if(!s.left)return;
  const qty=Object.fromEntries(s.rest.map(r=>[r.l.id,r.left]));let mode=start,date=localDate(),memo='';
  const label=l=>`${e(l.name||'')}`,sub=(l,left)=>[l.color,l.spec].filter(Boolean).map(e).join(' · ')+(l.color||l.spec?' · ':'')+`남음 ${won(left)}`;
  const paint=()=>{
   const total=Object.values(qty).reduce((a,b)=>a+b,0);
   const d=open(`<div class="nd-ps-hd"><b>납품 처리</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
    <div class="nd-qa-body">
     <div class="nd-qa-seg" role="tablist"><button type="button" role="tab" aria-selected="${mode==='all'}" data-m="all">남은 수량 전부 (${won(s.left)}개)</button><button type="button" role="tab" aria-selected="${mode==='part'}" data-m="part">일부만</button></div>
     ${mode==='part'?`<div class="nd-qa-lines">${s.rest.map(r=>`<div class="nd-qa-ln"><div><span>${label(r.l)}</span><small>${sub(r.l,r.left)}</small></div><span class="nd-qa-step"><button type="button" data-d="${e(r.l.id)}" data-v="-1" aria-label="줄이기">−</button><input inputmode="numeric" data-q="${e(r.l.id)}" value="${qty[r.l.id]}" aria-label="납품 수량"><button type="button" data-d="${e(r.l.id)}" data-v="1" aria-label="늘리기">+</button></span></div>`).join('')}</div><p class="nd-qa-note">처음엔 남은 수량이 다 채워져 있어요. 이번에 못 보내는 것만 줄이세요.</p>`:''}
     <div class="nd-qa-fields"><label>납품일<input type="date" id="ndQaDate" value="${e(date)}"></label><label>메모 (선택)<input id="ndQaMemo" value="${e(memo)}" placeholder="예: 택배 1박스"></label></div>
     <p class="nd-qa-after">확인하면 납품이 기록되고 <b>재고가 ${won(total)}개 빠져요</b>. 상태는 ${total>=s.left?'<b>납품</b>':'<b>부분납품</b>'}이 돼요.</p>
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${total>0?'':'disabled'}>${won(total)}개 납품 확인</button></div>`);
   d.querySelector('#ndQaDate').onchange=ev=>{date=ev.target.value;};d.querySelector('#ndQaMemo').oninput=ev=>{memo=ev.target.value;};
   d.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;if(mode==='all')s.rest.forEach(r=>qty[r.l.id]=r.left);paint();});
   d.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const r=s.rest.find(x=>x.l.id===b.dataset.d);qty[r.l.id]=Math.max(0,Math.min(r.left,qty[r.l.id]+Number(b.dataset.v)));paint();});
   d.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const r=s.rest.find(x=>x.l.id===inp.dataset.q);const v=Math.floor(Number(String(inp.value).replace(/[^\d]/g,''))||0);qty[r.l.id]=Math.max(0,Math.min(r.left,v));paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    const btn=ev.currentTarget;date=d.querySelector('#ndQaDate').value||localDate();memo=d.querySelector('#ndQaMemo').value.trim();
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
 function pay(edit=null){
  const q=current();if(!q||!guard())return;const s0=state(work(q));
  // 고치기: 이 입금을 뺀 남은 금액 기준. 저장은 새 입금 추가 → 원래 입금 지우기(입금은 고칠 수 없는 장부 — 지우기는 된다)
  const s=edit?{...s0,balance:s0.balance+(Number(edit.amount)||0)}:s0;
  let amount=edit?Number(edit.amount)||0:Math.max(0,s.balance),method=edit?.method||'계좌이체',preset=edit?'custom':'all',date=edit?.date||localDate(),memo=edit?.memo||'';
  const paint=()=>{
   const over=amount>s.balance&&s.balance>=0;
   const d=open(`<div class="nd-ps-hd"><b>${edit?'입금 고치기':'입금 받기'}</b><span class="nd-qa-sub">${e(coName(q.company_id))} · 남은 금액 ${won(s.balance)}원</span></div>
    <div class="nd-qa-body">
     <label class="nd-qa-money">받은 금액<input id="ndQaAmt" inputmode="numeric" value="${amount?won(amount):''}" placeholder="0"><span>원</span></label>
     <div class="nd-qa-chips" role="group" aria-label="금액">${[['all','남은 금액 전부'],['half','절반'],['custom','직접 입력']].map(([k,t])=>`<button type="button" data-p="${k}" aria-pressed="${preset===k}">${t}</button>`).join('')}</div>
     <div class="nd-qa-chips" role="group" aria-label="입금 방법">${METHODS.map(m=>`<button type="button" data-me="${m}" aria-pressed="${method===m}">${m}</button>`).join('')}</div>
     <div class="nd-qa-fields"><label>입금일<input type="date" id="ndQaDate" value="${e(date)}"></label><label>메모 (선택)<input id="ndQaMemo" value="${e(memo)}" placeholder="예: 잔금"></label></div>
     ${over?`<p class="nd-qa-warn">남은 금액보다 ${won(amount-s.balance)}원 많아요. 초과 입금으로 기록돼요.</p>`:''}
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${amount>0?'':'disabled'}>${amount>0?won(amount)+(edit?'원으로 고치기':'원 입금 확인'):'금액을 넣어 주세요'}</button></div>`);
   d.querySelector('#ndQaDate').onchange=ev=>{date=ev.target.value;};d.querySelector('#ndQaMemo').oninput=ev=>{memo=ev.target.value;};
   const inp=d.querySelector('#ndQaAmt');
   inp.oninput=()=>{amount=Math.floor(Number(inp.value.replace(/[^\d]/g,''))||0);preset='custom';d.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.p==='custom')));const go=d.querySelector('.nd-qa-go');go.disabled=!(amount>0);go.textContent=amount>0?won(amount)+(edit?'원으로 고치기':'원 입금 확인'):'금액을 넣어 주세요';};
   // 손을 뗄 때 창을 다시 그리면 같이 누른 [입금 확인]이 사라져 두 번 눌러야 했다 — 숫자 모양과 초과 안내만 고친다
   inp.onblur=()=>{inp.value=amount?won(amount):'';const over=amount>s.balance&&s.balance>=0;let w=d.querySelector('.nd-qa-warn');if(over){if(!w){w=document.createElement('p');w.className='nd-qa-warn';d.querySelector('.nd-qa-body').append(w);}w.textContent=`남은 금액보다 ${won(amount-s.balance)}원 많아요. 초과 입금으로 기록돼요.`;}else w?.remove();};
   d.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{preset=b.dataset.p;if(preset==='all')amount=Math.max(0,s.balance);else if(preset==='half')amount=Math.max(0,Math.round(s.balance/2));paint();if(preset==='custom'){const i=sheet.querySelector('#ndQaAmt');i.focus();i.select();}});
   d.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{method=b.dataset.me;paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    const btn=ev.currentTarget;if(!(amount>0))return;
    date=d.querySelector('#ndQaDate').value||localDate();memo=d.querySelector('#ndQaMemo').value.trim();
    btn.disabled=true;btn.textContent='저장 중…';
    const next=[...db.payments,{id:crypto.randomUUID(),date,company_id:q.company_id,quote_id:q.id,kind:'수금',method,amount,memo,created_at:new Date().toISOString()}];
    if(!await saveTable('payments',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
    db.payments=next;
    if(edit){const rest=db.payments.filter(x=>x.id!==edit.id);if(!await saveTable('payments',rest)){d.close();renderQtDetail();say('새 입금은 저장했지만 원래 입금을 지우지 못했어요. 원래 입금의 ··· → 지우기를 눌러 주세요.');return;}db.payments=rest;}
    d.close();renderQtDetail();
    say(edit?`입금을 ${won(amount)}원으로 고쳤어요`:`${won(amount)}원 입금을 기록했어요`);
   };
  };
  paint();
 }
 /* ── 진행 탭 기록(10/8 시안 ⑥⑦): 납품 [부분 납품][남은 N개 전체 납품] · 줄마다 ···(고치기·이 납품 취소)
      입금 [입금 추가] · 줄마다 ···(고치기·지우기) · 계산서 [발행] → 날짜 창. 옛 칸(.quote-flow)은 숨긴다.
      납품 고치기 = 원래 기록에 '취소됨'(void_at) 표시 + 새 기록 추가를 견적 저장 한 번에(저장소 규칙이 이것만 허용, 기록은 남는다). */
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?`${Number(m[2])}.${m[3]}`:'';};
 const dots='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>';
 const recLabel=(q,d)=>{try{return typeof deliveryRecordLabel==='function'?deliveryRecordLabel(q,d):'';}catch{return '';}};
 const recQty=d=>(d.lines||[]).reduce((a,l)=>a+(Number(l.qty)||0),0);
 function recs(f,q){
  const panel=f.querySelector('#qp-panel-flow');let box=panel?.querySelector(':scope>.nd-rec');
  if(!panel||!q){box?.remove();panel?.classList.remove('nd-rec-on');return;}
  const w=work(q),s=state(w),pays=typeof quotePayments==='function'?quotePayments(q.id):(db.payments||[]).filter(p=>p.kind==='수금'&&p.quote_id===q.id);
  const refunds=(db.payments||[]).filter(p=>p.quote_id===q.id&&p.kind==='지급'&&p.refund);
  const dels=(w.deliveries||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created_at||'').localeCompare(a.created_at||''));
  const taxed=taxedOf(q),nt=noTaxOf(q),can=committed(q);
  const key=JSON.stringify([q.id,q.status,q.tax_at,q.no_tax,nt,s.left,s.balance,dels.map(d=>[d.id,d.void_at,d.date,recQty(d)]),pays.map(p=>[p.id,p.amount,p.date,p.method,p.memo]),refunds.map(p=>[p.id,p.amount])]);
  if(box&&box.dataset.key===key)return;
  if(!box){box=document.createElement('div');box.className='nd-rec';panel.prepend(box);}
  panel.classList.add('nd-rec-on');box.dataset.key=key;
  const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
  const dRows=dels.map(d=>d.void_at?`<div class="nd-rec-row void"><span class="d">${md(d.date)}</span><span class="n">${e(recLabel(w,d)||'납품')}</span><span class="a">${won(recQty(d))}개</span><span class="t">${d.void_reason==='고침'?'고침':'취소됨'}</span></div>`
   :`<div class="nd-rec-row"><span class="d">${md(d.date)}</span><span class="n">${e(recLabel(w,d)||'납품')}${d.memo?` <small>· ${e(d.memo)}</small>`:''}</span><span class="a">${won(recQty(d))}개</span><button type="button" class="nd-rec-more" data-rm-d="${e(d.id)}" aria-label="이 납품 기록 메뉴" aria-expanded="false">${dots}</button></div>`).join('');
  const pRows=pays.map(p=>`<div class="nd-rec-row"><span class="d">${md(p.date)}</span><span class="n">${e([p.memo,p.method].filter(Boolean).join(' · ')||'입금')}</span><span class="a">${won(p.amount)}원</span><button type="button" class="nd-rec-more" data-rm-p="${e(p.id)}" aria-label="이 입금 기록 메뉴" aria-expanded="false">${dots}</button></div>`).join('');
  const rRows=refunds.map(p=>`<div class="nd-rec-row"><span class="d">${md(p.date)}</span><span class="n">환불${p.method?` · ${e(p.method)}`:''}</span><span class="a neg">−${won(p.amount)}원</span><button type="button" class="nd-rec-more" data-rm-r="${e(p.id)}" aria-label="이 환불 기록 메뉴" aria-expanded="false">${dots}</button></div>`).join('');
  box.innerHTML=`<section class="nd-rec-card">
    <div class="nd-rec-hd"><div><h3>납품</h3><span>${won(s.ordered)}개 중 ${won(s.delivered)}개${s.left?` · ${won(s.left)}개 남음`:s.delivered?' · 완료':''}</span></div>
     <div class="nd-rec-act">${can&&s.left?`<button type="button" class="nd-next-b" data-rec="part">부분 납품</button><button type="button" class="nd-next-b pri" data-rec="all">남은 ${won(s.left)}개 전체 납품</button>`:''}</div></div>
    <i class="nd-rec-bar" style="--p:${pct(s.delivered,s.ordered)}%"></i>
    ${dRows||`<p class="nd-rec-empty">${can?'아직 납품 기록이 없어요.':'수주 확정 후 납품을 기록할 수 있어요.'}</p>`}
   </section>
   <section class="nd-rec-card">
    <div class="nd-rec-hd"><div><h3>입금</h3><span>${won(s.amount)}원 중 ${won(s.paid)}원${s.balance>0?` · <b class="amber">${won(s.balance)}원 남음</b>`:s.balance<0?` · ${won(-s.balance)}원 초과`:s.paid?' · 완료':''}</span></div>
     <div class="nd-rec-act"><button type="button" class="nd-next-b ${s.balance>0?'pri':''}" data-rec="pay">입금 추가</button></div></div>
    <i class="nd-rec-bar" style="--p:${pct(s.paid,s.amount)}%"></i>
    ${pRows+rRows||'<p class="nd-rec-empty">아직 입금 기록이 없어요.</p>'}
   </section>
   <section class="nd-rec-card nd-rec-tax">
    <div class="nd-rec-hd"><div><h3>계산서</h3><span>${nt?(q.no_tax?'이 거래는 발행하지 않아요':'네이버·쿠팡·거래처 설정으로 발행하지 않아요'):taxed?`${e(String(q.tax_at).replaceAll('-','.'))} 발행`:'아직 발행하지 않았어요'}</span></div>
     <div class="nd-rec-act">${nt?'<b class="nd-rec-st">발행 안 함</b>':''}${!nt&&!taxed?'<b class="nd-rec-st amber">미발행</b>':''}<button type="button" class="nd-next-b" data-rec="tax">${taxed?'바꾸기':nt?(q.no_tax?'바꾸기':''):'발행'}</button></div></div>
   </section>`;
  if(nt&&!q.no_tax)box.querySelector('[data-rec="tax"]')?.remove();
 }
 // ··· 메뉴: 바깥을 누르거나 같은 ···을 다시 누르면 닫힌다
 let menu=null;
 const closeMenu=()=>{if(!menu)return;menu.btn.setAttribute('aria-expanded','false');menu.el.remove();menu=null;};
 function openMenu(btn,items){
  const same=menu&&menu.btn===btn;closeMenu();if(same)return;
  const el=document.createElement('div');el.className='nd-rec-menu';el.setAttribute('role','menu');
  el.innerHTML=items.map((it,i)=>`<button type="button" role="menuitem" data-i="${i}" class="${it.danger?'danger':''}">${e(it.t)}</button>`).join('');
  el.addEventListener('click',ev=>{const b=ev.target.closest('[data-i]');if(!b)return;const it=items[Number(b.dataset.i)];closeMenu();it.fn();});
  btn.closest('.nd-rec-row').append(el);btn.setAttribute('aria-expanded','true');menu={btn,el};
 }
 document.addEventListener('click',ev=>{if(menu&&!ev.target.closest?.('.nd-rec-menu')&&!ev.target.closest?.('.nd-rec-more'))closeMenu();},true);
 async function saveDeliveries(q,mutate,ok){
  const orig=(db.quotes||[]).find(x=>x.id===q.id);const nq=work(orig);mutate(nq);normalizeDeliveryStatus(nq);
  const next=db.quotes.map(x=>x.id===nq.id?nq:x);
  if(!await saveTable('quotes',next))return false;
  db.quotes=next;qtEditing=null;qtBaseline='';renderQtList();renderQtDetail();
  if(stockDeltaForQuote(nq).moves.length&&!await syncStockForQuote(nq,{ask:false})){window.dispatchEvent(new Event('naro-incomplete-stock'));return true;}
  say(ok);return true;
 }
 function editDelivery(id){
  const q0=current();if(!q0||!guard())return;const q=work(q0);const d0=(q.deliveries||[]).find(x=>x.id===id&&!x.void_at);if(!d0)return;
  const done=quoteDeliveryQtyMap(q);
  const rows=(d0.lines||[]).map(dl=>{const l=q.lines.find(x=>x.id===dl.line_id)||{};const was=Number(dl.qty)||0;return {l,id:dl.line_id,was,max:Math.max(was,(Number(l.qty)||0)-(done[dl.line_id]||0)+was)};});
  const qty=Object.fromEntries(rows.map(r=>[r.id,r.was]));let date=d0.date||localDate();
  const paint=()=>{
   const was=rows.reduce((a,r)=>a+r.was,0),now=rows.reduce((a,r)=>a+qty[r.id],0),same=now===was&&rows.every(r=>qty[r.id]===r.was)&&date===d0.date;
   const d=open(`<div class="nd-ps-hd"><b>납품 기록 고치기</b><span class="nd-qa-sub">${md(d0.date)} 납품 · ${e(recLabel(q,d0)||'')}</span></div>
    <div class="nd-qa-body"><div class="nd-qa-lines">${rows.map(r=>`<div class="nd-qa-ln"><div><span>${e(r.l.name||'품목')}</span><small>${[r.l.color,r.l.spec].filter(Boolean).map(e).join(' · ')}${r.l.color||r.l.spec?' · ':''}원래 ${won(r.was)}개</small></div><span class="nd-qa-step"><button type="button" data-d="${e(r.id)}" data-v="-1" aria-label="줄이기">−</button><input inputmode="numeric" data-q="${e(r.id)}" value="${qty[r.id]}" aria-label="납품 수량"><button type="button" data-d="${e(r.id)}" data-v="1" aria-label="늘리기">+</button></span></div>`).join('')}</div>
     <div class="nd-qa-fields"><label>납품일<input type="date" id="ndQaDate" value="${e(date)}"></label></div>
     <p class="nd-qa-after">${same?'바꾼 내용이 없어요.':now?`확인하면 <b>원래 ${won(was)}개 기록은 '고침'으로 남고 ${won(now)}개 기록이 새로 생겨요.</b> 재고는 차이(${now>was?'+':''}${won(now-was)}개)만큼 반영돼요.`:`0개면 <b>이 납품을 취소</b>하는 것과 같아요. 재고 ${won(was)}개가 되돌아와요.`}</p></div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${same?'disabled':''}>${now?`${won(now)}개로 고치기`:'이 납품 취소'}</button></div>`);
   d.querySelector('#ndQaDate').onchange=ev=>{date=ev.target.value||date;paint();};
   d.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.d);qty[r.id]=Math.max(0,Math.min(r.max,qty[r.id]+Number(b.dataset.v)));paint();});
   d.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const r=rows.find(x=>x.id===inp.dataset.q);qty[r.id]=Math.max(0,Math.min(r.max,Math.floor(Number(String(inp.value).replace(/[^\d]/g,''))||0)));paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';const at=new Date().toISOString(),lines=rows.map(r=>({line_id:r.id,qty:qty[r.id]})).filter(x=>x.qty>0);
    const ok=await saveDeliveries(q0,nq=>{nq.deliveries=nq.deliveries.map(x=>x.id===id?{...x,void_at:at,void_reason:lines.length?'고침':'취소'}:x);if(lines.length)nq.deliveries.push({id:crypto.randomUUID(),date,lines,memo:d0.memo||'',created_at:at,corrects:id});},lines.length?'납품 기록을 고쳤어요 · 재고 반영 완료':'납품을 취소했어요 · 재고 되돌림 완료');
    if(ok)d.close();else{btn.disabled=false;btn.textContent='다시 시도';}
   };
  };
  paint();
 }
 function cancelDelivery(id){
  const q0=current();if(!q0||!guard())return;const q=work(q0);const d0=(q.deliveries||[]).find(x=>x.id===id&&!x.void_at);if(!d0)return;
  const d=open(`<div class="nd-ps-hd"><b>이 납품을 취소할까요?</b><span class="nd-qa-sub">${md(d0.date)} · ${e(recLabel(q,d0)||'')} · ${won(recQty(d0))}개</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">기록은 '취소됨'으로 남고 재고 ${won(recQty(d0))}개가 되돌아와요. 매출·받을 금액에서도 빠져요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">납품 취소</button></div>`);
  d.querySelector('.nd-qa-del').onclick=async ev=>{const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';
   const at=new Date().toISOString();const ok=await saveDeliveries(q0,nq=>{nq.deliveries=nq.deliveries.map(x=>x.id===id?{...x,void_at:at,void_reason:'취소'}:x);},'납품을 취소했어요 · 재고 되돌림 완료');
   if(ok)d.close();else{btn.disabled=false;btn.textContent='다시 시도';}};
 }
 function deletePayment(id){
  const q=current();if(!q||!guard())return;const p=(db.payments||[]).find(x=>x.id===id);if(!p)return;
  const d=open(`<div class="nd-ps-hd"><b>이 입금을 지울까요?</b><span class="nd-qa-sub">${md(p.date)} · ${e([p.memo,p.method].filter(Boolean).join(' · ')||'입금')} · ${won(p.amount)}원</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">잘못 넣은 입금일 때만 지워 주세요. 지우면 받을 금액이 ${won(p.amount)}원 늘어나요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">지우기</button></div>`);
  d.querySelector('.nd-qa-del').onclick=async ev=>{const btn=ev.currentTarget;btn.disabled=true;btn.textContent='지우는 중…';
   const next=db.payments.filter(x=>x.id!==id);if(!await saveTable('payments',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
   db.payments=next;d.close();renderQtDetail();say('입금을 지웠어요');};
 }
 function taxSheet(){
  const q=current();if(!q||!guard())return;const auto=noTaxOf(q)&&!q.no_tax;
  let date=q.tax_at||localDate(),off=!!q.no_tax;
  const t=new Date();t.setDate(t.getDate()-1);const yday=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  const paint=()=>{
   const d=open(`<div class="nd-ps-hd"><b>계산서 발행</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
    <div class="nd-qa-body">
     ${off?'':`<div class="nd-qa-fields"><label>발행일<input type="date" id="ndQaDate" value="${e(date)}"></label></div>
     <div class="nd-qa-chips" role="group" aria-label="빠른 날짜"><button type="button" data-day="${localDate()}" aria-pressed="${date===localDate()}">오늘</button><button type="button" data-day="${yday}" aria-pressed="${date===yday}">어제</button></div>`}
     ${auto?'':`<label class="nd-qa-check"><input type="checkbox" id="ndQaOff" ${off?'checked':''}> 이 거래는 계산서를 발행하지 않아요 <small>(현금·카드 판매 등)</small></label>`}
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go">${off?'발행 안 함으로 저장':q.tax_at?'발행일 저장':'발행 저장'}</button></div>`);
   d.querySelector('#ndQaDate')?.addEventListener('change',ev=>{date=ev.target.value||date;paint();});
   d.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{date=b.dataset.day;paint();});
   d.querySelector('#ndQaOff')?.addEventListener('change',ev=>{off=ev.target.checked;paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';
    const nq=JSON.parse(JSON.stringify((db.quotes||[]).find(x=>x.id===q.id)));
    if(off){nq.no_tax=true;nq.tax_at='';}else{delete nq.no_tax;nq.tax_at=date;}
    const next=db.quotes.map(x=>x.id===nq.id?nq:x);
    if(!await saveTable('quotes',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
    db.quotes=next;qtEditing=null;qtBaseline='';d.close();renderQtList();renderQtDetail();say(off?'계산서 발행 안 함으로 저장했어요':`계산서 발행일 ${date.replaceAll('-','.')} 저장했어요`);};
  };
  paint();
 }
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('#qtForm .nd-rec [data-rec],#qtForm .nd-rec .nd-rec-more');if(!b)return;ev.preventDefault();
  if(b.dataset.rmR){const id=b.dataset.rmR;return openMenu(b,[{t:'환불 기록 지우기',danger:true,fn:()=>deletePayment(id)}]);}
  if(b.dataset.rec==='part')return deliver('part');if(b.dataset.rec==='all')return deliver('all');
  if(b.dataset.rec==='pay')return pay();if(b.dataset.rec==='tax')return taxSheet();
  if(b.dataset.rmD){const id=b.dataset.rmD;return openMenu(b,[{t:'수량·날짜 고치기',fn:()=>editDelivery(id)},{t:'이 납품 취소 (재고 되돌림)',danger:true,fn:()=>cancelDelivery(id)}]);}
  if(b.dataset.rmP){const p=(db.payments||[]).find(x=>x.id===b.dataset.rmP);if(!p)return;return openMenu(b,[{t:'고치기',fn:()=>pay(p)},{t:'지우기',danger:true,fn:()=>deletePayment(p.id)}]);}
 });
 document.addEventListener('click',ev=>{
  const t=ev.target.closest?.('#qtForm .nd-next [data-qa],#qtForm .nd-next [data-st],#qtForm .nd-next [data-tab],#qtForm .nd-next [data-restore],#qtForm .nd-edit-b');if(!t)return;ev.preventDefault();
  if(t.hasAttribute('data-restore'))return restoreQuote();
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
   open(`${head('이미 취소된 견적서예요')}<div class="nd-qa-body"><p class="nd-qa-note">납품·재고·입금 기록이 연결돼 있어 지우지 않고 '취소'로 남겨 둬요. 목록에서는 숨겨지고, 매출·받을 금액·재고 계산에 들어가지 않아요. 다시 쓰려면 견적서 위의 [되살리기]를 누르세요.</p></div>
    <div class="nd-ps-act nd-ps-one"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`);
   return;
  }
  // 사유: 잘못 만듦(목록에서 사라짐) / 거래 취소(받은 돈이 있으면 환불했는지 묻는다)
  const net=quotePaid(q.id);let why=q.status==='취소'?(q.cancel_reason||'잘못 만듦'):'',refund='',amt=net,method='계좌이체',rdate=localDate();
  const paint=()=>{
   const deal=why==='거래 취소',askRefund=deal&&net>0,ready=why&&(!askRefund||refund)&&(refund!=='yes'||amt>0);
   const d=open(`${head(q.status==='취소'?'재고 되돌리기를 마칠까요?':'견적서를 정리할게요')}
    <div class="nd-qa-body">
     <span class="nd-qa-label">왜 없애나요?</span>
     <div class="nd-qa-pick" role="radiogroup">
      <button type="button" role="radio" aria-checked="${why==='잘못 만듦'}" data-why="잘못 만듦"><b>잘못 만들었어요</b><small>중복·시험 입력·거래처 잘못 고름</small></button>
      <button type="button" role="radio" aria-checked="${deal}" data-why="거래 취소"><b>거래가 취소됐어요</b><small>주문 취소·반품</small></button>
     </div>
     ${askRefund?`<span class="nd-qa-label">받은 돈 ${won(net)}원은요?</span>
     <div class="nd-qa-pick" role="radiogroup">
      <button type="button" role="radio" aria-checked="${refund==='yes'}" data-refund="yes"><b>돌려줬어요</b><small>출금(환불)으로 기록</small></button>
      <button type="button" role="radio" aria-checked="${refund==='keep'}" data-refund="keep"><b>다음 거래에 쓸게요</b><small>거래처에 맡긴 돈으로 남김</small></button>
     </div>
     ${refund==='yes'?`<label class="nd-qa-money">환불 금액<input id="ndQaAmt" inputmode="numeric" value="${amt?won(amt):''}"><span>원</span></label>
     <div class="nd-qa-chips" role="group" aria-label="환불 방법">${METHODS.map(m=>`<button type="button" data-me="${m}" aria-pressed="${method===m}">${m}</button>`).join('')}</div>
     <div class="nd-qa-fields"><label>환불일<input type="date" id="ndQaDate" value="${e(rdate)}"></label></div>`:''}`:''}
     <div class="nd-qa-lines">
      ${L.dq?`<div class="nd-qa-ln"><div><span>납품 기록 ${won(L.dq)}개</span></div><b class="nd-qa-tag mute">기록은 남김</b></div>`:''}
      ${back.moves.length?`<div class="nd-qa-ln"><div><span>재고</span></div><b class="nd-qa-tag">${backQty>0?`${won(backQty)}개 되돌림`:'되돌림'}</b></div>`:''}
      ${L.pays.length&&!(askRefund&&refund==='yes')?`<div class="nd-qa-ln"><div><span>입금 ${won(net)}원</span></div><b class="nd-qa-tag mute">거래처에 맡긴 돈으로 남김</b></div>`:''}
     </div>
     <p class="nd-qa-note">취소된 견적은 목록에서 숨겨지고 매출·받을 금액·재고에서 빠져요. 기록은 남아서 언제든 [되살리기]할 수 있어요.</p>
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del" ${ready?'':'disabled'}>${q.status==='취소'?'재고 되돌리기':'취소 처리'}</button></div>`);
   d.querySelectorAll('[data-why]').forEach(b=>b.onclick=()=>{why=b.dataset.why;paint();});
   d.querySelectorAll('[data-refund]').forEach(b=>b.onclick=()=>{refund=b.dataset.refund;paint();});
   d.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{method=b.dataset.me;paint();});
   d.querySelector('#ndQaDate')?.addEventListener('change',ev=>{rdate=ev.target.value||rdate;});
   const ai=d.querySelector('#ndQaAmt');if(ai){ai.oninput=()=>{amt=Math.min(net,Math.floor(Number(ai.value.replace(/[^\d]/g,''))||0));const go=d.querySelector('.nd-qa-del');go.disabled=!(amt>0);};ai.onblur=()=>{ai.value=amt?won(amt):'';};} // 다시 그리면 같이 누른 버튼이 사라진다 — 숫자 모양만
   d.querySelector('.nd-qa-del').onclick=async ev=>{
    const btn=ev.currentTarget;btn.disabled=true;btn.textContent='정리하는 중…';
    const fail=t=>{btn.disabled=false;btn.textContent='다시 시도';say(t);};
    let cur=(db.quotes||[]).find(x=>x.id===id);
    if(cur.status!=='취소'){
     const nq={...JSON.parse(JSON.stringify(cur)),status:'취소',cancel_reason:why,cancelled_at:localDate(),cancel_prev:cur.status};
     const next=db.quotes.map(x=>x.id===id?nq:x);
     if(!await saveTable('quotes',next))return fail('취소로 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요.');
     db.quotes=next;cur=nq;qtEditing=null;qtBaseline='';renderQtList();renderQtDetail();
    }
    if(stockDeltaForQuote(cur).moves.length&&!await syncStockForQuote(cur,{ask:false}))return fail('재고 되돌리기에 실패했어요. 다시 누르면 이어서 해요.');
    if(askRefund&&refund==='yes'&&amt>0){
     const next=[...db.payments,{id:crypto.randomUUID(),date:rdate,company_id:cur.company_id,quote_id:cur.id,kind:'지급',refund:true,method,amount:amt,memo:`환불 · ${cur.no||''}`,created_at:new Date().toISOString()}];
     if(!await saveTable('payments',next)){d.close();renderQtDetail();say('취소는 됐지만 환불 기록을 저장하지 못했어요. 입금·출금에서 출금으로 넣어 주세요.');return;}
     db.payments=next;
    }
    d.close();renderQtList();renderQtDetail();say(askRefund&&refund==='yes'?`취소했어요 · 재고 되돌림 · 환불 ${won(amt)}원 기록`:'취소했어요 · 재고 되돌림 완료');
   };
  };
  paint();
 }
 // 되살리기: 취소 전 상태로(납품 기록이 남아 있으면 납품·부분납품으로 맞춤) → 재고 다시 반영. 환불 기록은 그대로 둔다.
 async function restoreQuote(){
  const q=current();if(!q||q.status!=='취소')return;
  const refunds=(db.payments||[]).filter(p=>p.quote_id===q.id&&p.kind==='지급'&&p.refund);
  const d=open(`<div class="nd-ps-hd"><b>견적서를 되살릴까요?</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">취소 전 상태(${e(q.cancel_prev||'수주')})로 돌아가고, 납품 기록이 있으면 재고가 다시 빠져요.${refunds.length?' 환불 기록은 그대로 남아요 — 필요하면 입금·출금에서 정리해 주세요.':''}</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go">되살리기</button></div>`);
  d.querySelector('.nd-qa-go').onclick=async ev=>{const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';
   const nq=work((db.quotes||[]).find(x=>x.id===q.id));nq.status=['작성중','발송','수주','부분납품','납품'].includes(q.cancel_prev)?q.cancel_prev:'수주';
   delete nq.cancel_reason;delete nq.cancelled_at;delete nq.cancel_prev;if(['수주','부분납품','납품'].includes(nq.status))normalizeDeliveryStatus(nq);
   const next=db.quotes.map(x=>x.id===nq.id?nq:x);
   if(!await saveTable('quotes',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
   db.quotes=next;qtEditing=null;qtBaseline='';d.close();renderQtList();renderQtDetail();
   if(stockDeltaForQuote(nq).moves.length&&!await syncStockForQuote(nq,{ask:false})){window.dispatchEvent(new Event('naro-incomplete-stock'));return;}
   say('견적서를 되살렸어요');};
 }
 // 목록 맨 아래 '취소된 견적 N건 보기'(상태 필터를 고르지 않았을 때만)
 function cancelToggle(){
  const list=document.getElementById('qtList');if(!list)return;
  const n=(db.quotes||[]).filter(x=>x.status==='취소').length,st=document.getElementById('qtStatus')?.value||'';
  let b=list.querySelector(':scope>.nd-cancel-toggle');
  if(!n||st){b?.remove();return;}
  const t=window.ndShowCancelled?`취소된 견적 숨기기`:`취소된 견적 ${n}건 보기`;
  if(b&&b.textContent===t&&b===list.lastElementChild)return;
  if(!b){b=document.createElement('button');b.type='button';b.className='nd-cancel-toggle';b.onclick=()=>{window.ndShowCancelled=!window.ndShowCancelled;renderQtList();};}
  b.textContent=t;list.append(b);
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
