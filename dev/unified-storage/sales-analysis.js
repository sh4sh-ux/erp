/* Read-only projection of salesData(). Preserve its filters and VAT rounding. */
const NaroSalesAnalysis=(()=>{
 const text=v=>String(v??'');
 const number=v=>Number.isFinite(Number(v))?Number(v):0;
 const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Current registered purchase prices, not historical COGS. As in itemBuy,
 // option prices precede the item price; zero means unregistered in this app.
 // Unlike a partial BOM sum, missing components must never inflate the margin.
 function unitCost(item,spec,items,path=new Set()){
  if(!item||path.has(item.id))return null;
  const option=(item.variants||[]).find(v=>v.spec===spec);
  const direct=number(option?.buy_price)||number(item.buy_price);
  if(direct)return direct>0?direct:null;
  if(item.type!=='세트'||!item.components?.length)return null;
  const next=new Set(path);next.add(item.id);let total=0;
  for(const c of item.components){
   const qty=number(c.qty),cost=unitCost(items.get(c.item_id),c.spec,items,next);
   if(qty<=0||cost===null)return null;
   total+=qty*cost;
  }
  return total>0&&Number.isFinite(total)?total:null;
 }
 function rows(groups,items,companies){
  const im=new Map(items.map(i=>[i.id,i])),cm=new Map(companies.map(c=>[c.id,c.name]));
  return Object.entries(groups).flatMap(([cid,group])=>Object.values(group).map(r=>{
   const it=im.get(r.item_id),qty=number(r.qty),price=number(r.price),gross=Math.round(qty*price*100)/100,supply=r.vat_inc?Math.round(gross/1.1):gross,vat=r.vat_inc?Math.round(gross)-supply:Math.round(supply*.1); // 부가세 포함 단가 줄(쇼핑몰 주문)은 결제액을 거꾸로 나눈다
   const category=text(it?.category).trim()||'미분류',buy=unitCost(it,r.spec,im);
   const identity=text(r.name).match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
   return {cid,company:cm.get(cid)||'거래처 정보 없음',itemKey:it?JSON.stringify(['id',it.id]):JSON.stringify(['name',r.name]),
    name:identity?identity[1]:text(r.name)||'이름 없는 품목',code:it?.code||(identity?identity[2]:''),category,
    color:text(r.color),spec:text(r.spec),qty,price,supply,vat,total:supply+vat,
    cost:buy===null?0:qty*buy,unknownCost:qty!==0&&buy===null?1:0};
  }));
 }
 function filter(rows,query,includeCompany=false){const q=text(query).trim().toLocaleLowerCase('ko');return !q?rows:rows.filter(r=>[r.name,r.code,r.category,r.color,r.spec,...(includeCompany?[r.company]:[])].some(v=>text(v).toLocaleLowerCase('ko').includes(q)));}
 function summary(rows){
  const s=rows.reduce((s,r)=>({total:s.total+r.total,supply:s.supply+r.supply,vat:s.vat+r.vat,qty:s.qty+r.qty,cost:s.cost+number(r.cost),unknownCost:s.unknownCost+number(r.unknownCost)}),{total:0,supply:0,vat:0,qty:0,cost:0,unknownCost:0});
  return {...s,margin:s.unknownCost?null:s.supply-s.cost,marginRate:!s.unknownCost&&s.supply>0?(s.supply-s.cost)/s.supply*100:null};
 }
 function marginLabel(s){return s.unknownCost?'마진 — · 원가 미등록':`마진 ${Math.round(s.margin).toLocaleString('ko-KR')}원 · ${s.marginRate===null?'—':s.marginRate.toFixed(1)+'%'}`;}
 function group(rows,mode,sort='amount'){
  const map=new Map();for(const r of rows){const id=mode==='company'?r.cid:mode==='category'?r.category:r.itemKey;
   if(!map.has(id))map.set(id,{id,name:mode==='company'?r.company:mode==='category'?r.category:r.name,code:mode==='item'?r.code:'',rows:[]});map.get(id).rows.push(r);}
  return [...map.values()].map(g=>({...g,...summary(g.rows),companies:new Set(g.rows.map(r=>r.cid)).size,items:new Set(g.rows.map(r=>r.itemKey)).size}))
   .sort((a,b)=>(sort==='name'?a.name.localeCompare(b.name,'ko'):sort==='qty'?b.qty-a.qty:b.total-a.total)||a.name.localeCompare(b.name,'ko'));
 }
 // Selection is a view state, never a mutation of the original company/period filters.
 function project(rows,state){
  const mode=['company','item','category'].includes(state.mode)?state.mode:'company';
  const index=group(rows,mode),selected=index.find(g=>g.id===state.selected)||null;
  const scope=selected?selected.rows:rows,detailMode=selected?(mode==='item'?'company':'item'):mode;
  const details=group(scope,detailMode,state.sort),q=text(state.query).trim().toLocaleLowerCase('ko');
  const left=text(state.leftQuery).trim().toLocaleLowerCase('ko');
  return {index:index.filter(g=>(g.name+' '+g.code).toLocaleLowerCase('ko').includes(left)),selected,scope,
   detailMode,details:details.filter(g=>(g.name+' '+g.code).toLocaleLowerCase('ko').includes(q)),
   detailCount:details.length,summary:summary(scope),overall:summary(rows)};
 }
 function share(amount,total){const value=total>0?amount/total*100:null;return {label:value===null?'—':value.toFixed(1)+'%',width:value===null?0:Math.max(0,Math.min(100,value))};}
 return {rows,filter,summary,group,project,share,escape,unitCost,marginLabel};
})();

/* UI only. No ledger writes, authentication, storage, or network requests. */
(()=>{
 'use strict';
 const view=document.getElementById('view-sales'),source=document.getElementById('slBody');if(!view||!source)return;
 const model=NaroSalesAnalysis,e=model.escape,n=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2});
 const money=v=>`<span class="nd-sa-num">${Math.round(v).toLocaleString('ko-KR')}</span><small class="nd-sa-currency">원</small>`;
 const margin=g=>`<span class="nd-sa-margin${g.unknownCost?' is-unknown':g.margin<0?' is-negative':''}" title="현재 등록 매입단가 기준 예상 마진 · 부가세 제외${g.unknownCost?' · 원가 미등록 항목이 있어 계산하지 않습니다':''}">${e(model.marginLabel(g))}</span>`;
 const labels={company:'거래처',item:'품목',category:'카테고리'};
 const state={mode:'company',selected:null,query:'',sort:'amount',leftQuery:'',mobileDetail:false};
 const phone=matchMedia('(max-width:1023px)');
 const section=document.createElement('section');section.className='nd-sales-analysis';section.setAttribute('aria-label','매출 상세');
 const result=document.createElement('div');result.className='nd-sa-result';section.append(result);
 const index=document.createElement('section');index.className='nd-sales-index';index.setAttribute('aria-label','매출 목록');
 index.innerHTML=`<div class="nd-sa-tabs" role="group" aria-label="매출 집계 방식"><button type="button" data-sa-mode="company">거래처별</button><button type="button" data-sa-mode="item">품목별</button><button type="button" data-sa-mode="category">카테고리별</button></div><div class="nd-sa-count" aria-live="polite"></div><div class="nd-sa-list"></div>`;
 const header=document.createElement('header');header.className='nd-sa-header';
 header.innerHTML=`<button type="button" class="nd-sa-back" aria-label="매출 목록으로 돌아가기"><span aria-hidden="true"></span>목록</button><div class="nd-sa-headline"><div class="nd-sa-heading"><div class="nd-sa-eyebrow"></div><h3 class="nd-sa-title"></h3></div><div class="nd-sa-header-amount"><div class="nd-sa-label">판매 금액 · 부가세 포함</div><strong></strong></div></div><div class="nd-sa-header-bottom"><div class="nd-sa-period"></div><div class="nd-sa-toolbar"><label class="nd-sa-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" aria-label="상세 품목·코드 검색" placeholder="품목·코드 검색"></label><select class="nd-sa-sort" aria-label="상세 정렬"><option value="amount">매출 높은 순</option><option value="qty">수량 많은 순</option><option value="name">이름순</option></select></div></div>`;
 const input=header.querySelector('input'),sort=header.querySelector('select'),list=index.querySelector('.nd-sa-list');
 header.querySelector('.nd-sa-back').lastChild.textContent='매출 집계';
 let queued=false,current=null,lastFilter=null;
 const value=id=>document.getElementById(id)?.value||'';
 const setHTML=(el,html)=>{if(el.innerHTML!==html)el.innerHTML=html;};
 const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
 function place(){
  if(source.nextElementSibling!==section)source.after(section);
  const left=!phone.matches&&view.querySelector('.workspace-left'),head=!phone.matches&&view.querySelector(':scope>.workspace-heading');
  if(left){if(index.parentElement!==left)left.append(index);}else if(index.parentElement!==view||index.nextElementSibling!==source)view.insertBefore(index,source);
  if(head){if(header.parentElement!==head)head.append(header);}else if(header.parentElement!==section)section.prepend(header);
  if(!view.classList.contains('nd-sales-ready'))view.classList.add('nd-sales-ready');
  view.classList.toggle('nd-sa-mobile-detail',phone.matches&&state.mobileDetail);
  const headSearch=view.querySelector('.nd-tools input');
  if(headSearch){const label=labels[state.mode]+(state.mode==='item'?'·코드':'')+' 검색';if(headSearch.placeholder!==label)headSearch.placeholder=label;if(headSearch.getAttribute('aria-label')!==label)headSearch.setAttribute('aria-label',label);}
 }
 function render(){
  if(typeof db==='undefined'||typeof salesData!=='function')return;
  place();
  const filters=JSON.stringify(['slFrom','slTo','slCo','slStatus'].map(value));
  if(lastFilter!==null&&lastFilter!==filters){state.query='';input.value='';}lastFilter=filters;
  // Exactly the existing salesData result; no duplicate accounting implementation.
  const rows=model.rows(salesData().groups,db.items||[],db.companies||[]),p=model.project(rows,state);current=p;
  if(state.selected!==null&&!p.selected){state.selected=null;state.mobileDetail=false;view.classList.remove('nd-sa-mobile-detail');}
  const label=labels[state.mode],name=p.selected?.name||'전체 '+label,unit=state.mode==='company'?'곳':'종';
  index.querySelectorAll('[data-sa-mode]').forEach(b=>{const pressed=String(b.dataset.saMode===state.mode);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);});
  setText(index.querySelector('.nd-sa-count'),`${p.index.length}${unit} · 부가세 포함`);
  const entry=(g,i)=>`<button type="button" class="nd-sa-entry${(i===-1?!p.selected:state.selected===g.id)?' on':''}" data-sa-select="${i}" aria-pressed="${i===-1?!p.selected:state.selected===g.id}"><span class="nd-sa-entry-name" title="${e(g.name)}">${e(g.name)}</span><span class="nd-sa-entry-note" title="${e(g.code||'')}">${g.code?e(g.code)+' · ':''}${i===-1?'전체 합계':'수량 '+n(g.qty)}</span><span class="nd-sa-entry-amount">${money(g.total)}</span>${margin(g)}</button>`;
  setHTML(list,entry({name:'전체 '+label,...p.overall},-1)+p.index.map(entry).join('')+(p.index.length?'':'<p class="nd-sa-empty">검색 결과가 없습니다.</p>'));
  setText(header.querySelector('.nd-sa-eyebrow'),p.selected?label:'매출 현황');
  setText(header.querySelector('.nd-sa-title'),name);header.querySelector('.nd-sa-title').title=name;
  setHTML(header.querySelector('.nd-sa-header-amount strong'),money(p.summary.total));
  setHTML(header.querySelector('.nd-sa-period'),`<span>${e(value('slFrom')||'전체')} – ${e(value('slTo')||'전체')}</span><span>견적일 기준</span>`);
  const detailsLabel=!p.selected?labels[p.detailMode]+'별 매출':p.detailMode==='company'?'구매 거래처':'판매 품목',detailUnit=p.detailMode==='company'?'곳':'종',searchLabel=p.detailMode==='company'?'거래처 검색':p.detailMode==='category'?'카테고리 검색':'품목·코드 검색';
  if(input.placeholder!==searchLabel){input.placeholder=searchLabel;input.setAttribute('aria-label','상세 '+searchLabel);}
  sort.value=state.sort;
  const share=model.share(p.summary.total,p.overall.total).label;
  const summary=`<div class="nd-sa-kpis${p.selected?'':' nd-sa-overview'}"><div><span>수량 합계</span><strong>${n(p.summary.qty)}</strong></div><div><span>${p.selected?detailsLabel:labels[p.detailMode]}</span><strong>${p.detailCount}<small class="nd-sa-currency">${detailUnit}</small></strong></div>${p.selected?`<div><span>전체 매출 비중</span><strong>${e(share)}</strong></div>`:''}</div>`;
  const meter=amount=>{const s=model.share(amount,p.summary.total);return `<span class="nd-sa-share-meter" aria-label="매출 비중 ${e(s.label)}"><span>${e(s.label)}</span><span class="nd-sa-share-track" aria-hidden="true"><span style="width:${s.width}%"></span></span></span>`;};
  const shown=model.summary(p.details),searching=!!state.query.trim();
  const itemName=(r,i)=>(p.selected?`<span class="nd-sa-item-name" title="${e(r.name)}">${e(r.name)}</span>`:`<button type="button" class="nd-sa-open-detail" data-sa-detail="${i}" title="${e(r.name)}" aria-label="${e(r.name)} 상세 보기"><span class="nd-sa-item-name">${e(r.name)}</span><span aria-hidden="true">›</span></button>`)+`<small class="nd-sa-mobile-qty">수량 ${n(r.qty)}${r.code?' · ':''}</small>`;
  const table=p.details.length?`<table class="nd-sa-table" aria-label="${detailsLabel} 상세"><thead><tr><th>${labels[p.detailMode]}</th><th class="nd-sa-n">수량</th><th class="nd-sa-n nd-sa-share">비중</th><th class="nd-sa-n">판매 금액</th></tr></thead><tbody>${p.details.map((r,i)=>`<tr><td class="nd-sa-name">${itemName(r,i)}${r.code?`<small class="nd-sa-code">${e(r.code)}</small>`:''}<span class="nd-sa-mobile-share">${meter(r.total)}</span></td><td class="nd-sa-n nd-sa-qty">${n(r.qty)}</td><td class="nd-sa-n nd-sa-share">${meter(r.total)}</td><td class="nd-sa-n nd-sa-money"><span class="nd-sa-sale">${money(r.total)}</span>${margin(r)}</td></tr>`).join('')}</tbody><tfoot><tr><td>${searching?'검색 합계':'합계'}</td><td class="nd-sa-n">${n(shown.qty)}</td><td class="nd-sa-n nd-sa-share">${e(model.share(shown.total,p.summary.total).label)}</td><td class="nd-sa-n nd-sa-money"><span class="nd-sa-sale">${money(shown.total)}</span>${margin(shown)}</td></tr></tfoot></table>`:'<p class="nd-sa-empty">조건에 맞는 매출 내역이 없습니다.<br>기간·검색어를 확인해 주세요.</p>';
  setHTML(result,summary+`<div class="nd-sa-sectionhead"><h4>${detailsLabel}</h4><span role="status">${searching?'검색 결과 ':''}${p.details.length}${detailUnit}</span></div>`+table+`<p class="nd-sa-note">견적일 · ${value('slStatus')==='all'?'모든 견적 상태':'수주·부분납품·납품'} · 부가세 포함<br>마진은 부가세 제외 매출 − 현재 등록 매입원가의 예상값이며, 마진율은 부가세 제외 매출 기준입니다. 원가 미등록 항목이 포함되면 마진을 표시하지 않습니다.<br>실제 납품 매출·입금액과 다를 수 있습니다. 수량은 품목·작업 합계입니다.${state.mode==='category'?' 카테고리는 현재 품목 분류이며 미등록·삭제 품목은 미분류입니다.':''}</p>`);
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
 function focusSelected(){const i=current?.index.findIndex(g=>g.id===state.selected)??-1;list.querySelector(`[data-sa-select="${i}"]`)?.focus({preventScroll:true});}
 index.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.saMode){state.mode=b.dataset.saMode;state.selected=null;state.leftQuery='';state.query='';input.value='';view.querySelectorAll('.panel-b-search,.nd-tools input').forEach(el=>el.value='');render();return;}
  if(b.hasAttribute('data-sa-select')){state.selected=current.index[Number(b.dataset.saSelect)]?.id??null;state.query='';input.value='';state.mobileDetail=true;render();if(phone.matches){header.querySelector('.nd-sa-back').focus({preventScroll:true});section.scrollIntoView({block:'start'});}else focusSelected();}
 });
 header.addEventListener('input',ev=>{if(ev.target===input){state.query=input.value;render();}});
 result.addEventListener('click',ev=>{
  const button=ev.target.closest('[data-sa-detail]')||ev.target.closest('tbody tr')?.querySelector('[data-sa-detail]');if(!button||current?.selected)return; // 줄 어디를 눌러도 그 항목으로
  const selected=current.details[Number(button.dataset.saDetail)];if(!selected)return;
  state.selected=selected.id;state.query='';input.value='';render();
  if(phone.matches)header.querySelector('.nd-sa-back').focus({preventScroll:true});else input.focus({preventScroll:true});
 });
 header.addEventListener('change',ev=>{if(ev.target===sort){state.sort=sort.value;render();}});
 header.querySelector('.nd-sa-back').addEventListener('click',()=>{state.mobileDetail=false;render();focusSelected();});
 view.addEventListener('input',ev=>{if(ev.target.matches('.panel-b-search,.nd-tools input')){state.leftQuery=ev.target.value;render();}});
 document.addEventListener('click',ev=>{if(ev.target.closest('.nd-sales-reset')){state.selected=null;state.query='';state.sort='amount';input.value='';schedule();}});
 phone.addEventListener('change',schedule);
 // Survive the original desktop panes being dismantled/recreated on resize.
 // Reattach our nodes only when misplaced; never observe our own content writes.
 new MutationObserver(schedule).observe(source,{childList:true,subtree:true});
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(node=>node===source||node.nodeType===1&&(node.matches?.('.workspace-left,.workspace-right,.workspace-heading')||node.contains?.(source)))))schedule();}).observe(view,{childList:true,subtree:true});
 render();
})();
