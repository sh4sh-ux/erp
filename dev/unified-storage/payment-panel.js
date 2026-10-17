/* 입금·출금 화면(10/15 시안 확정 — UI-RULES 'Payments'). 입금·출금 = 돈이 실제로 오간 기록.
   기본 앱의 필터·입력 창·저장(addPayment·deletePayment)이 그대로 기준이고, 여기서는 보여 주기와
   '고치기'(새 기록 저장 → 원래 기록 지우기, 견적서 진행 탭과 같은 규칙)만 더한다. */
(()=>{
 const desk=matchMedia('(min-width:1024px)');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paymentLabel=s=>'<span class="nd-payment-label">'+esc(s).replace('입금·출금','입금<i class="nd-payment-dot">·</i>출금')+'</span>';
 const num=n=>Math.round(Number(n)||0).toLocaleString('ko-KR');
 /* 견적 고르기의 금액(UI-RULES 'Receivables'): 받을 금액 = 납품액 − 받은 돈(받을 금액 화면과 같은 기준), 견적 남은 = 견적 전체 − 받은 돈.
    둘이 다르면 둘 다 보여 주고, 금액 칸은 받을 금액으로 채운다. 아직 납품 전이면(선입금) 견적 남은 금액으로 채운다. */
 const owed=q=>{const bal=fn('quoteBalance'),del=fn('deliveredAmount'),paid=fn('quotePaid');const rest=Math.max(0,bal?bal(q):0);
  if(!del||!paid)return {fill:rest,note:'견적 남은 금액'};const d=del(q),ar=Math.max(0,d-paid(q.id));
  if(d<=0.5)return {fill:rest,note:'견적 남은 · 납품 전'};if(Math.abs(ar-rest)<0.5)return {fill:ar,note:'받을 금액'};
  return {fill:ar,note:`받을 금액 · 견적 남은 ${num(rest)}원`};};
 const won=n=>num(n)+'원';
 const state={id:null,mobileOpen:false,signature:'',listSig:'',mobileSig:'',editing:null,menu:false};
 let queued=false;
 const data=()=>{try{return db;}catch{return null;}};
 const value=id=>document.getElementById(id)?.value||'';
 const records=()=>[...document.querySelectorAll('#payTbl tbody tr .rm')].map(b=>b.dataset.id);
 const get=id=>(data()?.payments||[]).find(p=>p.id===id&&!p.void_at);
 const company=id=>(data()?.companies||[]).find(c=>c.id===id);
 const coName=id=>company(id)?.name||'거래처 없음';
 const isIn=p=>p.kind!=='지급';
 const kindWord=p=>p.refund?'환불':isIn(p)?'입금':'출금';
 const quoteOf=p=>p?.quote_id?(data()?.quotes||[]).find(q=>q.id===p.quote_id):null;
 const purchaseOf=p=>p?.purchase_id?window.NaroPurchases?.vendor?.(p.company_id)?.find(x=>x.id===p.purchase_id):null;
 const docNo=p=>quoteOf(p)?.no||purchaseOf(p)?.no||'';
 const fn=name=>{try{const f=globalThis[name];return typeof f==='function'?f:null;}catch{return null;}};
 const amountOf=q=>{const f=fn('quoteAmount');return f?Number(f(q))||0:0;};
 const paidOf=q=>(data()?.payments||[]).filter(p=>p.quote_id===q.id&&!p.void_at&&(p.kind==='수금'||(p.kind==='지급'&&p.refund))).reduce((s,p)=>s+(p.kind==='수금'?1:-1)*(Number(p.amount)||0),0);
 const WD='일월화수목금토';
 function dayLabel(d){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||'');if(!m)return d||'날짜 없음';const t=new Date(+m[1],+m[2]-1,+m[3]);return `${+m[2]}월 ${+m[3]}일 (${WD[t.getDay()]})`;}
 const short=d=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(d||'');return m?`${m[1]}.${m[2]}`:(d||'');};
 const period=()=>({mode:value('payPeriod'),month:value('payMonth'),from:value('payFrom'),to:value('payTo')});
 function inPeriod(p,c=period()){
  const date=String(p.date||'');
  if(c.mode==='month')return !!c.month&&date.startsWith(c.month);
  if(c.mode==='range')return !(c.from&&c.to&&c.from>c.to)&&(!c.from||date>=c.from)&&(!c.to||date<=c.to);
  return true;
 }
 function periodLabel(){
  const c=period();
  return c.mode==='month'?c.month.replace(/^(\d{4})-0?(\d{1,2})$/,'$1년 $2월'):c.mode==='range'?`${c.from||'처음'} – ${c.to||'현재'}`:'전체 기간';
 }
 const thisMonth=()=>{const f=fn('localMonth');return f?f():new Date().toISOString().slice(0,7);};
 // 기본(이번 달)이 아닌 기간일 때만 칩으로 보인다 — 늘 있던 '일자·건수·초기화' 줄은 없앴다.
 const periodChanged=()=>{const c=period();return !(c.mode==='month'&&c.month===thisMonth());};
 const kindNote=()=>value('payFilter')==='수금'?'입금만':value('payFilter')==='지급'?'출금만':'';
 const rowsOf=ids=>ids.map(get).filter(Boolean);
 const totals=rows=>rows.reduce((s,p)=>{s[isIn(p)?'in':'out']+=Number(p.amount)||0;s[isIn(p)?'nIn':'nOut']++;s.count++;return s;},{in:0,out:0,nIn:0,nOut:0,count:0});
 function history(p){
  const ids=new Set(records());
  return (data()?.payments||[]).filter(x=>!x.void_at&&(p?(p.company_id?x.company_id===p.company_id:x.id===p.id)&&inPeriod(x):ids.has(x.id)))
   .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
 }
 // 받을 돈 = 받을 금액 화면과 같은 계산 · 줄 돈 = 매입 화면의 '미출금'과 같은 계산
 function receivable(){const f=fn('arData');if(!f)return null;try{const open=f().filter(r=>r.open>0);return {sum:open.reduce((s,r)=>s+r.open,0),n:open.length};}catch{return null;}}
 function payable(){const list=window.NaroPurchases?.payables?.();if(!list)return null;return {sum:list.reduce((s,x)=>s+x.open,0),n:list.length};}
 const signedAmount=p=>`${isIn(p)?'+':'−'}${won(p.amount)}`;
 function listMarkup(ids){
  const rows=rowsOf(ids);if(!rows.length)return '<p class="pp-empty">이 기간에 입금·출금 기록이 없어요.</p>';
  const groups=new Map();for(const p of rows){const k=p.date||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  // 10/17: 기간이 두 달 이상이면 달이 바뀌는 곳에 '9월 · 입금 +○ · 출금 −○' 한 줄(목록은 그대로)
  const ymOf=d=>/^\d{4}-\d{2}/.exec(d||'')?.[0]||'',mons=new Map();for(const p of rows){const k=ymOf(p.date);const m=mons.get(k)||{in:0,out:0};isIn(p)?m.in+=Number(p.amount)||0:m.out+=Number(p.amount)||0;mons.set(k,m);}
  const ymLabel=ym=>{if(!ym)return '날짜 없음';const [y,m]=ym.split('-');return (y!==String(new Date().getFullYear())?`${y}년 `:'')+`${+m}월`;};
  let lastYm=null;const monHead=d=>{const k=ymOf(d);if(mons.size<2||k===lastYm)return '';lastYm=k;const m=mons.get(k);return `<div class="pp-mg"><b>${esc(ymLabel(k))}</b><span>${m.in?`<em class="in">입금 +${num(m.in)}</em>`:''}${m.in&&m.out?'<i>·</i>':''}${m.out?`<em>출금 −${num(m.out)}</em>`:''}</span></div>`;};
  return [...groups].map(([d,items])=>`${monHead(d)}<div class="pp-dg">${esc(dayLabel(d))}</div>${items.map(p=>{
   const meta=[docNo(p)||p.memo||'',p.method||''].filter(Boolean).join(' · ');
   return `<button type="button" class="pp-row${p.id===state.id?' on':''}" data-pp="record" data-id="${esc(p.id)}"${p.id===state.id?' aria-current="true"':''}><span class="pp-row-nm">${esc(coName(p.company_id))}</span><span class="pp-row-am${isIn(p)&&!p.refund?' in':''}">${signedAmount(p)}</span><span class="pp-row-mt"><b class="pp-badge ${isIn(p)?'in':'out'}">${kindWord(p)}</b>${esc(meta)}</span></button>`;}).join('')}`).join('');
 }
 const chipsMarkup=()=>periodChanged()?`<div class="pp-fchips"><button type="button" class="pp-fchip" data-pp="reset" aria-label="기간을 이번 달로">${esc(periodLabel())} <span aria-hidden="true">✕</span></button></div>`:'';
 const barMarkup=sum=>`<span class="pp-bar" aria-hidden="true">${sum.in||sum.out?`<span class="in" style="flex:${sum.in}"></span><span class="out" style="flex:${sum.out}"></span>`:''}</span>`;
 function flowMarkup(sum){
  const net=sum.in-sum.out;
  return `<section class="pp-metrics pp-flow" aria-label="기간 합계"><div><span><i class="pp-dot in"></i>입금 · ${sum.nIn}건</span><strong>${num(sum.in)}<small>원</small></strong></div><div><span><i class="pp-dot out"></i>출금 · ${sum.nOut}건</span><strong>${num(sum.out)}<small>원</small></strong></div><div><span>차액<em class="pp-hint"> (입금 − 출금)</em></span><strong class="${net<0?'neg':''}">${net<0?'−':''}${num(Math.abs(net))}<small>원</small></strong></div></section>${barMarkup(sum)}`;
 }
 function overviewMarkup(){
  const ids=records(),rows=rowsOf(ids),sum=totals(rows),net=sum.in-sum.out,ar=receivable(),ap=payable(),label=periodLabel();
  const todo=ar||ap?`<section class="pp-todo">${ar?`<button type="button" data-pp="ar"><span><small>받을 금액${ar.n?' · '+ar.n+'곳':''}</small><b>${ar.n?won(ar.sum):'없음'}</b></span><em>받을 금액</em></button>`:''}${ap?`<button type="button" data-pp="purchases"><span><small>지급할 금액${ap.n?' · '+ap.n+'건':''}</small><b>${ap.n?won(ap.sum):'없음'}</b></span><em>매입</em></button>`:''}</section>`:'';
  const table=rows.length?`<table class="pp-table"><thead><tr><th class="pp-c-date">날짜</th><th>거래처 · 연결</th><th class="pp-c-method">방법</th><th class="pp-c-num pp-c-io">입금</th><th class="pp-c-num pp-c-io">출금</th><th class="pp-c-num pp-c-amt">금액</th></tr></thead><tbody>${rows.map(p=>`<tr data-pp="record" data-id="${esc(p.id)}" tabindex="0"><td class="pp-c-date">${esc(short(p.date))}</td><td><span class="pp-t-nm">${esc(coName(p.company_id))}</span><small>${esc([p.refund?'환불':'',docNo(p)?(p.purchase_id?'매입 ':'견적 ')+docNo(p):'',p.memo||''].filter(Boolean).join(' · ')||'연결 없음')}</small></td><td class="pp-c-method">${esc(p.method||'—')}</td><td class="pp-c-num pp-c-io in">${isIn(p)?num(p.amount):''}</td><td class="pp-c-num pp-c-io">${isIn(p)?'':num(p.amount)}</td><td class="pp-c-num pp-c-amt${isIn(p)&&!p.refund?' in':''}">${isIn(p)?'+':'−'}${num(p.amount)}</td></tr>`).join('')}</tbody></table>`:'<div class="pp-empty">이 기간에 입금·출금 기록이 없어요.<br>아래 [＋ 입금·출금 기록]으로 시작하세요.</div>';
  return `<button type="button" class="pp-back" data-pp="back">‹ <span>${paymentLabel('입금·출금')}</span></button>
   <header class="pp-head"><div class="pp-title"><span class="pp-caption">입출금 현황</span><h3 title="${esc(label)}">${esc(label)}</h3></div><div class="pp-amount"><span>차액 · 입금 − 출금</span><strong class="${net<0?'neg':''}">${net<0?'−':''}${won(Math.abs(net))}</strong></div><div class="pp-meta">${sum.count}건${kindNote()?' · '+kindNote():''}</div></header>
   <div class="pp-body" id="pp-body">${flowMarkup(sum)}${todo}<div class="pp-section-head"><h4>${esc(label.replace(/^\d{4}년 /,''))} 내역 <small>${sum.count}건</small></h4></div>${table}<p class="pp-note">차액은 이 기간의 입금 − 출금이에요. 통장 잔액과는 달라요.</p></div>
   <div class="pp-abar"><button type="button" class="pp-btn" data-pp="export">내보내기</button><span class="pp-sp"></span><button type="button" class="pp-btn pp-primary" data-pp="add">입금·출금 기록</button></div>`;
 }
 function detailMarkup(p){
  const q=quoteOf(p),pu=purchaseOf(p),co=company(p.company_id),word=kindWord(p);
  let prog='',chip='',rest=0,list,title;
  if(q){
   const due=amountOf(q),paid=paidOf(q);rest=Math.max(0,due-paid);
   chip=due>0?(rest<=0.5?'<span class="pp-chip ok">입금 완료</span>':'<span class="pp-chip warn">일부 입금</span>'):'';
   prog=due>0?`<section class="pp-prog"><div><span>받을 금액 ${won(due)} 중</span><b>${rest<=0.5?'입금 완료':'남은 금액 '+won(rest)}</b></div><div class="pp-pbar"><span style="width:${Math.min(100,Math.max(0,paid/due*100)).toFixed(1)}%"></span></div></section>`:'';
   list=(data()?.payments||[]).filter(x=>x.quote_id===q.id&&!x.void_at);title='이 견적의 입금·환불';
  }else if(p.purchase_id){list=(data()?.payments||[]).filter(x=>x.purchase_id===p.purchase_id&&!x.void_at);title='이 매입의 출금';}
  else{list=history(p);title=`이 거래처의 입출금 · ${periodLabel()}`;}
  list=list.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.created_at||'').localeCompare(String(b.created_at||'')));
  const docBtn=q?`<button type="button" class="pp-link" data-pp="doc">${esc(q.no||'견적서')}</button>`:pu?`<button type="button" class="pp-link" data-pp="doc">${esc(pu.no||'매입')}</button>`:'';
  const created=String(p.created_at||'').slice(0,10);
  const docLink=q?'<button type="button" data-pp="doc">견적서 열기</button>':p.purchase_id?'<button type="button" data-pp="doc">매입 열기</button>':'';
  return `<button type="button" class="pp-back" data-pp="back">‹ <span>${paymentLabel('입금·출금')}</span></button>
   <header class="pp-head"><div class="pp-title"><span class="pp-caption">${word}</span><h3 title="${esc(co?.name||'거래처 없음')}">${esc(co?.name||'거래처 없음')}</h3></div><div class="pp-amount"><span>${word}액</span><strong>${won(p.amount)}</strong></div><div class="pp-meta">${docBtn}<span>${esc(p.date||'날짜 없음')}</span><span>${esc(p.method||'방법 미기록')}</span>${chip}</div></header>
   <div class="pp-body" id="pp-body">${prog}
    <div class="pp-section-head"><h4>${esc(title)} <small>${list.length}건</small></h4>${docLink}</div>
    <table class="pp-table pp-table-rec"><thead><tr><th class="pp-c-date">날짜</th><th>내용</th><th class="pp-c-method">방법</th><th class="pp-c-num">금액</th></tr></thead><tbody>${list.map(x=>`<tr data-pp="record" data-id="${esc(x.id)}" tabindex="0"${x.id===p.id?' class="on" aria-current="true"':''}><td class="pp-c-date">${esc(short(x.date))}</td><td><span class="pp-t-nm">${esc(x.memo||kindWord(x))}</span>${!q&&!p.purchase_id?`<small>${esc(kindWord(x))}${docNo(x)?' · '+esc(docNo(x)):''}</small>`:''}</td><td class="pp-c-method">${esc(x.method||'—')}</td><td class="pp-c-num${isIn(x)&&!x.refund?' in':''}">${isIn(x)?'':'−'}${num(x.amount)}</td></tr>`).join('')}</tbody></table>
    <dl class="pp-kv"><dt>메모</dt><dd>${esc(p.memo||'메모 없음')}</dd><dt>거래처</dt><dd>${co?`<button type="button" class="pp-link" data-pp="company">${esc(co.name)}</button>`:'거래처 없음'}</dd><dt>기록</dt><dd>${created?esc(created)+' 기록':'기록일 없음'}</dd></dl>
   </div>
   <div class="pp-abar"><button type="button" class="pp-btn pp-del" data-pp="delete">삭제</button><button type="button" class="pp-btn" data-pp="edit">수정</button><span class="pp-sp"></span>${q&&rest>0.5&&!p.refund?`<button type="button" class="pp-btn pp-primary" data-pp="rest">남은 ${won(rest)} 입금 기록</button>`:'<button type="button" class="pp-btn pp-primary" data-pp="add">입금·출금 기록</button>'}</div>`;
 }
 const markup=p=>p?detailMarkup(p):overviewMarkup();
 function syncLeft(left,ids){
  if(!left)return;
  const select=document.getElementById('payFilter');
  let tabs=left.querySelector(':scope>.nd-chips');
  if(select&&!tabs){
   tabs=document.createElement('div');tabs.className='nd-chips pp-kind-tabs';
   tabs.setAttribute('role','group');tabs.setAttribute('aria-label','입출금 구분');
   for(const [v,label] of [['','전체'],['수금','입금'],['지급','출금']]){
    const b=document.createElement('button');b.type='button';b.dataset.v=v;b.textContent=label;
    b.onclick=()=>{select.value=v;select.dispatchEvent(new Event('change',{bubbles:true}));};tabs.append(b);
   }
   left.insertBefore(tabs,left.querySelector('.panel-b-index'));
  }
  if(tabs&&select)for(const b of tabs.querySelectorAll('button')){const pressed=String(b.dataset.v===select.value);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);}
  left.querySelectorAll(':scope>.pp-list-scope,:scope>.pp-overview').forEach(x=>x.remove());
  let list=left.querySelector(':scope>.pp-list');
  if(!list){list=document.createElement('div');list.className='pp-list';list.setAttribute('aria-label','입출금 기록');left.append(list);}
  const html=chipsMarkup()+listMarkup(ids);
  if(html!==state.listSig||!list.firstChild){list.innerHTML=html;state.listSig=html;}
 }
 // 제목 옆 건수(견적서와 같은 자리)
 function syncCount(v,ids){
  const head=v.querySelector(':scope>.page-head'),h2=head?.querySelector('h2');if(!h2)return;
  let c=head.querySelector(':scope>.pp-count');if(!c){c=document.createElement('span');c.className='count pp-count';h2.after(c);}
  const t=ids.length+'건';if(c.textContent!==t)c.textContent=t;
 }
 function mobileList(v,ids){
  let list=v.querySelector(':scope>.pp-mobile-list');
  if(!list){list=document.createElement('div');list.className='pp-mobile-list';v.append(list);}
  const sum=totals(rowsOf(ids)),net=sum.in-sum.out;
  const html=`<button type="button" class="pp-msum" data-pp="overview"><span class="pp-msum-top"><small>${esc(periodLabel())} 차액 (입금 − 출금)</small><b class="${net<0?'neg':''}">${net<0?'−':''}${won(Math.abs(net))}</b></span>${barMarkup(sum)}<span class="pp-msum-io"><small>입금 ${num(sum.in)}</small><small>출금 ${num(sum.out)}</small></span></button><div class="pp-kind-tabs" role="group" aria-label="입출금 구분">${[['','전체'],['수금','입금'],['지급','출금']].map(([k,t])=>`<button type="button" data-pp="kind" data-kind="${k}" aria-pressed="${value('payFilter')===k}">${t}</button>`).join('')}</div><div class="pp-list">${chipsMarkup()}${listMarkup(ids)}</div>`;
  if(html!==state.mobileSig||!list.firstChild){list.innerHTML=html;state.mobileSig=html;}
 }
 function show(id){
  const v=document.getElementById('view-payments');
  if(!v||!get(id)||!records().includes(id)||document.getElementById('payEntry')?.open)return false;
  state.id=id;state.mobileOpen=true;state.menu=false;render();if(!desk.matches)v.querySelector('.pp-back')?.scrollIntoView({block:'start'});return true;
 }
 function render(){
  const v=document.getElementById('view-payments');if(!v)return;
  const ids=records();if(state.id&&!ids.includes(state.id)){state.id=null;state.signature='';state.menu=false;}
  const entryOpen=!!document.getElementById('payEntry')?.open,inDlg=deskDialog(),docked=entryOpen&&!inDlg;
  v.classList.toggle('pp-entry-open',docked);
  syncCount(v,ids);
  if(!desk.matches)mobileList(v,ids);
  syncLeft(v.querySelector('.workspace-left'),ids);
  syncEntry();
  const p=get(state.id);
  let host=v.querySelector(':scope>.pp-detail');
  const active=(desk.matches?v.classList.contains('workspace-split'):state.mobileOpen)&&!docked;
  v.classList.toggle('pp-detail-open',active);v.classList.toggle('mobile-record-open',active&&!desk.matches);
  if(!active){if(host)host.hidden=true;return;}
  if(!host){host=document.createElement('section');host.className='pp-detail';host.setAttribute('aria-label','입출금 상세');v.append(host);}
  host.hidden=false;const html=markup(p);
  if(html!==state.signature||!host.firstChild){
   const same=host.dataset.for===(p?.id||''),top=host.querySelector('.pp-body')?.scrollTop||0;
   host.innerHTML=html;host.dataset.for=p?.id||'';if(same){const b=host.querySelector('.pp-body');if(b)b.scrollTop=top;}state.signature=html;
  }
  v.querySelectorAll('#payTbl tbody tr').forEach(r=>r.classList.toggle('panel-b-selected',!!p&&r.querySelector('.rm')?.dataset.id===state.id));
 }
 // 10/17: PC 입력 = 재고 입력처럼 지금 화면 위의 창(폰은 naro-design.js의 아래 창). 원래 입력 칸(#payEntry)을 창으로 옮겼다가 닫으면 제자리로 — 저장·확인 처리는 원래 것 그대로.
 let dlg=null,home=null;
 function deskDialog(){
  const v=document.getElementById('view-payments'),entry=document.getElementById('payEntry');if(!v||!entry)return false;
  if(!dlg){dlg=document.createElement('dialog');dlg.className='pp-entry-dlg';dlg.setAttribute('aria-label','입금·출금 기록');v.append(dlg);
   const close=()=>document.getElementById('payClose')?.click();
   dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
   dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
   dlg.addEventListener('close',()=>{if(home){home.replaceWith(entry);home=null;}if(entry.open)entry.open=false;schedule();});}
  if(desk.matches&&entry.open&&!dlg.open){home=document.createComment('pp-entry-home');entry.before(home);dlg.append(entry);dlg.showModal();setTimeout(()=>document.getElementById('payCo')?.focus(),0);}
  else if((!entry.open||!desk.matches)&&dlg.open)dlg.close();
  return dlg.open;
 }
 const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});};
 // ---------- 입력 창: 거래처를 고르면 남은 금액이 있는 견적이 뜨고, 누르면 금액이 채워진다 ----------
 const set=(id,v)=>{const el=document.getElementById(id);if(!el)return;el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
 function syncEntry(){
  const entry=document.getElementById('payEntry');if(!entry)return;
  if(!entry.open&&state.editing)state.editing=null;
  const co=entry.querySelector('.pf-co'),kind=value('payKind'),cid=value('payCo');
  const open=fn('openQuotesOf'),bal=fn('quoteBalance');
  let qs=[];try{qs=entry.open&&kind==='수금'&&cid&&open&&bal?open(cid):[];}catch{qs=[];}
  let pick=entry.querySelector('.pp-qpick');
  entry.classList.toggle('pp-has-pick',!!qs.length);
  if(!qs.length)pick?.remove();
  else if(co){
   if(!pick){pick=document.createElement('div');pick.className='pp-qpick';pick.setAttribute('role','group');pick.setAttribute('aria-label','어느 견적의 입금인가요?');co.after(pick);}
   const cur=value('payQuote');
   const html=`<span class="pp-qpick-k">연결할 견적 · 잔액이 있는 견적</span>${qs.map(q=>{const m=owed(q);return `<button type="button" data-pq="${esc(q.id)}" aria-pressed="${q.id===cur}"><span>${esc(q.no||'견적')}<small>${esc(short(q.date))} · ${esc(q.status||'')}</small></span><span class="pp-qpick-am"><b>${won(m.fill)}</b><small>${esc(m.note)}</small></span></button>`;}).join('')}<button type="button" data-pq="" aria-pressed="${!cur}"><span>건 지정 안 함<small>선입금·기타</small></span></button>`;
   if(pick.innerHTML!==html)pick.innerHTML=html;
  }
  // 창 제목 · 버튼 글자(재고 입력과 같게): 입금 기록 / 출금 기록 / 입금 기록 수정, [닫기]
  {const k=value('payKind')==='지급'?'출금':'입금',tt=state.editing?`${k} 기록 수정`:`${k} 기록`,add=entry.querySelector('.pay-add');
   let et=entry.querySelector('.pp-et');if(add&&!et){et=document.createElement('h3');et.className='pp-et';add.prepend(et);}
   if(et&&et.textContent!==tt)et.textContent=tt;
   const ph=document.getElementById('ndPayEntryTitle');if(ph&&ph.textContent!==tt)ph.textContent=tt;
   const cb=document.getElementById('payClose');if(cb&&cb.textContent!=='닫기')cb.textContent='닫기';}
  const head=document.querySelector('#view-payments>.workspace-heading');
  if(head&&entry.open){const cap=head.querySelector('.workspace-caption'),h=head.querySelector('h3'),k=value('payKind')==='지급'?'출금':'입금';const ct='입금·출금',ht=state.editing?`${k} 기록 수정`:`새 ${k} 기록`;if(cap&&cap.textContent!==ct)cap.textContent=ct;if(h&&h.textContent!==ht)h.textContent=ht;}
  let note=entry.querySelector('.pp-edit-note');const orig=state.editing&&(data()?.payments||[]).find(x=>x.id===state.editing);
  if(orig){if(!note){note=document.createElement('p');note.className='pp-edit-note';(entry.querySelector('.pay-add')||entry).prepend(note);}const t=`수정 중 · 원래 기록(${short(orig.date)} · ${won(orig.amount)})은 저장하면 새 기록으로 바뀌어요.`;if(note.textContent!==t)note.textContent=t;}
  else note?.remove();
 }
 function openEntry(kind,fill={}){
  const f=fn('openPaymentEntry');if(f)f(kind);else{const e=document.getElementById('payEntry');if(e)e.open=true;set('payKind',kind);}
  setTimeout(()=>{
   if(fill.company_id)set('payCo',fill.company_id);
   if(fill.quote_id!==undefined){
    const s=document.getElementById('payQuote');
    if(s&&fill.quote_id&&![...s.options].some(o=>o.value===fill.quote_id)){const q=(data()?.quotes||[]).find(x=>x.id===fill.quote_id);if(q){const o=document.createElement('option');o.value=q.id;o.textContent=q.no||'견적';s.append(o);}}
    set('payQuote',fill.quote_id||'');
   }
   if(fill.date){const d=document.getElementById('payDate');if(d)d.value=fill.date;}
   if(fill.method)set('payMethod',fill.method);
   if(fill.amount!==undefined){const a=document.getElementById('payAmt');if(a)a.value=fill.amount?num(fill.amount):'';}
   if(fill.memo!==undefined){const m=document.getElementById('payMemo');if(m)m.value=fill.memo||'';}
   syncEntry();
  },0);
 }
 async function addLinked(o){
  const date=value('payDate'),method=value('payMethod'),memo=value('payMemo').trim(),amount=Math.round(Number(value('payAmt').replace(/[^\d]/g,''))||0),save=fn('saveTable');
  if(!date){fn('toast')?.('날짜를 선택하세요');return;}
  if(amount<=0){fn('toast')?.('금액을 입력하세요');return;}
  const row={id:crypto.randomUUID(),date,company_id:o.company_id,quote_id:null,kind:o.kind,method,amount,memo,created_at:new Date().toISOString(),purchase_id:o.purchase_id,client_ref:'edit_'+crypto.randomUUID().slice(0,12),
   ...(o.refund?{refund:true}:{}),...(o.amount_fx?{currency:o.currency,amount_fx:o.amount_fx,fx_rate:Math.round(amount/o.amount_fx*10000)/10000}:{})};
  const next=[...db.payments,row];if(!save||!await save('payments',next))return;db.payments=next;
 }
 // 고치기: 새 기록이 저장된 뒤에 원래 기록을 지운다(저장소는 기록 수정을 받지 않고 추가·삭제만 받는다 — 견적서 진행 탭과 같음).
 function wrapAdd(){
  const base=fn('addPayment');if(!base||base.ndPayEdit)return;
  const wrapped=async function(){
   const before=new Set((data()?.payments||[]).map(p=>p.id)),orig=state.editing,o=orig&&get(orig);
   // 매입에 연결된 출금을 수정하면 연결(purchase_id)·외화 금액·환불 표시를 그대로 옮긴다 — 기본 저장은 이 칸들을 모른다(전엔 매입이 다시 미지급으로 보였다)
   const r=o?.purchase_id&&value('payCo')===o.company_id?await addLinked(o):await base.apply(this,arguments);
   const added=(data()?.payments||[]).find(p=>!before.has(p.id));
   if(added&&orig&&(data()?.payments||[]).some(p=>p.id===orig)){
    state.editing=null;const next=db.payments.filter(p=>p.id!==orig),save=fn('saveTable');
    if(save&&await save('payments',next)){db.payments=next;state.id=added.id;const e=document.getElementById('payEntry');if(e)e.open=false;fn('renderPay')?.();fn('toast')?.('입금·출금 기록을 고쳤어요');}
    else fn('toast')?.('새 기록은 저장했지만 원래 기록을 지우지 못했어요. 원래 기록을 골라 삭제해 주세요.');
   }else if(added)state.id=added.id;
   schedule();return r;
  };
  wrapped.ndPayEdit=true;globalThis.addPayment=wrapped;
 }
 function mount(){
  const v=document.getElementById('view-payments');if(!v)return;
  wrapAdd();
  v.addEventListener('click',ev=>{
   const pq=ev.target.closest('[data-pq]');
   if(pq){const id=pq.dataset.pq;set('payQuote',id);const q=(data()?.quotes||[]).find(x=>x.id===id),bal=fn('quoteBalance'),a=document.getElementById('payAmt');if(a&&q&&bal)a.value=num(owed(q).fill);syncEntry();return;}
   const b=ev.target.closest('[data-pp]');if(!b)return;const p=get(state.id);
   if(b.dataset.pp!=='menu'&&state.menu)state.menu=false;
   switch(b.dataset.pp){
    case 'record':show(b.dataset.id);break;
    case 'kind':{const s=document.getElementById('payFilter');s.value=b.dataset.kind;s.dispatchEvent(new Event('change',{bubbles:true}));break;}
    case 'reset':state.id=null;document.getElementById('payClear')?.click();break;
    case 'overview':state.id=null;state.mobileOpen=true;render();break;
    case 'back':state.mobileOpen=false;render();break;
    case 'menu':state.menu=!state.menu;state.signature='';render();break;
    case 'delete':if(p&&fn('deletePayment'))deletePayment(p.id);break;
    case 'edit':if(p){state.editing=p.id;openEntry(p.kind==='지급'?'지급':'수금',{company_id:p.company_id,quote_id:p.quote_id||'',date:p.date,method:p.method,amount:p.amount,memo:p.memo});}break;
    case 'rest':{const q=quoteOf(p);if(q)openEntry('수금',{company_id:q.company_id,quote_id:q.id,amount:Math.max(0,amountOf(q)-paidOf(q))});break;}
    case 'add':openEntry('수금');break;
    case 'export':[...document.querySelectorAll('.nd-nav-act')].find(x=>x.textContent.includes('데이터 내보내기'))?.click();break;
    case 'ar':fn('switchView')?.('ar');break;
    case 'purchases':fn('switchView')?.('purchases');break;
    case 'doc':{
     const q=quoteOf(p);
     if(q){if(fn('switchView')?.('quotes')!==false){qtSel=q.id;fn('renderQtList')?.();fn('renderQtDetail')?.();}}
     else if(p?.purchase_id&&fn('switchView')?.('purchases')!==false)window.NaroPurchases?.open?.(p.purchase_id);
     break;
    }
    case 'company':if(p&&fn('switchView')?.('companies')!==false){coSel=p.company_id;fn('renderCoList')?.();fn('renderCoDetail')?.();}break;
   }
  });
  v.addEventListener('keydown',ev=>{
   if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('tr[data-pp="record"]')){ev.preventDefault();show(ev.target.dataset.id);}
   if(ev.key==='Escape'&&state.menu){state.menu=false;state.signature='';render();}
  });
  document.addEventListener('click',ev=>{if(state.menu&&!ev.target.closest?.('.pp-menu-host')){state.menu=false;state.signature='';schedule();}});
  v.addEventListener('change',schedule);v.addEventListener('input',schedule);
  document.addEventListener('change',e=>{
   if(e.target.matches?.('.nd-pay-filter #payFrom,.nd-pay-filter #payTo'))document.getElementById('payPeriod').value='range';
   if(e.target.matches?.('#payKind,#payCo,#payQuote'))schedule();
  },true);
  document.addEventListener('click',()=>queueMicrotask(()=>{
   syncFilterDates();
   const h=document.querySelector('.nd-pay-filter .nd-pop-hd');
   if(h&&!h.querySelector('.pp-pop-close')){const b=document.createElement('button');b.type='button';b.className='pp-pop-close';b.setAttribute('aria-label',h.textContent==='필터'?'필터 닫기':'메뉴 닫기');b.textContent='×';b.onclick=()=>window.NaroPop?.close();h.append(b);}
  }));
  document.getElementById('payEntry')?.addEventListener('toggle',schedule);
  new MutationObserver(schedule).observe(v,{childList:true,subtree:true});
  desk.addEventListener('change',schedule);schedule();
 }
 function syncFilterDates(){
  const pop=document.querySelector('.nd-pay-filter');if(!pop?.querySelector('#payFrom'))return;
  const c=period();if(c.mode==='range')return;
  let from='',to='';
  if(c.mode==='month'&&/^\d{4}-\d{2}$/.test(c.month)){
   const [y,m]=c.month.split('-').map(Number);from=c.month+'-01';to=c.month+'-'+new Date(y,m,0).getDate();
  }
  for(const [id,v] of [['payFrom',from],['payTo',to]]){const input=document.getElementById(id);if(input&&input.value!==v){input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));}}
 }
 window.NaroPaymentPanel={open:show};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
