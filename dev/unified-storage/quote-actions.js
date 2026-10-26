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
 // 머리 단계 줄(10/8 시안, 10/26 [발송함] 버튼 뺌): 작성중·발송 = [수주 확정] 하나(공유·이메일로 보내면 저절로 발송, 앱 밖에서 보냈으면 단계 줄의 '발송'을 누른다), 수주 뒤 = 수주 · 납품 · 입금 · 계산서 + 지금 할 일 버튼 하나
 function steps(q){
  if(!committed(q)){
   const sent=q.status==='발송',days=sent&&q.sent_at&&typeof daysSince==='function'?daysSince(q.sent_at):0;
   return {key:q.status+'|'+days,sum:sent?{t:days>0?`회신 대기 · ${days}일째`:'회신 대기',s:'거래처가 확정하면 수주 확정을 누르세요'}:{t:'작성중',s:'공유·이메일로 보내면 발송으로 바뀌어요 · 확정되면 수주 확정'},list:[{t:sent?'작성':'작성중',st:sent?'done':'cur'},{t:sent?(days>0?`발송 · ${days}일째 회신 대기`:'발송'):'발송',st:sent?'cur':'todo',...(sent?{}:{act:'발송',hint:'앱 밖(카카오톡 등)에서 보냈으면 눌러서 발송으로 기록'})},{t:'수주',st:'todo'},{t:'납품',st:'todo'}],
    acts:'<button type="button" class="nd-next-b pri" data-st="수주">수주 확정</button>'};
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
  {const info=f.querySelector('#qp-panel-basic');let lk=info?.querySelector('.nd-log-link');
   if(!q||!window.NaroChangeLog){lk?.remove();}else if(info&&!lk){lk=document.createElement('button');lk.type='button';lk.className='nd-log-link';lk.textContent='이 견적서의 변경 기록 보기';lk.onclick=()=>{const c=current();if(c)window.NaroChangeLog.open({ref:c.id,title:`${c.no||''} · ${coName(c.company_id)}`});};info.append(lk);}}
  recs(f,q);
  const note=f.querySelector('.delivery-panel .quote-flow-body>.quote-flow-sub');const NOTE='저장된 납품 기록은 재고·매출의 근거라 수정하거나 삭제할 수 없어요. 잘못 넣었다면 ··· → 삭제를 누르면 재고가 되돌아가고, 나중에 복원할 수도 있어요.';
  if(note&&q&&(q.deliveries||[]).length&&note.textContent!==NOTE)note.textContent=NOTE;
  let el=f.querySelector(':scope .nd-next');
  cancelToggle();
  if(q&&anchor&&q.status==='취소'){
   const key='c|'+q.id+'|'+(q.cancelled_at||'')+'|'+(q.cancel_reason||'');
   if(!el){el=document.createElement('div');}
   if(el.dataset.key!==key){el.className='nd-next nd-cancelled';el.dataset.key=key;el.innerHTML=`<div class="nd-cx"><b>${q.cancel_reason==='삭제'?'삭제됨':'취소됨'}</b><span>${[q.cancelled_at?md(q.cancelled_at):'',q.cancel_reason&&q.cancel_reason!=='삭제'?q.cancel_reason:''].filter(Boolean).map(e).join(' · ')}${q.cancelled_at?' · ':''}매출·받을 금액·재고에서 빠졌어요</span></div><div class="nd-next-act"><button type="button" class="nd-next-b" data-restore>복원</button></div>`;}
   if(el.nextElementSibling!==anchor)anchor.before(el);return;
  }
  if(el?.classList.contains('nd-cancelled')){el.remove();el=null;}
  if(!q||!anchor){el?.remove();return;}
  const S=steps(q),key=q.id+'|'+q.status+'|'+S.key;
  if(el&&el.dataset.key===key&&el.nextElementSibling===anchor)return;
  if(!el){el=document.createElement('div');el.className='nd-next';}
  el.dataset.key=key;
  el.innerHTML=`<button type="button" class="nd-sum" data-tab="flow"><b>${e(S.sum.t)}</b><span>${e(S.sum.s)}</span></button><ol class="nd-steps">${S.list.map((x,i)=>`${i?`<li class="nd-step-ln ${x.st==='todo'?'':'on'}" aria-hidden="true"></li>`:''}<li class="nd-step ${x.st}">${x.act?`<button type="button" data-st="${e(x.act)}" title="${e(x.hint||'')}">`:x.tab?`<button type="button" data-tab="${x.tab}">`:'<span>'}<i>${x.st==='done'?ok:''}</i>${e(x.t)}${x.act||x.tab?'</button>':'</span>'}</li>`).join('')}</ol>${S.acts?`<div class="nd-next-act">${S.acts}</div>`:''}`;
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
  if(typeof qtHasUnsavedChanges==='function'&&qtHasUnsavedChanges()){say('수정한 내용을 먼저 저장해 주세요. 저장한 뒤 다시 눌러 주세요.');return false;}
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
  const qty=Object.fromEntries(s.rest.map(r=>[r.l.id,r.left]));let mode=start,date=localDate(),memo='',shipping={method:''};
  const label=l=>`${e(l.name||'')}`,sub=(l,left)=>[l.color,l.spec].filter(Boolean).map(e).join(' · ')+(l.color||l.spec?' · ':'')+`남음 ${won(left)}`;
  const paint=()=>{
   const total=Object.values(qty).reduce((a,b)=>a+b,0);
   const d=open(`<div class="nd-ps-hd"><b>납품 처리</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
    <div class="nd-qa-body">
     <div class="nd-qa-seg" role="tablist"><button type="button" role="tab" aria-selected="${mode==='all'}" data-m="all">남은 수량 전부 (${won(s.left)}개)</button><button type="button" role="tab" aria-selected="${mode==='part'}" data-m="part">일부만</button></div>
     ${mode==='part'?`<div class="nd-qa-lines">${s.rest.map(r=>`<div class="nd-qa-ln"><div><span>${label(r.l)}</span><small>${sub(r.l,r.left)}</small></div><span class="nd-qa-step"><button type="button" data-d="${e(r.l.id)}" data-v="-1" aria-label="줄이기">−</button><input inputmode="numeric" data-q="${e(r.l.id)}" value="${qty[r.l.id]}" aria-label="납품 수량"><button type="button" data-d="${e(r.l.id)}" data-v="1" aria-label="늘리기">+</button></span></div>`).join('')}</div><p class="nd-qa-note">처음엔 남은 수량이 다 채워져 있어요. 이번에 못 보내는 것만 줄이세요.</p>`:''}
     ${shippingFields(shipping,`<label>납품일<input type="date" id="ndQaDate" value="${e(date)}"></label>`)}<div class="nd-qa-fields"><label class="nd-qa-wide">메모 <small>(선택) · 링크를 붙이면 바로 열려요</small><input id="ndQaMemo" value="${e(memo)}" placeholder="예: 박스 2개 · 사진 링크"></label></div><p class="nd-qa-after">확인하면 납품이 기록되고 <b>재고가 ${won(total)}개 빠져요</b>. 상태는 ${total>=s.left?'<b>납품</b>':'<b>부분납품</b>'}이 돼요.</p>
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${total>0?'':'disabled'}>${won(total)}개 납품 확인</button></div>`);
   bindShipping(d);d.querySelector('.nd-qa-ship').addEventListener('change',()=>{shipping=readShipping(d,false)||shipping;});
   d.querySelector('#ndQaDate').onchange=ev=>{date=ev.target.value;};d.querySelector('#ndQaMemo').oninput=ev=>{memo=ev.target.value;};
   d.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;if(mode==='all')s.rest.forEach(r=>qty[r.l.id]=r.left);paint();});
   d.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const r=s.rest.find(x=>x.l.id===b.dataset.d);qty[r.l.id]=Math.max(0,Math.min(r.left,qty[r.l.id]+Number(b.dataset.v)));paint();});
   d.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const r=s.rest.find(x=>x.l.id===inp.dataset.q);const v=Math.floor(Number(String(inp.value).replace(/[^\d]/g,''))||0);qty[r.l.id]=Math.max(0,Math.min(r.left,v));paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    const btn=ev.currentTarget;date=d.querySelector('#ndQaDate').value||localDate();memo=d.querySelector('#ndQaMemo').value.trim();shipping=readShipping(d);if(!shipping)return;
    const lines=s.rest.map(r=>({line_id:r.l.id,qty:qty[r.l.id]})).filter(x=>x.qty>0);if(!lines.length)return;
    btn.disabled=true;btn.textContent='저장 중…';
    const nq=JSON.parse(JSON.stringify(q));
    nq.deliveries.push({id:crypto.randomUUID(),date,lines,memo,shipping,created_at:new Date().toISOString()});
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
   const d=open(`<div class="nd-ps-hd"><b>${edit?'입금 수정':'입금 받기'}</b><span class="nd-qa-sub">${e(coName(q.company_id))} · 남은 금액 ${won(s.balance)}원</span></div>
    <div class="nd-qa-body">
     <label class="nd-qa-money">받은 금액<input id="ndQaAmt" inputmode="numeric" value="${amount?won(amount):''}" placeholder="0"><span>원</span></label>
     <div class="nd-qa-chips" role="group" aria-label="금액">${[['all','남은 금액 전부'],['half','절반'],['custom','직접 입력']].map(([k,t])=>`<button type="button" data-p="${k}" aria-pressed="${preset===k}">${t}</button>`).join('')}</div>
     <div class="nd-qa-chips" role="group" aria-label="입금 방법">${METHODS.map(m=>`<button type="button" data-me="${m}" aria-pressed="${method===m}">${m}</button>`).join('')}</div>
     <div class="nd-qa-fields"><label>입금일<input type="date" id="ndQaDate" value="${e(date)}"></label><label>메모 (선택)<input id="ndQaMemo" value="${e(memo)}" placeholder="예: 잔금"></label></div>
     ${over?`<p class="nd-qa-warn">남은 금액보다 ${won(amount-s.balance)}원 많아요. 초과 입금으로 기록돼요.</p>`:''}
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${amount>0?'':'disabled'}>${amount>0?won(amount)+(edit?'원으로 수정':'원 입금 확인'):'금액을 넣어 주세요'}</button></div>`);
   d.querySelector('#ndQaDate').onchange=ev=>{date=ev.target.value;};d.querySelector('#ndQaMemo').oninput=ev=>{memo=ev.target.value;};
   const inp=d.querySelector('#ndQaAmt');
   inp.oninput=()=>{amount=Math.floor(Number(inp.value.replace(/[^\d]/g,''))||0);preset='custom';d.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.p==='custom')));const go=d.querySelector('.nd-qa-go');go.disabled=!(amount>0);go.textContent=amount>0?won(amount)+(edit?'원으로 수정':'원 입금 확인'):'금액을 넣어 주세요';};
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
    if(edit){const rest=db.payments.filter(x=>x.id!==edit.id);if(!await saveTable('payments',rest)){d.close();renderQtDetail();say('새 입금은 저장했지만 원래 입금을 지우지 못했어요. 수정에서 원래 입금 기록을 선택해 지워 주세요.');return;}db.payments=rest;}
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
 const dots='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3.5" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="12.5" r="1.4"/></svg>';
 const recLabel=(q,d)=>{try{return typeof deliveryRecordLabel==='function'?deliveryRecordLabel(q,d):'';}catch{return '';}};
 const recQty=d=>(d.lines||[]).reduce((a,l)=>a+(Number(l.qty)||0),0);
 const recordOpen=new Map();
 const CARRIERS={cj:['CJ대한통운','https://trace.cjlogistics.com/next/tracking.html?wblNo='],post:['우체국택배','https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1='],hanjin:['한진택배','https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblnum='],logen:['로젠택배','https://www.ilogen.com/web/personal/trace/'],lotte:['롯데택배','https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo='],kd:['경동택배','https://kdexp.com/service/delivery/etc/delivery.do?barcode='],
  // 10/26 네이버 택배조회에서 많이 쓰는 택배사 추가. 공식 조회 주소를 확인하지 못한 곳은 null → 네이버 검색('택배사 송장번호')으로 조회한다.
  daesin:['대신택배',null],ilyang:['일양로지스',null],hapdong:['합동택배',null],kunyoung:['건영택배',null],chunil:['천일택배',null],cu:['CU 편의점택배',null],gs:['GS25 편의점택배',null]};
 // 직접 추가한 택배사(settings.carriers_custom [{id:'u_…',name,url}]) — 조회 주소는 https만, 없으면 네이버 검색.
 const safeUrl=u=>typeof u==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(u.trim())&&u.trim().length<=300?u.trim():null;
 function customCarriers(list){let c=list;if(c===undefined){try{c=db.settings?.carriers_custom;}catch{}}return (Array.isArray(c)?c:[]).filter(x=>x&&typeof x.id==='string'&&/^u_[a-z0-9]{1,24}$/.test(x.id)&&typeof x.name==='string'&&x.name.trim()&&x.name.length<=40);}
 function carriers(custom){const out={...CARRIERS};for(const x of customCarriers(custom))if(!out[x.id])out[x.id]=[x.name.trim(),safeUrl(x.url)];return out;}
 const naverLookup=(name,no)=>'https://search.naver.com/search.naver?query='+encodeURIComponent(name+' '+no);
 // 송장 여러 개(10/15): 송장 1개는 예전 모양 {method,carrier,tracking} 그대로, 2개 이상이면 첫 송장 + parcels[{carrier,tracking}]를 함께 저장한다.
 const MAX_PARCELS=10;
 // 10/26 택배사 순서: 공급자 정보에서 직접 정한 순서(settings.carrier_order)가 있으면 그 순서, 없으면 지금까지 납품에 기록한 송장이 많은 순(자동).
 // 맨 앞 택배사가 새 송장에 미리 선택된다. 기록은 클라우드에 있으니 기기마다 같은 순서.
 function carrierUsage(){const n={};try{for(const q of db.quotes||[])for(const d of q.deliveries||[])if(!d.void_at)for(const p of parcelsOf(d.shipping))if(p.carrier)n[p.carrier]=(n[p.carrier]||0)+1;}catch{}return n;}
 function carrierOrder(manual,custom){const keys=Object.keys(carriers(custom));let s=manual;if(s===undefined){try{s=db.settings?.carrier_order;}catch{}}
  if(Array.isArray(s)&&s.length){const pick=s.filter(k=>keys.includes(k));return [...new Set([...pick,...keys])];}
  const n=carrierUsage();return keys.slice().sort((a,b)=>(n[b]||0)-(n[a]||0)||keys.indexOf(a)-keys.indexOf(b));}
 const defCarrier=()=>carrierOrder()[0]||'cj';
 // 주로 쓰는 5곳만 먼저 보이고 나머지는 접는다(송장 목록은 '그 외 택배사' 묶음, 공급자 정보는 [나머지 N개 보기]) — 10/26 사용자.
 const TOP_CARRIERS=5;
 // 고친 기록: 실제로 바뀐 것만(수량·날짜·배송·메모). 수량이 같으면 '250개 → 250개'처럼 쓰지 않는다.
 function fixText(o,d){const a=recQty(o),b=recQty(d),parts=[];if(a!==b)parts.push(`수량 ${won(a)}개 → ${won(b)}개`);if((o.date||'')!==(d.date||''))parts.push(`날짜 ${md(o.date)} → ${md(d.date)}`);if(JSON.stringify(shipNorm(o.shipping||{method:''}))!==JSON.stringify(shipNorm(d.shipping||{method:''})))parts.push('배송 정보 수정');if((o.memo||'')!==(d.memo||''))parts.push('메모 수정');return `${md(String(d.created_at||'').slice(0,10)||d.date)} 고침 · ${parts.join(' · ')||'내용 그대로'}`;}
 function parcelsOf(v){if(!v||v.method!=='택배')return [];if(Array.isArray(v.parcels)&&v.parcels.length)return v.parcels;return v.carrier||v.tracking?[{carrier:v.carrier,tracking:v.tracking||''}]:[];}
 function shipNorm(v){if(!v||v.method!=='택배')return {method:v?.method||''};const all=parcelsOf(v),list=all.filter(p=>p.tracking);const first=list[0]||all[0]||{carrier:'cj',tracking:''};const out={method:'택배',carrier:first.carrier,tracking:list[0]?.tracking||''};if(list.length>1)out.parcels=list.map(p=>({carrier:p.carrier,tracking:p.tracking}));return out;}
 function parcelRow(p,i,n){const first=!i;return `<div class="nd-qa-parcel" data-pr><label><span class="nd-qa-sr">택배사</span><select ${first?'id="ndShipCarrier"':''} data-pc aria-label="송장 ${i+1} 택배사">${(()=>{const all=carriers(),o=carrierOrder();if(p.carrier&&!all[p.carrier])o.push(p.carrier);const opt=k=>`<option value="${e(k)}" ${p.carrier===k?'selected':''}>${e(all[k]?.[0]||'택배('+k+')')}</option>`;return o.slice(0,TOP_CARRIERS).map(opt).join('')+(o.length>TOP_CARRIERS?`<optgroup label="그 외 택배사">${o.slice(TOP_CARRIERS).map(opt).join('')}</optgroup>`:'');})()}</select></label><label><span class="nd-qa-sr">송장번호</span><input ${first?'id="ndShipTracking"':''} data-pt inputmode="numeric" value="${e(p.tracking||'')}" placeholder="숫자만 입력" aria-label="송장 ${i+1} 번호"><a ${first?'id="ndShipLookup"':''} class="nd-qa-look" target="_blank" rel="noopener noreferrer" aria-disabled="true">조회 ↗</a></label>${n>1?`<button type="button" class="nd-qa-prm" data-prm aria-label="송장 ${i+1} 삭제">×</button>`:''}</div>`;}
 function shippingFields(v={},lead=''){const ps=parcelsOf(v),list=ps.length?ps:[{carrier:v.carrier||defCarrier(),tracking:v.tracking||''}];return `<div class="nd-qa-fields nd-qa-ship">${lead}<label>전달 방법<select id="ndShipMethod"><option value="" ${v.method?'':'selected'}>미기록</option>${['택배','직접 전달','방문 수령'].map(k=>`<option ${v.method===k?'selected':''}>${k}</option>`).join('')}</select></label><div class="nd-qa-parcels" id="ndShipParcels"><span class="nd-qa-pcount">송장 <b>${list.length}</b>개</span>${list.map((p,i)=>parcelRow(p,i,list.length)).join('')}<button type="button" class="nd-qa-padd" data-padd ${list.length>=MAX_PARCELS?'hidden':''}>송장 추가</button></div></div>`;}
 // final=true(저장): 빈 송장은 빼고 저장 모양으로. final=false(입력 중): 빈 줄도 남겨 다시 그릴 때 사라지지 않게.
 function readShipping(d,final=true){const method=d.querySelector('#ndShipMethod').value;if(method!=='택배')return {method};const rows=[...d.querySelectorAll('#ndShipParcels [data-pr]')].map(r=>({carrier:r.querySelector('[data-pc]').value,tracking:r.querySelector('[data-pt]').value.replace(/[\s-]/g,'')}));
  if(rows.some(p=>p.tracking&&!/^\d{8,30}$/.test(p.tracking))){if(final)say('송장번호는 숫자 8~30자리로 입력해 주세요.');return null;}
  if(!final){const first=rows[0]||{carrier:'cj',tracking:''};return rows.length>1?{method,carrier:first.carrier,tracking:first.tracking,parcels:rows}:{method,carrier:first.carrier,tracking:first.tracking};}
  return shipNorm({method,parcels:rows});}
 function trackingUrl(v){const carrier=carriers()[v?.carrier],tracking=String(v?.tracking||'').replace(/[\s-]/g,'');if(!(v?.method==='택배'&&carrier&&/^\d{8,30}$/.test(tracking)))return '';return carrier[1]?carrier[1]+encodeURIComponent(tracking):naverLookup(carrier[0],tracking);}
 function bindShipping(d){const method=d.querySelector('#ndShipMethod'),box=d.querySelector('#ndShipParcels');
  const refresh=()=>{box.hidden=method.value!=='택배';const rows=[...box.querySelectorAll('[data-pr]')];box.querySelector('.nd-qa-pcount b').textContent=rows.length;box.querySelector('.nd-qa-pcount').hidden=rows.length<2;
   rows.forEach(r=>{const link=r.querySelector('.nd-qa-look'),url=trackingUrl({method:method.value,carrier:r.querySelector('[data-pc]').value,tracking:r.querySelector('[data-pt]').value});if(url)link.href=url;else link.removeAttribute('href');link.setAttribute('aria-disabled',String(!url));});};
  const changed=()=>{refresh();method.dispatchEvent(new Event('change',{bubbles:true}));};
  box.addEventListener('click',ev=>{
   if(ev.target.closest('[data-padd]')){const n=box.querySelectorAll('[data-pr]').length;if(n>=MAX_PARCELS)return;const last=[...box.querySelectorAll('[data-pc]')].pop()?.value||defCarrier();
    box.querySelector('[data-padd]').insertAdjacentHTML('beforebegin',parcelRow({carrier:last,tracking:''},n,n+1));if(n===1)box.querySelector('[data-pr]').insertAdjacentHTML('beforeend','<button type="button" class="nd-qa-prm" data-prm aria-label="송장 1 삭제">×</button>');
    box.querySelector('[data-padd]').hidden=n+1>=MAX_PARCELS;changed();setTimeout(()=>{const ins=document.querySelectorAll('#ndShipParcels [data-pt]');ins[ins.length-1]?.focus();});return;}
   const rm=ev.target.closest('[data-prm]');if(rm){rm.closest('[data-pr]').remove();const rows=[...box.querySelectorAll('[data-pr]')];
    rows.forEach((r,i)=>{const c=r.querySelector('[data-pc]'),t=r.querySelector('[data-pt]'),a=r.querySelector('.nd-qa-look');c.id=i?'':'ndShipCarrier';t.id=i?'':'ndShipTracking';a.id=i?'':'ndShipLookup';c.setAttribute('aria-label',`송장 ${i+1} 택배사`);t.setAttribute('aria-label',`송장 ${i+1} 번호`);if(rows.length<2)r.querySelector('[data-prm]')?.remove();});
    box.querySelector('[data-padd]').hidden=false;changed();}});
  method.addEventListener('change',refresh);box.addEventListener('change',refresh);box.addEventListener('input',refresh);refresh();}
 function trackingLink(d){const url=trackingUrl(d.shipping);return url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(d.shipping.tracking)} · 배송 조회</a>`:e(d.shipping?.tracking||'—');}
 function shipmentIdentity(d){const v=d.shipping||{},ps=parcelsOf(v);return [v.method,...ps.flatMap(p=>[carriers()[p.carrier]?.[0]||p.carrier,p.tracking]),d.memo,'기록 '+d.id].filter(Boolean).join(' · ');}
 function recordPicker(kind){const q=current();if(!q||!guard())return;const rows=kind==='delivery'?(work(q).deliveries||[]).filter(x=>!x.void_at):(db.payments||[]).filter(x=>x.quote_id===q.id&&(x.kind==='수금'||x.refund));if(!rows.length)return;
 const d=open(`<div class="nd-ps-hd"><b>수정할 기록 선택</b></div><div class="nd-qa-body">${rows.map((r,i)=>`<button type="button" class="nd-record-pick" data-pick="${i}">${e(r.date)} · ${kind==='delivery'?e(recLabel(work(q),r))+' · '+won(recQty(r))+'개 · '+e(shipmentIdentity(r)):won(r.amount)+'원 · '+e(r.method||'')}</button><button type="button" class="nd-record-pick" data-remove="${i}">${kind==='delivery'?'이 납품 취소 (재고 되돌림) · '+e(shipmentIdentity(r)):'이 기록 삭제'}</button>`).join('')}</div><div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`);
 d.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.remove)];d.close();kind==='delivery'?cancelDelivery(r.id):deletePayment(r.id);});
 d.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.pick)];d.close();kind==='delivery'?editDelivery(r.id):r.refund?deletePayment(r.id):pay(r);});}
 function recs(f,q){
  const metadata=f.querySelector('.qp-metadata');const number=metadata?.firstElementChild;if(number&&q&&number.tagName!=='BUTTON'){const link=document.createElement('button');link.type='button';link.className='nd-quote-link';link.textContent=q.no||'견적서';link.onclick=()=>document.getElementById('qp-tab-items')?.click();number.replaceWith(link);}
  const panel=f.querySelector('#qp-panel-flow');let box=panel?.querySelector(':scope>.nd-rec');
  if(!panel||!q){box?.remove();panel?.classList.remove('nd-rec-on');return;}
  const w=work(q),s=state(w),pays=typeof quotePayments==='function'?quotePayments(q.id):(db.payments||[]).filter(p=>p.kind==='수금'&&p.quote_id===q.id);
  const refunds=(db.payments||[]).filter(p=>p.quote_id===q.id&&p.kind==='지급'&&p.refund);
  const dels=(w.deliveries||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created_at||'').localeCompare(a.created_at||''));
  const taxed=taxedOf(q),nt=noTaxOf(q),can=committed(q);
  const key=JSON.stringify([q.id,q.lines,q.deliveries,q.status,q.tax_at,q.no_tax,nt,s.left,s.balance,dels.map(d=>[d.id,d.void_at,d.date,recQty(d)]),pays.map(p=>[p.id,p.amount,p.date,p.method,p.memo]),refunds.map(p=>[p.id,p.amount])]);
  if(box&&box.dataset.key===key)return;
  if(!box){box=document.createElement('div');box.className='nd-rec';panel.prepend(box);}
  panel.classList.add('nd-rec-on');box.dataset.key=key;
  // 진행 탭 리스트(10/15 시안 승인): 위 단계 줄은 그대로, 아래는 품목 표처럼 칸 제목 + 한 줄 기록.
  // 줄을 누르면 그 납품의 품목·옵션·수량, 메모, 고친 기록이 펼쳐진다. 고치기·취소는 줄 끝 [⋯]. 저장 방식은 그대로(고침 = 원래 기록 void + 새 기록).
  const action=(label,type,disabled=false)=>`<button type="button" class="nd-record-action" data-rec="${type}" ${disabled?'disabled':''}>${label}</button>`;
  const section=(type,title,summary,buttons,body)=>{const id='nd-record-'+type,opened=recordOpen.get(q.id+':'+type)!==false;return `<section class="nd-record-section nd-pl"><div class="nd-record-heading"><button type="button" class="qt-sec-t nd-record-toggle" data-record-toggle="${type}" aria-expanded="${opened}" aria-controls="${id}">${title}<span class="cnt">${summary}</span></button><div class="nd-record-actions">${buttons}</div></div><div id="${id}" ${opened?'':'hidden'}>${body}</div></section>`;};
  const more=(attr,label)=>`<button type="button" class="nd-rec-more" ${attr} aria-label="${label}" aria-expanded="false">${dots}</button>`;
  const head=(cls,cols)=>`<div class="nd-pl-row nd-pl-th ${cls}" aria-hidden="true">${cols.map(([t,num])=>`<span class="${num?'num':''}">${t}</span>`).join('')}</div>`;
  const empty=t=>`<p class="nd-pl-empty">${t}</p>`;
  const opt=l=>[l.color,l.spec].filter(Boolean).map(e).join(' · ');
  const shipText=d=>{const v=d.shipping||{},ps=parcelsOf(v);if(ps.length>1){const p0=ps[0],name=carriers()[p0.carrier]?.[0]||'택배',url=trackingUrl({method:'택배',...p0});return `<span class="nd-pl-car">${e(name)}</span><span class="nd-pl-trk num">${e(p0.tracking)}</span>${url?`<a class="nd-pl-ext" href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="송장 1 ${e(name)} 배송 조회">조회 ↗</a>`:''}<span class="nd-pl-more" title="송장 ${ps.length}개 — 줄을 누르면 모두 보여요">+${ps.length-1}</span>`;}if(v.method==='택배'){const name=carriers()[v.carrier]?.[0]||'택배',url=trackingUrl(v);return `<span class="nd-pl-car">${e(name)}</span>${v.tracking?`<span class="nd-pl-trk num">${e(v.tracking)}</span>`:''}${url?`<a class="nd-pl-ext" href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(name)} 배송 조회">조회 ↗</a>`:''}`;}return v.method?`<span class="nd-pl-car">${e(v.method)}</span>`:'<span class="nd-pl-none">배송 미기록</span>';};
  const linkify=t=>e(t).replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${u.replace(/^https?:\/\//,'')} ↗</a>`);
  const live=dels.filter(d=>!d.void_at),gone=dels.filter(d=>d.void_at&&d.void_reason!=='고침');
  const dItems=d=>{let src=d.lines||[];try{if(typeof deliveryRecordLines==='function')src=deliveryRecordLines(w,d);}catch{}return src.map(x=>({...(w.lines||[]).find(l=>l.id===x.line_id),qty:x.qty})).filter(l=>Number(l.qty)>0);};
  const dRow=(d,isGone)=>{const key=q.id+':'+d.id,on=!isGone&&recordOpen.get('row:'+key)===true,orig=d.corrects?dels.find(x=>x.id===d.corrects):null;
   const items=dItems(d).map(l=>`<div class="nd-pl-row nd-pl-sub nd-pl-dl"><span></span><span class="nd-pl-in">${e(l.name||'품목')}${opt(l)?`<small>${opt(l)}</small>`:''}</span><span></span><span class="num">${won(l.qty)}</span><span></span></div>`).join('');
   const pl=parcelsOf(d.shipping),notes=[...(pl.length>1?pl.map((p,i)=>{const name=carriers()[p.carrier]?.[0]||'택배',url=trackingUrl({method:'택배',...p});return `<span><b>송장 ${i+1}</b>${e(name)} <i class="nd-pl-trk num">${e(p.tracking)}</i>${url?` <a class="nd-pl-ext" href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="송장 ${i+1} ${e(name)} 배송 조회">조회 ↗</a>`:''}</span>`;}):[]),d.memo?`<span><b>메모</b>${linkify(d.memo)}</span>`:'',orig?`<span><b>수정 기록</b>${fixText(orig,d)}</span>`:''].filter(Boolean).join('');
   return `<div class="nd-pl-rec${on?' on':''}${isGone?' gone':''}"><div class="nd-rec-row nd-pl-row nd-pl-dl nd-pl-main" ${isGone?'':`data-pl-open="${e(d.id)}" role="button" tabindex="0" aria-expanded="${on}"`}><span class="nd-pl-d num">${md(d.date)}</span><span class="nd-pl-nm">${e(recLabel(w,d)||'납품')}${isGone?'<small>취소됨</small>':''}</span><span class="nd-pl-ship">${isGone?'':shipText(d)}</span><span class="num nd-pl-q">${won(recQty(d))}</span><span class="nd-pl-act">${isGone?'':more(`data-rm-d="${e(d.id)}"`,'이 납품 메뉴')}</span></div>${on?`<div class="nd-pl-x">${items}${notes?`<p class="nd-pl-note">${notes}</p>`:''}</div>`:''}</div>`;};
  const restRows=s.rest.map(r=>`<div class="nd-pl-rec"><div class="nd-pl-row nd-pl-dl nd-pl-main nd-pl-left"><span class="nd-pl-d">남음</span><span class="nd-pl-nm">${e(r.l.name||'품목')}${opt(r.l)?`<small>${opt(r.l)}</small>`:''}</span><span class="nd-pl-ship">아직 안 보냄</span><span class="num nd-pl-q">${won(r.left)}</span><span></span></div></div>`).join('');
  const dBody=(live.length||gone.length||(can&&s.rest.length))?head('nd-pl-dl',[['날짜'],['품목'],['배송'],['수량',true],['']])+live.map(d=>dRow(d,false)).join('')+(live.length?restRows:'')+gone.map(d=>dRow(d,true)).join(''):empty(can?'아직 납품 기록이 없어요':'수주하면 납품을 기록할 수 있어요');
  const pRow=p=>`<div class="nd-pl-rec"><div class="nd-rec-row nd-pl-row nd-pl-pl nd-pl-main"><span class="nd-pl-d num">${md(p.date)}</span><span class="nd-pl-nm nd-pl-plain">${e(p.method||'입금')}${p.refund?' · 환불':''}${p.memo?`<small>${linkify(p.memo)}</small>`:''}</span><span class="num nd-pl-q">${p.refund?'−':''}${won(p.amount)}원</span><span class="nd-pl-act">${p.refund?more(`data-rm-r="${e(p.id)}"`,'환불 기록 메뉴'):more(`data-rm-p="${e(p.id)}"`,'이 입금 메뉴')}</span></div></div>`;
  const allPays=[...pays,...refunds].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const pBody=allPays.length?head('nd-pl-pl',[['날짜'],['방법 · 메모'],['금액',true],['']])+allPays.map(pRow).join(''):empty(s.amount>0?`아직 입금 기록이 없어요 · 받을 금액 ${won(Math.max(0,s.balance))}원`:'아직 입금 기록이 없어요');
  const tBody=nt?empty('계산서를 발행하지 않는 거래예요'):taxed?head('nd-pl-tx',[['날짜'],['구분'],['합계',true],['']])+`<div class="nd-pl-rec"><div class="nd-pl-row nd-pl-tx nd-pl-main"><span class="nd-pl-d num">${md(q.tax_at)}</span><span class="nd-pl-nm nd-pl-plain">발행</span><span class="num nd-pl-q">${won(s.amount)}원</span><span></span></div></div>`:empty(s.left?'납품을 마치면 발행일을 남겨 두세요':'발행했으면 발행일을 남겨 두세요');
  const warn=(t,on)=>on?`<b class="nd-pl-warn">${t}</b>`:t;
  box.innerHTML=section('delivery','납품',`${won(s.ordered)}개 중 ${won(s.delivered)}개${s.left?' · '+warn(won(s.left)+'개 남음',true):''}`,action('납품 추가','part',!can||!s.left),dBody)
   +section('payment','입금',s.amount>0?`${won(s.amount)}원 중 ${won(s.paid)}원${s.balance>0?' · '+warn(won(s.balance)+'원 남음',true):s.balance<0?' · '+warn(won(-s.balance)+'원 초과',true):''}`:`${won(s.paid)}원`,action('입금 추가','pay'),pBody)
   +section('tax','계산서',nt?'발행 안 함':taxed?'발행 완료':warn('미발행',true),action(taxed||nt?'수정':'발행 기록','tax'),tBody);

 }
 // ··· 메뉴: 바깥을 누르거나 같은 ···을 다시 누르면 닫힌다
 let menu=null;
 const closeMenu=()=>{if(!menu)return;menu.btn.setAttribute('aria-expanded','false');menu.el.remove();menu=null;};
 const MI={edit:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',undo:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',del:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'};
 function openMenu(btn,items){
  const same=menu&&menu.btn===btn;closeMenu();if(same)return;
  const el=document.createElement('div');el.className='nd-rec-menu';el.setAttribute('role','menu');
  el.innerHTML=items.map((it,i)=>`<button type="button" role="menuitem" data-i="${i}" class="${it.danger?'danger':''}">${MI[it.icon||(it.danger?'del':'edit')]}<span><b>${e(it.t)}</b>${it.sub?`<small>${e(it.sub)}</small>`:''}</span></button>`).join('');
  el.addEventListener('click',ev=>{const b=ev.target.closest('[data-i]');if(!b)return;const it=items[Number(b.dataset.i)];closeMenu();it.fn();});
  btn.closest('.nd-rec-row').append(el);const row=btn.closest('.nd-rec-row'),rr=row.getBoundingClientRect(),br=btn.getBoundingClientRect();el.style.right='0px';el.style.top=Math.round(br.bottom-rr.top+4)+'px';btn.setAttribute('aria-expanded','true');menu={btn,el};
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
  const qty=Object.fromEntries(rows.map(r=>[r.id,r.was]));let date=d0.date||localDate(),memo=d0.memo||'',shipping=structuredClone(d0.shipping||{method:''});
  const paint=()=>{
   const was=rows.reduce((a,r)=>a+r.was,0),now=rows.reduce((a,r)=>a+qty[r.id],0),same=now===was&&rows.every(r=>qty[r.id]===r.was)&&date===d0.date&&memo===(d0.memo||'')&&JSON.stringify(shipNorm(shipping))===JSON.stringify(shipNorm(d0.shipping||{method:''})),qtySame=rows.every(r=>qty[r.id]===r.was),what=[date!==d0.date?'납품일':'',JSON.stringify(shipNorm(shipping))!==JSON.stringify(shipNorm(d0.shipping||{method:''}))?'배송 정보':'',memo!==(d0.memo||'')?'메모':''].filter(Boolean).join('·');
   const d=open(`<div class="nd-ps-hd"><b>납품 기록 수정</b><span class="nd-qa-sub">${md(d0.date)} 납품 · ${e(recLabel(q,d0)||'납품')} · ${won(rows.reduce((a,r)=>a+r.was,0))}개</span></div>
    <div class="nd-qa-body"><span class="nd-qa-label">수량</span><div class="nd-qa-lines">${rows.map(r=>`<div class="nd-qa-ln"><div><span>${e(r.l.name||'품목')}</span><small>${[r.l.color,r.l.spec].filter(Boolean).map(e).join(' · ')}${r.l.color||r.l.spec?' · ':''}원래 ${won(r.was)}개</small></div><span class="nd-qa-step"><button type="button" data-d="${e(r.id)}" data-v="-1" aria-label="줄이기">−</button><input inputmode="numeric" data-q="${e(r.id)}" value="${qty[r.id]}" aria-label="납품 수량"><button type="button" data-d="${e(r.id)}" data-v="1" aria-label="늘리기">+</button></span></div>`).join('')}</div>
     ${shippingFields(shipping,`<label>납품일<input type="date" id="ndQaDate" value="${e(date)}"></label>`)}<div class="nd-qa-fields"><label class="nd-qa-wide">메모 <small>(선택) · 링크를 붙이면 바로 열려요</small><input id="ndQaMemo" value="${e(memo)}" placeholder="예: 박스 2개 · 사진 링크"></label></div>${same?'':`<p class="nd-qa-after">${qtySame?`<b>${what}만 바뀌어요.</b> 수량이 그대로라 재고는 변하지 않아요.`:now?`확인하면 <b>원래 ${won(was)}개 기록은 '고침'으로 남고 ${won(now)}개 기록이 새로 생겨요.</b> 재고는 차이(${now>was?'+':''}${won(now-was)}개)만큼 반영돼요.`:`0개면 <b>이 납품을 취소</b>하는 것과 같아요. 재고 ${won(was)}개가 되돌아와요.`}</p>`}</div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" ${same?'disabled':''}>${same||qtySame?'수정':now?`${won(now)}개로 수정`:'이 납품 취소'}</button></div>`);
   d.querySelector('#ndQaDate').onchange=ev=>{date=ev.target.value||date;paint();};d.querySelector('#ndQaMemo').onchange=ev=>{memo=ev.target.value.trim();paint();};
   bindShipping(d);d.querySelector('.nd-qa-ship').addEventListener('change',ev=>{const next=readShipping(d,false);if(next){shipping=next;const keep=ev.target.closest?.('[data-pr]')?[...d.querySelectorAll('[data-pr]')].indexOf(ev.target.closest('[data-pr]')):-1;paint();if(keep>=0&&ev.target.matches('[data-pt]'))document.querySelectorAll('#ndShipParcels [data-pt]')[keep]?.focus();}});
   d.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.d);qty[r.id]=Math.max(0,Math.min(r.max,qty[r.id]+Number(b.dataset.v)));paint();});
   d.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const r=rows.find(x=>x.id===inp.dataset.q);qty[r.id]=Math.max(0,Math.min(r.max,Math.floor(Number(String(inp.value).replace(/[^\d]/g,''))||0)));paint();});
   d.querySelector('.nd-qa-go').onclick=async ev=>{
    shipping=readShipping(d);if(!shipping)return;const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';const at=new Date().toISOString(),lines=rows.map(r=>({line_id:r.id,qty:qty[r.id]})).filter(x=>x.qty>0);
    const ok=await saveDeliveries(q0,nq=>{nq.deliveries=nq.deliveries.map(x=>x.id===id?{...x,void_at:at,void_reason:lines.length?'고침':'취소'}:x);if(lines.length)nq.deliveries.push({id:crypto.randomUUID(),date,lines,memo:(d.querySelector('#ndQaMemo')?.value||memo).trim(),shipping,created_at:at,corrects:id});},lines.length?'납품 기록을 고쳤어요 · 재고 반영 완료':'납품을 취소했어요 · 재고 되돌림 완료');
    if(ok)d.close();else{btn.disabled=false;btn.textContent='다시 시도';}
   };
  };
  paint();
 }
 function cancelDelivery(id){
  const q0=current();if(!q0||!guard())return;const q=work(q0);const d0=(q.deliveries||[]).find(x=>x.id===id&&!x.void_at);if(!d0)return;
  const d=open(`<div class="nd-ps-hd"><b>이 납품을 취소할까요?</b><span class="nd-qa-sub">${md(d0.date)} · ${e(recLabel(q,d0)||'')} · ${won(recQty(d0))}개 · ${e(shipmentIdentity(d0))}</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">기록은 '취소됨'으로 남고 재고 ${won(recQty(d0))}개가 되돌아와요. 매출·받을 금액에서도 빠져요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">납품 취소</button></div>`);
  d.querySelector('.nd-qa-del').onclick=async ev=>{const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';
   const at=new Date().toISOString();const ok=await saveDeliveries(q0,nq=>{nq.deliveries=nq.deliveries.map(x=>x.id===id?{...x,void_at:at,void_reason:'취소'}:x);},'납품을 취소했어요 · 재고 되돌림 완료');
   if(ok)d.close();else{btn.disabled=false;btn.textContent='다시 시도';}};
 }
 function deletePayment(id){
  if(window.NaroTrash){if(guard())NaroTrash.deletePayment(id);return;} // 휴지통에 담고 지운다(복원 가능)
  const q=current();if(!q||!guard())return;const p=(db.payments||[]).find(x=>x.id===id);if(!p)return;
  const d=open(`<div class="nd-ps-hd"><b>이 입금을 지울까요?</b><span class="nd-qa-sub">${md(p.date)} · ${e([p.memo,p.method].filter(Boolean).join(' · ')||'입금')} · ${won(p.amount)}원</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">잘못 넣은 입금일 때만 지워 주세요. 지우면 받을 금액이 ${won(p.amount)}원 늘어나요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">삭제</button></div>`);
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
  const toggle=ev.target.closest?.('[data-record-toggle]');if(toggle){const type=toggle.dataset.recordToggle,q=current();if(!q)return;const opened=toggle.getAttribute('aria-expanded')!=='true';recordOpen.set(q.id+':'+type,opened);toggle.setAttribute('aria-expanded',String(opened));document.getElementById(toggle.getAttribute('aria-controls')).hidden=!opened;return;}
  const row=ev.target.closest?.('#qtForm .nd-rec [data-pl-open]');if(row&&!ev.target.closest('button,a')){const q=current();if(!q)return;const k='row:'+q.id+':'+row.dataset.plOpen;recordOpen.set(k,recordOpen.get(k)!==true);const box=row.closest('.nd-rec');if(box)box.dataset.key='';recs(document.getElementById('qtForm'),q);return;}
  const b=ev.target.closest?.('#qtForm .nd-rec [data-rec],#qtForm .nd-rec .nd-rec-more');if(!b)return;ev.preventDefault();
  if(b.dataset.rec==='edit-delivery')return recordPicker('delivery');if(b.dataset.rec==='edit-payment')return recordPicker('payment');
  if(b.dataset.rmR){const id=b.dataset.rmR;return openMenu(b,[{t:'환불 기록 삭제',sub:'받을 금액이 다시 계산돼요',danger:true,fn:()=>deletePayment(id)}]);}
  if(b.dataset.rec==='part')return deliver('part');if(b.dataset.rec==='all')return deliver('all');
  if(b.dataset.rec==='pay')return pay();if(b.dataset.rec==='tax')return taxSheet();
  if(b.dataset.rmD){const id=b.dataset.rmD;return openMenu(b,[{t:'수정',sub:'수량 · 날짜 · 배송 · 메모',fn:()=>editDelivery(id)},{t:'납품 취소',sub:'재고가 되돌아가요',icon:'undo',danger:true,fn:()=>cancelDelivery(id)}]);}
  if(b.dataset.rmP){const p=(db.payments||[]).find(x=>x.id===b.dataset.rmP);if(!p)return;return openMenu(b,[{t:'수정',sub:'금액 · 날짜 · 방법 · 메모',fn:()=>pay(p)},{t:'삭제',sub:'받을 금액이 다시 계산돼요',danger:true,fn:()=>deletePayment(p.id)}]);}
 });
 document.addEventListener('click',ev=>{
  const t=ev.target.closest?.('#qtForm .nd-next [data-qa],#qtForm .nd-next [data-st],#qtForm .nd-next [data-tab],#qtForm .nd-next [data-restore],#qtForm .nd-edit-b');if(!t)return;ev.preventDefault();
  if(t.hasAttribute('data-restore'))return restoreQuote();
  if(t.dataset.qa){t.dataset.qa==='deliver'?deliver():pay();return;}
  if(t.dataset.tab){document.getElementById('qp-tab-'+t.dataset.tab)?.click();return;}
  if(t.dataset.st){if(typeof qtEditing==='undefined'||!qtEditing)return;qtEditing.status=t.dataset.st;const sel=document.getElementById('fq_status');if(sel)sel.value=t.dataset.st;document.getElementById('qtSaveBtn')?.click();return;}
  const q=current();if(!q)return;
  if(isEditing(q)&&typeof qtHasUnsavedChanges==='function'&&qtHasUnsavedChanges()){say('수정한 내용을 저장하면 보기 화면으로 돌아가요');return;}
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
 // 한번에 삭제(10/11): 창 하나에 할 일을 보여 주고 [삭제] 한 번에 — 재고 되돌림 · 받은 돈은 돌려줌(출금) 또는 맡겨 둠 · 목록에서 빼기.
 //  지우지 않고 '취소'(사유 '삭제')로 보관한다 → 목록 맨 아래 '삭제·취소된 견적 보기'에서 [복원]. 끊기면 다시 눌러 이어서 한다.
 async function removeQuote(id){
  const q=(db.quotes||[]).find(x=>x.id===id);if(!q)return legacyDelete?.(id);
  const L=linked(q);
  const head=t=>`<div class="nd-ps-hd"><b>${t}</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')} · ${won(quoteAmount(q))}원</span></div>`;
  const back=stockDeltaForQuote({...q,status:'취소'}),backQty=back.moves.reduce((a,m)=>a+(m.kind==='입고'?m.qty:-m.qty),0);
  if(q.status==='취소'&&q.cancel_reason==='삭제'&&!back.moves.length){
   open(`${head('이미 삭제된 견적서예요')}<div class="nd-qa-body"><p class="nd-qa-note">목록에서 빠져 있고 매출·받을 금액·재고 계산에 들어가지 않아요. 다시 쓰려면 견적서 위의 [복원]을 누르세요.</p></div>
    <div class="nd-ps-act nd-ps-one"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`);
   return;
  }
  const net=quotePaid(q.id);let refund=net>0?'yes':'';
  const paint=()=>{
   const d=open(`${head('견적서 삭제')}
    <div class="nd-qa-body">
     <p class="nd-qa-note">삭제를 누르면 한 번에 처리돼요.</p>
     <div class="nd-qa-lines">
      ${back.moves.length?`<div class="nd-qa-ln"><div><span>납품한 ${won(L.dq||backQty)}개</span></div><b class="nd-qa-tag">${backQty>0?`재고로 ${won(backQty)}개 되돌림`:'재고 되돌림'}</b></div>`:''}
      ${net>0?`<div class="nd-qa-ln"><div><span>입금액 ${won(net)}원</span></div><b class="nd-qa-tag${refund==='yes'?'':' mute'}">${refund==='yes'?'돌려준 것으로(출금) 기록':'선입금으로 남김'}</b></div>`:''}
      <div class="nd-qa-ln"><div><span>견적서</span></div><b class="nd-qa-tag mute">목록에서 빠짐 · 복원 가능</b></div>
     </div>
     ${net>0?`<div class="nd-qa-chips" role="group" aria-label="입금액"><button type="button" data-refund="yes" aria-pressed="${refund==='yes'}">돌려줬어요</button><button type="button" data-refund="keep" aria-pressed="${refund==='keep'}">다음 거래에 쓸게요</button></div>`:''}
     <p class="nd-qa-note">기록은 지우지 않고 남아요. 목록 위 필터(≡)의 '삭제·취소된 견적 보기'에서 다시 열어 [복원]할 수 있어요.</p>
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">삭제</button></div>`);
   d.querySelectorAll('[data-refund]').forEach(b=>b.onclick=()=>{refund=b.dataset.refund;paint();});
   d.querySelector('.nd-qa-del').onclick=async ev=>{
    const btn=ev.currentTarget;btn.disabled=true;btn.textContent='삭제하는 중…';
    const fail=t=>{btn.disabled=false;btn.textContent='다시 시도';say(t);};
    let cur=(db.quotes||[]).find(x=>x.id===id);
    if(cur.status!=='취소'||cur.cancel_reason!=='삭제'){
     // 이미 '취소'된 견적은 취소 날짜·이전 상태를 그대로 두고 사유만 '삭제'로(목록 표시 '삭제됨')
     const nq=cur.status==='취소'?{...JSON.parse(JSON.stringify(cur)),cancel_reason:'삭제',cancel_reason_before:cur.cancel_reason||''}:{...JSON.parse(JSON.stringify(cur)),status:'취소',cancel_reason:'삭제',cancelled_at:localDate(),cancel_prev:cur.status};
     const next=db.quotes.map(x=>x.id===id?nq:x);
     if(!await saveTable('quotes',next))return fail('삭제하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
     db.quotes=next;cur=nq;qtEditing=null;qtBaseline='';renderQtList();renderQtDetail();
    }
    if(stockDeltaForQuote(cur).moves.length&&!await syncStockForQuote(cur,{ask:false}))return fail('재고 되돌리기에 실패했어요. 다시 누르면 이어서 해요.');
    const left=quotePaid(cur.id);
    if(refund==='yes'&&left>0){
     const next=[...db.payments,{id:crypto.randomUUID(),date:localDate(),company_id:cur.company_id,quote_id:cur.id,kind:'지급',refund:true,method:'계좌이체',amount:left,memo:`환불 · ${cur.no||''}`,created_at:new Date().toISOString()}];
     if(!await saveTable('payments',next))return fail('견적서는 삭제됐지만 환불 기록을 저장하지 못했어요. 다시 누르면 이어서 해요.');
     db.payments=next;
    }
    qtSel=null;d.close();renderQtList();renderQtDetail();say(refund==='yes'&&left>0?`견적서를 삭제했어요 · 환불 ${won(left)}원 기록`:'견적서를 삭제했어요');
   };
  };
  paint();
 }
 // 되살리기: 취소 전 상태로(납품 기록이 남아 있으면 납품·부분납품으로 맞춤) → 재고 다시 반영. 환불 기록은 그대로 둔다.
 async function restoreQuote(){
  const q=current();if(!q||q.status!=='취소')return;
  const refunds=(db.payments||[]).filter(p=>p.quote_id===q.id&&p.kind==='지급'&&p.refund);
  const d=open(`<div class="nd-ps-hd"><b>견적서를 복원할까요?</b><span class="nd-qa-sub">${e(coName(q.company_id))} · ${e(q.no||'')}</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">${q.cancel_reason_before!==undefined?'삭제되기 전처럼 취소된 견적으로 돌아가요(목록 표시 \'삭제됨\' → \'취소\'). 재고·입금은 바뀌지 않아요.':`취소 전 상태(${e(q.cancel_prev||'수주')})로 돌아가고, 납품 기록이 있으면 재고가 다시 빠져요.`}${q.cancel_reason_before===undefined&&refunds.length?' 환불 기록은 그대로 남아요 — 필요하면 입금·출금에서 정리해 주세요.':''}</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go">복원</button></div>`);
  d.querySelector('.nd-qa-go').onclick=async ev=>{const btn=ev.currentTarget;btn.disabled=true;btn.textContent='저장 중…';
   const was=(db.quotes||[]).find(x=>x.id===q.id);
   // 취소된 뒤에 지운 견적: 복원하면 원래의 '취소'(그때 사유)로 돌아간다 — 재고·입금은 그대로.
   if(was.cancel_reason_before!==undefined){const nq=work(was);nq.cancel_reason=was.cancel_reason_before||'잘못 만듦';delete nq.cancel_reason_before;const next=db.quotes.map(x=>x.id===nq.id?nq:x);if(!await saveTable('quotes',next)){btn.disabled=false;btn.textContent='다시 시도';return;}db.quotes=next;qtEditing=null;qtBaseline='';d.close();renderQtList();renderQtDetail();say('복원했어요 · 취소된 견적으로 돌아왔어요');return;}
   const nq=work((db.quotes||[]).find(x=>x.id===q.id));nq.status=['작성중','발송','수주','부분납품','납품'].includes(q.cancel_prev)?q.cancel_prev:'수주';
   delete nq.cancel_reason;delete nq.cancelled_at;delete nq.cancel_prev;if(['수주','부분납품','납품'].includes(nq.status))normalizeDeliveryStatus(nq);
   const next=db.quotes.map(x=>x.id===nq.id?nq:x);
   if(!await saveTable('quotes',next)){btn.disabled=false;btn.textContent='다시 시도';return;}
   db.quotes=next;qtEditing=null;qtBaseline='';d.close();renderQtList();renderQtDetail();
   if(stockDeltaForQuote(nq).moves.length&&!await syncStockForQuote(nq,{ask:false})){window.dispatchEvent(new Event('naro-incomplete-stock'));return;}
   say('견적서를 복원했어요');};
 }
 // 목록 맨 아래 '취소된 견적 N건 보기'(상태 필터를 고르지 않았을 때만)
 function cancelToggle(){
  // 10/11: '삭제·취소된 견적 보기'는 목록 위 필터 창으로 옮겼다(trash-actions.js). 남은 옛 버튼만 치운다.
  document.querySelectorAll('#qtList>.nd-cancel-toggle').forEach(x=>x.remove());return;
  const list=document.getElementById('qtList');if(!list)return;
  const n=(db.quotes||[]).filter(x=>x.status==='취소').length,st=document.getElementById('qtStatus')?.value||'';
  let b=list.querySelector(':scope>.nd-cancel-toggle');
  if(!n||st){b?.remove();return;}
  const t=window.ndShowCancelled?`삭제·취소된 견적 숨기기`:`삭제·취소된 견적 ${n}건 보기`;
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
   <div class="nd-qa-body"><p class="nd-qa-note">납품 기록은 재고와 매출의 근거라서 저장한 뒤에는 수정하거나 삭제할 수 없게 되어 있어요.</p>
    <p class="nd-qa-note">잘못 넣었다면 <b>견적서를 삭제</b>하면 재고가 되돌아오고 매출에서 빠져요(나중에 복원 가능). 그다음 새 견적서로 다시 만들면 돼요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del" data-cancel-q>견적서 삭제하기</button></div>`);
  d.querySelector('[data-cancel-q]').onclick=()=>removeQuote(q.id);
 },true);
 /* 거래처 고르기(10/11): 새 견적일 때만 머리의 거래처 이름(비어 있으면 '거래처 선택')을 눌러 검색해서 고른다.
    새 견적을 열면 바로 펼친다. 고르면 정보 탭의 거래처 칸(#fq_co)에 넣고 change — 단가·메모 자동 채움은 원래 동작 그대로. */
 let coPop=null,coAuto='';
 const closeCoPop=()=>{coPop?.remove();coPop=null;};
 // Capture before the original change handler rebuilds and detaches the select.
 document.addEventListener('change',ev=>{
  if(ev.target.id!=='fq_co'||!ev.target.value||qtSel!=='__new__')return;
  queueMicrotask(()=>{if(qtSel==='__new__'&&document.getElementById('fq_co')?.value)document.getElementById('qp-tab-items')?.click();});
 },true);
 function editable(){const sel=document.getElementById('fq_co');if(!sel||sel.disabled)return false;return qtSel==='__new__';}
 function openCoPop(anchor,sel=document.getElementById('fq_co'),filter=()=>true,label='거래처'){
  closeCoPop();if(!sel)return;
  const hidden=window.NaroTrash?NaroTrash.hidden('companies'):[];
  const all=(db.companies||[]).filter(c=>!hidden.includes(c.id)&&filter(c)).sort((a,b)=>((a.type==='매입')-(b.type==='매입'))||(a.name||'').localeCompare(b.name||'','ko'));
  const pop=document.createElement('div');pop.className='nd-co-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',label+' 고르기');
  pop.innerHTML='<input type="search" placeholder="거래처 이름·담당자 검색" aria-label="거래처 검색"><div class="nd-co-list" role="listbox"></div><button type="button" class="nd-co-new">+ 새 거래처 등록</button>';
  const input=pop.querySelector('input'),list=pop.querySelector('.nd-co-list');let hi=0,shown=[];
  const pick=c=>{closeCoPop();sel.value=c.id;sel.dispatchEvent(new Event('change',{bubbles:true}));};
  const draw=()=>{const q=input.value.trim().toLowerCase();shown=all.filter(c=>!q||(c.name||'').toLowerCase().includes(q)||(c.contact||'').toLowerCase().includes(q)).slice(0,60);hi=Math.min(hi,Math.max(0,shown.length-1));
   list.innerHTML=shown.length?shown.map((c,i)=>`<button type="button" role="option" class="nd-co-opt${i===hi?' on':''}" data-i="${i}"><span>${e(c.name||'(이름 없음)')}</span>${c.contact?`<small>${e(c.contact)}</small>`:''}<em>${e(c.type||'매출')}</em></button>`).join(''):'<p class="nd-co-empty">맞는 거래처가 없어요</p>';
   list.querySelectorAll('[data-i]').forEach(b=>b.onmousedown=ev=>{ev.preventDefault();pick(shown[Number(b.dataset.i)]);});};
  input.oninput=()=>{hi=0;draw();};
  input.onkeydown=ev=>{if(ev.isComposing)return;if(ev.key==='ArrowDown'){ev.preventDefault();hi=Math.min(hi+1,shown.length-1);draw();}else if(ev.key==='ArrowUp'){ev.preventDefault();hi=Math.max(hi-1,0);draw();}else if(ev.key==='Enter'){ev.preventDefault();if(shown[hi])pick(shown[hi]);}else if(ev.key==='Escape'){closeCoPop();}};
  pop.querySelector('.nd-co-new').onclick=()=>{closeCoPop();if(typeof switchView==='function')switchView('companies');document.getElementById('coNewBtn')?.click();};
  (document.getElementById('appView')||document.body).append(pop);coPop=pop;
  const r=anchor.getBoundingClientRect(),w=Math.min(380,window.innerWidth-24);pop.style.width=w+'px';pop.style.left=Math.max(12,Math.min(r.left,window.innerWidth-w-12))+'px';pop.style.top=(r.bottom+6)+'px';
  draw();setTimeout(()=>input.focus(),0);
 }
 document.addEventListener('click',ev=>{
  const co=ev.target.closest?.('#qtForm .quote-summary .co');
  if(co&&editable()){ev.preventDefault();openCoPop(co);return;}
  if(coPop&&!coPop.contains(ev.target)&&!ev.target.closest?.('#puForm .quote-summary .co'))closeCoPop();
 },true);
 window.addEventListener('resize',closeCoPop);
 // 새 견적: 거래처가 비어 있으면 열자마자 고르기 창
 if(typeof window.renderQtDetail==='function'){const o=window.renderQtDetail;window.renderQtDetail=function(){const r=o.apply(this,arguments);
  try{const co=document.querySelector('#qtForm .quote-summary .co');if(co){const ed=editable();co.classList.toggle('nd-co-editable',ed);if(ed){co.setAttribute('role','button');co.tabIndex=0;co.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();openCoPop(co);}};}else{co.removeAttribute('role');co.removeAttribute('tabindex');co.onkeydown=null;}}
   if(!editable())closeCoPop();
   const sel=document.getElementById('fq_co');const key=qtSel==='__new__'?'new:'+(document.getElementById('qtList')?.childElementCount||0):'';
   if(qtSel==='__new__'&&sel&&!sel.value&&co&&coAuto!==key){setTimeout(()=>{const a=document.querySelector('#qtForm .quote-summary .co'),r=a&&a.getBoundingClientRect();if(!r||!r.width||coAuto===key)return;if(document.getElementById('fq_co')&&!document.getElementById('fq_co').value){coAuto=key;openCoPop(a);}},60);}
   if(qtSel!=='__new__')coAuto='';
  }catch{}return r;};}
 if(legacyDelete)window.deleteQuote=removeQuote;
 // ── 자동 수주(10/17 사용자 결정) ──
 // 작성중·발송 견적에 입금(받은 돈)·계산서 발행·납품 기록이 새로 생기면 수주로 바꾼다. 거래가 확정된 것이므로.
 // 저장 흐름을 건드리지 않으려고, 저장(saveTable)이 모두 끝나고 잠깐 뒤에 '새로 생긴 근거'만 보고 따로 한 번 저장한다.
 // 이미 근거가 있던 견적(사용자가 일부러 발송으로 되돌린 것 포함)은 다시 바꾸지 않는다. 취소된 견적은 바꾸지 않고 알리기만.
 if(typeof window.saveTable==='function'&&!window.saveTable.__autoOrder){
  const OPEN=['작성중','발송'],orig=window.saveTable;
  const paidOf=q=>typeof quoteNetPaid==='function'?quoteNetPaid(q):(db.payments||[]).filter(p=>p.quote_id===q.id&&p.kind==='수금'&&!p.refund).reduce((n,p)=>n+(Number(p.amount)||0),0);
  const liveDel=q=>(q.deliveries||[]).filter(d=>!d.void_at).length;
  const why=q=>paidOf(q)>0?'입금':(q.tax_at&&!q.no_tax)?'계산서 발행':liveDel(q)?'납품 기록':'';
  const evidence=()=>new Set((db.quotes||[]).filter(q=>why(q)).map(q=>q.id));
  let base=null,inflight=0,timer=0,busyPromote=false;
  const actToast=(msg,label,fn)=>{const t=document.getElementById('toast');if(!t){say(msg);return;}
   t.innerHTML=`<span>${e(msg)}</span>`+(fn?` <button type="button" class="nd-toast-act">${e(label)}</button>`:'');t.classList.add('show');
   const b=t.querySelector('.nd-toast-act');if(b){t.style.pointerEvents='auto';b.onclick=()=>{t.classList.remove('show');t.style.pointerEvents='';fn();};}
   try{clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.classList.remove('show');t.style.pointerEvents='';},5000);}catch{setTimeout(()=>t.classList.remove('show'),5000);}};
  const refresh=()=>{try{renderQtList();renderQtDetail();}catch{}try{window.NaroDashboard?.render?.();}catch{}};
  const syncEditor=(id,status)=>{try{if(qtEditing&&qtEditing.id===id){const clean=typeof quoteSnapshot==='function'&&quoteSnapshot(qtEditing)===qtBaseline;qtEditing.status=status;if(clean)qtBaseline=quoteSnapshot(qtEditing);}}catch{}};
  async function run(){
   if(inflight||busyPromote){schedule();return;}
   const before=base;base=null;if(!before)return;
   const fresh=[...evidence()].filter(id=>!before.has(id)).map(id=>(db.quotes||[]).find(q=>q.id===id)).filter(Boolean);
   const cancelled=fresh.filter(q=>q.status==='취소');
   const targets=fresh.filter(q=>OPEN.includes(q.status));
   if(!targets.length){if(cancelled.length)say(`취소된 견적(${cancelled[0].no||''})에 ${why(cancelled[0])}이 기록됐어요 · 상태는 그대로 두었어요`);return;}
   const prev=new Map(targets.map(q=>[q.id,q.status]));
   const next=(db.quotes||[]).map(q=>{if(!prev.has(q.id))return q;const n={...q,status:'수주'};if(liveDel(n)&&typeof normalizeDeliveryStatus==='function')normalizeDeliveryStatus(n);return n;});
   busyPromote=true;
   try{
    if(!await orig('quotes',next))return;
    db.quotes=next;targets.forEach(q=>syncEditor(q.id,next.find(x=>x.id===q.id).status));refresh();
    const q0=targets[0],label=targets.length>1?`견적 ${targets.length}건`:(q0.no||'견적');
    actToast(`${why(next.find(x=>x.id===q0.id))}이 기록돼서 ${label}을(를) 수주로 바꿨어요`,'되돌리기',async()=>{
     const back=(db.quotes||[]).map(q=>prev.has(q.id)&&q.status==='수주'?{...q,status:prev.get(q.id)}:q);
     if(await orig('quotes',back)){db.quotes=back;prev.forEach((st,id)=>syncEditor(id,st));refresh();say('상태를 되돌렸어요');}});
   }finally{busyPromote=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(run,350);}
  const wrapped=async function(name,data){
   if(base===null&&!busyPromote)try{base=evidence();}catch{base=null;}
   inflight++;
   try{return await orig.apply(this,arguments);}
   finally{inflight--;if(base)schedule();}
  };
  wrapped.__autoOrder=true;window.saveTable=wrapped;
 }
 window.NaroQuoteActions={bar,deliver,pay,removeQuote,chooseCompany:openCoPop,closeCompanyPicker:closeCoPop};

 // ── 공급자 정보 → 택배사 순서(10/26): [자동(많이 쓴 순) | 직접 정하기] + 위·아래 버튼. 저장은 공급자 정보 [저장]과 함께(settings.carrier_order). ──
 let crDraft,crCustom,crMore=false;
 function crSaved(){let s;try{s=db.settings?.carrier_order;}catch{}const all=carriers();return Array.isArray(s)&&s.length?s.filter(k=>all[k]):null;}
 const crSavedCustom=()=>customCarriers().map(x=>({id:x.id,name:x.name.trim(),...(safeUrl(x.url)?{url:safeUrl(x.url)}:{})}));
 function crPaint(){
  const box=document.getElementById('st_carriers');if(!box)return;
  if(crDraft===undefined)crDraft=crSaved();if(crCustom===undefined)crCustom=crSavedCustom();
  const all=carriers(crCustom),manual=Array.isArray(crDraft),order=carrierOrder(manual?crDraft:null,crCustom),use=carrierUsage(),mine=new Set(crCustom.map(x=>x.id));
  const adding=box.querySelector('.nd-cr-add')?.open;
  box.innerHTML=`<div class="nd-cr-mode" role="group" aria-label="택배사 순서 정하는 방법"><button type="button" data-cr-mode="auto" aria-pressed="${!manual}">자동 · 많이 쓴 순</button><button type="button" data-cr-mode="manual" aria-pressed="${manual}">직접 정하기</button></div><ol class="nd-cr-list${manual?'':' is-auto'}">${order.map((k,i)=>`<li data-cr-k="${e(k)}"${i>=TOP_CARRIERS&&!crMore?' hidden':''}><span class="nd-cr-grip" role="button" tabindex="0" data-cr-grip="${e(k)}" aria-label="${e(all[k][0])} 순서 옮기기 — 끌어서 옮기거나 ↑↓ 키" title="끌어서 순서 바꾸기"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="5.5" cy="4" r="1.3"/><circle cx="10.5" cy="4" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12" r="1.3"/><circle cx="10.5" cy="12" r="1.3"/></svg></span><span class="nd-cr-n">${i+1}</span><span class="nd-cr-nm">${e(all[k][0])}${i===0?'<em>기본 선택</em>':''}${mine.has(k)?'<small>직접 추가</small>':''}${all[k][1]?'':'<small>조회: 네이버</small>'}</span><span class="nd-cr-use">${use[k]?`${use[k]}번 사용`:''}</span>${mine.has(k)?`<button type="button" class="nd-cr-x" data-cr-del="${e(k)}" aria-label="${e(all[k][0])} 지우기" title="지우기">×</button>`:''}</li>`).join('')}</ol>${order.length>TOP_CARRIERS?`<button type="button" class="nd-cr-fold" data-cr-more aria-expanded="${crMore}">${crMore?'접기':`나머지 ${order.length-TOP_CARRIERS}개 보기`}<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`:''}
  <details class="nd-cr-add"${adding?' open':''}><summary>+ 택배사 추가</summary><div class="nd-cr-form"><input id="nd_cr_name" maxlength="40" placeholder="택배사 이름 (예: 한덕택배)" autocomplete="off"><input id="nd_cr_url" maxlength="300" inputmode="url" placeholder="조회 주소 (선택) — https://…송장번호 앞까지" autocomplete="off"><button type="button" class="btn ghost" data-cr-add>추가</button></div><p class="nd-cr-tip">조회 주소를 비우면 [조회 ↗]가 네이버에서 '택배사 이름 + 송장번호'로 찾아요.</p></details>`;
 }
 function crChanged(){crPaint();document.getElementById('st_carriers')?.dispatchEvent(new Event('input',{bubbles:true}));}
 const crSay=t=>typeof window.toast==='function'?window.toast(t):alert(t);
 document.addEventListener('click',ev=>{
  const t=ev.target.closest?.('#st_carriers button');if(!t)return;
  if(t.hasAttribute('data-cr-more')){crMore=!crMore;crPaint();return;}
  if(t.dataset.crMode){crDraft=t.dataset.crMode==='manual'?carrierOrder(undefined,crCustom):null;crChanged();return;}
  if(t.hasAttribute('data-cr-add')){
   const name=(document.getElementById('nd_cr_name')?.value||'').trim(),url=(document.getElementById('nd_cr_url')?.value||'').trim();
   if(!name){crSay('택배사 이름을 넣어 주세요.');document.getElementById('nd_cr_name')?.focus();return;}
   const all=carriers(crCustom);if(Object.values(all).some(([n])=>n.replace(/\s/g,'')===name.replace(/\s/g,''))){crSay('이미 있는 택배사예요.');return;}
   if(url&&!safeUrl(url)){crSay('조회 주소는 https:// 로 시작하는 주소만 넣을 수 있어요.');document.getElementById('nd_cr_url')?.focus();return;}
   const id='u_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
   crCustom=[...crCustom,{id,name,...(url?{url:safeUrl(url)}:{})}];if(Array.isArray(crDraft))crDraft=[...carrierOrder(crDraft,crCustom)];
   crChanged();const d=document.querySelector('#st_carriers .nd-cr-add');if(d)d.open=false;return;}
  if(t.dataset.crDel){const k=t.dataset.crDel;crCustom=crCustom.filter(x=>x.id!==k);if(Array.isArray(crDraft))crDraft=crDraft.filter(x=>x!==k);crChanged();return;}

 });
 // 10/26 끌어서 옮기기(마우스·손가락 모두): 손잡이(⋮⋮)를 잡고 위아래로. 자동 순서에서 옮기면 그 자리에서 '직접 정하기'로 바뀐다.
 // 끄는 동안은 줄을 DOM에서 옮기지 않고 translateY로만 보여 준다(옮기면 pointer capture가 풀린다). 키보드는 손잡이에서 ↑↓.
 function crMove(k,to){const o=carrierOrder(Array.isArray(crDraft)?crDraft:null,crCustom),i=o.indexOf(k);if(i<0)return;to=Math.max(0,Math.min(o.length-1,to));if(to===i&&Array.isArray(crDraft))return;o.splice(i,1);o.splice(to,0,k);crDraft=o;crChanged();}
 document.addEventListener('keydown',ev=>{const g=ev.target.closest?.('#st_carriers [data-cr-grip]');if(!g||!['ArrowUp','ArrowDown'].includes(ev.key))return;ev.preventDefault();const k=g.dataset.crGrip,o=carrierOrder(Array.isArray(crDraft)?crDraft:null,crCustom);crMove(k,o.indexOf(k)+(ev.key==='ArrowUp'?-1:1));setTimeout(()=>document.querySelector(`#st_carriers [data-cr-grip="${CSS.escape(k)}"]`)?.focus());});
 document.addEventListener('pointerdown',ev=>{
  const g=ev.target.closest?.('#st_carriers [data-cr-grip]');if(!g||ev.button>0)return;ev.preventDefault();
  const li=g.closest('li'),list=li.parentElement,items=[...list.children].filter(x=>!x.hidden),from=items.indexOf(li),h=li.getBoundingClientRect().height,y0=ev.clientY;let to=from;
  li.classList.add('is-drag');list.classList.add('is-dragging');try{g.setPointerCapture(ev.pointerId);}catch{}
  const move=e=>{const dy=e.clientY-y0;li.style.transform=`translateY(${dy}px)`;to=Math.max(0,Math.min(items.length-1,from+Math.round(dy/h)));
   items.forEach((x,i)=>{if(x===li)return;const shift=from<to&&i>from&&i<=to?-h:from>to&&i<from&&i>=to?h:0;x.style.transform=shift?`translateY(${shift}px)`:'';});};
  const end=()=>{g.removeEventListener('pointermove',move);g.removeEventListener('pointerup',end);g.removeEventListener('pointercancel',end);
   items.forEach(x=>{x.style.transform='';});li.classList.remove('is-drag');list.classList.remove('is-dragging');
   if(to!==from)crMove(li.dataset.crK,to);};
  g.addEventListener('pointermove',move);g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
 });
 document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.isComposing&&ev.target.closest?.('#st_carriers .nd-cr-form input')){ev.preventDefault();document.querySelector('#st_carriers [data-cr-add]')?.click();}});
 window.naroCarrierToSettings=()=>{crDraft=crSaved();crCustom=crSavedCustom();crPaint();};
 window.naroCarrierFromSettings=()=>({carrier_order:Array.isArray(crDraft)?carrierOrder(crDraft,crCustom):undefined,carriers_custom:crCustom?.length?crCustom:undefined});
 window.naroCarrierClean=()=>{if(crDraft===undefined)return true;return JSON.stringify(crCustom||[])===JSON.stringify(crSavedCustom())&&JSON.stringify(Array.isArray(crDraft)?carrierOrder(crDraft,crCustom):null)===JSON.stringify(crSaved()?carrierOrder(crSaved()):null);};
 window.naroCarrierOrder=carrierOrder;
 // 10/26 공유·이메일로 견적서를 보내면 저절로 '발송'(보낸 날 기록) — 작성중일 때만, 지금 열린 견적만. 저장은 단계 버튼과 같은 길([저장]).
 window.naroMarkSent=(q,docType)=>{
  try{if(docType&&docType!=='견적서')return;if(typeof qtEditing==='undefined'||!qtEditing||!q||qtEditing.id!==q.id||qtEditing.status!=='작성중')return;
   qtEditing.status='발송';const sel=document.getElementById('fq_status');if(sel)sel.value='발송';
   setTimeout(()=>{document.getElementById('qtSaveBtn')?.click();if(typeof window.toast==='function')setTimeout(()=>window.toast('보냈으니 발송으로 바꿨어요 · 회신 대기 날짜를 세요'),400);},0);
  }catch(err){console.error('[mark-sent]',err);}
 };
})();
