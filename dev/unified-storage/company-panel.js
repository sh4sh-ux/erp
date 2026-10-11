/* 거래처 오른쪽 패널(10/11, 시안 A '흐름형' 승인). 화면만 바꾼다 — 저장 규칙·필드 id·저장 버튼은 원래 것 그대로.
   원래 renderCoDetail이 그린 뒤 같은 폼을 다시 짠다: 머리(이름·연락처·받을/줄 금액) + 탭 [거래 · 단가 · 정보].
   거래 = 받을 금액(매입처는 줄 금액) 요약 · 최근 입금(출금) · 거래 내역(견적, 매입처는 매입)을 줄을 눌러 펼친다.
   정보 = 원래 입력 칸을 기본 정보 / 연락처 / 메모로 묶어 옮긴다(복사하지 않아 저장·변경 감지가 그대로 동작). */
(()=>{
 if(typeof renderCoDetail!=='function')return;
 const desk=matchMedia('(min-width:1024px)');
 const ui={cid:null,tab:'deal',seg:'open',allPays:false,allDeals:false,open:null};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Math.round(Number(n)||0).toLocaleString('ko-KR');
 const won=n=>money(n)+'원';
 const md=d=>{const m=/^\d{4}-(\d{2})-(\d{2})/.exec(d||'');return m?`${m[1]}.${m[2]}`:'—';};
 const fn=(name,...a)=>{try{const f=globalThis[name];return typeof f==='function'?f(...a):undefined;}catch{return undefined;}};
 const D=()=>{try{return db;}catch{return null;}};
 const sel=()=>{try{return coSel;}catch{return null;}};
 const ICON={
  chev:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  mail:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  doc:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
  empty:'<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h4"/></svg>'
 };
 const STATUS_CLASS={'작성중':'st-draft','발송':'st-sent','수주':'st-won','부분납품':'st-sent','납품':'st-done'};
 const names=lines=>{const n=(lines||[]).map(l=>(l.name||'').trim()).filter(Boolean);return n.length?n[0]+(n.length>1?` 외 ${n.length-1}건`:''):'품목 없음';};
 const qtyOf=lines=>(lines||[]).filter(l=>(l.name||'').trim()).reduce((s,l)=>s+(Number(l.qty)||0),0);

 // ── 매출처: 견적별 납품·입금 ──
 function quoteRows(cid){
  const d=D(),pays=d.payments||[];
  return (d.quotes||[]).filter(q=>q.company_id===cid&&q.status!=='취소').map(q=>{
   const total=fn('quoteAmount',q)??0;
   const dels=(q.deliveries||[]).map(x=>{const lines=fn('deliveredLines',q,x)||[];return {date:x.date||q.delivered_at||'',kind:'납품',text:`${money(lines.reduce((s,l)=>s+(Number(l.qty)||0),0))}개`,amount:0};});
   const delivered=fn('deliveredAmount',q)??0;
   const linked=pays.filter(p=>p.quote_id===q.id&&(p.kind==='수금'||(p.kind==='지급'&&p.refund)));
   const paid=linked.reduce((s,p)=>s+(p.kind==='수금'?1:-1)*(Number(p.amount)||0),0);
   const full=!!fn('quoteIsFullyDelivered',q);
   const want=qtyOf(q.lines),got=(q.deliveries||[]).reduce((s,x)=>s+(fn('deliveredLines',q,x)||[]).reduce((a,l)=>a+(Number(l.qty)||0),0),0);
   const ev=[...dels,...linked.map(p=>({date:p.date||'',kind:p.kind==='수금'?'입금':'환불',text:[p.method,p.memo].filter(Boolean).join(' · ')||'입금',amount:(p.kind==='수금'?1:-1)*(Number(p.amount)||0)}))]
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''));
   if(!dels.length)ev.unshift({date:'',kind:'납품',text:want?`아직 납품 전 · ${money(want)}개 남음`:'아직 납품 전',amount:0,todo:true});
   else if(!full&&want>got)ev.push({date:'',kind:'납품',text:`${money(want-got)}개 남음`,amount:0,todo:true});
   const left=delivered-paid;
   const done=full&&left<=0;
   const leftText=!dels.length?(paid>0?`선입금 ${won(paid)}`:'납품 전'):left>0?won(left):left<0?`${won(-left)} 더 받음`:'0원 · 다 받음';
   return {id:q.id,date:q.date||'',title:names(q.lines),sub:q.no||'',st:q.status||'',cls:STATUS_CLASS[q.status]||'st-draft',amount:total,ev,done,leftText,leftWarn:dels.length&&left>0,go:'견적서 열기 ›',kind:'quote'};
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.sub||'').localeCompare(a.sub||''));
 }
 // ── 매입처: 매입별 입고·출금(매입 화면이 켜져 있을 때) ──
 function purchaseRows(cid){
  const P=globalThis.NaroPurchases;if(!P?.vendor)return null;
  const st=P.state?.().status;if(st==='unknown'){P.load?.().then(()=>{if(sel()===cid)renderCoDetail();});return null;}
  if(st!=='ready')return null;
  return P.vendor(cid).map(p=>{
   const fx=p.cur!=='KRW',amt=n=>fx?`${p.cur} ${Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2})}`:won(n);
   const ev=[...p.receipts.map(r=>({date:r.date,kind:'입고',text:`${money(r.qty)}개`,amount:0})),
    ...p.pays.map(x=>({date:x.date,kind:x.kind==='지급'?'출금':'돌려받음',text:x.method||'출금',amount:(x.kind==='지급'?1:-1)*x.amount}))].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
   if(!p.receipts.length)ev.unshift({date:'',kind:'입고',text:p.qty?`아직 입고 전 · ${money(p.qty)}개`:'아직 입고 전',amount:0,todo:true});
   const left=p.due-p.paid;
   return {id:p.id,date:p.date||'',title:p.title,sub:p.no||'',st:p.label,cls:p.cls,amount:p.total,amountText:amt(p.total),ev,done:p.got>=p.qty&&left<=0.5,
    leftText:left>0.5?amt(left):left<-0.5?`${amt(-left)} 더 줌`:'0원 · 다 줌',leftWarn:left>0.5,go:'매입 열기 ›',kind:'purchase'};
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.sub||'').localeCompare(a.sub||''));
 }
 function summary(c){
  const d=D(),sell=c.type!=='매입';
  if(sell){
   const r=(fn('arData')||[]).find(x=>x.cid===c.id)||{delivered:0,paid:0,open:0,orders:0,lastDeliver:'',lastPay:''};
   const pays=(d.payments||[]).filter(p=>p.company_id===c.id&&p.kind==='수금').sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created_at||'').localeCompare(a.created_at||''));
   const deals=quoteRows(c.id),recent=[r.lastDeliver,r.lastPay,deals[0]?.date].filter(Boolean).sort().slice(-1)[0]||'';
   const pct=r.delivered>0?Math.max(0,Math.min(100,Math.round(r.paid/r.delivered*100))):0;
   return {sell,amtLabel:'받을 금액',amt:Math.max(0,r.open),left:r.open,pct,verb:'받음',base:r.delivered,paid:r.paid,money:'받을 금액',payTitle:'최근 입금',payBtn:'입금 추가',dealTitle:'거래 내역',dealBtn:'새 견적',openLabel:'진행 중',
    line:[['최근 거래',md(recent)],['견적',`${deals.length}건`],['납품 누계',won(r.delivered)],['입금 누계',won(r.paid)]],
    pays:pays.map(p=>({date:p.date,text:[p.method,p.memo].filter(Boolean).join(' · ')||'입금',ref:(d.quotes.find(q=>q.id===p.quote_id)||{}).no||'',amount:Number(p.amount)||0})),
    deals,has:deals.length>0||pays.length>0||r.delivered>0};
  }
  const pays=(d.payments||[]).filter(p=>p.company_id===c.id&&p.kind==='지급').sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created_at||'').localeCompare(a.created_at||''));
  const deals=purchaseRows(c.id)||[],krw=deals.filter(p=>!/[A-Z]{3} /.test(p.amountText||''));
  const due=krw.reduce((s,p)=>s+(p.amount||0),0),paidAll=pays.reduce((s,p)=>s+(Number(p.amount)||0),0);
  const left=Math.max(0,krw.reduce((s,p)=>s+Math.max(0,(p.leftWarn?Number(String(p.leftText).replace(/[^\d]/g,'')):0)),0));
  const recent=[deals[0]?.date,pays[0]?.date].filter(Boolean).sort().slice(-1)[0]||'';
  const pct=due>0?Math.max(0,Math.min(100,Math.round((due-left)/due*100))):0;
  return {sell,amtLabel:'줄 금액',amt:left,left,pct,verb:'지급',base:due,paid:due-left,money:'줄 금액',payTitle:'최근 출금',payBtn:'출금 추가',dealTitle:'매입 내역',dealBtn:'새 매입',openLabel:'남은 일',
   line:[['최근 거래',md(recent)],['매입',`${deals.length}건`],['매입 누계',won(due)],['출금 누계',won(paidAll)]],
   pays:pays.map(p=>({date:p.date,text:[p.method,p.memo].filter(Boolean).join(' · ')||'출금',ref:'',amount:Number(p.amount)||0})),
   deals,has:deals.length>0||pays.length>0,noPurchases:!globalThis.NaroPurchases?.vendor};
 }

 // 요약 한 줄: 82% 받음 · 160,100원 남음 / 납품 전 · 미리 받은 돈 50,000원 / 100% 받음 · 다 받았어요
 function ovText(s){
  const sep='<span class="sep">·</span>',pre=s.sell&&s.left<0?`${sep}<span class="cp-pre">미리 받은 돈 ${won(-s.left)}</span>`:'';
  if(!(s.base>0))return `<b>${s.sell?'납품 전':'입고 전'}</b>${pre}`;
  if(s.left<=0)return `<b>100%</b>${esc(s.verb)}${sep}<span>${s.sell?'다 받았어요':'다 줬어요'}</span>${pre}`;
  return `<b>${s.pct}%</b>${esc(s.verb)}${sep}<span class="cp-warn">${won(s.left)} 남음</span>`;
 }
 function dealHtml(s){
  if(!s.has)return `<div class="cp-empty">${ICON.empty}<b>아직 거래가 없어요</b><span>${s.sell?'첫 견적을 만들면 받을 금액과 거래 내역이 여기에 쌓여요':'매입을 등록하면 줄 금액과 매입 내역이 여기에 쌓여요'}</span><button type="button" class="btn primary" data-cp="new">${s.sell?'첫 견적 만들기':'첫 매입 등록'}</button></div>`;
  const pays=ui.allPays?s.pays:s.pays.slice(0,3);
  const open=s.deals.filter(r=>!r.done),done=s.deals.filter(r=>r.done);
  const list=ui.seg==='open'?open:ui.seg==='done'?done:s.deals,shown=ui.allDeals?list:list.slice(0,5);
  const row=r=>{const on=ui.open===r.id;return `<button type="button" class="cp-qr" data-cp-row="${esc(r.id)}" aria-expanded="${on}"><span class="d">${md(r.date)}</span><span class="m"><span class="t">${esc(r.title)}</span><span class="s"><span class="pill pm ${esc(r.cls)}">${esc(r.st)}</span><span class="sd">${md(r.date)} · </span>${esc(r.sub)}</span></span><span class="pill ${esc(r.cls)}">${esc(r.st)}</span><span class="a">${esc(r.amountText||won(r.amount))}</span><span class="cv">${ICON.chev}</span></button>`+
   (on?`<div class="cp-tl">${r.ev.map(e=>`<div class="cp-ev${e.todo?' todo':''}"><span>${e.date?md(e.date):'—'}</span><b>${esc(e.kind)}</b><em>${esc(e.text)}</em><i>${e.amount?(e.amount<0?'−':'')+won(Math.abs(e.amount)):''}</i></div>`).join('')}
    <div class="cp-tls"><span>${r.kind==='quote'?'이 견적':'이 매입'} 남은 금액 <b class="${r.leftWarn?'cp-warn':''}">${esc(r.leftText)}</b></span><button type="button" class="cp-link" data-cp-go="${esc(r.id)}" data-cp-kind="${r.kind}">${esc(r.go)}</button></div></div>`:'');};
  return `<div class="cp-ov">
    <div><div class="k">${esc(s.money)}</div><div class="v">${ovText(s)}</div></div>
    <button type="button" class="btn primary" data-cp="pay">${esc(s.payBtn)}</button>
    <div class="cp-track"><i style="width:${s.pct}%"></i></div>
    <div class="cp-stats">${s.line.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
   </div>
   <section class="cp-sec"><div class="cp-sech"><h3>${esc(s.payTitle)}</h3><span class="cnt">${s.pays.length}건</span><span class="sp"></span>${s.pays.length>3?`<button type="button" class="cp-link" data-cp="pays">${ui.allPays?'접기':'모두 보기 ›'}</button>`:''}</div>
    ${pays.length?`<div class="cp-list">${pays.map(p=>`<div class="cp-pr"><span class="d">${md(p.date)}</span><span class="n">${esc(p.text)}${p.ref?`<span class="q">${esc(p.ref)}</span>`:''}</span><span class="a">${won(p.amount)}</span></div>`).join('')}</div>`:`<p class="cp-none">아직 ${s.sell?'입금':'출금'} 기록이 없어요</p>`}
   </section>
   <section class="cp-sec"><div class="cp-sech"><h3>${esc(s.dealTitle)}</h3><span class="sp"></span>
     <div class="cp-seg" role="group" aria-label="${esc(s.dealTitle)} 보기">${[['open',`${s.openLabel} ${open.length}`],['done',`끝남 ${done.length}`],['all','전체']].map(([v,t])=>`<button type="button" data-cp-seg="${v}" aria-pressed="${ui.seg===v}">${esc(t)}</button>`).join('')}</div>
     <button type="button" class="btn ghost cp-new" data-cp="new">${ICON.plus}${esc(s.dealBtn)}</button></div>
    ${s.noPurchases?'<p class="cp-none">매입 화면을 쓰면 매입 내역이 여기에 나와요</p>':shown.length?`<div class="cp-list">${shown.map(row).join('')}</div>`:`<p class="cp-none">${ui.seg==='open'?'진행 중인 거래가 없어요':ui.seg==='done'?'끝난 거래가 없어요':'거래가 없어요'}</p>`}
    ${list.length>5?`<div class="cp-more"><button type="button" class="cp-link" data-cp="deals">${ui.allDeals?'접기':`${list.length-5}건 더 보기`}</button></div>`:''}
   </section>`;
 }
 const grp=(title,desc,nodes)=>{const g=document.createElement('section');g.className='cp-grp';g.innerHTML=`<div class="cp-grph"><h4>${esc(title)}</h4>${desc?`<p>${esc(desc)}</p>`:''}</div><div class="cp-grpb"></div>`;const b=g.lastElementChild;nodes.filter(Boolean).forEach(n=>b.append(n));return g;};
 const unit=id=>{const el=document.getElementById(id);return el?.closest('.grid2')||el?.closest('.field')||null;};

 function enhance(){
  const form=document.getElementById('coForm');if(!form||form.classList.contains('hidden'))return;
  const d=D();if(!d)return;
  const isNew=sel()==='__new__',c=isNew?null:(d.companies||[]).find(x=>x.id===sel());if(!isNew&&!c)return;
  if(ui.cid!==sel()){ui.cid=sel();ui.tab=isNew?'info':'deal';ui.seg='open';ui.allPays=false;ui.allDeals=false;ui.open=null;}
  const actions=form.querySelector('.form-actions'),back=document.getElementById('coBackToList');
  const name=unit('f_name'),typeBiz=unit('f_type'),contact=unit('f_contact'),email=unit('f_email'),addr=unit('f_address'),addr2=unit('f_address_detail'),memo=unit('f_memo'),qmemo=unit('f_qmemo');
  const prices=document.getElementById('coPriceRules')?.closest('section');
  if(!actions||!name)return;
  const s=isNew?null:summary(c);
  if(s&&!s.sell&&ui.tab==='price')ui.tab='deal';
  const tabs=isNew?[['info','정보'],['price','단가']]:s.sell?[['deal','거래'],['price','단가'],['info','정보']]:[['deal','거래'],['info','정보']];
  if(!tabs.some(t=>t[0]===ui.tab))ui.tab=tabs[0][0];
  const typePill=!c?'':c.type==='매입'?'<span class="pill buy">매입</span>':'<span class="pill sell">매출</span>';
  const meta=c?[c.contact,c.phone].filter(Boolean).map(esc):[];
  // 머리
  const head=document.createElement('div');head.className='cp-head';
  head.innerHTML=`<div class="cp-top"><div class="cp-id"><div class="cp-cap">거래처</div><div class="co-title"><span class="co-title-name">${esc(c?c.name||'(이름 없음)':'새 거래처')}</span></div>
    ${c?`<div class="cp-meta">${meta.length?meta.join('<span class="dot">·</span>'):'<span class="none">담당자·연락처 없음</span>'}${typePill}</div>`:'<div class="cp-meta"><span class="none">상호를 입력하고 등록하세요</span></div>'}</div>
    ${s?`<div class="cp-amt"><div class="k">${esc(s.amtLabel)}</div><div class="v">${won(s.amt)}</div></div>`:''}</div>
   <div class="cp-tabs" role="tablist" aria-label="거래처 상세">${tabs.map(([v,t])=>`<button type="button" role="tab" data-cp-tab="${v}" aria-selected="${ui.tab===v}">${t}</button>`).join('')}</div>`;
  // 패널
  const pDeal=document.createElement('div');pDeal.className='cp-panel';pDeal.dataset.cpPanel='deal';if(s)pDeal.innerHTML=dealHtml(s);
  const pPrice=document.createElement('div');pPrice.className='cp-panel';pPrice.dataset.cpPanel='price';
  if(prices){prices.classList.add('cp-prices');const h=prices.querySelector('h3');if(h)h.textContent='약정 판매 단가';pPrice.append(prices);}
  const pInfo=document.createElement('div');pInfo.className='cp-panel';pInfo.dataset.cpPanel='info';
  pInfo.append(grp('기본 정보','견적서·거래명세서에 나와요',[name,typeBiz]),grp('연락처','견적서를 보낼 때 써요',[contact,email,addr,addr2]),grp('메모','견적서 기본 비고는 새 견적에 자동으로 들어가요',[memo,qmemo]));
  if(c&&window.NaroChangeLog)pInfo.insertAdjacentHTML('beforeend','<button type="button" class="cp-link cp-log" data-cp="log">이 거래처의 변경 기록 보기</button>');
  [pDeal,pPrice,pInfo].forEach(p=>{p.hidden=p.dataset.cpPanel!==ui.tab;});
  const body=document.createElement('div');body.className=desk.matches?'workspace-form-body cp-body':'cp-body';
  body.append(pDeal,pPrice,pInfo);
  // 정리: 원래 머리·요약·액션 줄·옛 거래 내역은 지운다(입력 칸은 위에서 옮겼다)
  [...form.childNodes].forEach(n=>{if(n!==actions)n.remove();});
  form.prepend(head,body);
  if(back){if(desk.matches)body.prepend(back);else form.prepend(back);}
  form.classList.add('cp');if(desk.matches)form.classList.add('workspace-form');
  // 아래 버튼 줄: [전화(폰)] [이메일] [거래명세서(매출처·PC)] … [⋯] [저장]
  actions.querySelectorAll('.cp-act').forEach(b=>b.remove());
  if(c){
   const mk=(cls,icon,label,dis)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost cp-act '+cls;b.innerHTML=icon+label;if(dis)b.disabled=true;return b;};
   const tel=mk('cp-tel',ICON.phone,'전화',!c.phone),mail=mk('cp-mail',ICON.mail,'이메일',!c.email);
   tel.onclick=()=>{location.href='tel:'+String(c.phone).replace(/[^\d+]/g,'');};
   mail.onclick=()=>{location.href='mailto:'+encodeURIComponent(c.email);};
   const btns=[tel,mail];
   if(c.type!=='매입'){const st=mk('cp-stmt',ICON.doc,'거래명세서',!d.quotes.some(q=>q.company_id===c.id&&q.status!=='취소'));st.onclick=()=>openStatement(c);btns.push(st);}
   actions.prepend(...btns);
   const stmt=actions.querySelector('.cp-stmt'),del=actions.querySelector(':scope>.btn.del');
   if(stmt&&del&&!desk.matches){const menu=document.createElement('details');menu.className='panel-b-danger';menu.innerHTML='<summary>더보기</summary>';del.before(menu);menu.append(stmt,del);}
  }
  bind(form,c,s);
 }
 function openStatement(c){
  const q=D().quotes.filter(x=>x.company_id===c.id&&x.status!=='취소').sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.no||'').localeCompare(a.no||''))[0];
  if(!q)return;
  try{qtDocType='거래명세서';qtSel=q.id;qtEditing=null;qtBaseline='';}catch{}
  if(fn('switchView','quotes')===false)return;fn('renderQtList');fn('renderQtDetail');fn('scrollToDetail','qtForm');
 }
 function newDeal(c,s){
  if(s?.sell===false){if(fn('switchView','purchases')===false)return;setTimeout(()=>{document.getElementById('puNewBtn')?.click();setTimeout(()=>{const v=document.getElementById('pu_co');if(v&&!v.value){v.value=c.id;v.dispatchEvent(new Event('change',{bubbles:true}));}},60);},60);return;}
  if(fn('switchView','quotes')===false)return;
  document.getElementById('qtNewBtn')?.click();
  try{if(qtEditing){qtEditing.company_id=c.id;fn('applyCoQuoteMemo',qtEditing,'');fn('renderQtDetail');fn('scrollToDetail','qtForm');}}catch{}
 }
 function addPay(c,s){
  if(fn('switchView','payments')===false)return;
  const kind=document.getElementById('payKind');
  if(kind&&s&&!s.sell&&kind.value!=='지급'){kind.value='지급';kind.dispatchEvent(new Event('change',{bubbles:true}));}
  const el=document.getElementById('payCo');if(el){el.value=c.id;fn('updatePayQuotes');}
  const box=document.getElementById('payEntry');if(box)box.open=true;
  setTimeout(()=>document.getElementById('payAmt')?.focus(),40);
 }
 function bind(form,c,s){
  form.querySelectorAll('[data-cp-tab]').forEach(b=>b.onclick=()=>{ui.tab=b.dataset.cpTab;form.querySelectorAll('[data-cp-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));form.querySelectorAll('[data-cp-panel]').forEach(p=>{p.hidden=p.dataset.cpPanel!==ui.tab;});form.querySelector('.cp-body')?.scrollTo?.(0,0);});
  const deal=form.querySelector('[data-cp-panel="deal"]');if(!deal||!c)return;
  const repaint=()=>{deal.innerHTML=dealHtml(summary(c));};
  deal.onclick=ev=>{
   const t=ev.target.closest('button');if(!t||!deal.contains(t))return;
   if(t.dataset.cpRow){ui.open=ui.open===t.dataset.cpRow?null:t.dataset.cpRow;repaint();return;}
   if(t.dataset.cpSeg){ui.seg=t.dataset.cpSeg;ui.allDeals=false;repaint();return;}
   if(t.dataset.cpGo){if(t.dataset.cpKind==='purchase'){globalThis.NaroPurchases?.open?.(t.dataset.cpGo);return;}
    try{qtSel=t.dataset.cpGo;qtEditing=null;qtBaseline='';}catch{}if(fn('switchView','quotes')===false)return;fn('renderQtList');fn('renderQtDetail');fn('scrollToDetail','qtForm');return;}
   const a=t.dataset.cp;
   if(a==='pays'){ui.allPays=!ui.allPays;repaint();}
   else if(a==='deals'){ui.allDeals=!ui.allDeals;repaint();}
   else if(a==='pay')addPay(c,s);
   else if(a==='new')newDeal(c,s);
  };
  form.querySelector('[data-cp="log"]')?.addEventListener('click',()=>window.NaroChangeLog?.open({ref:c.id,title:c.name||'거래처'}));
 }
 const orig=renderCoDetail;
 renderCoDetail=function(){const r=orig.apply(this,arguments);try{enhance();}catch(e){console.error('[company-panel]',e);}return r;};
 desk.addEventListener('change',()=>{try{if(document.getElementById('coForm')?.classList.contains('cp'))renderCoDetail();}catch{}});
 window.NaroCompanyPanel={ui,summary:c=>summary(c)};
})();
