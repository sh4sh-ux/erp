/* Read-only presentation. Native filters, entry and confirmed deletion remain
   authoritative; no persistence or accounting calculation changes. */
(()=>{
 const desk=matchMedia('(min-width:1024px)');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const won=n=>Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
 const signed=n=>(n>0?'+':n<0?'−':'')+won(Math.abs(n));
 const company=p=>(data()?.companies||[]).find(c=>c.id===p?.company_id)?.name||'거래처 없음';
 const kindTitle=()=>value('payFilter')==='수금'?'전체 입금':value('payFilter')==='지급'?'전체 출금':'전체 입금·출금';
 const state={id:null,mobileOpen:false,signature:''};
 let queued=false;
 const data=()=>{try{return db;}catch{return null;}};
 const value=id=>document.getElementById(id)?.value||'';
 const records=()=>[...document.querySelectorAll('#payTbl tbody tr .rm')].map(b=>b.dataset.id);
 const get=id=>(data()?.payments||[]).find(p=>p.id===id&&!p.void_at);
 // Header tools are installed once, but the responsive left panel is recreated.
 // Restore its native-select tabs on every mount, without cloning form controls.
 function syncLeft(left,index,ids){
  if(!left||!index)return;
  const select=document.getElementById('payFilter');
  let tabs=left.querySelector(':scope>.nd-chips');
  if(select&&!tabs){
   tabs=document.createElement('div');tabs.className='nd-chips pp-kind-tabs';
   tabs.setAttribute('role','group');tabs.setAttribute('aria-label','입출금 구분');
   for(const [value,label] of [['','전체'],['수금','입금'],['지급','출금']]){
    const b=document.createElement('button');b.type='button';b.dataset.v=value;b.textContent=label;
    b.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};tabs.append(b);
   }
   left.insertBefore(tabs,left.querySelector('.pp-overview')||index);
  }
  if(tabs&&select)for(const b of tabs.querySelectorAll('button')){
   const pressed=String(b.dataset.v===select.value);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);
  }
  let scope=left.querySelector('.pp-list-scope');
  if(!scope){scope=document.createElement('div');scope.className='pp-list-scope';(tabs||index).after(scope);}
  const scopeHTML=`<span>${esc(periodLabel())} · ${ids.length}건</span><button type="button" data-pp="reset">초기화</button>`;
  if(scope.innerHTML!==scopeHTML)scope.innerHTML=scopeHTML;
  index.querySelectorAll('button').forEach((b,i)=>{
   const p=get(ids[i]);if(!p)return;
   const amount=b.querySelector('.pbr-amt'),sub=b.querySelector('.pbr-sub');
   if(amount&&amount.textContent!==won(p.amount))amount.textContent=won(p.amount);
   const text=[p.date,p.kind==='지급'?'출금':'입금',p.method].filter(Boolean).join(' · ');
   if(sub&&sub.textContent!==text)sub.textContent=text;
  });
 }
 const period=()=>({mode:value('payPeriod'),month:value('payMonth'),from:value('payFrom'),to:value('payTo')});
 function inPeriod(p,c=period()){
  const date=String(p.date||'');
  if(c.mode==='month')return !!c.month&&date.startsWith(c.month);
  if(c.mode==='range')return !(c.from&&c.to&&c.from>c.to)&&(!c.from||date>=c.from)&&(!c.to||date<=c.to);
  return true;
 }
 function periodLabel(){
  const c=period();
  return c.mode==='month'?c.month.replace('-','년 ')+'월':c.mode==='range'?`${c.from||'처음'} – ${c.to||'현재'}`:'전체 기간';
 }
 function history(p){
  const ids=new Set(records());
  return (data()?.payments||[]).filter(x=>!x.void_at&&(p?(p.company_id?x.company_id===p.company_id:x.id===p.id)&&inPeriod(x):ids.has(x.id)))
   .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
 }
 const totals=rows=>rows.reduce((s,p)=>{s[p.kind==='지급'?'out':'in']+=Number(p.amount)||0;s.count++;return s;},{in:0,out:0,count:0});
 function documentNo(p){
  if(p.purchase_id)return window.NaroPurchases?.vendor(p.company_id)?.find(q=>q.id===p.purchase_id)?.no||'';
  return (data()?.quotes||[]).find(q=>q.id===p.quote_id&&(!q.company_id||q.company_id===p.company_id))?.no||'';
 }
 function markup(p){
  const rows=history(p),sum=totals(rows),co=(data()?.companies||[]).find(c=>c.id===p?.company_id);
  const title=p?co?.name||'거래처 없음':kindTitle();
  const groups=new Map();for(const row of rows){const day=row.date||'날짜 없음';if(!groups.has(day))groups.set(day,[]);groups.get(day).push(row);}
  const metric=(label,n,count)=>`<div><span>${label}<small>${count}건</small></span><strong>${Math.round(n).toLocaleString('ko-KR')}<small>원</small></strong></div>`;
  return `<button type="button" class="pp-back" data-pp="back">‹ <span>입금·출금</span></button>
   <header class="pp-head"><div class="pp-title"><span class="pp-caption">${p?'거래처':'입출금 현황'}</span><h3 title="${esc(title)}">${esc(title)}</h3></div><div class="pp-amount"><span>차액 · 입금 − 출금</span><strong>${signed(sum.in-sum.out)}</strong></div><div class="pp-meta">${esc(periodLabel())} · ${p?'거래처 기록':'조회된 기록'}</div></header>
   <div class="pp-body" id="pp-body"><section class="pp-metrics" aria-label="조회 결과 합계">${metric('입금 합계',sum.in,rows.filter(x=>x.kind!=='지급').length)}${metric('출금 합계',sum.out,rows.filter(x=>x.kind==='지급').length)}</section>
   <div class="pp-section-head"><h4>${p?'거래처 입출금 내역':'입출금 내역'} <small>${sum.count}건</small></h4>${p?'<button type="button" data-pp="overview">전체 내역</button>':''}</div>
   <div class="pp-columns" aria-hidden="true"><span>거래 내용</span><span>결제수단</span><span>금액</span></div>
   ${[...groups].map(([date,items])=>`<section class="pp-day"><div class="pp-day-head"><span>${esc(date)}</span><span>${items.length}건</span></div><ol class="pp-records">${items.map(x=>{
    const incoming=x.kind!=='지급',name=p?`${x.refund?'환불 ':''}${incoming?'입금':'출금'}`:(data()?.companies||[]).find(c=>c.id===x.company_id)?.name||'거래처 없음';
    const doc=documentNo(x),type=(x.refund?'환불 ':'')+(incoming?'입금':'출금');
    return `<li><details class="pp-record${x.id===p?.id?' pp-selected-record':''}" data-record="${esc(x.id)}"${x.id===p?.id?' aria-current="true"':''}><summary><div class="pp-record-name"><span>${esc(name)}</span><small>${!p?`<b class="pp-badge ${incoming?'in':'out'}">${type}</b>`:''}<span class="pp-inline-method">${esc(x.method||'미기록')}</span><span class="pp-preview">${esc(x.memo||doc||'')}</span></small></div><span class="pp-method">${esc(x.method||'미기록')}</span><strong>${won(x.amount)}<i class="pp-chevron" aria-hidden="true"></i></strong></summary><dl class="pp-record-more"><dt>거래일</dt><dd>${esc(x.date||'미기록')}</dd><dt>구분</dt><dd>${type} · ${esc(x.method||'결제수단 미기록')}</dd>${doc?`<dt>문서번호</dt><dd>${esc(doc)}</dd>`:''}<dt>메모</dt><dd>${esc(x.memo||'메모 없음')}</dd><dt>기록 관리</dt><dd><button type="button" class="pp-record-delete" data-pp="delete-record" data-id="${esc(x.id)}">이 기록 삭제</button></dd></dl></details></li>`;
   }).join('')}</ol></section>`).join('')||'<div class="pp-empty">표시할 입출금 기록이 없습니다.</div>'}
   <p class="pp-note">${p?'선택 기간의 거래처 입금·출금을 모두 표시합니다. ':''}차액은 통장 잔액과 다릅니다.</p>${co?'<button type="button" class="pp-company-link" data-pp="company">거래처 보기 ›</button>':''}</div>`;
 }
 function mobileList(v,ids){
  let list=v.querySelector(':scope>.pp-mobile-list');
  if(!list){list=document.createElement('div');list.className='pp-mobile-list';v.append(list);}
  const sum=totals(history(null));
  const html=`<div class="pp-kind-tabs" role="group" aria-label="입출금 구분">${[['','전체'],['수금','입금'],['지급','출금']].map(([k,t])=>`<button type="button" data-pp="kind" data-kind="${k}" aria-pressed="${value('payFilter')===k}">${t}</button>`).join('')}</div><div class="pp-list-scope"><span>${esc(periodLabel())} · ${ids.length}건</span><button type="button" data-pp="reset">초기화</button></div><button type="button" class="pp-mobile-row" data-pp="overview"><span><b>${kindTitle()}</b><strong>${signed(sum.in-sum.out)}</strong></span><small>조회 합계 · 입금 − 출금</small></button>${ids.map(id=>{const p=get(id);return p?`<button type="button" class="pp-mobile-row" data-pp="record" data-id="${esc(id)}"><span><b>${esc(company(p))}</b><strong>${won(p.amount)}</strong></span><small>${esc(p.date)} · <em class="pp-badge ${p.kind==='지급'?'out':'in'}">${p.kind==='지급'?'출금':'입금'}</em> · ${esc(p.method||'미기록')}</small></button>`:'';}).join('')||'<p class="pp-empty">표시할 입출금 기록이 없습니다.</p>'}`;
  if(list.innerHTML!==html)list.innerHTML=html;
 }
 function show(id){
  const v=document.getElementById('view-payments');
  if(!v||!get(id)||!records().includes(id)||document.getElementById('payEntry')?.open)return false;
  state.id=id;state.mobileOpen=true;render();if(!desk.matches)v.querySelector('.pp-back')?.scrollIntoView({block:'start'});return true;
 }
 function render(){
  const v=document.getElementById('view-payments');if(!v)return;
  const ids=records();if(state.id&&!ids.includes(state.id)){state.id=null;state.signature='';}
  v.classList.toggle('pp-entry-open',!!document.getElementById('payEntry')?.open);
  if(!desk.matches)mobileList(v,ids);
  const p=get(state.id),left=v.querySelector('.workspace-left'),index=left?.querySelector('.panel-b-index');
  syncLeft(left,index,ids);
  let all=left?.querySelector('.pp-overview');
  if(index&&!all){all=document.createElement('button');all.type='button';all.className='pp-overview';all.dataset.pp='overview';index.before(all);}
  if(all){const sum=totals(history(null)),html=`<span>${kindTitle()} <strong>${signed(sum.in-sum.out)}</strong></span><small>조회 합계 · 입금 − 출금</small>`;if(all.innerHTML!==html)all.innerHTML=html;all.classList.toggle('on',!p);}
  let host=v.querySelector(':scope>.pp-detail');
  const active=(desk.matches?v.classList.contains('workspace-split'):state.mobileOpen)&&!document.getElementById('payEntry')?.open;
  v.classList.toggle('pp-detail-open',active);v.classList.toggle('mobile-record-open',active&&!desk.matches);
  if(!active){if(host)host.hidden=true;return;}
  if(!host){host=document.createElement('section');host.className='pp-detail';host.setAttribute('aria-label','입출금 상세 내역');v.append(host);}
  host.hidden=false;const html=markup(p);
  if(html!==state.signature||!host.firstChild){const expanded=[...host.querySelectorAll('details[open]')].map(x=>x.dataset.record);host.innerHTML=html;host.querySelectorAll('details').forEach(x=>{x.open=expanded.includes(x.dataset.record);});state.signature=html;}
  v.querySelectorAll('#payTbl tbody tr').forEach(r=>r.classList.toggle('panel-b-selected',!!p&&r.querySelector('.rm')?.dataset.id===state.id));
  v.querySelectorAll('.panel-b-index button').forEach((b,i)=>{const selected=!!p&&ids[i]===state.id;b.classList.toggle('on',selected);if(selected)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
 }
 const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});};
 function syncFilterDates(){
  const pop=document.querySelector('.nd-pay-filter');if(!pop?.querySelector('#payFrom'))return;
  const c=period();if(c.mode==='range')return;
  let from='',to='';
  if(c.mode==='month'&&/^\d{4}-\d{2}$/.test(c.month)){
   const [y,m]=c.month.split('-').map(Number);from=c.month+'-01';to=c.month+'-'+new Date(y,m,0).getDate();
  }
  for(const [id,v] of [['payFrom',from],['payTo',to]]){const input=document.getElementById(id);if(input&&input.value!==v){input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));}}
 }
 function mount(){
  const v=document.getElementById('view-payments');if(!v)return;
  v.addEventListener('click',ev=>{
   const b=ev.target.closest('[data-pp]');if(!b)return;const p=get(state.id);
   switch(b.dataset.pp){
    case 'record':show(b.dataset.id);break;
    case 'kind':{const s=document.getElementById('payFilter');s.value=b.dataset.kind;s.dispatchEvent(new Event('change',{bubbles:true}));break;}
    case 'reset':state.id=null;document.getElementById('payClear')?.click();break;
    case 'delete-record':if(get(b.dataset.id)&&typeof deletePayment==='function')deletePayment(b.dataset.id);break;
    case 'overview':state.id=null;state.mobileOpen=true;render();break;
    case 'back':state.mobileOpen=false;render();break;
    case 'company':if(p&&typeof switchView==='function'&&switchView('companies')!==false){coSel=p.company_id;renderCoList();renderCoDetail();}break;
    case 'delete':if(p&&typeof deletePayment==='function')deletePayment(p.id);break;
   }
  });
  v.addEventListener('change',schedule);v.addEventListener('input',schedule);
  document.addEventListener('change',e=>{
   if(e.target.matches?.('.nd-pay-filter #payFrom,.nd-pay-filter #payTo'))document.getElementById('payPeriod').value='range';
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
 window.NaroPaymentPanel={open:show};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
