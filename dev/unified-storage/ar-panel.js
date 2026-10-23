/* 받을 금액 화면(10/16 시안 — UI-RULES 'Receivables'). 받을 금액 = 납품한 금액 − 받은 금액(입금).
   누구에게 얼마를, 경과일(가장 오래된 미입금 납품부터 며칠) 못 받았는지 보여 주고 바로 입금을 기록한다.
   계산은 기본 앱(arData · deliveredLines · quoteTotals · quoteAmount · quotePaid)을 그대로 쓰고, 저장은 하지 않는다.
   입금 기록은 입금·출금 화면의 입력 창(openPaymentEntry)을 연다. 모양은 입금·출금과 같은 부품(.pp-*)을 쓴다. */
(()=>{
 const desk=matchMedia('(min-width:1024px)');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Math.round(Number(n)||0).toLocaleString('ko-KR');
 const won=n=>num(n)+'원';
 const state={cid:null,quote:null,mobileOpen:false,sig:'',listSig:'',mobileSig:'',mo:null,moCid:null,qx:null};
 let queued=false;
 const data=()=>{try{return db;}catch{return null;}};
 const fn=name=>{try{const f=globalThis[name];return typeof f==='function'?f:null;}catch{return null;}};
 const value=id=>document.getElementById(id)?.value||'';
 const coName=id=>(data()?.companies||[]).find(c=>c.id===id)?.name||'거래처 없음';
 const today=()=>{const f=fn('localDate');return f?f():new Date().toISOString().slice(0,10);};
 const days=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return null;const a=new Date(d+'T00:00:00'),b=new Date(today()+'T00:00:00');return Math.max(0,Math.round((b-a)/864e5));};
 const short=d=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(d||'');return m?`${m[1]}.${m[2]}`:'';};
 // 경과일: 30일 · 60일 기준(시안 확정). 30일 넘으면 주황, 60일 넘으면 빨강 칩.
 const ageCls=n=>n==null?'':n>60?'ap-old':n>30?'ap-mid':'';
 const ageChip=n=>n==null?'':ageCls(n)?`<b class="ap-age ${ageCls(n)}">${n}일</b>`:`${n}일`;
 const live=q=>(q?.deliveries||[]).filter(d=>!d.void_at);
 const delAmt=(q,d)=>{try{return fn('quoteTotals')({lines:fn('deliveredLines')(q,d)}).total||0;}catch{return 0;}};
 const qPaid=q=>(data()?.payments||[]).filter(p=>p.quote_id===q.id&&!p.void_at&&(p.kind==='수금'||(p.kind==='지급'&&p.refund))).reduce((s,p)=>s+(p.kind==='수금'?1:-1)*(Number(p.amount)||0),0);
 // 견적 하나: 납품액 − 받은 돈. 받은 돈은 오래된 납품부터 채운다 → 남은 첫 납품의 날짜가 '경과일'의 기준.
 function quoteOpen(q){
  const ds=live(q).map(d=>({date:d.date||q.delivered_at||'',amt:delAmt(q,d)})).sort((a,b)=>a.date.localeCompare(b.date));
  const delivered=ds.reduce((s,d)=>s+d.amt,0),paid=qPaid(q),open=delivered-paid;
  let left=paid,oldest=null;for(const d of ds){if(left>=d.amt-0.5){left-=d.amt;continue;}oldest=d.date;break;}
  return {q,delivered,paid,open,oldest,age:open>0.5?days(oldest):null,last:ds.at(-1)?.date||''};
 }
 // 10/23 견적 펼치기: 줄을 누르면 그 견적의 품목 · 납품 기록 · 입금 · 계산서를 한눈에(번호는 그대로 견적서로 이동).
 // 다른 화면(거래처 등)도 같은 모양을 쓰도록 NaroQuoteBrief로 내보낸다. 계산만 하고 저장하지 않는다.
 const CHEV='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
 function quoteBrief(qid,{payButton=true,docButton=true,attr='ap'}={}){
  const at=attr==='pp'?'pp':'ap';
  const q=(data()?.quotes||[]).find(x=>x.id===qid);if(!q)return '<div class="nd-qx-b"><p class="nd-qx-none">견적을 찾을 수 없어요.</p></div>';
  const lines=(q.lines||[]).filter(l=>(l.name||'').trim()),opt=l=>[l.color,l.spec].filter(Boolean).join(' · ');
  // 납품·남은 금액과 같은 기준(부가세 포함)으로 — 견적의 합계 계산(quoteTotals)을 줄 하나에 그대로 쓴다.
  const amt=l=>{try{return fn('quoteTotals')({...q,lines:[l]}).total||0;}catch{return (Number(l.qty)||0)*(Number(l.price)||0);}};
  const shown=lines.slice(0,5),more=lines.length-shown.length;
  const dels=live(q).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const dq=d=>{try{return fn('deliveryRecordQty')?.(q,d)??0;}catch{return 0;}};
  const pays=(data()?.payments||[]).filter(p=>p.quote_id===q.id&&!p.void_at&&(p.kind==='수금'||(p.kind==='지급'&&p.refund))).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  let taxed=false,noTax=false;try{taxed=!!fn('isTaxed')?.(q);noTax=!!fn('noTax')?.(q);}catch{}
  const tax=taxed?`발행 ${short(q.tax_at)||''}`.trim():noTax?'발행 안 함':'<b class="nd-qx-warn">미발행</b>';
  const row=(a,b,c,cls='')=>`<div class="nd-qx-r${cls}"><span class="a">${a}</span><span class="b">${b}</span><span class="c">${c}</span></div>`;
  const sec=(title,body)=>`<div class="nd-qx-s"><h5>${title}</h5>${body}</div>`;
  return `<div class="nd-qx-b">
   ${sec(`품목 <small>${lines.length}개</small>`,lines.length?shown.map(l=>row(esc(l.name),`${esc(opt(l))}${opt(l)?' · ':''}${num(l.qty)}${esc(l.unit||'')}`,num(amt(l)))).join('')+(more>0?`<div class="nd-qx-more">외 ${more}개</div>`:''):'<p class="nd-qx-none">품목이 없어요.</p>')}
   ${sec(`납품 <small>${dels.length}번</small>`,dels.length?dels.map(d=>row(short(d.date||q.delivered_at)||'—',`${num(dq(d))}개`,num(delAmt(q,d)))).join(''):'<p class="nd-qx-none">아직 납품하지 않았어요.</p>')}
   ${sec(`입금 <small>${pays.length}건</small>`,pays.length?pays.map(p=>row(short(p.date)||'—',esc(p.kind==='지급'?'환불':(p.method||'입금')),`${p.kind==='지급'?'-':''}${num(p.amount)}`,p.kind==='지급'?' neg':'')).join(''):'<p class="nd-qx-none">아직 입금이 없어요.</p>')}
   <div class="nd-qx-foot"><span>계산서 ${tax}</span><span class="sp"></span>${docButton?`<button type="button" class="pp-btn" data-${at}="doc" data-q="${esc(q.id)}">견적서 열기</button>`:''}${payButton?`<button type="button" class="pp-btn pp-primary" data-${at}="pay" data-id="${esc(q.company_id)}" data-q="${esc(q.id)}">이 견적 입금 기록</button>`:''}</div>
  </div>`;
 }
 // 거래처: 받을 금액은 받을 금액 화면과 같은 계산(arData). 경과일 = 남은 견적 중 가장 오래된 것.
 function companies(){
  const f=fn('arData');if(!f)return [];let rows=[];try{rows=f();}catch{return [];}
  const qs=(data()?.quotes||[]).filter(q=>q.status!=='취소');
  return rows.map(r=>{const opens=qs.filter(q=>q.company_id===r.cid).map(quoteOpen).filter(x=>x.open>0.5).sort((a,b)=>(a.oldest||'').localeCompare(b.oldest||''));
   const age=opens.length?Math.max(...opens.map(x=>x.age??0)):null;
   return {...r,name:coName(r.cid),opens,age};});
 }
 const showAll=()=>value('arFilter')==='all';
 const visible=list=>list.filter(r=>showAll()||r.open>0.5).filter(r=>{const q=(document.querySelector('#view-ar .nd-tsearch input')?.value||'').trim().toLowerCase();return !q||r.name.toLowerCase().includes(q);});
 const sortOld=list=>list.slice().sort((a,b)=>(b.age??-1)-(a.age??-1)||b.open-a.open);
 const quoteMode=()=>value('arView')==='quote';
 function buckets(list){const b=[0,0,0];for(const r of list)for(const o of r.opens){const n=o.age??0;b[n>60?2:n>30?1:0]+=o.open;}return b;}
 function listMarkup(list){
  if(quoteMode()){
   const qs=list.flatMap(r=>r.opens.map(o=>({...o,cid:r.cid,name:r.name}))).sort((a,b)=>(b.age??-1)-(a.age??-1));
   if(!qs.length)return '<p class="pp-empty">미수 견적이 없어요.</p>';
   return qs.map(o=>`<button type="button" class="pp-row${state.quote===o.q.id?' on':''}" data-ap="quote" data-id="${esc(o.cid)}" data-q="${esc(o.q.id)}"><span class="pp-row-nm">${esc(o.name)}</span><span class="pp-row-am">${won(o.open)}</span><span class="pp-row-mt">${ageCls(o.age)?ageChip(o.age):''}${esc(o.q.no||'견적')} · ${short(o.oldest)} 납품${ageCls(o.age)?'':` · ${o.age}일`}</span></button>`).join('');
  }
  if(!list.length)return `<p class="pp-empty">${showAll()?'거래처가 없어요.':'미수 거래처가 없어요.'}</p>`;
  return list.map(r=>`<button type="button" class="pp-row${state.cid===r.cid&&!state.quote?' on':''}" data-ap="co" data-id="${esc(r.cid)}"><span class="pp-row-nm">${esc(r.name)}</span><span class="pp-row-am">${r.open>0.5?won(r.open):'입금 완료'}</span><span class="pp-row-mt">${ageCls(r.age)?ageChip(r.age):''}${r.opens.length?`견적 ${r.opens.length}건`:'남은 견적 없음'}${r.age!=null&&!ageCls(r.age)?` · ${r.age}일`:''} · ${r.lastPay?'마지막 입금 '+short(r.lastPay):'입금 없음'}</span></button>`).join('');
 }
 const barMarkup=b=>`<span class="pp-bar ap-agebar" aria-hidden="true">${b[0]+b[1]+b[2]?`<span class="a0" style="flex:${b[0]}"></span><span class="a1" style="flex:${b[1]}"></span><span class="a2" style="flex:${b[2]}"></span>`:''}</span>`;
 function overviewMarkup(all){
  const list=sortOld(visible(all)),open=all.filter(r=>r.open>0.5),total=open.reduce((s,r)=>s+r.open,0),nq=open.reduce((s,r)=>s+r.opens.length,0);
  const pending=all.reduce((s,r)=>s+Math.max(0,r.pending),0),npend=(data()?.quotes||[]).filter(q=>q.status!=='취소'&&all.some(r=>r.cid===q.company_id)&&(fn('quoteAmount')?.(q)||0)-(fn('deliveredAmount')?.(q)||0)>0.5&&['수주','부분납품'].includes(q.status)).length;
  const untaxed=all.reduce((s,r)=>s+r.untaxed,0),nunt=all.reduce((s,r)=>s+r.untaxedCount,0),b=buckets(open);
  const table=list.length?`<table class="pp-table ap-table"><thead><tr><th>거래처</th><th class="pp-c-method">견적</th><th class="pp-c-num">받을 금액</th><th class="pp-c-method ap-c-age">경과일</th><th class="pp-c-method">마지막 입금</th></tr></thead><tbody>${list.map(r=>`<tr data-ap="co" data-id="${esc(r.cid)}" tabindex="0"><td><span class="pp-t-nm">${esc(r.name)}</span></td><td class="pp-c-method">${r.opens.length}건</td><td class="pp-c-num">${r.open>0.5?num(r.open):'0'}</td><td class="pp-c-method ap-c-age">${r.age==null?'—':ageChip(r.age)}</td><td class="pp-c-method">${r.lastPay?short(r.lastPay):'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="pp-empty">미수 거래처가 없어요.</div>';
  return `<button type="button" class="pp-back" data-ap="back">‹ <span>받을 금액</span></button>
   <header class="pp-head"><div class="pp-title"><span class="pp-caption">받을 금액 현황</span><h3>오늘 기준</h3></div><div class="pp-amount"><span>받을 금액 · 납품 − 입금</span><strong>${won(total)}</strong></div><div class="pp-meta"><span>${today().replace(/-/g,'.')}</span><span>${open.length}곳 · 견적 ${nq}건</span></div></header>
   <div class="pp-body" id="ap-body">
    <section class="pp-metrics pp-flow" aria-label="받을 금액 요약"><div><span>받을 금액 · ${nq}건</span><strong>${num(total)}<small>원</small></strong></div><div><span>납품 전 금액 · ${npend}건</span><strong>${num(pending)}<small>원</small></strong></div><div><span>계산서 미발행 · ${nunt}건</span><strong>${num(untaxed)}<small>원</small></strong></div></section>
    <div class="pp-section-head"><h4>경과일 <small>가장 오래된 미입금 납품 기준</small></h4></div>
    ${barMarkup(b)}<div class="ap-aging"><span><i class="a0"></i>30일 안 <b>${won(b[0])}</b></span><span><i class="a1"></i>31–60일 <b>${won(b[1])}</b></span><span><i class="a2"></i>61일 넘음 <b>${won(b[2])}</b></span></div>
    <div class="pp-section-head"><h4>거래처별 <small>${list.length}곳 · 오래된 순</small></h4></div>${table}
    <p class="pp-note">받을 금액은 납품한 금액에서 받은 금액(입금)을 뺀 것이에요. 수주만 하고 아직 납품하지 않은 금액(납품 전 금액)은 더하지 않아요.</p>
   </div>
   <div class="pp-abar"><button type="button" class="pp-btn" data-ap="export">내보내기</button><span class="pp-sp"></span><button type="button" class="pp-btn pp-primary" data-ap="pay">입금 기록</button></div>`;
 }
 // 입금을 채울 견적: 견적 탭에서 고른 것, 아니면 가장 오래된 것.
 const pick=r=>r.opens.find(o=>o.q.id===state.quote)||r.opens[0];
 function detailMarkup(r){
  const pays=(data()?.payments||[]).filter(p=>p.company_id===r.cid&&p.kind==='수금'&&!p.void_at).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  // 10/17 B안: 최근 입금을 달마다 한 줄(달 · 건수 · 합계 ⌄)로 — 거래처 화면과 같은 부품(.nd-mon). 최근 3개월, 가장 최근 달만 펼침.
  if(state.moCid!==r.cid){state.moCid=r.cid;state.mo=null;state.qx=null;}
  const ymOf=d=>/^\d{4}-\d{2}/.exec(d||'')?.[0]||'',ymLabel=ym=>{if(!ym)return '날짜 없음';const [y,m]=ym.split('-');return (y!==String(new Date().getFullYear())?`${y}년 `:'')+`${+m}월`;};
  const mg=[];for(const p of pays){const k=ymOf(p.date);let m=mg[mg.length-1];if(!m||m.ym!==k){m={ym:k,items:[],sum:0};mg.push(m);}m.items.push(p);m.sum+=Number(p.amount)||0;}
  const months=mg.slice(0,3),monOpen=(m,i)=>state.mo?state.mo.has(m.ym):i===0;state.firstYm=mg[0]?.ym??null;
  const chev='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const qno=id=>(data()?.quotes||[]).find(q=>q.id===id)?.no||'';
  const pct=r.delivered>0?Math.min(100,Math.max(0,r.paid/r.delivered*100)):0,first=pick(r);
  const linked=r.opens.reduce((s,o)=>s+o.open,0),diff=Math.round(linked-Math.max(0,r.open));
  return `<button type="button" class="pp-back" data-ap="back">‹ <span>받을 금액</span></button>
   <header class="pp-head"><div class="pp-title"><span class="pp-caption">거래처</span><h3 title="${esc(r.name)}">${esc(r.name)}</h3></div><div class="pp-amount"><span>받을 금액</span><strong>${won(Math.max(0,r.open))}</strong></div><div class="pp-meta"><span>견적 ${r.opens.length}건</span>${r.age!=null?`<span>가장 오래된 납품 ${r.age}일 전</span>`:''}<span>${r.lastPay?'마지막 입금 '+short(r.lastPay):'입금 없음'}</span></div></header>
   <div class="pp-body" id="ap-body">
    <section class="pp-prog"><div><span>납품 ${won(r.delivered)} 중 ${won(r.paid)} 받음</span><b>${Math.round(pct)}%</b></div><div class="pp-pbar"><span style="width:${pct.toFixed(1)}%"></span></div></section>
    <div class="pp-section-head"><h4>미수 견적 <small>${r.opens.length}건 · 오래된 순</small></h4></div>
    ${r.opens.length?`<table class="pp-table ap-table"><thead><tr><th>견적</th><th class="pp-c-method">납품일</th><th class="pp-c-num ap-c-wide">납품액</th><th class="pp-c-num ap-c-wide">받음</th><th class="pp-c-num">남은 금액</th><th class="pp-c-method ap-c-age">경과</th><th class="nd-qx-cv" aria-label="펼치기"></th></tr></thead><tbody>${r.opens.map(o=>{const x=state.qx===o.q.id;return `<tr class="nd-qx-row${state.quote===o.q.id?' on':''}" data-ap="qx" data-q="${esc(o.q.id)}" tabindex="0" aria-expanded="${x}"><td><button type="button" class="pp-link" data-ap="doc" data-q="${esc(o.q.id)}">${esc(o.q.no||'견적')}</button></td><td class="pp-c-method">${short(o.oldest)}</td><td class="pp-c-num ap-c-wide">${num(o.delivered)}</td><td class="pp-c-num ap-c-wide">${num(o.paid)}</td><td class="pp-c-num">${num(o.open)}</td><td class="pp-c-method ap-c-age">${ageChip(o.age)}</td><td class="nd-qx-cv"><span class="cv">${CHEV}</span></td></tr>${x?`<tr class="nd-qx"><td colspan="7">${quoteBrief(o.q.id)}</td></tr>`:''}`;}).join('')}</tbody></table>`:'<div class="pp-empty">미수 견적이 없어요.</div>'}
    ${diff>0?`<p class="pp-note">견적에 연결하지 않은 입금 ${won(diff)}이 있어요. 견적별 남은 금액의 합이 받을 금액보다 그만큼 커요.</p>`:''}
    <div class="pp-section-head"><h4>최근 입금 <small>${pays.length}건${mg.length>3?` · 최근 3개월`:''}</small></h4><button type="button" data-ap="payments">입금·출금에서 모두 보기</button></div>
    ${months.length?`<div class="nd-mons ap-mons">${months.map((m,i)=>{const on=monOpen(m,i);return `<div class="nd-mon"><button type="button" class="nd-mon-h" data-ap="mon" data-ym="${esc(m.ym)}" aria-expanded="${on}"><b>${esc(ymLabel(m.ym))}</b><span class="n">${m.items.length}건</span><span class="s">${won(m.sum)}</span><span class="cv">${chev}</span></button>${on?`<div class="nd-mon-b">${m.items.map(p=>`<div class="nd-mon-r"><span class="d">${short(p.date)}</span><span class="n">${esc(p.method||'입금')}${p.quote_id&&qno(p.quote_id)?` <button type="button" class="pp-link ap-qlink" data-ap="qpv" data-q="${esc(p.quote_id)}">${esc(qno(p.quote_id))}</button>`:''}</span><span class="a">${won(p.amount)}</span></div>`).join('')}</div>`:''}</div>`;}).join('')}</div>`:'<div class="pp-empty">아직 입금 기록이 없어요.</div>'}
   </div>
   <div class="pp-abar"><button type="button" class="pp-btn" data-ap="company">거래처 보기</button><span class="pp-sp"></span><button type="button" class="pp-btn pp-primary" data-ap="pay" data-id="${esc(r.cid)}">${first?`입금 기록 · ${esc(first.q.no||'견적')}부터`:'입금 기록'}</button></div>`;
 }
 function syncLeft(v,list){
  const left=v.querySelector('.workspace-left');if(!left)return;
  left.querySelectorAll(':scope>.workspace-record-index,:scope>.panel-b-index').forEach(x=>{if(!x.hidden)x.hidden=true;});
  // 거래처 | 견적 탭: 기본 앱의 칩 줄이 왼쪽에 못 들어가는 경우가 있어 여기서 만든다(입금·출금의 탭과 같은 자리·모양).
  let tabs=left.querySelector(':scope>.nd-chips');if(!tabs){tabs=document.createElement('div');tabs.className='nd-chips ap-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','받을 금액 보기');tabs.innerHTML=[['co','거래처'],['quote','견적']].map(([k,t])=>`<button type="button" data-ap="mode" data-mode="${k}">${t}</button>`).join('');left.append(tabs);}
  const mode=value('arView')||'co';tabs.querySelectorAll('button').forEach(x=>{const on=String((x.dataset.mode||x.dataset.v)===mode);if(x.getAttribute('aria-pressed')!==on)x.setAttribute('aria-pressed',on);});
  let el=left.querySelector(':scope>.pp-list');if(!el){el=document.createElement('div');el.className='pp-list';el.setAttribute('aria-label','받을 금액 목록');left.append(el);}
  const html=listMarkup(list);if(html!==state.listSig||!el.firstChild){el.innerHTML=html;state.listSig=html;}
 }
 function syncCount(v,n){const head=v.querySelector(':scope>.page-head'),h2=head?.querySelector('h2');if(!h2)return;let c=head.querySelector(':scope>.pp-count');if(!c){c=document.createElement('span');c.className='count pp-count';h2.after(c);}const t=n+'곳';if(c.textContent!==t)c.textContent=t;}
 function mobileList(v,all,list){
  let el=v.querySelector(':scope>.pp-mobile-list');if(!el){el=document.createElement('div');el.className='pp-mobile-list';v.append(el);}
  const open=all.filter(r=>r.open>0.5),total=open.reduce((s,r)=>s+r.open,0),b=buckets(open);
  const html=`<button type="button" class="pp-msum" data-ap="overview"><span class="pp-msum-top"><small>받을 금액 · 오늘 기준</small><b>${won(total)}</b></span>${barMarkup(b)}<span class="pp-msum-io"><small>30일 안 ${num(b[0])}</small><small>30일 넘음 ${num(b[1]+b[2])}</small></span></button><div class="pp-kind-tabs" role="group" aria-label="받을 금액 보기">${[['co','거래처'],['quote','견적']].map(([k,t])=>`<button type="button" data-ap="mode" data-mode="${k}" aria-pressed="${(value('arView')||'co')===k}">${t}</button>`).join('')}</div><div class="pp-list">${listMarkup(list)}</div>`;
  if(html!==state.mobileSig||!el.firstChild){el.innerHTML=html;state.mobileSig=html;}
 }
 function render(){
  const v=document.getElementById('view-ar');if(!v)return;
  v.classList.add('ap-on');
  const all=companies(),list=sortOld(visible(all));
  if(state.cid&&!all.some(r=>r.cid===state.cid)){state.cid=null;state.quote=null;}
  syncCount(v,all.filter(r=>r.open>0.5).length);
  if(!desk.matches)mobileList(v,all,list);
  syncLeft(v,list);
  const r=all.find(x=>x.cid===state.cid);
  const active=desk.matches?true:state.mobileOpen;
  v.classList.toggle('pp-detail-open',active);v.classList.toggle('mobile-record-open',active&&!desk.matches);
  let host=v.querySelector(':scope>.pp-detail');
  if(!active){if(host)host.hidden=true;return;}
  if(!host){host=document.createElement('section');host.className='pp-detail';host.setAttribute('aria-label','받을 금액 상세');v.append(host);}
  host.hidden=false;const html=r?detailMarkup(r):overviewMarkup(all);
  if(html!==state.sig||!host.firstChild){host.innerHTML=html;state.sig=html;}
  fitQx(host);
 }
 // 펼친 줄은 보이는 칸 수만큼만 차지한다(폰·좁은 화면에서 숨긴 칸까지 걸치면 표의 칸 폭이 어긋난다).
 function fitQx(root){for(const td of root.querySelectorAll('tr.nd-qx>td')){const n=[...(td.parentElement.previousElementSibling?.children||[])].filter(c=>getComputedStyle(c).display!=='none').length;if(n&&td.colSpan!==n)td.colSpan=n;}}
 window.NaroFitQx=fitQx;
 const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{render();}catch(e){console.error(e);}});};
 const set=(id,val)=>{const el=document.getElementById(id);if(!el)return;el.value=val;el.dispatchEvent(new Event('change',{bubbles:true}));};
 // 입금 기록: 입금·출금 화면의 입력 창을 열고, 가장 오래된 견적과 그 남은 금액을 채운다.
 function pay(cid,qid){
  const sv=fn('switchView');if(sv&&sv('payments')===false)return;
  const open=fn('openPaymentEntry');if(open)open('수금');
  if(!cid)return;
  const r=companies().find(x=>x.cid===cid),first=r&&(r.opens.find(o=>o.q.id===qid)||pick(r));
  setTimeout(()=>{set('payCo',cid);setTimeout(()=>{
   const s=document.getElementById('payQuote');
   if(first&&s){if(![...s.options].some(o=>o.value===first.q.id)){const o=document.createElement('option');o.value=first.q.id;o.textContent=first.q.no||'견적';s.append(o);}set('payQuote',first.q.id);}
   const a=document.getElementById('payAmt');if(a)a.value=num(first?first.open:Math.max(0,r?.open||0));
  },0);},0);
 }
 function mount(){
  const v=document.getElementById('view-ar');if(!v)return;
  const f=document.getElementById('arFilter');if(f){for(const o of f.options){const t=o.value==='all'?'전체 거래처':'미수 거래처만';if(o.textContent!==t)o.textContent=t;}}
  v.addEventListener('click',ev=>{
   const b=ev.target.closest('[data-ap]');if(!b)return;
   switch(b.dataset.ap){
    case 'co':state.cid=b.dataset.id;state.quote=null;state.mobileOpen=true;state.sig='';render();if(!desk.matches)v.querySelector('.pp-back')?.scrollIntoView({block:'start'});break;
    case 'quote':state.cid=b.dataset.id;state.quote=b.dataset.q;state.mobileOpen=true;state.sig='';render();break;
    case 'overview':state.cid=null;state.quote=null;state.mobileOpen=true;state.sig='';render();break;
    case 'back':state.mobileOpen=false;if(desk.matches){state.cid=null;state.quote=null;}render();break;
    case 'mode':set('arView',b.dataset.mode);break;
    case 'pay':pay(b.dataset.id||state.cid,b.dataset.q);break;
    case 'qx':state.qx=state.qx===b.dataset.q?null:b.dataset.q;state.sig='';render();break;
    case 'payments':fn('switchView')?.('payments');break;
    case 'export':[...document.querySelectorAll('.nd-nav-act')].find(x=>x.textContent.includes('데이터 내보내기'))?.click();break;
    case 'company':if(state.cid&&fn('switchView')?.('companies')!==false){try{coSel=state.cid;}catch{}fn('renderCoList')?.();fn('renderCoDetail')?.();}break;
    case 'mon':{const k=b.dataset.ym,mo=state.mo||new Set(state.firstYm!=null?[state.firstYm]:[]);mo.has(k)?mo.delete(k):mo.add(k);state.mo=mo;state.sig='';render();break;}
    case 'qpv':if(globalThis.NaroQuotePreview?.(b.dataset.q))break;
    // falls through
    case 'doc':{const id=b.dataset.q;if(fn('switchView')?.('quotes')!==false){try{qtSel=id;}catch{}fn('renderQtList')?.();fn('renderQtDetail')?.();}break;}
   }
  });
  v.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('tr[data-ap="co"],tr[data-ap="qx"]')){ev.preventDefault();ev.target.click();}});
  v.addEventListener('change',schedule);v.addEventListener('input',schedule);
  document.addEventListener('change',e=>{if(e.target?.id==='arView'||e.target?.id==='arFilter'){state.sig='';schedule();}},true);
  new MutationObserver(schedule).observe(v,{childList:true,subtree:true});
  desk.addEventListener('change',schedule);addEventListener('resize',()=>{const h=v.querySelector(':scope>.pp-detail');if(h)fitQx(h);});schedule();
 }
 window.NaroArPanel={render:schedule,companies};
 window.NaroQuoteBrief=quoteBrief;window.NaroQuoteChevron=CHEV;
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
