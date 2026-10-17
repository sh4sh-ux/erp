/* 재고 화면(10/17 시안 승인 — 견적서·매입·업체 제공 자재와 같은 틀). 화면만 바꾼다: 계산·저장은 원래 것 그대로
   (stockOptionRows · currentStocks · 입고/출고/조정 입력 폼 .stock-add → reviewStockEntry · openStockChange · saveTable('items')).
   왼쪽: 원래 #stockItems 줄을 그대로 두고 안의 글자만 다시 그린다(품목명 / 코드 · 옵션 수 · 상태 꼬리표).
   오른쪽: 머리(품목명 · 현재 수량/가용) → 탭 [옵션 · 기록 · 정보] → 아래 [최소 기준][재고 조정] … [출고 기록][입고 기록].
   옵션 탭 = 색상 × 사이즈 숫자표(시안 A: 상자·배경 없이 숫자와 가는 선, 품절 빨강 · 미달 주황 글자) + 옵션별 줄 표.
   아무것도 안 골랐을 때(전체 현황) = 숫자 4개 + 확인할 옵션.
   입력 폼은 PC에서 가운데 창으로(아래 버튼으로 열었을 때만), 폰은 원래 naro-design 아래 창 그대로.
   주의: build.mjs가 String.replace로 index.html에 끼워 넣으므로 달러+앰퍼샌드 같은 치환 특수 문자열을 쓰지 말 것. */
(()=>{
 'use strict';
 if(typeof renderStock!=='function'||typeof stockOptionRows!=='function')return;
 const PC=matchMedia('(min-width:781px)');
 const ui={tab:'options',mode:'qty',opt:'',rec:'all',entry:false,entryMoves:0};
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n0=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
 const ymd=d=>/^\d{4}-\d{2}-\d{2}/.test(d||'')?String(d).slice(0,10).replaceAll('-','.'):'';
 const itemOf=id=>(db.items||[]).find(i=>i.id===id);
 const optLabel=(c,s)=>[c,s].filter(Boolean).join(' · ')||'기본';
 const isOut=c=>c.qty<=0,isWarn=c=>!isOut(c)&&(c.low||c.shortage>0);
 const DOTS='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3.5" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="12.5" r="1.4"/></svg>';
 const say=t=>typeof toast==='function'?toast(t):alert(t);
 const view=()=>document.getElementById('view-stock');
 const detailCard=()=>view()?.querySelector(':scope>.cols>.card:nth-child(2)');

 function groups(){
  const combos=stockOptionRows(),by=new Map();
  for(const c of combos){if(!by.has(c.item_id))by.set(c.item_id,[]);by.get(c.item_id).push(c);}
  return {combos,by};
 }
 // 색상·사이즈 순서 = 품목에 적힌 순서(없으면 기록에 나온 순서)
 function axes(it,rows){
  const uniq=a=>[...new Set(a)];
  const colors=uniq([...(it?.colors||[]),...rows.map(r=>r.color)]).filter(c=>rows.some(r=>r.color===c));
  const specs=uniq([...(it?.variants||[]).map(v=>v.spec),...(it?.spec?[it.spec]:[]),...rows.map(r=>r.spec)]).filter(s=>rows.some(r=>r.spec===s));
  return {colors,specs};
 }
 const tagOf=rows=>{const out=rows.filter(isOut).length,warn=rows.filter(isWarn).length;
  return out?`<span class="sp-tag red">품절 ${out}</span>`:warn?`<span class="sp-tag amb">부족 ${warn}</span>`:rows.some(r=>r.minimum===null)?'<span class="sp-tag gray">기준 없음</span>':'';};

 /* ── 왼쪽: 원래 줄(눌림 처리 그대로)의 안쪽 글자만 ── */
 function paintLeft(by){
  for(const b of document.querySelectorAll('#stockItems>.stock-item[data-stock-id]')){
   const id=b.dataset.stockId;b.classList.add('sp-li');
   if(!id){const all=[...by.values()].flat();const k='all|'+all.length;if(b.dataset.spk===k)continue;b.dataset.spk=k;
    b.innerHTML=`<span class="sp-r1"><b class="sp-nm">전체 현황</b><span class="sp-v">${n0(by.size)}<small>품목</small></span></span><span class="sp-r2"><small>옵션 ${n0(all.length)}개</small>${tagOf(all)}</span>`;continue;}
   const it=itemOf(id),rows=by.get(id)||[],qty=rows.reduce((s,r)=>s+r.qty,0);
   const k=[id,it?.name,it?.code,qty,rows.length,tagOf(rows)].join('|');if(b.dataset.spk===k)continue;b.dataset.spk=k;
   b.innerHTML=`<span class="sp-r1"><b class="sp-nm">${e(it?.name||'(삭제된 품목)')}</b><span class="sp-v">${n0(qty)}<small>개</small></span></span><span class="sp-r2"><small>${e([it?.code,`${n0(rows.length)}옵션`].filter(Boolean).join(' · '))}</small>${tagOf(rows)}</span>`;
  }
 }

 /* ── 오른쪽 ── */
 function headHtml(eye,title,meta,heroK,hero,heroSub){
  return `<div class="sp-head"><div class="sp-hl"><div class="sp-eye">${eye}</div><h3 class="sp-title">${title}</h3><div class="sp-meta">${meta}</div></div>
   <div class="sp-hero"><span>${heroK}</span><strong>${hero}</strong>${heroSub?`<small>${heroSub}</small>`:''}</div></div>`;
 }
 function matrixHtml(it,rows){
  const {colors,specs}=axes(it,rows);if(colors.length<=1&&specs.length<=1)return '';
  const cell=(c,s)=>rows.find(r=>r.color===c&&r.spec===s);
  const val=r=>ui.mode==='avail'?r.available:r.qty;
  const head=`<tr><th></th>${specs.map(s=>`<th>${e(s||'기본')}</th>`).join('')}<th class="sp-sum">합계</th></tr>`;
  const body=colors.map(c=>{let sum=0;
   const tds=specs.map(s=>{const r=cell(c,s);if(!r)return '<td class="none">—</td>';sum+=val(r);
    const cls=isOut(r)?'out':isWarn(r)?'low':'';const sub=isOut(r)?'품절':r.shortage>0?`부족 ${n0(r.shortage)}`:r.low?`최소 ${n0(r.minimum)}`:ui.mode==='qty'&&r.reserved>0?`가용 ${n0(r.available)}`:ui.mode==='avail'&&r.reserved>0?`현재 ${n0(r.qty)}`:'';
    return `<td class="${cls}${ui.opt===r.key?' sel':''}"><button type="button" data-sp-opt="${e(r.key)}" aria-label="${e(optLabel(c,s))} ${n0(val(r))}개">${n0(val(r))}<small>${sub||'&nbsp;'}</small></button></td>`;}).join('');
   return `<tr><td class="sp-c">${e(c||'—')}</td>${tds}<td class="sp-sum">${n0(sum)}<small>&nbsp;</small></td></tr>`;}).join('');
  return `<div class="sp-sec"><b>사이즈<em class="sp-hint">${ui.mode==='avail'?'가용 수량':'현재 수량'} · 칸을 누르면 그 옵션 기록</em></b><div class="sp-seg" role="group" aria-label="보기"><button type="button" data-sp-mode="qty" aria-pressed="${ui.mode==='qty'}">현재</button><button type="button" data-sp-mode="avail" aria-pressed="${ui.mode==='avail'}">가용</button></div></div>
   <div class="sp-mx-wrap"><table class="sp-mx">${head}${body}</table></div>`;
 }
 const status=r=>r.qty<0?['red','확인 필요']:isOut(r)?['red','품절']:r.shortage>0?['amb','주문 부족']:r.low?['amb','미달']:r.minimum===null?['gray','기준 없음']:['green','여유'];
 function optionsHtml(it,rows){
  const {colors,specs}=axes(it,rows);const order=r=>colors.indexOf(r.color)*1000+specs.indexOf(r.spec);
  const list=rows.slice().sort((a,b)=>order(a)-order(b));
  const free=rows.filter(r=>!isOut(r)&&!isWarn(r)).length,warn=rows.filter(isWarn).length,out=rows.filter(isOut).length,t=Math.max(1,rows.length),w=v=>(v/t*100).toFixed(2)+'%';
  const sum=`<div class="sp-sum-bar"><span class="sp-cap">옵션 ${n0(rows.length)}개</span><span class="sp-track" aria-hidden="true">${free?`<i class="ok" style="width:${w(free)}"></i>`:''}${warn?`<i class="amb" style="width:${w(warn)}"></i>`:''}${out?`<i class="red" style="width:${w(out)}"></i>`:''}</span>
   <span class="sp-leg"><span><i class="ok"></i>여유 <b>${n0(free)}</b></span><span><i class="amb"></i>미달·부족 <b>${n0(warn)}</b></span><span><i class="red"></i>품절 <b>${n0(out)}</b></span></span></div>`;
  const rowsHtml=list.map(r=>{const [cl,tx]=status(r);return `<div class="sp-tr sp-g-opt${ui.opt===r.key?' sel':''}" data-sp-opt="${e(r.key)}" role="button" tabindex="0"><span class="sp-ol">${e(optLabel(r.color,r.spec))}</span><span class="num${isOut(r)?' red':''}">${n0(r.qty)}</span><span class="num">${n0(r.reserved)}</span><span class="num${r.available<0?' red':''}">${n0(r.available)}</span><span class="num${r.minimum===null?' dim':''}">${r.minimum===null?'—':n0(r.minimum)}</span><span><span class="sp-tag ${cl}">${tx}</span></span></div>`;}).join('');
  return sum+matrixHtml(it,rows)+`<div class="sp-sec"><b>옵션별<em>${n0(rows.length)}개</em></b></div>
   <div class="sp-th sp-g-opt" aria-hidden="true"><span>색상 · 사이즈</span><span class="num">현재</span><span class="num">출고 예정</span><span class="num">가용</span><span class="num">최소</span><span>상태</span></div>${rowsHtml||'<p class="sp-empty">옵션이 없어요</p>'}`;
 }
 const kindOf=m=>/^재고 조정/.test(m.memo||'')?'조정':m.kind;
 function srcOf(m){
  const q=m.quote_id?(db.quotes||[]).find(x=>x.id===m.quote_id):null;
  if(q)return `${m.kind==='출고'?'납품':'견적'} <button type="button" class="sp-link" data-sp-quote="${e(q.id)}">${e(q.no||'견적')}</button>`;
  if(m.purchase_id){const t=String(m.memo||''),no=m.purchase_no||(/((?:PO|IM)-[\w-]+)/.exec(t)||[])[1]||'매입 보기',lab=(/^(반품|입고 취소)/.exec(t)||[])[1]||'매입';return `${lab} <button type="button" class="sp-link" data-sp-purchase="${e(m.purchase_id)}">${e(no)}</button>`;}
  if(/^재고 조정/.test(m.memo||''))return e((m.memo.split(' · ')[1])||'재고 조사');
  return '';
 }
 const memoOf=m=>{const t=String(m.memo||'');if(m.purchase_id&&/^(매입|반품|입고 취소) (?:PO|IM)-[\w-]+/.test(t))return t.split(' · ').slice(1).join(' · ');if(/^재고 조정/.test(t))return t.split(' · ').slice(2).join(' · ');if(/^견적 .+ (수주|출고)/.test(t)&&m.quote_id)return '';return t;};
 function historyHtml(id){
  const all=(db.stock_moves||[]).filter(m=>m.item_id===id).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created_at||'').localeCompare(a.created_at||''));
  const live=all.filter(m=>!m.cancelled_at);
  const optKey=ui.opt&&ui.opt.split('|')[0]===id?ui.opt:'';
  const pass=m=>(!optKey||[m.item_id,m.color||'',m.spec||''].join('|')===optKey)&&(ui.rec==='all'||kindOf(m)===ui.rec);
  const list=all.filter(pass);
  const chips=[['all','전체'],['입고','입고'],['출고','출고'],['조정','조정']].map(([k,l])=>`<button type="button" data-sp-rec="${k}" aria-pressed="${ui.rec===k}">${l}</button>`).join('');
  const [,c,s]=optKey?optKey.split('|'):[];
  const optChip=optKey?`<button type="button" class="sp-optchip" data-sp-optclear>${e(optLabel(c,s))} <span aria-hidden="true">✕</span></button>`:'';
  const rows=list.map(m=>{const k=kindOf(m),sign=m.kind==='입고'?'+':'−';
   return `<div class="sp-tr sp-g-log${m.cancelled_at?' gone':''}"><span class="sp-d">${ymd(m.date)}</span><span class="sp-k"><i class="${k==='입고'?'in':k==='조정'?'adj':'out'}"></i>${k}${m.cancelled_at?'<small>취소됨</small>':''}</span>
    <span class="sp-nmc"><b>${e(optLabel(m.color,m.spec))}</b><span class="sp-src">${srcOf(m)}</span></span><span class="sp-memo" title="${e(memoOf(m))}">${e(memoOf(m))}</span>
    <span class="num${m.kind==='출고'&&k==='조정'?' red':''}">${sign}${n0(m.qty)}</span><span class="sp-act">${recordMenuBtn(m)}</span></div>`;}).join('');
  return `<div class="sp-sec"><b>기록<em>${n0(live.length)}건</em>${optChip}</b><div class="sp-seg" role="group" aria-label="기록 구분">${chips}</div></div>`+
   (rows?`<div class="sp-th sp-g-log" aria-hidden="true"><span>날짜</span><span>구분</span><span>옵션 · 출처</span><span>메모</span><span class="num">수량</span><span></span></div>${rows}`:'<p class="sp-empty">기록이 없어요</p>');
 }
 // 기록 줄 ⋮: 원래 stockRecordActions가 만든 버튼(수정·삭제·복원)을 그대로 메뉴로
 function recordMenuBtn(m){
  let h='';try{h=typeof stockRecordActions==='function'?stockRecordActions(m):'';}catch{h='';}
  if(!/data-stock-(edit|void|restore)/.test(h))return '';
  return `<button type="button" class="sp-dots" data-sp-rmenu="${e(m.id)}" aria-label="기록 메뉴">${DOTS}</button>`;
 }
 function infoHtml(it,rows){
  const {colors,specs}=axes(it,rows);const set=rows.filter(r=>r.minimum!==null).length;
  const kv=[['품목코드',it?.code||'—'],['카테고리',it?.category||'—'],['색상',colors.filter(Boolean).join(', ')||'—'],['사이즈',specs.filter(Boolean).join(', ')||'—'],['최소 기준',`${n0(set)} / ${n0(rows.length)}개 옵션 설정`]];
  return `<div class="sp-sec"><b>품목 정보</b><button type="button" class="sp-textbtn" data-sp-item="${e(it?.id||'')}">품목 열기</button></div><dl class="sp-kv">${kv.map(([k,v])=>`<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl>`;
 }
 function overviewHtml(by,combos){
  const total=combos.reduce((s,r)=>s+r.qty,0),avail=combos.reduce((s,r)=>s+Math.max(0,r.available),0);
  const k=[['zero','품절 옵션',combos.filter(isOut).length,'red'],['low','최소 기준 미달',combos.filter(r=>r.low&&!isOut(r)).length,'amb'],['short','주문 대비 부족',combos.filter(r=>r.shortage>0).length,''],['missing','최소 기준 없음',combos.filter(r=>r.minimum===null).length,'']];
  const need=combos.filter(r=>isOut(r)||isWarn(r)).sort((a,b)=>b.shortage-a.shortage||Number(isOut(b))-Number(isOut(a))||a.available-b.available||a.name.localeCompare(b.name,'ko',{numeric:true}));
  const rows=need.map(r=>{const it=itemOf(r.item_id),[cl,tx]=status(r);return `<div class="sp-tr sp-g-ov" data-sp-go="${e(r.item_id)}" data-sp-key="${e(r.key)}" role="button" tabindex="0"><span class="sp-nmc"><b>${e(it?.name||'')}</b><span class="sp-src">${e(it?.code||'')}</span></span><span class="sp-ol">${e(optLabel(r.color,r.spec))}</span><span class="num">${n0(r.qty)} <i>/ ${r.minimum===null?'—':n0(r.minimum)}</i></span><span class="num${r.available<0?' red':''}">${n0(r.available)}</span><span><span class="sp-tag ${cl}">${tx}</span></span><span class="sp-chev" aria-hidden="true">›</span></div>`;}).join('');
  return headHtml('재고','전체 현황',`${n0(by.size)}품목 · 옵션 ${n0(combos.length)}개 · ${ymd(typeof localDate==='function'?localDate():'')} 기준`,'현재 수량 합계',`${n0(total)}개`,`가용 <b>${n0(avail)}개</b>`)+
   `<div class="sp-body"><div class="sp-kpis">${k.map(([f,l,v,c])=>`<button type="button" data-sp-filter="${f}"><span>${l}</span><b class="${c&&v?c:''}">${n0(v)}<small>개</small></b></button>`).join('')}</div>
    <div class="sp-sec"><b>확인할 옵션<em>${n0(need.length)}개</em></b></div>
    ${rows?`<div class="sp-th sp-g-ov" aria-hidden="true"><span>품목</span><span>옵션</span><span class="num">현재 / 최소</span><span class="num">가용</span><span>상태</span><span></span></div>${rows}`:'<p class="sp-empty">확인할 옵션이 없어요. 모두 여유 있어요.</p>'}</div>
   <div class="sp-bar"><span class="sp-sp"></span><button type="button" class="btn save" data-sp-go-entry="stockRegister">입고 기록</button></div>`;
 }
 function itemHtml(id,rows){
  const it=itemOf(id),{colors,specs}=axes(it,rows);
  const qty=rows.reduce((s,r)=>s+r.qty,0),res=rows.reduce((s,r)=>s+r.reserved,0),avail=qty-res;
  const lastIn=(db.stock_moves||[]).filter(m=>m.item_id===id&&m.kind==='입고'&&!m.cancelled_at).map(m=>m.date||'').sort().pop();
  const moves=(db.stock_moves||[]).filter(m=>m.item_id===id&&!m.cancelled_at).length;
  const meta=[it?.code?`<span class="sp-code">${e(it.code)}</span>`:'',[colors.filter(Boolean).length?`색상 ${colors.filter(Boolean).length}`:'',specs.filter(Boolean).length?`사이즈 ${specs.filter(Boolean).length}`:''].filter(Boolean).join(' · '),lastIn?`최근 입고 ${ymd(lastIn)}`:''].filter(Boolean).join('<span class="sp-dot">·</span>');
  const tabs=[['options','옵션',rows.length],['history','기록',moves],['info','정보','']].map(([k,l,c])=>`<button type="button" role="tab" data-sp-tab="${k}" aria-selected="${ui.tab===k}">${l}${c!==''?`<em>${n0(c)}</em>`:''}</button>`).join('');
  const body=ui.tab==='history'?historyHtml(id):ui.tab==='info'?infoHtml(it,rows):optionsHtml(it,rows);
  return headHtml('재고',e(it?.name||'(삭제된 품목)'),meta||'&nbsp;','현재 수량',`${n0(qty)}개`,res?`출고 예정 ${n0(res)} · 가용 <b>${n0(avail)}개</b>`:`가용 <b>${n0(avail)}개</b>`)+
   `<div class="sp-tabs" role="tablist" aria-label="재고 상세">${tabs}</div><div class="sp-body">${body}</div>
   <div class="sp-bar"><button type="button" class="btn ghost" data-sp-min>최소 기준</button><button type="button" class="btn ghost" data-sp-go-entry="stockAdjust">재고 조정</button><span class="sp-sp"></span><button type="button" class="btn ghost" data-sp-go-entry="stockOutbound">출고 기록</button><button type="button" class="btn save" data-sp-go-entry="stockRegister">입고 기록</button></div>`;
 }
 function paint(){
  const v=view(),card=detailCard();if(!v||!card)return;
  v.classList.add('sp-on');
  const {combos,by}=groups();paintLeft(by);
  // PC(1024~)는 panel-layout-b가 원래 노드를 .workspace-right로 옮긴다 → 그 안에, 아니면 원래 오른쪽 카드 안에
  const box=v.querySelector(':scope>.workspace-right')||card;
  let host=document.getElementById('spDetail');
  if(!host){host=document.createElement('div');host.id='spDetail';}
  if(host.parentElement!==box){const bar=box.querySelector(':scope>.nd-st-bar');bar?bar.after(host):box.prepend(host);}
  const id=typeof stockSelectedItem!=='undefined'?stockSelectedItem:'';
  if(ui.opt&&ui.opt.split('|')[0]!==id)ui.opt='';
  const html=id&&by.has(id)?itemHtml(id,by.get(id)):id?itemHtml(id,[]):overviewHtml(by,combos);
  if(host.dataset.html!==html){const sc=host.querySelector('.sp-body')?.scrollTop||0;host.innerHTML=html;host.dataset.html=html;const b=host.querySelector('.sp-body');if(b)b.scrollTop=sc;}
  // 입력 창: 저장되면(기록 수가 바뀜) 닫는다
  if(ui.entry&&(db.stock_moves||[]).length!==ui.entryMoves)closeEntry(true);
 }
 const orig=renderStock;
 renderStock=function(){const r=orig.apply(this,arguments);try{paint();}catch(err){console.error(err);}return r;};
 try{window.renderStock=renderStock;}catch{}

 /* ── 입력 창(PC): 원래 .stock-add를 가운데 창처럼 띄운다. 품목을 고르면 원래 화면이 폼을 자동으로 펴므로, 아래 버튼으로 열었을 때만 보인다. ── */
 let backdrop=null;
 function openEntry(btnId){
  const v=view();if(!v)return;
  if(PC.matches){ui.entry=true;ui.entryMoves=(db.stock_moves||[]).length;v.classList.add('sp-entry');
   if(!backdrop){backdrop=document.createElement('div');backdrop.className='sp-backdrop';backdrop.addEventListener('click',()=>document.getElementById('ivCancelBtn')?.click());}
   v.append(backdrop);}
  document.getElementById(btnId)?.click();
  if(PC.matches)requestAnimationFrame(()=>{const add=v.querySelector('.stock-add');if(add&&add.hidden)closeEntry(false);else add?.querySelector('input,select,button')?.focus({preventScroll:true});});
 }
 function closeEntry(saved){
  const v=view();ui.entry=false;v?.classList.remove('sp-entry');backdrop?.remove();
  if(saved){const add=v?.querySelector('.stock-add');if(add)add.hidden=true;}
 }
 // 원래 [입력 닫기](확인 후)로 폼이 숨겨지면 창도 닫는다
 const watchAdd=()=>{const add=view()?.querySelector('.stock-add');if(!add||add.dataset.spw)return;add.dataset.spw='1';
  new MutationObserver(()=>{if(add.hidden&&ui.entry)closeEntry(false);}).observe(add,{attributes:true,attributeFilter:['hidden']});};
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&ui.entry&&!document.querySelector('dialog[open]')){ev.preventDefault();document.getElementById('ivCancelBtn')?.click();}});

 /* ── 최소 기준 창 ── */
 let sheet=null;
 function openSheet(html){
  if(!sheet){sheet=document.createElement('dialog');sheet.className='nd-pay-sheet nd-qa-sheet sp-sheet';sheet.addEventListener('click',ev=>{if(ev.target===sheet)sheet.close();});(document.getElementById('appView')||document.body).append(sheet);}
  sheet.innerHTML=html;if(!sheet.open){sheet.tabIndex=-1;sheet.showModal();}
  sheet.querySelector('[data-x]')?.addEventListener('click',()=>sheet.close());return sheet;
 }
 function minSheet(id){
  const it=itemOf(id);if(!it)return;const rows=groups().by.get(id)||[];const {colors,specs}=axes(it,rows);
  const cell=(c,s)=>rows.find(r=>r.color===c&&r.spec===s);
  const inp=r=>r?`<input inputmode="numeric" autocomplete="off" data-sp-minkey="${e(r.key)}" value="${r.minimum===null?'':n0(r.minimum)}" placeholder="—" aria-label="${e(optLabel(r.color,r.spec))} 최소 기준">`:'<span class="none">—</span>';
  const grid=`<table class="sp-mxin"><tr><th></th>${specs.map(s=>`<th>${e(s||'기본')}</th>`).join('')}</tr>${colors.map(c=>`<tr><td class="sp-c">${e(c||'—')}</td>${specs.map(s=>`<td>${inp(cell(c,s))}</td>`).join('')}</tr>`).join('')}</table>`;
  const s=openSheet(`<div class="nd-ps-hd"><b>최소 기준</b><span class="nd-qa-sub">${e(it.name)} · 이 수량보다 적으면 '부족'으로 알려요</span></div>
   <div class="nd-qa-body">${grid}
    <div class="sp-fill"><span>빈칸 한 번에</span><input inputmode="numeric" id="sp_fill" placeholder="예: 3" aria-label="빈칸에 넣을 최소 기준"><button type="button" class="btn ghost" data-sp-fillgo>채우기</button></div>
    <p class="nd-qa-note">빈칸(—) = 기준 없음, 0 = 최소 보유 없음.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" id="sp_minsave">최소 기준 저장</button></div>`);
  const ins=[...s.querySelectorAll('[data-sp-minkey]')];
  ins.forEach((x,i)=>{x.addEventListener('focus',()=>x.select());x.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.isComposing){ev.preventDefault();(ins[i+1]||s.querySelector('#sp_minsave')).focus();}});});
  s.querySelector('[data-sp-fillgo]').onclick=()=>{const v=s.querySelector('#sp_fill').value.trim();if(!/^\d+$/.test(v)){say('0 이상의 숫자를 적어 주세요');return;}ins.forEach(x=>{if(!x.value.trim())x.value=v;});};
  s.querySelector('#sp_minsave').onclick=async ev=>{const btn=ev.currentTarget;
   const changes=[];for(const x of ins){const raw=x.value.replace(/,/g,'').trim();if(raw!==''&&!/^\d+$/.test(raw)){say('최소 기준은 0 이상의 숫자로 적어 주세요');x.focus();return;}changes.push({key:x.dataset.spMinkey,value:raw===''?null:Number(raw)});}
   const mins={...(it.stock_minimums||{})};changes.forEach(c=>{const k=c.key.split('|').slice(1).join('|');if(c.value===null)delete mins[k];else mins[k]=c.value;});
   const next=db.items.map(i=>i.id===id?{...i,stock_minimums:mins}:i);
   btn.disabled=true;btn.textContent='저장 중…';
   try{if(await saveTable('items',next)){db.items=next;try{if(typeof itEditing!=='undefined'&&itEditing&&itEditing.id===id)itEditing.stock_minimums={...mins};}catch{}sheet.close();renderStock();say('최소 기준을 저장했어요');}
    else{btn.disabled=false;btn.textContent='다시 시도';}}catch(err){say(err.message);btn.disabled=false;btn.textContent='최소 기준 저장';}};
  setTimeout(()=>ins[0]?.focus(),0);
 }

 /* ── 기록 메뉴 ── */
 let menu=null;
 const closeMenu=()=>{menu?.remove();menu=null;};
 function openRecordMenu(btn,id){
  if(menu&&menu.dataset.id===id){closeMenu();return;}closeMenu();
  const m=(db.stock_moves||[]).find(x=>x.id===id);if(!m)return;
  let h='';try{h=stockRecordActions(m);}catch{}
  const items=[];if(/data-stock-edit/.test(h))items.push(['수정','수량 · 날짜 · 메모',()=>openStockChange(id,'edit')]);
  if(/data-stock-restore/.test(h))items.push(['복원','같은 기록을 다시 더해요',()=>{const b=document.createElement('button');b.dataset.stockRestore=id;b.hidden=true;document.body.append(b);b.click();b.remove();}]);
  if(/data-stock-void/.test(h))items.push(['삭제','반대 기록으로 되돌려요',()=>openStockChange(id,'void'),true]);
  if(!items.length)return;
  menu=document.createElement('div');menu.className='sp-menu';menu.dataset.id=id;menu.setAttribute('role','menu');
  menu.innerHTML=items.map(([t,s,,d],i)=>`<button type="button" role="menuitem" data-i="${i}" class="${d?'danger':''}"><b>${t}</b><small>${s}</small></button>`).join('');
  menu.addEventListener('click',ev=>{const b=ev.target.closest('[data-i]');if(!b)return;ev.stopPropagation();const f=items[+b.dataset.i][2];closeMenu();f();});
  const row=btn.closest('.sp-tr');row.append(menu);const rr=row.getBoundingClientRect(),br=btn.getBoundingClientRect();menu.style.top=Math.round(br.bottom-rr.top+4)+'px';
 }
 document.addEventListener('click',ev=>{if(menu&&!ev.target.closest?.('.sp-menu,.sp-dots'))closeMenu();},true);

 /* ── 눌림 ── */
 const pickItem=id=>{const b=document.querySelector(`#stockItems>.stock-item[data-stock-id="${CSS.escape(id)}"]`);if(b)b.click();else{stockSelectedItem=id;renderStock();}};
 document.addEventListener('click',ev=>{
  const host=document.getElementById('spDetail');if(!host||!host.contains(ev.target))return;
  const t=ev.target.closest('button,[data-sp-opt],[data-sp-go]');if(!t)return;
  if(t.matches('[data-sp-tab]')){ui.tab=t.dataset.spTab;paint();return;}
  if(t.matches('[data-sp-mode]')){ui.mode=t.dataset.spMode;paint();return;}
  if(t.matches('[data-sp-rec]')){ui.rec=t.dataset.spRec;paint();return;}
  if(t.matches('[data-sp-optclear]')){ui.opt='';paint();return;}
  if(t.matches('[data-sp-opt]')){ui.opt=t.dataset.spOpt;ui.tab='history';ui.rec='all';paint();return;}
  if(t.matches('[data-sp-go-entry]')){openEntry(t.dataset.spGoEntry);return;}
  if(t.matches('[data-sp-min]')){minSheet(stockSelectedItem);return;}
  if(t.matches('[data-sp-filter]')){const f=document.getElementById('stockFilter');if(f){f.value=t.dataset.spFilter==='missing'&&![...f.options].some(o=>o.value==='missing')?'all':t.dataset.spFilter;f.dispatchEvent(new Event('change',{bubbles:true}));}return;}
  if(t.matches('[data-sp-go]')){ui.tab='options';ui.opt='';pickItem(t.dataset.spGo);return;}
  if(t.matches('[data-sp-rmenu]')){ev.stopPropagation();openRecordMenu(t,t.dataset.spRmenu);return;}
  if(t.matches('[data-sp-quote]')){try{switchView('quotes');qtSel=t.dataset.spQuote;renderQtList();renderQtDetail();}catch{}return;}
  if(t.matches('[data-sp-purchase]')){try{window.NaroPurchases?.open?.(t.dataset.spPurchase);}catch{}return;}
  if(t.matches('[data-sp-item]')){try{switchView('items');itSel=t.dataset.spItem;renderItList?.();renderItDetail?.();}catch{}return;}
 });
 document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('#spDetail [role="button"]')){ev.preventDefault();ev.target.click();}});
 // 다른 품목을 고르면 옵션 탭부터
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('#stockItems>.stock-item[data-stock-id]');if(b&&b.dataset.stockId!==(typeof stockSelectedItem!=='undefined'?stockSelectedItem:'')){ui.tab='options';ui.opt='';ui.rec='all';}},true);
 const boot=()=>{watchAdd();if(!view()?.classList.contains('hidden'))try{renderStock();}catch{}};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
 window.NaroStockPanel={paint,openEntry,minSheet};
})();
