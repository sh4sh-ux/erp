// 매입 화면(2단계 — feature/naro-purchase). 견적서 화면과 같은 부품·같은 스타일 규칙을 쓴다(10/10 시안).
// 데이터: 매입 파일은 PURCHASE_* 메시지로(저장소 쪽 business-workspace), 재고·입출금은 기존 Table.save(SAVE_TABLE) 그대로.
// 매입 저장(작성)과 재고 입고 확정은 서로 다른 버튼·창. 입고·반품·입고 취소는 purchase-saga 절차(끊겨도 이어서, 두 번 안 됨).
import {paymentStatus,lineBase} from './purchase-ledger.mjs';
import {postReceipt,resume,postReturn,voidReceipt,unfinished,receiptState} from './purchase-saga.mjs';

const MSG={BUSY:'저장이 끝난 뒤 다시 눌러 주세요.',STORAGE_CONFLICT:'다른 기기에서 먼저 바뀌었어요. 최신 내용으로 다시 불러왔어요.',VALIDATION:'입력 내용을 확인해 주세요(수량·금액·이미 처리된 기록).',WRITE_BLOCKED:'이 작업은 지금 할 수 없어요.',UNAVAILABLE:'Google Drive에서는 아직 매입을 쓸 수 없어요. Dropbox에서 쓸 수 있어요.',SAVE_UNCONFIRMED:'저장 결과를 확인하지 못했어요. [저장 결과 확인]을 눌러 주세요.',NETWORK_ERROR:'연결을 확인한 뒤 다시 시도해 주세요.',RECONNECT_REQUIRED:'저장소 연결이 끊겼어요. 다시 연결해 주세요.',QUOTA_LIMIT:'저장 공간이 부족해요.'};
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n0=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
const money=v=>n0(v)+'원';
const today=()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const md=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');return m?`${m[1]}.${m[2]}.${m[3]}`:'';};
const uid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,16);
const nowIso=()=>new Date().toISOString();
const ICON={cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'};

const DOTS='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>';
const OK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const RM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const mdShort=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?`${Number(m[2])}.${m[3]}`:'';};
const num=v=>Math.floor(Number(String(v??'').replace(/[^\d]/g,''))||0);

// ── 견적서 화면의 스타일을 매입 화면에 그대로 ──
// 견적서 규칙은 #view-quotes·#qtForm 같은 이름에 묶여 있다. 같은 규칙을 이름만 바꿔 원래 규칙 바로 뒤에 한 벌 더 넣는다
// (순서까지 같아야 어느 규칙이 이기는지도 같다). 견적서를 고치면 매입도 저절로 같이 바뀐다.
const ID_MAP=[['view-quotes','view-purchases'],['qtForm','puForm'],['qtList','puList'],['qtCols','puCols'],['qtDetailCard','puDetailCard'],['qtEmpty','puEmpty'],['qtBackBtn','puBackBtn'],['qtSearch','puSearch'],['qtNewBtn','puNewBtn'],['qtCount','puCount'],['qtSaveBtn','puSaveBtn'],['qtCancelBtn','puCancelBtn'],
 ['qp-tab-items','pp-tab-items'],['qp-tab-flow','pp-tab-flow'],['qp-tab-basic','pp-tab-basic'],['qp-panel-items','pp-panel-items'],['qp-panel-flow','pp-panel-flow'],['qp-panel-basic','pp-panel-basic'],
 ['fq_heroTotal','pu_heroTotal'],['fq_supply','pu_supply'],['fq_vat','pu_vat'],['fq_total','pu_total'],['fq_addLine','pu_addLine'],['fq_sizeBtn','pu_sizeBtn'],['fq_sizePanel','pu_sizePanel'],['fq_date','pu_date'],['fq_co','pu_co'],['fq_memo','pu_memo']];
const ID_TO=Object.fromEntries(ID_MAP);
const ID_RE=new RegExp('#('+ID_MAP.map(x=>x[0]).join('|')+')(?![\\w-])','g');
const mirrored=new WeakSet();
export function mirrorQuoteStyles(doc=document){
 let added=0;
 const walk=(owner,rules)=>{for(let i=0;i<rules.length;i++){const r=rules[i];
  if(typeof r.selectorText==='string'){ID_RE.lastIndex=0;if(!ID_RE.test(r.selectorText))continue;ID_RE.lastIndex=0;
   const sel=r.selectorText.replace(ID_RE,(m,id)=>'#'+ID_TO[id]);
   try{owner.insertRule(`${sel}{${r.style.cssText}}`,i+1);i++;added++;}catch{}}
  else if(r.cssRules&&typeof r.insertRule==='function')walk(r,r.cssRules);}};
 for(const sh of doc.styleSheets){if(mirrored.has(sh))continue;let rules;try{rules=sh.cssRules;}catch{continue;}if(!rules||!rules.length)continue;mirrored.add(sh);walk(sh,rules);}
 return added;
}

export function installPurchaseUI({port,features=()=>true}){
 const g=globalThis;
 // 업무 화면의 전역 상수(db·renderers·Table·currentView)는 window 속성이 아니라 이름으로만 닿는다.
 /* global db, renderers, Table, currentView */
 const app={get db(){try{return db;}catch{return null;}},get renderers(){try{return renderers;}catch{return null;}},get Table(){try{return Table;}catch{return null;}},get view(){try{return currentView;}catch{return '';}}};
 const wait=new Map();
 const ask=(type,body={})=>new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();wait.set(requestId,{resolve,reject});port().postMessage({type,requestId,...body});setTimeout(()=>{if(wait.has(requestId)){wait.delete(requestId);reject(Object.assign(Error('NETWORK_ERROR'),{code:'NETWORK_ERROR'}));}},45000);});
 const onMessage=m=>{if(typeof m?.type!=='string'||!m.type.startsWith('PURCHASE_'))return false;const w=wait.get(m.requestId);if(!w)return true;wait.delete(m.requestId);if(m.type==='PURCHASE_ERROR')w.reject(Object.assign(Error(m.code||'INTERNAL_ERROR'),{code:m.code||'INTERNAL_ERROR'}));else w.resolve(m);return true;};
 const st={status:'unknown',doc:null,sel:null,tab:'items',filter:'',q:'',draft:null,dirty:false,editing:false,open:false,working:false,note:'',sz:null};
 const mob=matchMedia('(max-width:820px)'),desk=matchMedia('(min-width:1024px)');
 const D=()=>app.db,companies=()=>D()?.companies||[];
 const coName=id=>companies().find(c=>c.id===id)?.name||'';
 const itemOf=id=>(D()?.items||[]).find(i=>i.id===id);
 const isWork=i=>i?.type==='작업';
 const specsOf=i=>[...new Set([...(i?.variants||[]).map(v=>v.spec).filter(Boolean),...(i?.spec?[i.spec]:[])])];
 const buyOf=(i,spec)=>{if(!i)return 0;if(typeof g.itemBuy==='function')return Number(g.itemBuy(i,spec))||0;const v=(i.variants||[]).find(x=>x.spec===spec);return Number(v?.buy_price??i.buy_price)||0;};
 const rows=()=>st.doc?.rows||[];
 const cur=()=>rows().find(p=>p.id===st.sel)||null;
 const shown=()=>st.draft&&st.draft.id===st.sel?st.draft:cur();
 const received=(p,l)=>(p.receipts||[]).filter(r=>!r.void_at).reduce((s,r)=>s+(r.lines.find(x=>x.line_id===l.id)?.qty||0),0);
 const returned=(p,l)=>(p.returns||[]).reduce((s,r)=>s+(r.lines.find(x=>x.line_id===l.id)?.qty||0),0);
 const qtyOf=p=>p.lines.reduce((s,l)=>s+(l.qty||0),0),gotOf=p=>p.lines.reduce((s,l)=>s+received(p,l),0);
 const totals=p=>{const supply=Object.values(lineBase(p)).reduce((s,v)=>s+v,0);const tax=p.vat_on===false?0:Math.round(supply*.1);return {supply,tax,total:supply+tax};};
 const payState=p=>paymentStatus(p,D()?.payments||[]);
 const pays=p=>(D()?.payments||[]).filter(x=>x.purchase_id===p.id);
 const toast=t=>typeof g.toast==='function'?g.toast(t):null;
 const saved=p=>rows().some(x=>x.id===p.id);
 const editable=p=>p.status!=='취소'&&!(p.receipts||[]).length&&!(p.returns||[]).length;
 // 목록·머리의 상태 하나(견적서와 같은 자리, 같은 색 규칙)
 function disp(p){
  if(p.status==='취소')return ['취소','st-lost'];
  const q=qtyOf(p),got=gotOf(p);
  if(!saved(p)||!got)return ['작성중','st-draft'];
  if(got<q)return ['부분 입고','st-sent st-partial'];
  const ps=payState(p);if(ps.due-ps.paid>0)return ['미출금','st-won'];
  return ['완료','st-done'];
 }
 const pill=p=>{const [t,c]=disp(p);return `<span class="pill ${c}">${esc(t)}</span>`;};

 // ── 메뉴(업무 묶음, 입금·출금 아래) ──
 const nav=document.createElement('button');nav.type='button';nav.className='nav-item pu-nav';nav.dataset.view='purchases';nav.innerHTML=ICON.cart+'<span>매입</span>';
 const view=document.createElement('section');view.className='view hidden pu-view';view.id='view-purchases';view.setAttribute('aria-label','매입');
 function place(){
  const rail=document.querySelector('#appView .rail-nav'),pay=rail?.querySelector('.nav-item[data-view="payments"]'),host=document.getElementById('view-quotes')?.parentElement;
  if(!rail||!pay||!host)return false;
  if(!features())return true; // 매입 권한이 없으면 메뉴를 만들지 않는다
  if(!nav.isConnected)pay.after(nav);if(!view.isConnected)host.append(view);
  if(app.renderers&&!app.renderers.purchases)app.renderers.purchases=render;
  nav.onclick=()=>{if(typeof g.switchView==='function')g.switchView('purchases');};
  return true;
 }
 if(!place())new MutationObserver((r,o)=>{if(place())o.disconnect();}).observe(document.body,{childList:true,subtree:true});
 [mob,desk].forEach(m=>m.addEventListener('change',()=>{if(app.view==='purchases')render();}));

 async function load(reload=false){
  try{const r=await ask('PURCHASE_STATE',{reload});st.status=r.state.status;st.doc=r.doc;st.note=r.state.capacity?.warn?'매입 파일이 70% 찼어요. 연도별로 나누는 작업이 필요해요.':'';}
  catch(e){st.status='error';st.note=MSG[e.code]||'매입을 불러오지 못했어요.';}
  render();
 }
 const fail=async e=>{const t=MSG[e?.code]||e?.message||'저장하지 못했어요.';toast(t);if(e?.code==='STORAGE_CONFLICT'){st.draft=null;st.dirty=false;st.editing=false;await load(true);return;}render();};
 async function savePurchase(next){const r=await ask('PURCHASE_SAVE',{doc:next});st.doc=r.doc;
  // 앞서 끊긴 저장이 먼저 확인돼 반영된 경우: 그 내용이 이번 것과 같으면 그대로 진행, 다르면 화면을 맞추고 다시 누르게 한다
  if(r.applied===false&&JSON.stringify(r.doc?.rows)!==JSON.stringify(next.rows))throw Object.assign(Error('앞서 끊긴 저장을 먼저 확인해 반영했어요. 내용을 확인하고 다시 눌러 주세요.'),{code:'RETRY'});
  return r.doc;}
 const io={getDoc:()=>structuredClone(st.doc),getStock:()=>structuredClone(D().stock_moves||[]),savePurchases:savePurchase,saveStock:rows=>app.Table.save('stock_moves',rows)};

 // ── 그리기: 견적서와 같은 뼈대(머리·목록 카드·상세 카드) ──
 function render(){
  if(!view.isConnected)return;
  mirrorQuoteStyles();
  if(st.status==='unknown'){st.status='loading';load();}
  const more=document.getElementById('moreNavBtn');if(more&&app.view==='purchases')more.classList.add('on');
  const ready=st.status==='ready',p=ready?shown():null;
  const open=ready?!!p:true; // 준비 전(시작·지원 안 함·오류)은 상세 카드에 안내
  view.dataset.ndPhone=open?'detail':'list';
  const list=ready?rows().filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.no.localeCompare(a.no)):[];
  const pending=ready?unfinished(st.doc,D().stock_moves||[]):[];
  const chips=[['','전체'],['작성중','작성중'],['부분 입고','부분 입고'],['미출금','미출금'],['완료','완료']];
  const count=ready?rows().filter(x=>x.kind!=='기초재고').length:0;
  // 검색 줄 자리: PC(1024~)는 머리 안, 그보다 좁으면 목록 카드 맨 위 — 견적서(panel-layout-b)와 같다
  const tools=`<div class="list-head naro-search-toolbar"><div class="search">${ICON.search}<input id="puSearch" placeholder="매입처·번호·품목 검색" aria-label="매입처·번호·품목 검색" value="${esc(st.q)}" ${ready?'':'disabled'}></div>
     <button class="btn-add" id="puNewBtn" type="button" title="새 매입" aria-label="새 매입" ${ready?'':'disabled'}>${ICON.plus}</button></div>`;
  view.innerHTML=`<div class="page-head"><h2>매입</h2><span class="count" id="puCount">${ready?count+'건':''}</span><div class="sp"></div>${desk.matches?tools:''}</div>
   <div class="cols quote-cols${open?' detail-open':''}" id="puCols">
    <div class="card quote-list-card">${desk.matches?'':tools}
     <div class="nd-chips" role="group" aria-label="빠른 필터">${chips.map(([v,t])=>`<button type="button" data-v="${v}" aria-pressed="${st.filter===v}">${t}</button>`).join('')}</div>
     ${pending.length?`<div class="pu-banner" role="status"><span>마무리 안 된 입고·반품 ${pending.length}건</span><button type="button" data-act="resume">이어서 하기</button></div>`:''}
     ${st.note&&ready?`<div class="pu-banner warn" role="status"><span>${esc(st.note)}</span></div>`:''}
     <div class="list" id="puList">${listHtml(list)}</div>
    </div>
    <div class="card quote-detail-card" id="puDetailCard">
     ${desk.matches?'<div class="panel-b-empty-heading"><span class="workspace-caption">업무</span><h3>매입 상세</h3></div>':''}
     <button class="quote-back" id="puBackBtn" type="button" data-act="back" aria-label="매입 목록으로 돌아가기" ${ready&&p?'':'hidden'}>${ICON.back}매입</button>
     ${emptyCard(ready&&p)}${ready&&p?form(p):'<div class="detail workspace-form hidden" id="puForm"></div>'}
    </div>
   </div>`;
  bind();
 }
 function listHtml(list){
  if(st.status!=='ready')return '';
  if(!list.length)return `<div class="empty">${rows().length?'조건에 맞는 매입이 없어요.':'아직 매입이 없어요. + 버튼으로 첫 매입을 적어 보세요.'}</div>`;
  return list.map(p=>`<div class="list-item${p.id===st.sel?' on':''}" data-id="${esc(p.id)}" role="button" tabindex="0"><div class="li-body"><div class="li-title"><span class="li-nm">${esc(coName(p.vendor_id)||'매입처 없음')}</span><span class="li-no">${esc(p.no)}</span></div><div class="li-date">${esc(p.date)}</div></div><div class="li-right"><div class="li-amt">${money(totals(p).total)}</div>${pill(p)}</div></div>`).join('');
 }
 function emptyCard(hide=false){
  const box=(t,b,act='')=>`<div class="detail-empty pu-empty${hide?' hidden':''}" id="puEmpty">${ICON.cart}<div><b>${t}</b><br>${b}</div>${act}</div>`;
  if(st.status==='loading'||st.status==='unknown')return box('불러오는 중…','');
  if(st.status==='unsupported')return box('Google Drive에서는 아직 매입을 쓸 수 없어요','매입 기록은 지금 Dropbox에서만 저장돼요. 다른 기능은 그대로 쓸 수 있어요.');
  if(st.status==='error')return box('매입을 불러오지 못했어요',esc(st.note||'잠시 뒤 다시 시도해 주세요.'),'<button type="button" class="btn ghost" data-act="reload">다시 불러오기</button>');
  if(st.status==='absent')return box('매입을 시작할까요?','매입처·품목·수량·단가를 적고 [입고 처리]를 하면 재고에 더해지고, 줄 돈(미출금)이 잡혀요.<br>기존 재고·입출금 기록은 바뀌지 않아요.','<button type="button" class="btn save" data-act="start">매입 시작하기</button>');
  return box('왼쪽에서 매입을 고르거나','<b>+</b> 버튼으로 새로 적으세요.');
 }
 function match(p){
  if(p.kind==='기초재고')return false;
  if(st.filter&&disp(p)[0]!==st.filter)return false;
  if(!st.q)return true;
  const hay=[p.no,coName(p.vendor_id),p.memo,...p.lines.map(l=>itemOf(l.item_id)?.name||'')].join(' ').toLowerCase();
  return hay.includes(st.q.toLowerCase());
 }

 function form(p){
  const t=totals(p),sv=saved(p);
  const tabs=[['items','품목'],['flow','진행'],['basic','정보']];
  // 머리·탭: PC는 고정 머리(panel-b-work-header)+본문(workspace-form-body) 묶음, 폰·태블릿은 묶음 없이 양식 바로 아래 — 견적서(panel-layout-b)와 같다
  const head=`    ${mob.matches?`<div class="qp-mobile-actions"><button type="button" data-act="back">‹ 매입</button><button type="button" class="qp-primary naro-compact-action" data-act="save">저장</button></div>`:''}
    <div class="qt-hero quote-summary">
     <div class="qs-info"><div class="qs-row"><span class="qs-k">매입처</span><span class="qs-val co">${esc(coName(p.vendor_id)||'매입처를 골라 주세요')}</span></div></div>
     <div class="qs-amount"><div class="qs-amt-k">금액 (부가세 포함)</div><div class="qs-amt-v" id="pu_heroTotal">${money(t.total)}</div></div>
     <div class="qp-metadata"><span>${esc(p.no)}</span><span>${esc(md(p.date))}</span>${pill(p)}</div>
    </div>
    <div class="qp-tabs" role="tablist" aria-label="매입 상세">${tabs.map(([k,l])=>`<button type="button" id="pp-tab-${k}" role="tab" data-tab="${k}" aria-controls="pp-panel-${k}" aria-selected="${st.tab===k}" tabindex="${st.tab===k?0:-1}">${l}</button>`).join('')}</div>`;
  return `<div class="detail workspace-form${st.editing?'':' nd-view'}" id="puForm" data-nd-st="${esc(disp(p)[0])}">
   ${desk.matches?`<div class="panel-b-work-header">${head}</div>`:''}
   ${desk.matches?'<div class="workspace-form-body">':head}
    ${next(p,sv)}
    <div class="qt-sec qt-basic" id="pp-panel-basic" role="tabpanel" aria-labelledby="pp-tab-basic" ${st.tab==='basic'?'':'hidden'}>${basic(p,sv)}</div>
    <div class="qt-sec" id="pp-panel-items" role="tabpanel" aria-labelledby="pp-tab-items" ${st.tab==='items'?'':'hidden'}>${itemsPanel(p,sv)}</div>
    <div class="qt-sec qp-flow nd-rec-on" id="pp-panel-flow" role="tabpanel" aria-labelledby="pp-tab-flow" ${st.tab==='flow'?'':'hidden'}>${flow(p,sv)}</div>
   ${desk.matches?'</div>':''}
   <div class="form-actions quote-form-actions">
    <button class="btn save${st.dirty?'':' nd-saved'}" id="puSaveBtn" type="button" data-act="save" aria-label="${st.dirty?'저장':'저장됨 — 바뀐 내용 없음'}">${st.dirty?'저장':'저장됨'}</button>
    ${st.dirty?`<button class="btn ghost" id="puCancelBtn" type="button" data-act="revert">${sv?'되돌리기':'취소'}</button>`:''}
    ${sv?(mob.matches?`<details class="qp-more pu-more"><summary>··· 더보기</summary>${moreBtns(p)}</details>`:`<details class="panel-b-danger pu-more"><summary aria-label="더보기">더보기</summary><div class="nd-pop">${moreBtns(p)}</div></details>`):''}
   </div>
  </div>`;
 }
 // 진행 줄: 발주 → 입고 → 출금 → 계산서 + 다음 할 일(견적서: 수주 → 납품 → 입금 → 계산서)
 function next(p,sv){
  if(p.status==='취소')return `<div class="nd-next nd-cancelled"><div class="nd-cx"><b>취소됨</b><span>재고·줄 돈에서 빠졌어요</span></div></div>`;
  const q=qtyOf(p),got=gotOf(p),ps=sv?payState(p):{due:totals(p).total,paid:0},left=Math.max(0,ps.due-ps.paid),tax=!!p.tax_invoice?.received;
  const allIn=sv&&q>0&&got>=q;
  const list=[
   {t:'발주',st:sv?'done':'cur'},
   {t:`입고 ${n0(got)}/${n0(q)}개`,st:allIn?'done':sv?'cur':'todo',tab:'flow'},
   {t:`출금 ${n0(ps.paid)} / ${n0(ps.due)}원`,st:sv&&ps.due>0&&!left?'done':allIn?'cur':'todo',tab:'flow'},
   {t:tax?'계산서 받음':'계산서 미수취',st:tax?'done':'todo',tab:'flow'}];
  const acts=[];
  if(sv&&!st.dirty){
   if(left>0)acts.push(`<button type="button" class="nd-next-b${got<q?'':' pri'}" data-act="pay">출금 기록</button>`);
   if(got<q)acts.push('<button type="button" class="nd-next-b pri" data-act="receive">입고 처리</button>');
  }
  const sum=sv?{t:`입고 ${n0(got)} / ${n0(q)}개`,s:`출금 ${n0(ps.paid)}원 · ${tax?'계산서 받음':'계산서 미수취'}`}:{t:'작성 중',s:'저장하면 입고 처리를 할 수 있어요'};
  return `<div class="nd-next"><button type="button" class="nd-sum" data-tab="flow"><b>${esc(sum.t)}</b><span>${esc(sum.s)}</span></button><ol class="nd-steps">${list.map((x,i)=>`${i?`<li class="nd-step-ln ${x.st==='todo'?'':'on'}" aria-hidden="true"></li>`:''}<li class="nd-step ${x.st}">${x.tab?`<button type="button" data-tab="${x.tab}">`:'<span>'}<i>${x.st==='done'?OK:''}</i>${esc(x.t)}${x.tab?'</button>':'</span>'}</li>`).join('')}</ol>${acts.length?`<div class="nd-next-act">${acts.join('')}</div>`:''}</div>`;
 }
 const editBtn=p=>saved(p)&&editable(p)?`<button type="button" class="nd-edit-b" data-act="edit">${st.editing?'완료':'편집'}</button>`:'';
 function itemsPanel(p,sv){
  const t=totals(p),cnt=`${p.lines.filter(l=>l.item_id).length}건 · 총 ${n0(qtyOf(p))}개`;
  const optLabel=l=>[l.color,l.spec].filter(Boolean).map(esc).join(' · ');
  const name=it=>it?`${esc(it.name||'')}<span class="cd">${esc(it.code||'')}</span>`:'<span class="ph">품목 선택</span>';
  const lines=p.lines.map((l,i)=>{const it=itemOf(l.item_id),colors=it?.colors||[],specs=specsOf(it);
   return `<div class="qline" data-idx="${i}"><button type="button" class="ip-btn" data-f="item" data-idx="${i}" aria-label="${esc(it?.name||'')} 품목">${name(it)}</button>
    <div class="dual"><select data-f="lcolor" data-idx="${i}" aria-label="색상">${colors.length?colors.map(c=>`<option ${c===l.color?'selected':''}>${esc(c)}</option>`).join(''):'<option value="">—</option>'}</select><select data-f="vspec" data-idx="${i}" aria-label="규격/옵션">${specs.length?specs.map(s=>`<option ${s===l.spec?'selected':''}>${esc(s)}</option>`).join(''):'<option value="">—</option>'}</select></div>
    <input type="text" inputmode="numeric" class="num" data-f="qty" data-idx="${i}" value="${l.qty?n0(l.qty):''}" aria-label="수량">
    <input type="text" inputmode="numeric" class="num" data-f="price" data-idx="${i}" value="${l.unit_price?n0(l.unit_price):''}" placeholder="0" aria-label="단가">
    <span class="amt" data-amt="${i}">${n0((l.qty||0)*(l.unit_price||0))}</span>
    <button type="button" class="rm" data-rm="${i}" title="행 삭제" aria-label="행 삭제">${RM}</button></div>`;}).join('');
  const cards=mob.matches?`<div class="qp-cards"><section class="qp-products"><h3>품목 ${p.lines.filter(l=>l.item_id).length}건${editBtn(p)}</h3>
   ${p.lines.map((l,i)=>{const it=itemOf(l.item_id);return `<article class="qp-card"><button class="qp-card-edit" type="button" data-qp-edit="${i}"><strong>${it?`${esc(it.name||'')} <small class="qp-code">${esc(it.code||'')}</small>`:'품목 선택'}</strong><span class="qp-muted">편집 ›</span></button>
    ${optLabel(l)?`<p class="qp-muted">${optLabel(l)}</p>`:''}<div class="qp-card-bottom"><div class="qp-stepper"><button type="button" data-qstep="${i}" data-v="-1" aria-label="수량 줄이기">−</button><span>${n0(l.qty)}</span><button type="button" data-qstep="${i}" data-v="1" aria-label="수량 늘리기">+</button></div>
    <div class="qp-card-amount"><strong>${money((l.qty||0)*(l.unit_price||0))}</strong><small class="qp-muted">${money(l.unit_price)} / ${esc(it?.unit||'EA')}</small></div></div></article>`;}).join('')}
   <div class="nd-addrow"><button class="qp-add nd-gi-plus nd-gi-f" type="button" data-act="addline">품목 추가</button><button class="btn-line-add qp-add" type="button" data-act="size">⊞ 옵션별 한번에</button></div></section></div>`:'';
  return `<div class="qt-sec-t">품목 <span class="cnt">${cnt}</span>${mob.matches?'':editBtn(p)}</div>
   ${cards}
   <div class="qlines"><div class="qline head"><span>품목</span><span class="dual" style="text-align:center"><span>색상</span><span>규격/옵션</span></span><span style="text-align:center">수량</span><span style="text-align:right;padding-right:10px">단가</span><span style="text-align:right">금액</span><span></span></div>${lines}</div>
   <div class="line-btns"><button class="btn-line-add nd-gi-plus nd-gi-f" id="pu_addLine" type="button" data-act="addline">행 추가</button><button class="btn-line-add" id="pu_sizeBtn" type="button" data-act="size">⊞ 옵션별 한번에</button></div>
   <div id="pu_sizePanel">${st.sz&&st.editing?sizePanel(p):''}</div>
   <div class="qtotals"><div class="row"><span class="k">공급가액</span><span class="v" id="pu_supply">${money(t.supply)}</span></div><div class="row"><span class="k">부가세 ${p.vat_on===false?'(없음)':'(10%)'}</span><span class="v" id="pu_vat">${money(t.tax)}</span></div><div class="row grand"><span class="k">합계</span><span class="v" id="pu_total">${money(t.total)}</span></div></div>
   ${sv&&!editable(p)&&p.status!=='취소'?'<div class="hint" style="text-align:right;margin-top:6px">입고가 시작된 매입은 품목을 고칠 수 없어요 — 진행 탭에서 입고 취소·반품으로 바로잡아요</div>':''}`;
 }
 // 옵션별 한번에(견적서와 같은 칸): 품목·색상을 고르고 옵션마다 수량·단가
 function sizePanel(p){
  const cands=(D()?.items||[]).filter(i=>(i.variants||[]).length&&!isWork(i)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko'));
  if(!cands.length)return `<div class="szpanel"><div class="hint" style="margin:0">규격/옵션이 등록된 품목이 없습니다. 품목 화면에서 옵션을 먼저 등록해 주세요.</div><div class="szfoot"><div class="sp"></div><button class="btn ghost" type="button" data-act="szclose">닫기</button></div></div>`;
  const it=cands.find(x=>x.id===st.sz.item)||cands.find(x=>p.lines.some(l=>l.item_id===x.id))||cands[0];
  const colors=it.colors||[],color=colors.includes(st.sz.color)?st.sz.color:(p.lines.find(l=>l.item_id===it.id&&colors.includes(l.color))?.color||colors[0]||'');
  st.sz.item=it.id;st.sz.color=color;
  const have={};p.lines.forEach(l=>{if(l.item_id===it.id&&(l.color||'')===color)have[l.spec||'']=l;});
  return `<div class="szpanel"><div class="szhead"><select id="pu_szItem" aria-label="품목">${cands.map(i=>`<option value="${esc(i.id)}" ${i.id===it.id?'selected':''}>${esc(i.name)}${i.code?' '+esc(i.code):''}</option>`).join('')}</select>
    <select id="pu_szColor" aria-label="색상" ${colors.length?'':'disabled'}>${colors.length?colors.map(c=>`<option ${c===color?'selected':''}>${esc(c)}</option>`).join(''):'<option value="">색상 —</option>'}</select></div>
   <div class="szgrid">${it.variants.map(v=>{const l=have[v.spec],price=l?l.unit_price:buyOf(it,v.spec);return `<div class="szcell"><div class="lb" title="${esc(v.spec)}">${esc(v.spec)}</div><input type="text" inputmode="numeric" data-sz="${esc(v.spec)}" value="${l&&l.qty?n0(l.qty):''}" placeholder="0" aria-label="${esc(v.spec)} 수량"><div class="pr"><input type="text" inputmode="numeric" data-szp="${esc(v.spec)}" value="${price?n0(price):''}" placeholder="단가" aria-label="${esc(v.spec)} 단가"></div></div>`;}).join('')}</div>
   <div class="szfoot"><span class="szsum" id="pu_szSum">총 ${n0(Object.values(have).reduce((a,l)=>a+(l.qty||0),0))}개</span><div class="sp"></div><button class="btn ghost" type="button" data-act="szclose">닫기</button><button class="btn save" type="button" data-act="szapply" style="flex:0 0 auto">품목에 넣기</button></div>
   <div class="hint" style="margin-top:8px">수량을 넣은 옵션만 품목 행으로 들어갑니다. 0이나 빈칸은 해당 행을 지웁니다.</div></div>`;
 }
 // 진행 탭: 견적서의 납품·입금·계산서 카드와 같은 모양 — 입고·출금·반품·계산서
 function flow(p,sv){
  if(!sv)return '<p class="nd-rec-empty" style="padding:18px 0">먼저 [저장]을 눌러 주세요. 저장한 뒤 입고 처리·출금을 기록할 수 있어요.</p>';
  const ids=new Set((D().stock_moves||[]).map(m=>m.id)),ps=payState(p),q=qtyOf(p),got=gotOf(p),left=Math.max(0,ps.due-ps.paid),live=p.status!=='취소';
  const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
  const lineLabel=r=>r.lines.map(x=>{const l=p.lines.find(y=>y.id===x.line_id);return [l?.color,l?.spec].filter(Boolean).join('·')+` ${n0(x.qty)}`;}).join(', ');
  const recRows=(p.receipts||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(r=>{const s=receiptState(r,ids),n=r.lines.reduce((a,x)=>a+x.qty,0);
   if(s==='void')return `<div class="nd-rec-row void"><span class="d">${mdShort(r.date)}</span><span class="n">입고 · ${esc(lineLabel(r))}</span><span class="a">${n0(n)}개</span><span class="t">취소됨</span></div>`;
   return `<div class="nd-rec-row"><span class="d">${mdShort(r.date)}</span><span class="n">입고 · ${esc(lineLabel(r))}${s==='posted'?'':' <small>· 마무리 필요</small>'}</span><span class="a">${n0(n)}개</span>${s==='posted'&&live?`<button type="button" class="nd-rec-more" data-menu-r="${esc(r.id)}" aria-label="이 입고 기록 메뉴" aria-expanded="false">${DOTS}</button>`:''}</div>`;}).join('');
  const payRows=pays(p).map(x=>`<div class="nd-rec-row"><span class="d">${mdShort(x.date)}</span><span class="n">${x.kind==='지급'?esc([x.method,x.memo&&!/^매입 /.test(x.memo)?x.memo:''].filter(Boolean).join(' · ')||'출금'):'환불 받음'}</span><span class="a${x.kind==='지급'?'':' neg'}">${x.kind==='지급'?'':'−'}${money(x.amount)}</span></div>`).join('');
  const retRows=(p.returns||[]).map(t=>`<div class="nd-rec-row"><span class="d">${mdShort(t.date)}</span><span class="n">반품 · ${esc(lineLabel(t))}${t.reason?` <small>· ${esc(t.reason)}</small>`:''}${t.posted_at?'':' <small>· 마무리 필요</small>'}</span><span class="a">${n0(t.lines.reduce((a,x)=>a+x.qty,0))}개</span></div>`).join('');
  const canReturn=live&&p.lines.some(l=>received(p,l)-returned(p,l)>0),tax=p.tax_invoice||{};
  return `<div class="nd-rec">
   <section class="nd-rec-card"><div class="nd-rec-hd"><div><h3>입고</h3><span>${n0(q)}개 중 ${n0(got)}개${got<q?` · ${n0(q-got)}개 남음`:got?' · 완료':''}</span></div>
    <div class="nd-rec-act">${live&&got<q?`<button type="button" class="nd-next-b" data-act="receive-part">부분 입고</button><button type="button" class="nd-next-b pri" data-act="receive">남은 ${n0(q-got)}개 전체 입고</button>`:''}</div></div>
    <i class="nd-rec-bar" style="--p:${pct(got,q)}%"></i>${recRows||'<p class="nd-rec-empty">아직 입고 기록이 없어요.</p>'}</section>
   <section class="nd-rec-card"><div class="nd-rec-hd"><div><h3>출금</h3><span>${n0(ps.due)}원 중 ${n0(ps.paid)}원${left>0?` · <b class="amber">${n0(left)}원 남음</b>`:ps.paid>ps.due?` · ${n0(ps.paid-ps.due)}원 초과`:ps.paid?' · 완료':''}</span></div>
    <div class="nd-rec-act">${live?`<button type="button" class="nd-next-b${left>0?' pri':''}" data-act="pay">출금 기록</button>`:''}</div></div>
    <i class="nd-rec-bar" style="--p:${pct(ps.paid,ps.due)}%"></i>${payRows||'<p class="nd-rec-empty">아직 출금 기록이 없어요.</p>'}</section>
   <section class="nd-rec-card"><div class="nd-rec-hd"><div><h3>반품</h3><span>입고된 것 중 매입처로 돌려보낸 수량</span></div>
    <div class="nd-rec-act">${canReturn?'<button type="button" class="nd-next-b" data-act="return">반품</button>':''}</div></div>${retRows}</section>
   <section class="nd-rec-card nd-rec-tax"><div class="nd-rec-hd"><div><h3>계산서</h3><span>${tax.received?`${esc(md(tax.date||''))} 받음`:'아직 받지 않았어요'}</span></div>
    <div class="nd-rec-act">${tax.received?'':'<b class="nd-rec-st amber">미수취</b>'}<button type="button" class="nd-next-b" data-act="tax">${tax.received?'바꾸기':'받음'}</button></div></div></section>
  </div>`;
 }
 function basic(p,sv){
  const vendors=companies().filter(c=>c.type==='매입'||c.id===p.vendor_id);
  const lockV=sv&&!editable(p),dateHtml=typeof g.dateControlHtml==='function'?g.dateControlHtml('pu_date',p.date,'매입일'):`<input type="date" id="pu_date" value="${esc(p.date)}" aria-label="매입일">`;
  return `<div class="qt-sec-t">기본 정보</div>
   <div class="grid2"><div class="field"><label for="pu_date">매입일</label>${dateHtml}</div>
    <div class="field"><label for="pu_co">매입처 *</label><select id="pu_co" ${lockV?'disabled':''}><option value="">매입처 선택</option>${vendors.map(c=>`<option value="${esc(c.id)}" ${c.id===p.vendor_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>${vendors.length?'':'<div class="hint">거래처 화면에서 구분을 \'매입\'으로 등록하면 여기에 나와요.</div>'}</div></div>
   <div class="grid2 pair"><div class="field"><label for="pu_vatSel">부가세</label><select id="pu_vatSel" ${lockV?'disabled':''}><option value="1" ${p.vat_on===false?'':'selected'}>10% 별도</option><option value="0" ${p.vat_on===false?'selected':''}>없음</option></select></div></div>
   <div class="qt-sec"><div class="qt-sec-t">비고</div><div class="field" style="margin-bottom:0"><textarea id="pu_memo" placeholder="입고 일정, 결제 조건 등">${esc(p.memo||'')}</textarea></div></div>`;
 }
 const moreBtns=p=>`${p.status!=='취소'?'<button class="btn ghost" type="button" data-act="cancel">매입 취소</button>':''}${deletable(p)?'<button class="btn del" type="button" data-act="delete">삭제</button>':''}`;
 const deletable=p=>!(p.receipts||[]).length&&!(p.returns||[]).length&&!(D().payments||[]).some(x=>x.purchase_id===p.id)&&!(D().stock_moves||[]).some(m=>m.purchase_id===p.id);

 // ── 고치기 ──
 const blank=()=>({id:'l'+uid(),item_id:'',qty:1,unit_price:0});
 function edit(fn,redraw=true){const base=st.draft&&st.draft.id===st.sel?st.draft:structuredClone(cur());fn(base);st.draft=base;st.dirty=true;if(redraw)render();}
 function pickItem(i,id){
  if(id==='__free__'){toast('매입은 등록된 품목만 넣을 수 있어요. 품목 화면에서 먼저 등록해 주세요.');return;}
  const it=itemOf(id);if(!it)return;if(isWork(it)){toast('작업 품목은 매입에 넣을 수 없어요.');return;}
  edit(p=>{const l=p.lines[i]||(p.lines[i]=blank());l.item_id=it.id;l.color=(it.colors||[])[0];l.spec=specsOf(it)[0];l.unit_price=buyOf(it,l.spec);for(const k of ['color','spec'])if(l[k]===undefined)delete l[k];});
 }
 function newPurchase(){
  const d=today(),n=rows().filter(p=>p.date===d).length+1,vendor=companies().find(c=>c.type==='매입');
  st.draft={id:'pu_'+uid(),no:`PO-${d.slice(0,4)}${d.slice(5,7)}${d.slice(8)}-${n}`,kind:'국내',vendor_id:vendor?.id||'',date:d,status:'작성중',currency:'KRW',lines:[blank()],vat:{supply:0,tax:0},vat_on:true,tax_invoice:{received:false},costs:[],receipts:[],returns:[],cost_runs:[],created_at:nowIso(),updated_at:nowIso()};
  while(rows().some(p=>p.no===st.draft.no))st.draft.no=st.draft.no.replace(/-(\d+)$/,(m,x)=>'-'+(Number(x)+1));
  st.sel=st.draft.id;st.dirty=true;st.editing=true;st.tab='items';st.sz=null;render();
 }
 const recalcVat=p=>{const t=totals(p);p.vat={supply:t.supply,tax:t.tax};};
 async function save(){
  if(!st.dirty||st.working)return;
  const p=structuredClone(st.draft);if(!p)return;
  p.lines=p.lines.filter(l=>l.item_id);
  if(!p.vendor_id){toast('매입처를 골라 주세요.');st.tab='basic';render();return;}
  if(!p.lines.length||p.lines.some(l=>!(Number.isSafeInteger(l.qty)&&l.qty>0)||!(l.unit_price>=0))){toast('품목·수량·단가를 확인해 주세요.');st.tab='items';st.editing=true;render();return;}
  recalcVat(p);p.updated_at=nowIso();
  const next={...st.doc,rows:cur()?st.doc.rows.map(x=>x.id===p.id?p:x):[...st.doc.rows,p]};
  st.working=true;const b=view.querySelector('#puSaveBtn');if(b){b.disabled=true;b.textContent='저장 중…';}
  try{await savePurchase(next);st.draft=null;st.dirty=false;st.editing=false;st.sz=null;toast('매입을 저장했어요');}catch(e){st.working=false;await fail(e);return;}
  st.working=false;render();
 }

 // ── 처리 창: 견적서의 납품 처리·입금 받기 창과 같은 부품(nd-pay-sheet nd-qa-sheet) ──
 let sheetEl=null;
 function qa(html){
  if(!sheetEl){sheetEl=document.createElement('dialog');sheetEl.className='nd-pay-sheet nd-qa-sheet pu-qa';sheetEl.addEventListener('click',ev=>{if(ev.target===sheetEl)sheetEl.close();});}
  if(!sheetEl.isConnected)(document.getElementById('appView')||document.body).append(sheetEl);
  sheetEl.innerHTML=html;if(!sheetEl.open){sheetEl.tabIndex=-1;sheetEl.showModal();sheetEl.focus({preventScroll:true});}
  sheetEl.querySelector('[data-x]')?.addEventListener('click',()=>sheetEl.close());
  return sheetEl;
 }
 const head=(t,sub)=>`<div class="nd-ps-hd"><b>${t}</b><span class="nd-qa-sub">${sub}</span></div>`;
 const acts=(label,on=true,cls='')=>`<div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go${cls}" ${on?'':'disabled'}>${label}</button></div>`;
 const stepRow=(id,title,sub,v,label)=>`<div class="nd-qa-ln"><div><span>${title}</span><small>${sub}</small></div><span class="nd-qa-step"><button type="button" data-d="${esc(id)}" data-v="-1" aria-label="줄이기">−</button><input inputmode="numeric" data-q="${esc(id)}" value="${v}" aria-label="${label}"><button type="button" data-d="${esc(id)}" data-v="1" aria-label="늘리기">+</button></span></div>`;
 const optOf=l=>[l.color,l.spec].filter(Boolean).map(esc).join(' · ');
 // 저장 버튼 공통: 누르면 '저장 중…', 실패하면 '다시 시도' + 안내
 async function go(d,run){
  const btn=d.querySelector('.nd-qa-go');if(!btn||btn.disabled)return;const keep=btn.textContent;btn.disabled=true;btn.textContent='저장 중…';
  try{await run();d.close();render();}
  catch(e){btn.disabled=false;btn.textContent='다시 시도';const t=MSG[e?.code]||e?.message||'저장하지 못했어요.';let w=d.querySelector('.nd-qa-warn');if(!w){w=document.createElement('p');w.className='nd-qa-warn';d.querySelector('.nd-qa-body')?.append(w);}w.textContent=t;
   if(e?.code==='STORAGE_CONFLICT'){d.close();await load(true);}else void keep;}
 }
 function qtyPicker({title,sub,rowsIn,start,unit,after,goLabel,note,fields,onGo,segAll,danger=false}){
  // rowsIn: [{id,l,max,sub}] · start: 'all' | 'part' | 'zero'
  const qty=Object.fromEntries(rowsIn.map(r=>[r.id,start==='zero'?0:r.max]));let mode=start==='zero'?'part':start;const total0=rowsIn.reduce((a,r)=>a+r.max,0);const keep={};
  const paint=()=>{
   const d0=sheetEl&&sheetEl.open?sheetEl:null;if(d0)d0.querySelectorAll('[data-keep]').forEach(i=>keep[i.id]=i.value);
   const total=Object.values(qty).reduce((a,b)=>a+b,0);
   const d=qa(`${head(title,sub)}<div class="nd-qa-body">
     ${segAll?`<div class="nd-qa-seg" role="tablist"><button type="button" role="tab" aria-selected="${mode==='all'}" data-m="all">${segAll} (${n0(total0)}${unit})</button><button type="button" role="tab" aria-selected="${mode==='part'}" data-m="part">일부만</button></div>`:''}
     ${mode==='part'?`<div class="nd-qa-lines">${rowsIn.map(r=>stepRow(r.id,esc(itemOf(r.l.item_id)?.name||'품목'),r.sub,qty[r.id],title+' 수량')).join('')}</div>${note?`<p class="nd-qa-note">${note}</p>`:''}`:''}
     <div class="nd-qa-fields">${fields}</div>
     <p class="nd-qa-after">${after(total)}</p></div>${acts(`${n0(total)}${unit} ${goLabel}`,total>0,danger?' danger':'')}`);
   Object.entries(keep).forEach(([id,v])=>{const i=d.querySelector('#'+id);if(i)i.value=v;});
   d.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;if(mode==='all')rowsIn.forEach(r=>qty[r.id]=r.max);paint();});
   d.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const r=rowsIn.find(x=>x.id===b.dataset.d);qty[r.id]=Math.max(0,Math.min(r.max,qty[r.id]+Number(b.dataset.v)));paint();});
   d.querySelectorAll('[data-q]').forEach(inp=>inp.onchange=()=>{const r=rowsIn.find(x=>x.id===inp.dataset.q);qty[r.id]=Math.max(0,Math.min(r.max,num(inp.value)));paint();});
   d.querySelector('.nd-qa-go').onclick=()=>go(d,()=>onGo(d,rowsIn.map(r=>({line_id:r.id,qty:qty[r.id]})).filter(x=>x.qty>0)));
  };
  paint();
 }
 function receiveSheet(start='all'){
  const p=cur();if(!p)return;const rest=p.lines.map(l=>({id:l.id,l,max:l.qty-received(p,l)})).filter(r=>r.max>0).map(r=>({...r,sub:`${optOf(r.l)}${optOf(r.l)?' · ':''}남음 ${n0(r.max)}`}));if(!rest.length)return;
  const rid='r'+uid(); // [다시 시도]해도 같은 입고 번호 — 끊겼다 이어져도 두 번 생기지 않는다
  qtyPicker({title:'입고 처리',sub:`${esc(coName(p.vendor_id))} · ${esc(p.no)}`,rowsIn:rest,start,unit:'개',segAll:'남은 수량 전부',goLabel:'입고 확인',
   note:'처음엔 남은 수량이 다 채워져 있어요. 이번에 안 들어온 것만 줄이세요.',
   fields:`<label>입고일<input type="date" id="puQaDate" data-keep value="${today()}"></label><label>메모 (선택)<input id="puQaMemo" data-keep placeholder="예: 박스 3개"></label>`,
   after:n=>`확인하면 입고가 기록되고 <b>재고에 ${n0(n)}개 더해져요</b>.`,
   onGo:async(d,lines)=>{if(!lines.length)throw Error('수량을 넣어 주세요.');await postReceipt(io,p.id,{receiptId:rid,date:d.querySelector('#puQaDate').value||today(),lines,at:nowIso()});toast(`${n0(lines.reduce((a,x)=>a+x.qty,0))}개 입고를 기록했어요 · 재고 반영 완료`);}});
 }
 function returnSheet(){
  const p=cur();if(!p)return;const rest=p.lines.map(l=>({id:l.id,l,max:received(p,l)-returned(p,l)})).filter(r=>r.max>0).map(r=>({...r,sub:`${optOf(r.l)}${optOf(r.l)?' · ':''}입고 ${n0(r.max)}`}));if(!rest.length)return;
  const unit=Object.fromEntries(p.lines.map(l=>[l.id,l.unit_price||0]));
  const tid='t'+uid();
  qtyPicker({title:'반품',sub:`${esc(coName(p.vendor_id))} · 입고된 것만`,rowsIn:rest,start:'zero',unit:'개',goLabel:'반품 확인',danger:true,
   note:'돌려보낸 수량만 늘리세요.',
   fields:`<label>반품일<input type="date" id="puQaDate" data-keep value="${today()}"></label><label>사유<input id="puQaMemo" data-keep placeholder="예: 불량"></label>`,
   after:n=>n?`확인하면 <b>재고에서 ${n0(n)}개 빠지고</b>, 줄 돈이 줄어요.`:'반품할 수량을 넣어 주세요.',
   onGo:async(d,lines)=>{if(!lines.length)throw Error('반품할 수량을 넣어 주세요.');void unit;await postReturn(io,p.id,{returnId:tid,date:d.querySelector('#puQaDate').value||today(),lines,reason:d.querySelector('#puQaMemo').value.trim(),at:nowIso()});toast('반품을 기록했어요 · 재고에서 뺐어요');}});
 }
 const METHODS=['계좌이체','카드','현금','기타'];
 function paySheet(){
  const p=cur();if(!p)return;const ps=payState(p),bal=Math.max(0,ps.due-ps.paid),ref='pay_'+uid();
  let amount=bal,method='계좌이체',preset='all',date=today(),memo='';
  const paint=()=>{
   const over=amount>bal;
   const d=qa(`${head('출금 기록',`${esc(coName(p.vendor_id))} · 남은 금액 ${n0(bal)}원`)}<div class="nd-qa-body">
     <label class="nd-qa-money">보낸 금액<input id="puQaAmt" inputmode="numeric" value="${amount?n0(amount):''}" placeholder="0"><span>원</span></label>
     <div class="nd-qa-chips" role="group" aria-label="금액">${[['all','남은 금액 전부'],['half','절반'],['custom','직접 입력']].map(([k,t])=>`<button type="button" data-p="${k}" aria-pressed="${preset===k}">${t}</button>`).join('')}</div>
     <div class="nd-qa-chips" role="group" aria-label="출금 방법">${METHODS.map(m=>`<button type="button" data-me="${m}" aria-pressed="${method===m}">${m}</button>`).join('')}</div>
     <div class="nd-qa-fields"><label>출금일<input type="date" id="puQaDate" value="${esc(date)}"></label><label>메모 (선택)<input id="puQaMemo" value="${esc(memo)}" placeholder="예: 잔금"></label></div>
     ${over?`<p class="nd-qa-warn">남은 금액보다 ${n0(amount-bal)}원 많아요. 초과 출금으로 기록돼요.</p>`:''}
    </div>${acts(amount>0?`${n0(amount)}원 출금 확인`:'금액을 넣어 주세요',amount>0)}`);
   d.querySelector('#puQaDate').onchange=ev=>{date=ev.target.value;};d.querySelector('#puQaMemo').oninput=ev=>{memo=ev.target.value;};
   const inp=d.querySelector('#puQaAmt');
   inp.oninput=()=>{amount=num(inp.value);preset='custom';d.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.p==='custom')));const b=d.querySelector('.nd-qa-go');b.disabled=!(amount>0);b.textContent=amount>0?`${n0(amount)}원 출금 확인`:'금액을 넣어 주세요';};
   // 손을 뗄 때 창을 다시 그리면 같이 누른 확인 버튼이 사라진다 — 숫자 모양만 정리
   inp.onblur=()=>{inp.value=amount?n0(amount):'';};
   d.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{preset=b.dataset.p;if(preset==='all')amount=bal;else if(preset==='half')amount=Math.round(bal/2);paint();if(preset==='custom'){const i=sheetEl.querySelector('#puQaAmt');i.focus();i.select();}});
   d.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{method=b.dataset.me;paint();});
   d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
    if(!(amount>0))throw Error('금액을 넣어 주세요.');
    const list=D().payments||[];if(list.some(x=>x.client_ref===ref))return; // 같은 창에서 두 번 눌러도 한 번만
    await app.Table.save('payments',[...list,{id:'pay'+uid(),date:d.querySelector('#puQaDate').value||today(),company_id:p.vendor_id,kind:'지급',method,amount,memo:d.querySelector('#puQaMemo').value.trim()||`매입 ${p.no}`,purchase_id:p.id,client_ref:ref,created_at:nowIso()}]);
    toast(`${n0(amount)}원 출금을 기록했어요`);});
  };
  paint();
 }
 function voidSheet(rid){
  const p=cur(),r=p?.receipts.find(x=>x.id===rid);if(!r)return;const n=r.lines.reduce((a,x)=>a+x.qty,0);
  const d=qa(`${head('입고 취소',`${mdShort(r.date)} 입고 ${n0(n)}개`)}<div class="nd-qa-body">
    <div class="nd-qa-fields"><label>사유<input id="puQaMemo" placeholder="예: 수량을 잘못 넣음"></label></div>
    <p class="nd-qa-after">확인하면 <b>재고에서 ${n0(n)}개가 되돌아가요</b>. 기록은 지우지 않고 '취소됨'으로 남아요.</p></div>${acts('입고 취소 확인',true,' danger')}`);
  d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{await voidReceipt(io,p.id,rid,{reason:d.querySelector('#puQaMemo').value.trim()||'입고 취소',at:nowIso()});toast('입고를 취소했어요 · 재고에서 되돌림');});
 }
 function taxSheet(){
  const p=cur();if(!p)return;const t=p.tax_invoice||{};
  const d=qa(`${head(t.received?'계산서 바꾸기':'계산서 받음',`${esc(coName(p.vendor_id))} · ${esc(p.no)}`)}<div class="nd-qa-body">
    <div class="nd-qa-fields"><label>받은 날<input type="date" id="puQaDate" value="${esc(t.date||today())}"></label></div>
    ${t.received?'<div class="nd-qa-chips" role="group" aria-label="계산서"><button type="button" data-undo aria-pressed="false">아직 안 받음으로 되돌리기</button></div>':''}</div>${acts(t.received?'받은 날 바꾸기':'받음으로 기록')}`);
  const put=async tax=>{const np={...structuredClone(p),tax_invoice:tax,updated_at:nowIso()};await savePurchase({...st.doc,rows:st.doc.rows.map(x=>x.id===p.id?np:x)});};
  d.querySelector('[data-undo]')?.addEventListener('click',()=>go(d,async()=>{await put({received:false});toast('계산서를 미수취로 되돌렸어요');}));
  d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{await put({received:true,date:d.querySelector('#puQaDate').value||today()});toast('계산서를 받음으로 기록했어요');});
 }
 function cancelSheet(){
  const p=cur();if(!p)return;const live=(p.receipts||[]).filter(r=>!r.void_at),ps=payState(p);
  if(live.length){const d=qa(`${head('먼저 입고를 취소해야 해요',esc(p.no))}<div class="nd-qa-body"><p class="nd-qa-after">재고에 들어간 매입은 <b>진행 탭에서 입고 취소</b>를 한 뒤에 매입을 취소할 수 있어요.</p></div><div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go">진행 탭 열기</button></div>`);d.querySelector('.nd-qa-go').onclick=()=>{d.close();st.tab='flow';render();};return;}
  let refund=ps.paid>0;
  const paint=()=>{const d=qa(`${head('매입 취소',`${esc(coName(p.vendor_id))} · ${esc(p.no)}`)}<div class="nd-qa-body">
    ${ps.paid>0?`<div class="nd-qa-chips" role="group" aria-label="환불"><button type="button" data-rf="1" aria-pressed="${refund}">${n0(ps.paid)}원 돌려받음</button><button type="button" data-rf="0" aria-pressed="${!refund}">아직 안 받음</button></div>`:''}
    <p class="nd-qa-after">확인하면 매입이 <b>취소됨</b>으로 남아요(지우지 않아요).${ps.paid>0&&refund?` 돌려받은 ${n0(ps.paid)}원은 <b>환불 입금</b>으로 기록돼요.`:''}</p></div>${acts('매입 취소 확인',true,' danger')}`);
   d.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>{refund=b.dataset.rf==='1';paint();});
   d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
    if(ps.paid>0&&refund)await app.Table.save('payments',[...(D().payments||[]),{id:'pay'+uid(),date:today(),company_id:p.vendor_id,kind:'수금',refund:true,method:'계좌이체',amount:Math.round(ps.paid),memo:`매입 취소 환불 ${p.no}`,purchase_id:p.id,client_ref:'refund_'+uid(),created_at:nowIso()}]);
    await savePurchase({...st.doc,rows:st.doc.rows.map(x=>x.id===p.id?{...x,status:'취소',updated_at:nowIso()}:x)});st.draft=null;st.dirty=false;st.editing=false;toast('매입을 취소했어요');});};
  paint();
 }
 function removeSheet(){
  const p=cur();if(!p||!deletable(p))return;
  const d=qa(`${head('매입 삭제',`${esc(coName(p.vendor_id))} · ${esc(p.no)}`)}<div class="nd-qa-body"><p class="nd-qa-after">입고·출금이 없는 매입이라 <b>완전히 지워요</b>. 되돌릴 수 없어요.</p></div>${acts('삭제',true,' danger')}`);
  d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{await savePurchase({...st.doc,rows:st.doc.rows.filter(x=>x.id!==p.id)});st.sel=null;st.draft=null;st.dirty=false;st.editing=false;toast('매입을 지웠어요');});
 }
 // 폰 품목 편집 창(견적서 qp-sheet와 같은 부품)
 let lineSheet=null;
 function fitLineSheet(){if(!lineSheet)return;const vv=window.visualViewport,kb=Math.max(0,innerHeight-((vv?.height||innerHeight)+(vv?.offsetTop||0))),navH=kb>100?0:(document.getElementById('bottomNav')?.getBoundingClientRect().height||0);lineSheet.style.maxHeight=`${Math.max(160,(vv?.height||innerHeight)-navH-16)}px`;lineSheet.style.bottom=`${kb+navH}px`;}
 window.visualViewport?.addEventListener('resize',fitLineSheet);window.visualViewport?.addEventListener('scroll',fitLineSheet);
 function lineEditor(i,searchFirst=false){
  const p=shown();if(!p)return;const l0=p.lines[i]||blank();let w={...l0},search=searchFirst||!w.item_id,confirmDel=false;
  const host=view.querySelector('#puForm');if(!host)return;
  const close=()=>{lineSheet?.close();lineSheet?.remove();lineSheet=null;};
  const draw=()=>{
   if(!lineSheet){lineSheet=document.createElement('dialog');lineSheet.className='qp-sheet';lineSheet.addEventListener('cancel',ev=>{ev.preventDefault();close();});lineSheet.addEventListener('click',ev=>{if(ev.target===lineSheet)close();});host.append(lineSheet);lineSheet.showModal();}
   const it=itemOf(w.item_id),colors=it?.colors||[],specs=specsOf(it);
   lineSheet.setAttribute('aria-label',search?'품목 검색':'품목 편집');lineSheet.classList.toggle('qp-search-sheet',search);
   if(search){
    lineSheet.innerHTML=`<div class="qp-sheet-head"><h3>품목 검색</h3><button class="naro-sheet-close" type="button" data-close aria-label="닫기">닫기</button></div><input class="qp-search" type="search" placeholder="품목명 / 품목코드 검색" aria-label="품목명 또는 품목코드 검색"><div class="qp-results"></div>`;
    const inp=lineSheet.querySelector('.qp-search'),res=lineSheet.querySelector('.qp-results');
    const list=()=>{const q=inp.value.trim().toLowerCase();const m=(D()?.items||[]).filter(x=>!isWork(x)&&`${x.name||''} ${x.code||''}`.toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko'));
     res.innerHTML=m.length?m.map(x=>`<button type="button" class="qp-result" data-pick="${esc(x.id)}"><span><strong>${esc(x.name||'')}</strong><small>${esc(x.code||'')}</small></span><span>${money(buyOf(x,specsOf(x)[0]))}</span></button>`).join(''):'<p>검색 결과가 없습니다.</p>';
     res.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const x=itemOf(b.dataset.pick);w.item_id=x.id;w.color=(x.colors||[])[0];w.spec=specsOf(x)[0];w.unit_price=buyOf(x,w.spec);search=false;draw();});};
    inp.oninput=list;list();setTimeout(()=>inp.focus(),0);
   }else{
    const chips=(f,opts,v)=>opts.length?`<div class="qp-chips option-chip-grid" role="group" aria-label="${f==='color'?'색상':'규격/옵션'}">${opts.map(o=>`<button type="button" data-${f}="${esc(o)}" aria-pressed="${o===v}">${esc(o)}</button>`).join('')}</div>`:'<p class="qp-muted">—</p>';
    lineSheet.innerHTML=`<div class="qp-sheet-head"><h3>품목 편집</h3><button class="naro-sheet-close" type="button" data-close aria-label="편집 취소하고 닫기">닫기</button></div>
     <div class="qp-sheet-body"><div class="qp-field"><label>품목</label><button type="button" class="ip-btn" data-search>${it?`${esc(it.name||'')}<span class="cd">${esc(it.code||'')}</span>`:'<span class="ph">품목 선택</span>'}</button></div>
      <div class="qp-field"><label>색상</label>${chips('color',colors,w.color)}</div><div class="qp-field"><label>규격/옵션</label>${chips('spec',specs,w.spec)}</div>
      <div class="qp-field"><label for="pu-edit-qty">수량</label><div class="qp-edit-stepper"><button type="button" data-q="-1" aria-label="수량 줄이기">−</button><input type="text" inputmode="numeric" class="num" id="pu-edit-qty" value="${n0(w.qty)}"><button type="button" data-q="1" aria-label="수량 늘리기">+</button></div></div>
      <div class="qp-field"><label for="pu-edit-price">단가</label><input type="text" inputmode="numeric" class="num" id="pu-edit-price" value="${w.unit_price?n0(w.unit_price):''}" placeholder="0"></div>
      <div class="qp-edit-amount">금액<span class="amt">${n0((w.qty||0)*(w.unit_price||0))}</span></div></div>
     <div class="qp-sheet-footer"><button class="qp-delete" type="button" data-del>${confirmDel?'삭제 확인':'행 삭제'}</button><button class="qp-primary" type="button" data-apply>적용</button></div>`;
    const sync=()=>{w.qty=num(lineSheet.querySelector('#pu-edit-qty').value);w.unit_price=num(lineSheet.querySelector('#pu-edit-price').value);};
    lineSheet.querySelector('[data-search]').onclick=()=>{sync();search=true;draw();};
    lineSheet.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{sync();w.color=b.dataset.color;draw();});
    lineSheet.querySelectorAll('[data-spec]').forEach(b=>b.onclick=()=>{sync();w.spec=b.dataset.spec;w.unit_price=buyOf(itemOf(w.item_id),w.spec)||w.unit_price;draw();});
    lineSheet.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{sync();w.qty=Math.max(0,w.qty+Number(b.dataset.q));draw();});
    // 손을 뗄 때 창을 다시 그리면 같이 누른 [적용]이 사라진다 — 금액 숫자만 고친다
    lineSheet.querySelectorAll('#pu-edit-qty,#pu-edit-price').forEach(inp=>inp.oninput=()=>{sync();lineSheet.querySelector('.qp-edit-amount .amt').textContent=n0((w.qty||0)*(w.unit_price||0));});
    lineSheet.querySelector('[data-del]').onclick=()=>{if(!confirmDel){confirmDel=true;draw();return;}close();edit(p=>{p.lines.splice(i,1);if(!p.lines.length)p.lines.push(blank());});};
    lineSheet.querySelector('[data-apply]').onclick=()=>{sync();close();if(!w.item_id)return;edit(p=>{const l={...w};for(const k of ['color','spec'])if(!l[k])delete l[k];p.lines[i]=l;});};
   }
   lineSheet.querySelector('[data-close]').onclick=close;
   fitLineSheet();
  };
  draw();
 }
 function applySize(){
  const box=view.querySelector('#pu_sizePanel');const it=itemOf(st.sz.item),color=st.sz.color;if(!box||!it)return;let added=0,removed=0;
  edit(p=>{it.variants.forEach(v=>{const q=num(box.querySelector(`[data-sz="${CSS.escape(v.spec)}"]`)?.value),pr=num(box.querySelector(`[data-szp="${CSS.escape(v.spec)}"]`)?.value);
   const idx=p.lines.findIndex(l=>l.item_id===it.id&&(l.color||'')===color&&(l.spec||'')===v.spec);
   if(q>0){if(idx>=0){p.lines[idx].qty=q;p.lines[idx].unit_price=pr;}else{const l={id:'l'+uid(),item_id:it.id,qty:q,unit_price:pr,spec:v.spec};if(color)l.color=color;p.lines.push(l);}added++;}
   else if(idx>=0){p.lines.splice(idx,1);removed++;}});
   p.lines=p.lines.filter(l=>l.item_id);if(!p.lines.length)p.lines.push(blank());st.sz=null;});
  toast(added?`옵션 ${added}종을 품목에 넣었습니다${removed?` · ${removed}종 제거`:''}`:'수량이 입력된 옵션이 없습니다');
 }
 // ··· 메뉴(견적서와 같은 nd-rec-menu): 바깥을 누르거나 같은 ···을 다시 누르면 닫힌다
 let menu=null;
 const closeMenu=()=>{if(!menu)return;menu.btn.setAttribute('aria-expanded','false');menu.el.remove();menu=null;};
 function openMenu(btn,items){
  const same=menu&&menu.btn===btn;closeMenu();if(same)return;
  const el=document.createElement('div');el.className='nd-rec-menu';el.setAttribute('role','menu');
  el.innerHTML=items.map((it,i)=>`<button type="button" role="menuitem" data-i="${i}" class="${it.danger?'danger':''}">${esc(it.t)}</button>`).join('');
  el.addEventListener('click',ev=>{const b=ev.target.closest('[data-i]');if(!b)return;const it=items[Number(b.dataset.i)];closeMenu();it.fn();});
  btn.closest('.nd-rec-row').append(el);btn.setAttribute('aria-expanded','true');menu={btn,el};
 }
 document.addEventListener('click',ev=>{
  if(menu&&!ev.target.closest?.('.nd-rec-menu')&&!ev.target.closest?.('.nd-rec-more'))closeMenu();
  const dt=view.querySelector('details.pu-more[open]');if(dt&&!dt.contains(ev.target))dt.open=false;
 },true);
 async function resumeAll(){
  st.working=true;try{for(const u of unfinished(st.doc,D().stock_moves||[])){
   const p=rows().find(x=>x.id===u.purchase_id);
   if(u.receipt_id){const r=p.receipts.find(x=>x.id===u.receipt_id);if(u.state==='voiding')await voidReceipt(io,p.id,r.id,{reason:r.void_reason,at:r.void_at});else if(u.state!=='mismatch')await resume(io,p.id,r.id,nowIso());}
   else if(u.return_id&&u.state!=='mismatch'){const t=p.returns.find(x=>x.id===u.return_id);await postReturn(io,p.id,{returnId:t.id,date:t.date,lines:t.lines,reason:t.reason,at:nowIso()});}
  }toast('마무리했어요');}catch(e){st.working=false;await fail(e);return;}st.working=false;render();
 }
 function select(id){
  if(st.dirty&&st.sel!==id){toast('저장하지 않은 변경이 있어요. [저장] 또는 [되돌리기]를 먼저 눌러 주세요.');return;}
  st.sel=id;st.draft=null;st.dirty=false;st.editing=false;st.sz=null;render();
  view.querySelector('#puForm')?.scrollIntoView?.({block:'nearest'});
 }
 function bind(){
  view.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',async()=>{
   const a=b.dataset.act;
   if(a==='reload')return load(true);
   if(a==='start'){b.disabled=true;try{const r=await ask('PURCHASE_START');st.status=r.state.status;st.doc=r.doc;render();}catch(err){b.disabled=false;await fail(err);}return;}
   if(a==='resume')return resumeAll();
   if(a==='back'){if(st.dirty&&!saved(shown()||{})){st.draft=null;st.dirty=false;}st.sel=st.dirty?st.sel:null;if(st.dirty){toast('저장하지 않은 변경이 있어요. [저장] 또는 [되돌리기]를 먼저 눌러 주세요.');return;}st.editing=false;render();return;}
   if(a==='save')return save();
   if(a==='revert'){st.draft=null;st.dirty=false;st.editing=false;st.sz=null;if(!cur())st.sel=null;render();return;}
   if(a==='edit'){st.editing=!st.editing;if(!st.editing)st.sz=null;render();return;}
   if(a==='addline'){if(mob.matches){const p=shown();lineEditor(p.lines.length,true);return;}return edit(p=>p.lines.push(blank()));}
   if(a==='size'){st.sz=st.sz?null:{item:null,color:null};render();return;}
   if(a==='szclose'){st.sz=null;render();return;}
   if(a==='szapply')return applySize();
   if(a==='receive')return receiveSheet('all');
   if(a==='receive-part')return receiveSheet('part');
   if(a==='pay')return paySheet();
   if(a==='return')return returnSheet();
   if(a==='tax')return taxSheet();
   if(a==='cancel'){b.closest('details')?.removeAttribute('open');return cancelSheet();}
   if(a==='delete'){b.closest('details')?.removeAttribute('open');return removeSheet();}
  }));
  view.querySelector('#puNewBtn')?.addEventListener('click',()=>{if(st.dirty){toast('저장하지 않은 변경이 있어요. [저장] 또는 [되돌리기]를 먼저 눌러 주세요.');return;}newPurchase();});
  view.querySelectorAll('#puList .list-item').forEach(el=>{el.onclick=()=>select(el.dataset.id);el.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(el.dataset.id);}};});
  view.querySelectorAll('.nd-chips [data-v]').forEach(b=>b.onclick=()=>{st.filter=b.dataset.v;view.querySelectorAll('.nd-chips [data-v]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paintList();});
  view.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{st.tab=b.dataset.tab;render();}));
  view.querySelectorAll('[data-menu-r]').forEach(b=>b.onclick=()=>openMenu(b,[{t:'입고 취소',danger:true,fn:()=>voidSheet(b.dataset.menuR)}]));
  const q=view.querySelector('#puSearch');if(q){let comp=false;q.addEventListener('compositionstart',()=>comp=true);q.addEventListener('compositionend',()=>{comp=false;st.q=q.value.trim();paintList();});q.addEventListener('input',()=>{if(comp)return;st.q=q.value.trim();paintList();});}
  const f=view.querySelector('#puForm');if(!f)return;
  f.querySelectorAll('.qline .ip-btn[data-f="item"]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.idx);if(typeof g.openItemPicker==='function')g.openItemPicker(el,v=>pickItem(i,v));});
  f.querySelectorAll('.qline [data-f]:not(.ip-btn)').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.dataset.idx),k=el.dataset.f;
   edit(p=>{const l=p.lines[i];if(!l)return;if(k==='qty')l.qty=num(el.value);else if(k==='price')l.unit_price=num(el.value);else if(k==='lcolor'){if(el.value)l.color=el.value;else delete l.color;}else if(k==='vspec'){if(el.value)l.spec=el.value;else delete l.spec;l.unit_price=buyOf(itemOf(l.item_id),l.spec)||l.unit_price;}});}));
  f.querySelectorAll('.qline [data-rm]').forEach(b=>b.onclick=()=>edit(p=>{p.lines.splice(Number(b.dataset.rm),1);if(!p.lines.length)p.lines.push(blank());}));
  f.querySelectorAll('[data-qp-edit]').forEach(b=>b.onclick=()=>{if(st.editing)lineEditor(Number(b.dataset.qpEdit));});
  f.querySelectorAll('[data-qstep]').forEach(b=>b.onclick=()=>edit(p=>{const l=p.lines[Number(b.dataset.qstep)];if(l)l.qty=Math.max(0,(l.qty||0)+Number(b.dataset.v));}));
  f.querySelector('#pu_date')?.addEventListener('change',e=>edit(p=>{p.date=e.target.value||p.date;}));
  f.querySelector('#pu_co')?.addEventListener('change',e=>edit(p=>{p.vendor_id=e.target.value;}));
  f.querySelector('#pu_vatSel')?.addEventListener('change',e=>edit(p=>{p.vat_on=e.target.value!=='0';}));
  f.querySelector('#pu_memo')?.addEventListener('change',e=>edit(p=>{p.memo=e.target.value;}));
  f.querySelector('#pu_szItem')?.addEventListener('change',e=>{st.sz={item:e.target.value,color:null};render();});
  f.querySelector('#pu_szColor')?.addEventListener('change',e=>{st.sz.color=e.target.value;render();});
  const szs=[...f.querySelectorAll('[data-sz]')];szs.forEach(inp=>inp.addEventListener('input',()=>{const s=view.querySelector('#pu_szSum');if(s)s.textContent=`총 ${n0(szs.reduce((a,i)=>a+num(i.value),0))}개`;}));
 }
 function paintList(){const el=view.querySelector('#puList');if(!el)return;el.innerHTML=listHtml(rows().filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.no.localeCompare(a.no)));el.querySelectorAll('.list-item').forEach(x=>{x.onclick=()=>select(x.dataset.id);});}
 g.NaroPurchases={render,load,state:()=>structuredClone({status:st.status,count:rows().length})};
 return {onMessage};
}
