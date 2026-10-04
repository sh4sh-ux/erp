/* Dashboard presentation only. Read the active in-memory workspace; never retain a
   dataset, write a ledger, migrate statuses, or perform network/storage operations. */
(() => {
 'use strict';
 const stages=[['작성중','작성 중','견적 준비','file'],['발송','발송','고객 답변 대기','send'],['수주','수주','주문 확정·납품 준비','check'],['납품','납품','납품 완료','box']];
 const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 function periods(mode,today){
  const [y,m,d]=today.split('-').map(Number);
  const count=mode==='year'?5:mode==='day'?7:6;
  return Array.from({length:count},(_,i)=>{
   const n=i-count+1,date=mode==='year'?new Date(y+n,0,1):mode==='day'?new Date(y,m-1,d+n):new Date(y,m-1+n,1);
   const key=ymd(date).slice(0,mode==='year'?4:mode==='day'?10:7);
   return {key,label:mode==='year'?key+'년':mode==='day'?`${date.getMonth()+1}/${date.getDate()}`:`${date.getMonth()+1}월`,sale:0,receipt:0};
  });
 }
 function aggregate(data,mode,today,deliveryTotal){
  const rows=periods(mode,today),byKey=new Map(rows.map(r=>[r.key,r])),size=rows[0].key.length;
  // The same deliveredLines + quoteTotals helpers used by monthSales include
  // partial delivery and final-delivery service/discount recognition.
  for(const q of data.quotes||[])for(const d of q.deliveries||[]){
   const r=byKey.get(String(d.date||'').slice(0,size));if(r)r.sale+=deliveryTotal(q,d);
  }
  for(const p of data.payments||[]){
   if(p.kind!=='수금'||p.void_at)continue;
   const r=byKey.get(String(p.date||'').slice(0,size));if(r)r.receipt+=Number(p.amount)||0;
  }
  return rows;
 }
 function progress(quotes){
  const counts=new Map();for(const q of quotes||[])counts.set(q.status,(counts.get(q.status)||0)+1);
  const rows=stages.map(([status,label,hint,icon])=>({status,label,hint,icon,count:counts.get(status)||0}));
  // Never call a partially delivered order complete or silently omit it.
  if(counts.get('부분납품'))rows.splice(3,0,{status:'부분납품',label:'부분납품',hint:'남은 수량 납품 준비',icon:'box',count:counts.get('부분납품')});
  return rows;
 }
 function recent(quotes){return [...(quotes||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,4);}
 const model={periods,aggregate,progress,recent};
 if(typeof document==='undefined'){globalThis.NaroDashboardModel=model;return;}
 const paths={
  arrow:'<path d="M7 17 17 7M7 7h10v10"/>',chevron:'<path d="m9 6 6 6-6 6"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  box:'<path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5"/>',
  wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18M17 12h4v5h-4a2.5 2.5 0 0 1 0-5Z"/>'};
 const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.file}</svg>`;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>Math.round(v).toLocaleString('ko-KR')+'원';
 let chartMode='month',selectedKey=null;
 const deliveryTotal=(q,d)=>quoteTotals({lines:deliveredLines(q,d)}).total;
 function openQuotes(status,id){
  if(switchView('quotes')===false||currentView!=='quotes')return;
  if(typeof clearQtFilters==='function')clearQtFilters();
  const search=document.getElementById('qtSearch');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}
  document.getElementById('qtStatus').value=status||'';
  document.getElementById('qtFrom').value='';document.getElementById('qtTo').value='';
  if(id)qtSel=id;
  renderQtList();renderQtDetail();
  if(id&&typeof rememberAppStep==='function')rememberAppStep(true);
 }
 function panel(title,body,extra=''){return `<section class="nd-db-card"><header class="nd-db-head"><h3>${title}</h3>${extra}</header>${body}</section>`;}
 function renderChart(host){
  const rows=aggregate(db,chartMode,localDate(),deliveryTotal);
  let selected=Math.max(0,rows.findIndex(r=>r.key===selectedKey));
  if(!rows.some(r=>r.key===selectedKey))selected=rows.length-1;
  selectedKey=rows[selected].key;
  const max=Math.max(1,...rows.flatMap(r=>[Math.abs(r.sale),Math.abs(r.receipt)]))*1.12;
  const negative=rows.some(r=>r.sale<0||r.receipt<0);
  const valueHtml=r=>`<b>${esc(r.key)}</b><span class="nd-db-sale">매출 ${money(r.sale)}</span><span class="nd-db-receipt">입금 ${money(r.receipt)}</span>`;
  const mark=(value,kind)=>`<span class="nd-db-bar ${kind}${value<0?' negative':''}" style="height:${Math.abs(value)/max*100}%"></span>`;
  host.innerHTML=`<header class="nd-db-head"><h3>매출·입금 현황</h3><div class="nd-db-tabs" role="group" aria-label="매출·입금 집계 단위">${[['year','연간'],['month','월별'],['day','일별']].map(([key,label])=>`<button type="button" data-period="${key}" aria-pressed="${chartMode===key}">${label}</button>`).join('')}</div></header>
   <div class="nd-db-chart-meta"><span>${rows[0].key} — ${rows.at(-1).key}</span><div class="nd-db-values">${valueHtml(rows[selected])}</div></div>
   <div class="nd-db-bars${negative?' has-negative':''}" role="group" aria-label="기간별 매출과 입금" style="--db-bars:${rows.length}">${rows.map((r,i)=>`<button type="button" class="nd-db-bar-group" data-bar="${i}" aria-pressed="${i===selected}" aria-label="${r.key}, 매출 ${money(r.sale)}, 입금 ${money(r.receipt)}"><span class="nd-db-pair" aria-hidden="true">${mark(r.sale,'sale')}${mark(r.receipt,'receipt')}</span><span class="nd-db-bar-label">${r.label}</span></button>`).join('')}</div>
   <div class="nd-db-chart-note">매출: 납품일 기준 · 부가세 포함 / 입금: 입금일 기준${negative?' · 음수는 기준선 아래 표시':''}</div><span class="nd-db-sr" aria-live="polite" data-chart-announcement></span>`;
  const groups=[...host.querySelectorAll('[data-bar]')],values=host.querySelector('.nd-db-values');
  const show=i=>{values.innerHTML=valueHtml(rows[i]);groups.forEach((b,j)=>b.classList.toggle('is-preview',i===j));};
  groups.forEach((b,i)=>{
   b.onpointerenter=e=>{if(e.pointerType!=='touch')show(i);};b.onfocus=()=>show(i);
   b.onblur=()=>show(selected);
   b.onclick=()=>{selected=i;selectedKey=rows[i].key;groups.forEach((x,j)=>x.setAttribute('aria-pressed',String(i===j)));show(i);host.querySelector('[data-chart-announcement]').textContent=b.getAttribute('aria-label');};
  });
  host.querySelector('.nd-db-bars').onpointerleave=()=>show(selected);
  host.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{chartMode=b.dataset.period;selectedKey=null;renderChart(host);host.querySelector(`[data-period="${chartMode}"]`).focus({preventScroll:true});});
 }
 function refinedDashboard(){
  const view=document.getElementById('view-dash'),root=view?.querySelector('.dash-brief');if(!root)return;
  view.classList.add('nd-dashboard');
  const today=localDate(),month=today.slice(0,7),sales=monthSales(month);
  const receipt=(db.payments||[]).filter(p=>p.kind==='수금'&&!p.void_at&&String(p.date||'').startsWith(month)).reduce((s,p)=>s+(Number(p.amount)||0),0);
  const ar=arData(),open=ar.reduce((s,r)=>s+r.open,0);
  const aged=ar.filter(r=>r.open>0&&(daysSince(r.lastDeliver)||0)>=30),tax=db.quotes.filter(needsTax);
  const short=Object.values(currentStocks()).filter(n=>n<=0).length;
  const qs=recent(db.quotes),stagesNow=progress(db.quotes);
  const metric=(label,value,hint,target)=>`<button type="button" class="nd-db-metric" data-go="${target}"><span>${label}${icon('arrow')}</span><strong>${money(value)}</strong><small>${hint}</small></button>`;
  const quoteRows=qs.map(q=>`<button type="button" class="nd-db-quote" data-quote="${esc(q.id)}"><span class="nd-db-name"><strong>${esc(coName(q.company_id))}</strong><small>${esc(q.no||'—')} · ${esc(q.date||'날짜 없음')}</small></span><span class="nd-db-quote-amount"><strong>${money(quoteTotals(q).total)}</strong><span class="pill ${esc(QT_STATUS_CLASS[q.status]||'st-draft')}">${esc(q.status==='작성중'?'작성 중':q.status)}</span></span>${icon('chevron')}</button>`).join('')||'<p class="nd-db-empty">아직 견적이 없습니다. 위의 ‘새 견적’으로 시작하세요.</p>';
  const stageRows=stagesNow.map(s=>`<button type="button" class="nd-db-stage" data-status="${s.status}"><span class="nd-db-stage-icon">${icon(s.icon)}</span><span class="nd-db-stage-name"><strong>${s.label}</strong> <small>(${s.hint})</small></span><b>${s.count}<small>건</small></b></button>`).join('');
  root.innerHTML=panel('핵심 현황',`<div class="nd-db-metrics">${metric('이번 달 매출',sales.total,'납품 기준 · 부가세 포함','sales')}${metric('이번 달 입금',receipt,'입금일 기준','payments')}${metric('받을 금액',open,'전체 납품 − 입금 · 선입금 포함','ar')}</div>`,`<span>${esc(month)} · ${Number(today.slice(8))}일 기준</span>`)
   +'<section class="nd-db-card nd-db-chart" aria-label="매출·입금 현황"></section>'
   +panel('확인할 일',`<div class="nd-db-attention">${[['ar','wallet','30일 이상 미수',aged.length+'곳'],['tax','file','계산서 미발행',tax.length+'건'],['stock','box','재고 부족',short+'옵션']].map(([key,i,label,count])=>`<button type="button" data-review="${key}" aria-expanded="false">${icon(i)}<span>${label}</span><b>${count}</b>${icon('chevron')}</button>`).join('')}</div><div class="nd-db-review" hidden></div>`, '<span>필요한 업무로 바로 연결</span>')
   +`<div class="nd-db-work">${panel('최근 견적',quoteRows,'<button type="button" class="nd-db-link" data-all-quotes>전체 보기 '+icon('arrow')+'</button>')}${panel('견적 진행',stageRows,'<span>상태별 견적 수</span>')}</div>`
   +'<details class="nd-db-analysis"><summary>품목 판매 분석 보기</summary><section class="card sales-insight" id="salesInsight" aria-label="품목 판매 분석"></section></details>';
  renderChart(root.querySelector('.nd-db-chart'));
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));
  root.querySelector('[data-all-quotes]').onclick=()=>openQuotes('');
  root.querySelectorAll('[data-quote]').forEach(b=>b.onclick=()=>openQuotes('',b.dataset.quote));
  root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>openQuotes(b.dataset.status));
  const review=root.querySelector('.nd-db-review');
  root.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{
   const key=b.dataset.review,closing=b.getAttribute('aria-expanded')==='true';
   root.querySelectorAll('[data-review]').forEach(x=>x.setAttribute('aria-expanded',String(x===b&&!closing)));review.hidden=closing;if(closing)return;
   if(key==='ar')review.innerHTML=aged.length?aged.map(r=>`<div class="nd-db-review-row"><span>${esc(coName(r.cid))}</span><b>${money(r.open)}</b></div>`).join(''):'<p>30일 이상 경과한 미수가 없습니다.</p>';
   if(key==='tax')review.innerHTML=tax.length?tax.map(q=>`<button type="button" class="nd-db-review-row" data-tax-id="${esc(q.id)}"><span>${esc(coName(q.company_id))}<small>${esc(q.no)}</small></span><b>견적 확인 ${icon('chevron')}</b></button>`).join(''):'<p>계산서 미발행 견적이 없습니다.</p>';
   if(key==='stock')review.innerHTML=`<p>${short?`재고 수량이 0 이하인 옵션 ${short}건을 확인해 주세요.`:'재고 수량이 0 이하인 옵션이 없습니다.'}</p>`;
   const go=document.createElement('button');go.type='button';go.className='nd-db-link';go.textContent=key==='stock'?'재고 보기':key==='tax'?'견적서 보기':'받을 금액 보기';go.onclick=()=>key==='tax'?openQuotes(''):switchView(key);review.append(go);
   review.querySelectorAll('[data-tax-id]').forEach(x=>x.onclick=()=>openQuotes('',x.dataset.taxId));
  });
  const analysis=root.querySelector('.nd-db-analysis');analysis.ontoggle=()=>{if(analysis.open&&!analysis.dataset.loaded){renderSalesInsight();analysis.dataset.loaded='1';}};
 }
 // renderers captured the old function earlier. Update both entry points once.
 renderDash=refinedDashboard;renderers.dash=refinedDashboard;
 if(typeof currentView!=='undefined'&&currentView==='dash'&&typeof db!=='undefined')refinedDashboard();
})();
