// 매입 화면(2단계 — feature/naro-purchase). 견적서 화면과 같은 부품·같은 스타일 규칙을 쓴다(10/10 시안).
// 데이터: 매입 파일은 PURCHASE_* 메시지로(저장소 쪽 business-workspace), 재고·입출금은 기존 Table.save(SAVE_TABLE) 그대로.
// 매입 저장(작성)과 재고 입고 확정은 서로 다른 버튼·창. 입고·반품·입고 취소는 purchase-saga 절차(끊겨도 이어서, 두 번 안 됨).
import {paymentStatus,lineBase,unitCosts} from './purchase-ledger.mjs';
import {IMPORT_PROMPT,parseImportPaste,checkImport,importDraft,rememberedMap,rememberedTypes,costTypeOf} from './import-paste.mjs';
import {postReceipt,resume,postReturn,voidReceipt,unfinished,receiptState,stockMoveId,voidMoveId} from './purchase-saga.mjs';

const MSG={BUSY:'저장이 끝난 뒤 다시 눌러 주세요.',STORAGE_CONFLICT:'다른 기기에서 먼저 바뀌었어요. 최신 내용으로 다시 불러왔어요.',VALIDATION:'입력 내용을 확인해 주세요(수량·금액·이미 처리된 기록).',WRITE_BLOCKED:'이 작업은 지금 할 수 없어요.',UNAVAILABLE:'Google Drive에서는 아직 매입을 쓸 수 없어요. Dropbox에서 쓸 수 있어요.',SAVE_UNCONFIRMED:'저장 결과를 확인하지 못했어요. [저장 결과 확인]을 눌러 주세요.',NETWORK_ERROR:'연결을 확인한 뒤 다시 시도해 주세요.',RECONNECT_REQUIRED:'저장소 연결이 끊겼어요. 다시 연결해 주세요.',QUOTA_LIMIT:'저장 공간이 부족해요.'};
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n0=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
const money=v=>n0(v)+'원';
const today=()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const md=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');return m?`${m[1]}.${m[2]}.${m[3]}`:'';};
const uid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,16);
const nowIso=()=>new Date().toISOString();
const ICON={cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'};

const DOTS='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3.5" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="12.5" r="1.4"/></svg>';
const OK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const RM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const mdShort=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?`${Number(m[2])}.${m[3]}`:'';};
const num=v=>Math.floor(Number(String(v??'').replace(/[^\d]/g,''))||0);
// 수입 매입(외화): 단가·금액은 소수 둘째 자리까지, 원화는 원 단위
const dec=v=>{const n=Number(String(v??'').replace(/[^\d.]/g,''));return Number.isFinite(n)?Math.round(n*100)/100:0;};
const fx=(v,c)=>`${c?c+' ':''}${(Number(v)||0).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fxs=v=>Number.isInteger(Math.round((Number(v)||0)*100)/100)?n0(v):fx(v); // 진행 줄처럼 좁은 곳: 정수면 소수점 없이
const localDay=iso=>{const d=new Date(iso);if(isNaN(d))return '';const z=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;};
const isFx=p=>!!p?.currency&&p.currency!=='KRW';
const COST_TYPES=['운임','보험','관세','통관수수료','국내운송','기타'];

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
 const st={rowOpen:new Set(),status:'unknown',doc:null,sel:null,tab:'items',filter:'',q:'',draft:null,dirty:false,editing:false,open:false,working:false,note:'',sz:null};
 const mob=matchMedia('(max-width:820px)'),desk=matchMedia('(min-width:1024px)');
 const D=()=>app.db,companies=()=>D()?.companies||[];
 const coName=id=>companies().find(c=>c.id===id)?.name||(id?'(삭제된 거래처)':''); // 매입이 쓰던 거래처가 지워졌으면 그렇다고 표시
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
 const totals=p=>{const supply=Object.values(lineBase(p)).reduce((s,v)=>s+v,0);
  if(isFx(p)){const costs=(p.costs||[]).filter(c=>!c.void_at).reduce((s,c)=>s+(Number(c.amount_krw)||0),0);return {supply,tax:0,total:supply,fx:Math.round(p.lines.reduce((s,l)=>s+(l.qty||0)*(l.unit_price||0),0)*100)/100,costs,landed:supply+costs};}
  const tax=p.vat_on===false?0:Math.round(supply*.1);return {supply,tax,total:supply+tax};};
 const amtOf=(p,v)=>isFx(p)?fx(v,p.currency):money(v);
 // 부대비용·수입부가세를 낸 곳(운송사·관세사)에 남은 돈(원)
 const costLeft=ps=>(ps.costs||[]).reduce((s,c)=>s+Math.max(0,c.due-c.paid),0);
 const payState=p=>paymentStatus(p,D()?.payments||[]);
 const pays=p=>(D()?.payments||[]).filter(x=>x.purchase_id===p.id);
 const toast=t=>typeof g.toast==='function'?g.toast(t):null;
 const saved=p=>rows().some(x=>x.id===p.id);
 const editable=p=>p.status!=='취소'&&!(p.receipts||[]).length&&!(p.returns||[]).length;
 // 목록·머리의 상태 하나(견적서와 같은 자리, 같은 색 규칙)
 function disp(p){
  if(p.removed_at)return ['삭제됨','st-lost'];
  if(p.status==='취소')return ['취소','st-lost'];
  const q=qtyOf(p),got=gotOf(p);
  if(!saved(p)||!got)return ['작성중','st-draft'];
  if(got<q)return ['부분 입고','st-sent st-partial'];
  const ps=payState(p);if(ps.due-ps.paid>(isFx(p)?0.005:0)||costLeft(ps)>0.5)return ['미출금','st-won'];
  return ['완료','st-complete'];
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

 // 저장소가 매입 파일을 못 읽은 이유(오류 코드)를 쉬운 말로 — '잠시 뒤 다시'만 보여 주면 무엇이 문제인지 알 수 없었다
 const loadErrNote=code=>({VALIDATION:'매입 기록 중 규칙에 맞지 않는 것이 있어요. 최근에 지운 거래처·품목이 있으면 목록 필터(≡) → 삭제된 항목에서 복원해 보세요.',
  STORAGE_CONFLICT:'읽는 사이에 다른 기기에서 매입이 바뀌었어요. [다시 불러오기]를 눌러 주세요.',NETWORK_ERROR:'연결을 확인한 뒤 [다시 불러오기]를 눌러 주세요.',
  STORAGE_INVALID:'매입 파일 모양이 올바르지 않아요. 관리자에게 알려 주세요.'}[code]||`잠시 뒤 다시 시도해 주세요.${code?` (${code})`:''}`);
 async function load(reload=false,quiet=false){
  // 저장소가 잠깐 바쁘면(BUSY) 화면에 오류를 띄우지 않고 '불러오는 중'인 채로 몇 번 더 묻는다(새로고침 직후 다른 일과 겹칠 때)
  for(let i=0;;i++){
   try{const r=await ask('PURCHASE_STATE',{reload});st.status=r.state.status;st.doc=r.doc;st.note=r.state.status==='error'?loadErrNote(r.state.error):r.state.capacity?.warn?'매입 파일이 70% 찼어요. 연도별로 나누는 작업이 필요해요.':'';break;}
   catch(e){if(e.code==='BUSY'&&i<4){await new Promise(r=>setTimeout(r,800*(i+1)));continue;}
    if(quiet)st.status='unknown';else{st.status='error';st.note=e.code==='BUSY'?'다른 작업이 아직 끝나지 않았어요. 잠시 뒤 [다시 불러오기]를 눌러 주세요.':MSG[e.code]||'매입을 불러오지 못했어요.';}break;} // 미리 읽기 실패는 조용히 — 화면을 열 때 다시 읽는다
  }
  render();
  if(app.view==='dash'&&st.status==='ready')try{app.renderers?.dash?.();}catch{} // 대시보드 '계산서 미수취' 숫자
 }
 // 미리 읽기: 업무 화면이 뜨고 쉬는 틈에 매입 파일을 한 번 읽어 둔다 → [매입]을 누르면 기다리지 않고 바로 보인다.
 // (매입 권한이 있을 때만. 저장 중이라 BUSY면 조용히 넘기고, 화면을 열 때 다시 읽는다.)
 const warm=()=>{if(st.status!=='unknown'||!features())return;st.status='loading';load(false,true);};
 setTimeout(()=>{if(typeof g.requestIdleCallback==='function')g.requestIdleCallback(warm,{timeout:3000});else setTimeout(warm,600);},800);
 const fail=async e=>{const t=MSG[e?.code]||e?.message||'저장하지 못했어요.';toast(t);if(e?.code==='STORAGE_CONFLICT'){st.draft=null;st.dirty=false;st.editing=false;await load(true);return;}render();};
 async function savePurchase(next){const r=await ask('PURCHASE_SAVE',{doc:next});st.doc=r.doc;
  // 앞서 끊긴 저장이 먼저 확인돼 반영된 경우: 그 내용이 이번 것과 같으면 그대로 진행, 다르면 화면을 맞추고 다시 누르게 한다
  if(r.applied===false&&JSON.stringify(r.doc?.rows)!==JSON.stringify(next.rows))throw Object.assign(Error('앞서 끊긴 저장을 먼저 확인해 반영했어요. 내용을 확인하고 다시 눌러 주세요.'),{code:'RETRY'});
  return r.doc;}
 const io={getDoc:()=>structuredClone(st.doc),getStock:()=>structuredClone(D().stock_moves||[]),savePurchases:savePurchase,saveStock:rows=>app.Table.save('stock_moves',rows)};

 // ── 그리기: 견적서와 같은 뼈대(머리·목록 카드·상세 카드) ──
 function render(){
  if(!view.isConnected)return;
  if(st.status==='unknown'){st.status='loading';load();} // 읽기 요청을 먼저 보내고(네트워크가 기다리는 동안) 화면을 그린다
  g.NaroQuoteActions?.closeCompanyPicker();
  mirrorQuoteStyles();
  const more=document.getElementById('moreNavBtn');if(more&&app.view==='purchases')more.classList.add('on');
  const ready=st.status==='ready',p=ready?shown():null;
  const open=ready?!!p:true; // 준비 전(시작·지원 안 함·오류)은 상세 카드에 안내
  view.dataset.ndPhone=open?'detail':'list';
  const list=ready?rows().filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.no.localeCompare(a.no)):[];
  const pending=ready?unfinished(st.doc,D().stock_moves||[]):[];
  const chips=[['','전체'],['작성중','작성중'],['부분 입고','부분 입고'],['미출금','미출금'],['완료','완료']];
  const count=ready?rows().filter(x=>x.kind!=='기초재고'&&!x.removed_at).length:0;
  // 검색 줄 자리: PC(1024~)는 머리 안, 그보다 좁으면 목록 카드 맨 위 — 견적서(panel-layout-b)와 같다
  const tools=`<div class="list-head naro-search-toolbar"><div class="search">${ICON.search}<input id="puSearch" placeholder="매입처·번호·품목" aria-label="매입처·번호·품목 검색" value="${esc(st.q)}" ${ready?'':'disabled'}></div>
     <button class="nd-tool${st.filter==='삭제됨'?' on':''}" id="puFilterBtn" type="button" title="필터" aria-label="필터" ${ready?'':'disabled'}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button>
     <button class="btn-add" id="puNewBtn" type="button" title="새 매입" aria-label="새 매입" ${ready?'':'disabled'}>${ICON.plus}</button></div>`;
  view.innerHTML=`<div class="page-head"><h2>매입</h2><span class="count" id="puCount">${ready?count+'건':''}</span><div class="sp"></div>${desk.matches?tools:''}</div>
   <div class="cols quote-cols${open?' detail-open':''}" id="puCols">
    <div class="card quote-list-card">${desk.matches?'':tools}
     <div class="nd-chips" role="group" aria-label="빠른 필터">${chips.map(([v,t])=>`<button type="button" data-v="${v}" aria-pressed="${st.filter===v}">${t}</button>`).join('')}</div>
     ${st.filter==='삭제됨'?`<div class="nd-trash-bar"><b>삭제된 매입</b><span>${rows().filter(x=>x.removed_at).length}건</span><button type="button" data-act="trash-off">전체 목록으로</button></div>`:''}
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
  return list.map(p=>`<div class="list-item${p.id===st.sel?' on':''}" data-id="${esc(p.id)}" role="button" tabindex="0"><div class="li-body"><div class="li-title"><span class="li-nm">${esc(coName(p.vendor_id)||'매입처 없음')}</span><span class="li-no">${esc(p.no)}</span></div><div class="li-date">${esc(p.date)}</div></div><div class="li-right"><div class="li-amt">${isFx(p)?fx(totals(p).fx,p.currency):money(totals(p).total)}</div>${pill(p)}</div></div>`).join('');
 }
 function emptyCard(hide=false){
  const box=(t,b,act='')=>`<div class="detail-empty pu-empty${hide?' hidden':''}" id="puEmpty">${ICON.cart}<div><b>${t}</b><br>${b}</div>${act}</div>`;
  if(st.status==='loading'||st.status==='unknown')return box('불러오는 중…','');
  if(st.status==='unsupported')return box('Google Drive에서는 아직 매입을 쓸 수 없어요','매입 기록은 지금 Dropbox에서만 저장돼요. 다른 기능은 그대로 쓸 수 있어요.');
  if(st.status==='error')return box('매입을 불러오지 못했어요',esc(st.note||'잠시 뒤 다시 시도해 주세요.'),'<button type="button" class="btn ghost" data-act="reload">다시 불러오기</button>');
  if(st.status==='absent')return box('매입을 시작할까요?','매입처·품목·수량·단가를 적고 [입고 처리]를 하면 재고에 더해지고, 미지급으로 잡혀요.<br>기존 재고·입출금 기록은 바뀌지 않아요.','<button type="button" class="btn save" data-act="start">매입 시작하기</button>');
  return box('왼쪽에서 매입을 고르거나','<b>+</b> 버튼으로 새로 적으세요.');
 }
 function match(p){
  if(p.kind==='기초재고')return false;
  if(st.filter==='삭제됨'){if(!p.removed_at)return false;}else if(p.removed_at||st.filter&&disp(p)[0]!==st.filter)return false;
  if(!st.q)return true;
  const hay=[p.no,coName(p.vendor_id),p.memo,p.customs?.declaration_no,p.customs?.bl_no,...p.lines.map(l=>[itemOf(l.item_id)?.name||'',l.src_name||''].join(' '))].join(' ').toLowerCase();
  return hay.includes(st.q.toLowerCase());
 }

 function form(p){
  const t=totals(p),sv=saved(p);
  const tabs=[['items','품목'],['flow','진행'],['basic','정보']];
  // 머리·탭: PC는 고정 머리(panel-b-work-header)+본문(workspace-form-body) 묶음, 폰·태블릿은 묶음 없이 양식 바로 아래 — 견적서(panel-layout-b)와 같다
  const head=`    ${mob.matches?`<div class="qp-mobile-actions"><button type="button" data-act="back">‹ 매입</button><button type="button" class="qp-primary naro-compact-action" data-act="save">저장</button></div>`:''}
    <div class="qt-hero quote-summary">
     <div class="qs-info"><div class="qs-row"><span class="qs-k">매입처</span><span class="qs-val co">${esc(coName(p.vendor_id)||'매입처 선택')}</span></div></div>
     <div class="qs-amount"><div class="qs-amt-k">${isFx(p)?`금액 (${esc(p.currency)})`:'금액 (부가세 포함)'}</div><div class="qs-amt-v" id="pu_heroTotal">${isFx(p)?fx(t.fx):money(t.total)}</div></div>
     <div class="qp-metadata"><b class="pu-no">${esc(p.no)}</b><span>${esc(md(p.date))}</span>${pill(p)}${isFx(p)?`<span class="pu-fx-sub">${money(t.supply)} · 환율 ${esc(String(p.fx?.booking_rate??''))}</span>`:''}</div>
    </div>
    <div class="qp-tabs" role="tablist" aria-label="매입 상세">${tabs.map(([k,l])=>`<button type="button" id="pp-tab-${k}" role="tab" data-tab="${k}" aria-controls="pp-panel-${k}" aria-selected="${st.tab===k}" tabindex="${st.tab===k?0:-1}">${l}</button>`).join('')}</div>`;
  return `<div class="detail workspace-form${st.editing?'':' nd-view'}" id="puForm" data-nd-st="${esc(disp(p)[0])}">
   ${desk.matches?`<div class="panel-b-work-header">${head}</div>`:''}
   ${desk.matches?'<div class="workspace-form-body">':head}
    ${sv?next(p,sv):''}
    <div class="qt-sec qt-basic nd-info" id="pp-panel-basic" role="tabpanel" aria-labelledby="pp-tab-basic" ${st.tab==='basic'?'':'hidden'}>${basic(p,sv)}</div>
    <div class="qt-sec" id="pp-panel-items" role="tabpanel" aria-labelledby="pp-tab-items" ${st.tab==='items'?'':'hidden'}>${itemsPanel(p,sv)}</div>
    <div class="qt-sec qp-flow nd-rec-on" id="pp-panel-flow" role="tabpanel" aria-labelledby="pp-tab-flow" ${st.tab==='flow'?'':'hidden'}>${flow(p,sv)}</div>
   ${desk.matches?'</div>':''}
   <div class="form-actions quote-form-actions">
    <button class="btn save${st.dirty?'':' nd-saved'}" id="puSaveBtn" type="button" data-act="save" aria-label="${st.dirty?'저장':'저장됨 — 바뀐 내용 없음'}">${st.dirty?'저장':'저장됨'}</button>
    ${st.dirty?`<button class="btn ghost" id="puCancelBtn" type="button" data-act="revert">${sv?'되돌리기':'취소'}</button>`:''}
    ${sv&&!p.removed_at?(mob.matches?`<details class="qp-more pu-more"><summary>··· 더보기</summary>${moreBtns(p)}</details>`:`<details class="panel-b-danger pu-more"><summary aria-label="더보기">더보기</summary><div class="nd-pop">${moreBtns(p)}</div></details>`):''}
   </div>
  </div>`;
 }
 // 진행 줄: 발주 → 입고 → 출금 → 계산서 + 다음 할 일(견적서: 수주 → 납품 → 입금 → 계산서)
 function next(p,sv){
  if(p.removed_at)return `<div class="nd-next nd-cancelled"><div class="nd-cx"><b>삭제됨</b><span>${mdShort(p.removed_at.slice(0,10))} 삭제 · 재고·지급할 금액에서 빠졌어요</span></div><button type="button" class="btn ghost" data-act="restore">복원</button></div>`;
  if(p.status==='취소')return `<div class="nd-next nd-cancelled"><div class="nd-cx"><b>취소됨</b><span>재고·지급할 금액에서 빠졌어요</span></div></div>`;
  const q=qtyOf(p),got=gotOf(p),ps=sv?payState(p):{due:totals(p).total,paid:0},left=Math.max(0,ps.due-ps.paid),tax=!!p.tax_invoice?.received;
  const allIn=sv&&q>0&&got>=q,fxp=isFx(p),cDue=(ps.costs||[]).reduce((s,c)=>s+c.due,0),cPaid=(ps.costs||[]).reduce((s,c)=>s+c.paid,0),cLeft=fxp?costLeft(ps):0;
  const list=[
   {t:'발주',st:sv?'done':'cur'},
   {t:`입고 ${n0(got)}/${n0(q)}개`,st:allIn?'done':sv?'cur':'todo',tab:'flow'},
   fxp?{t:`출금 ${fxs(ps.paid)} / ${fxs(ps.due)} ${p.currency}`,st:sv&&ps.due>0&&left<0.005?'done':allIn?'cur':'todo',tab:'flow'}
    :{t:`출금 ${n0(ps.paid)} / ${n0(ps.due)}원`,st:sv&&ps.due>0&&!left?'done':allIn?'cur':'todo',tab:'flow'},
   ...(fxp?[{t:cLeft>0.5?`부대비용 ${n0(cLeft)}원 남음`:cDue>0&&sv?'부대비용 완료':'부대비용',st:sv&&cDue>0&&cLeft<0.5?'done':sv?'cur':'todo',tab:'flow'}]:[]),
   {t:tax?'계산서 받음':'계산서 미수취',st:tax?'done':'todo',tab:'flow'}];
  const acts=[];
  if(sv&&!st.dirty){
   if(left>(fxp?0.005:0)||cLeft>0.5)acts.push(`<button type="button" class="nd-next-b${got<q?'':' pri'}" data-act="pay">출금 기록</button>`);
   if(got<q)acts.push('<button type="button" class="nd-next-b pri" data-act="receive">입고 처리</button>');
  }
  const sum=sv?{t:`입고 ${n0(got)} / ${n0(q)}개`,s:fxp?`출금 ${fx(ps.paid,p.currency)} · 부대비용 ${n0(cPaid)}원`:`출금 ${n0(ps.paid)}원 · ${tax?'계산서 받음':'계산서 미수취'}`}:{t:'작성 중',s:'저장하면 입고 처리를 할 수 있어요'};
  return `<div class="nd-next"><button type="button" class="nd-sum" data-tab="flow"><b>${esc(sum.t)}</b><span>${esc(sum.s)}</span></button><ol class="nd-steps">${list.map((x,i)=>`${i?`<li class="nd-step-ln ${x.st==='todo'?'':'on'}" aria-hidden="true"></li>`:''}<li class="nd-step ${x.st}">${x.tab?`<button type="button" data-tab="${x.tab}">`:'<span>'}<i>${x.st==='done'?OK:''}</i>${esc(x.t)}${x.tab?'</button>':'</span>'}</li>`).join('')}</ol>${acts.length?`<div class="nd-next-act">${acts.join('')}</div>`:''}</div>`;
 }
 const editBtn=p=>saved(p)&&editable(p)?`<button type="button" class="nd-edit-b" data-act="edit">${st.editing?'완료':'편집'}</button>`:'';
 function itemsPanel(p,sv){
  const t=totals(p),cnt=`${p.lines.filter(l=>l.item_id).length}건 · 총 ${n0(qtyOf(p))}개`;
  const optLabel=l=>[l.color,l.spec].filter(Boolean).map(esc).join(' · ');
  const name=(it,id)=>it?`${esc(it.name||'')}<span class="cd">${esc(it.code||'')}</span>`:id?'<span class="ph">(삭제된 품목)</span>':'<span class="ph">품목 선택</span>';
  const lines=p.lines.map((l,i)=>{const it=itemOf(l.item_id),colors=it?.colors||[],specs=specsOf(it);
   return `<div class="qline" data-idx="${i}"><button type="button" class="ip-btn" data-f="item" data-idx="${i}" aria-label="${esc(it?.name||'')} 품목">${name(it,l.item_id)}</button>
    <div class="dual"><select data-f="lcolor" data-idx="${i}" aria-label="색상">${colors.length?colors.map(c=>`<option ${c===l.color?'selected':''}>${esc(c)}</option>`).join(''):'<option value="">—</option>'}</select><select data-f="vspec" data-idx="${i}" aria-label="규격/옵션">${specs.length?specs.map(s=>`<option ${s===l.spec?'selected':''}>${esc(s)}</option>`).join(''):'<option value="">—</option>'}</select></div>
    <input type="text" inputmode="numeric" class="num" data-f="qty" data-idx="${i}" value="${l.qty?n0(l.qty):''}" aria-label="수량">
    <input type="text" inputmode="${isFx(p)?'decimal':'numeric'}" class="num" data-f="price" data-idx="${i}" value="${l.unit_price?(isFx(p)?fx(l.unit_price):n0(l.unit_price)):''}" placeholder="0" aria-label="단가">
    <span class="amt" data-amt="${i}">${isFx(p)?fx((l.qty||0)*(l.unit_price||0)):n0((l.qty||0)*(l.unit_price||0))}</span>
    <button type="button" class="rm" data-rm="${i}" title="행 삭제" aria-label="행 삭제">${RM}</button></div>`;}).join('');
  const cards=mob.matches?`<div class="qp-cards"><section class="qp-products"><h3>품목 ${p.lines.filter(l=>l.item_id).length}건${editBtn(p)}</h3>
   ${p.lines.map((l,i)=>{const it=itemOf(l.item_id);return `<article class="qp-card"><div class="qp-card-head"><button class="qp-card-edit" type="button" data-qp-edit="${i}"><strong>${it?`${esc(it.name||'')} <small class="qp-code">${esc(it.code||'')}</small>`:l.item_id?'(삭제된 품목)':'품목 선택'}</strong></button><div class="qp-card-amount"><strong>${amtOf(p,(l.qty||0)*(l.unit_price||0))}</strong></div></div>
    <div class="qp-card-sub"><p class="qp-muted">${[optLabel(l),l.src_name?esc(l.src_name):''].filter(Boolean).join(' · ')}</p><small class="qp-unit">${amtOf(p,l.unit_price)}<span class="qp-per"> / ${esc(it?.unit||'EA')}</span></small></div>
    <div class="qp-card-bottom"><div class="qp-stepper"><button type="button" data-qstep="${i}" data-v="-1" aria-label="수량 줄이기">−</button><span>${n0(l.qty)}</span><button type="button" data-qstep="${i}" data-v="1" aria-label="수량 늘리기">+</button></div><button class="qp-card-more" type="button" data-qp-more="${i}">편집</button></div></article>`;}).join('')}
   <div class="nd-addrow"><button class="qp-add nd-gi-plus nd-gi-f" type="button" data-act="addline">품목 추가</button><button class="btn-line-add qp-add" type="button" data-act="size">⊞ 옵션별 한번에</button></div></section></div>`:'';
  return `<div class="qt-sec-t">품목 <span class="cnt">${cnt}</span>${mob.matches?'':editBtn(p)}</div>
   ${cards}
   <div class="qlines"><div class="qline head"><span>품목</span><span class="dual" style="text-align:center"><span>색상</span><span>규격/옵션</span></span><span style="text-align:center">수량</span><span style="text-align:right;padding-right:10px">단가${isFx(p)?` (${esc(p.currency)})`:''}</span><span style="text-align:right">금액</span><span></span></div>${lines}</div>
   <div class="line-btns"><button class="btn-line-add nd-gi-plus nd-gi-f" id="pu_addLine" type="button" data-act="addline">행 추가</button><button class="btn-line-add" id="pu_sizeBtn" type="button" data-act="size">⊞ 옵션별 한번에</button></div>
   <div id="pu_sizePanel">${st.sz&&st.editing?sizePanel(p):''}</div>
   ${isFx(p)?`<div class="qtotals pu-fx-totals"><div class="row"><span class="k">합계 (${esc(p.currency)})</span><span class="v" id="pu_fxTotal">${fx(t.fx)}</span></div><div class="row"><span class="k">원화 환산 · 환율 ${esc(String(p.fx?.booking_rate??''))}</span><span class="v" id="pu_supply">${money(t.supply)}</span></div><div class="row"><span class="k">부대비용</span><span class="v">${money(t.costs)}</span></div><div class="row grand"><span class="k">도착원가</span><span class="v" id="pu_total">${money(t.landed)}</span></div></div>`:`<div class="qtotals"><div class="row"><span class="k">공급가액</span><span class="v" id="pu_supply">${money(t.supply)}</span></div><div class="row"><span class="k">부가세 ${p.vat_on===false?'(없음)':'(10%)'}</span><span class="v" id="pu_vat">${money(t.tax)}</span></div><div class="row grand"><span class="k">합계</span><span class="v" id="pu_total">${money(t.total)}</span></div></div>`}
   ${sv&&!editable(p)&&p.status!=='취소'?'<div class="hint" style="text-align:right;margin-top:6px">입고가 시작된 매입은 품목을 수정할 수 없어요 — 진행 탭에서 입고 취소·반품으로 바로잡아요</div>':''}`;
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
   <div class="szgrid">${it.variants.map(v=>{const l=have[v.spec],fxp=isFx(p),price=l?l.unit_price:fxp?0:buyOf(it,v.spec);return `<div class="szcell"><div class="lb" title="${esc(v.spec)}">${esc(v.spec)}</div><input type="text" inputmode="numeric" data-sz="${esc(v.spec)}" value="${l&&l.qty?n0(l.qty):''}" placeholder="0" aria-label="${esc(v.spec)} 수량"><div class="pr"><input type="text" inputmode="${fxp?'decimal':'numeric'}" data-szp="${esc(v.spec)}" value="${price?(fxp?fx(price):n0(price)):''}" placeholder="단가" aria-label="${esc(v.spec)} 단가"></div></div>`;}).join('')}</div>
   <div class="szfoot"><span class="szsum" id="pu_szSum">총 ${n0(Object.values(have).reduce((a,l)=>a+(l.qty||0),0))}개</span><div class="sp"></div><button class="btn ghost" type="button" data-act="szclose">닫기</button><button class="btn save" type="button" data-act="szapply" style="flex:0 0 auto">품목에 넣기</button></div>
   <div class="hint" style="margin-top:8px">수량을 넣은 옵션만 품목 행으로 들어갑니다. 0이나 빈칸은 해당 행을 지웁니다.</div></div>`;
 }
 // 진행 탭(10/15 — 견적서 진행 탭과 같은 목록형): 제목 줄(이름 · 요약 · 오른쪽 테두리 버튼) + 품목 표처럼 칸 제목 + 한 줄 기록.
 // 입고·출금·반품·계산서. 버튼·메뉴 동작(data-act · data-menu-r)과 저장 방식은 그대로다.
 function flow(p,sv){
  if(!sv)return '<p class="nd-rec-empty" style="padding:18px 0">먼저 [저장]을 눌러 주세요. 저장한 뒤 입고 처리·출금을 기록할 수 있어요.</p>';
  const ids=new Set((D().stock_moves||[]).map(m=>m.id)),ps=payState(p),q=qtyOf(p),got=gotOf(p),left=Math.max(0,ps.due-ps.paid),live=p.status!=='취소';
  const warn=t=>`<b class="nd-pl-warn">${t}</b>`;
  const action=(label,act,disabled=false)=>`<button type="button" class="nd-record-action" data-act="${act}" ${disabled?'disabled':''}>${label}</button>`;
  const section=(type,title,summary,buttons,body)=>{const id='pu-record-'+type,opened=st.recOpen?.[type]!==false;return `<section class="nd-record-section nd-pl"><div class="nd-record-heading"><button type="button" class="qt-sec-t nd-record-toggle" data-record-toggle="${type}" aria-expanded="${opened}" aria-controls="${id}">${title}<span class="cnt">${summary}</span></button><div class="nd-record-actions">${buttons}</div></div><div id="${id}" ${opened?'':'hidden'}>${body}</div></section>`;};
  const head=cols=>`<div class="nd-pl-row nd-pl-th nd-pl-pl" aria-hidden="true">${cols.map(([t,n])=>`<span class="${n?'num':''}">${t}</span>`).join('')}</div>`;
  const empty=t=>`<p class="nd-pl-empty">${t}</p>`;
  const row=(date,name,sub,amount,act='',gone=false)=>`<div class="nd-pl-rec${gone?' gone':''}"><div class="nd-rec-row nd-pl-row nd-pl-pl nd-pl-main"><span class="nd-pl-d num">${mdShort(date)}</span><span class="nd-pl-nm nd-pl-plain">${name}${sub?`<small>${sub}</small>`:''}</span><span class="num nd-pl-q">${amount}</span><span class="nd-pl-act">${act}</span></div></div>`;
  // 입고·반품 줄(UI-RULES 'Purchases follow quotes'): 견적서 납품 줄과 같은 부품 — 날짜 · 품목(첫 품목 외 N건) · 상태 · 수량 · [⋯],
  // 줄을 누르면 품목 · 옵션 · 수량이 펼쳐진다(견적서 납품과 같은 .nd-pl-dl / .nd-pl-x).
  const itemName=l=>{const it=itemOf(l?.item_id);return it?`${it.name||'품목'}${it.code?` [${it.code}]`:''}`:'품목';};
  const recLines=r=>r.lines.map(x=>({l:p.lines.find(y=>y.id===x.line_id),qty:x.qty})).filter(x=>x.qty>0);
  const recName=r=>{const ls=recLines(r),names=[...new Set(ls.map(x=>itemName(x.l)))];return names.length?esc(names[0])+(names.length>1?` 외 ${names.length-1}건`:''):'품목';};
  const opt=l=>[l?.color,l?.spec].filter(Boolean).map(esc).join(' · ');
  const dlRow=(kind,r,state,n,act,gone)=>{const k=kind+':'+r.id,on=!gone&&st.rowOpen?.has(k);
   const sub=recLines(r).map(x=>`<div class="nd-pl-row nd-pl-sub nd-pl-dl"><span></span><span class="nd-pl-in">${esc(itemName(x.l))}${opt(x.l)?`<small>${opt(x.l)}</small>`:''}</span><span></span><span class="num">${n0(x.qty)}</span><span></span></div>`).join('');
   return `<div class="nd-pl-rec${on?' on':''}${gone?' gone':''}"><div class="nd-rec-row nd-pl-row nd-pl-dl nd-pl-main" ${gone?'':`data-pl-open="${esc(k)}" role="button" tabindex="0" aria-expanded="${on}"`}><span class="nd-pl-d num">${mdShort(r.date)}</span><span class="nd-pl-nm">${recName(r)}${gone?'<small>취소됨</small>':''}</span><span class="nd-pl-ship">${state}</span><span class="num nd-pl-q">${n0(n)}</span><span class="nd-pl-act">${act}</span></div>${on?`<div class="nd-pl-x">${sub}</div>`:''}</div>`;};
  const dlHead=cols=>`<div class="nd-pl-row nd-pl-th nd-pl-dl" aria-hidden="true">${cols.map(([t,n])=>`<span class="${n?'num':''}">${t}</span>`).join('')}</div>`;
  const recs=(p.receipts||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(r=>{const s=receiptState(r,ids),n=r.lines.reduce((a,x)=>a+x.qty,0);
   if(s==='void')return dlRow('r',r,'',n,'',true);
   return dlRow('r',r,s==='posted'?'입고 완료':warn('마무리 필요'),n,s==='posted'&&live?`<button type="button" class="nd-rec-more" data-menu-r="${esc(r.id)}" aria-label="이 입고 기록 메뉴" aria-expanded="false">${DOTS}</button>`:'',false);}).join('');
  const payList=pays(p).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const fxp=isFx(p),payTo=x=>fxp?esc(x.company_id===p.vendor_id?'매입처':coName(x.company_id)||'낸 곳')+' · ':'';
  const payAmt=x=>x.amount_fx?`${fx(x.amount_fx,x.currency||p.currency)}<small>${money(x.amount)}</small>`:money(x.amount);
  const payRows=payList.map(x=>x.kind==='지급'?row(x.date,payTo(x)+esc(x.method||'출금'),x.memo&&!/^매입 /.test(x.memo)?esc(x.memo):'',payAmt(x)):row(x.date,payTo(x)+'환불 받음',x.memo?esc(x.memo):'',`−${payAmt(x)}`)).join('');
  // 수입: 부대비용(원가에 금액 비율로 나눔) · 수입부가세(원가 밖) · 개당 원가
  const costs=(p.costs||[]).filter(c=>!c.void_at),iv=p.import_vat||{},cSum=costs.reduce((a,c)=>a+(Number(c.amount_krw)||0),0),cl=costLeft(ps);
  const costRows=costs.map(c=>row(c.added_at?localDay(c.added_at):p.date,esc(c.type),[esc(coName(c.payee_id)||'낸 곳 미지정'),`${esc(c.alloc||'금액')} 비율로 나눔`].join(' · '),money(c.amount_krw))).join('')
   +(iv.amount?row(p.date,'수입부가세',`원가 제외 · 공제${iv.payee_id?' · '+esc(coName(iv.payee_id)):''}`,money(iv.amount)):'')
   +(iv.fee_vat?row(p.date,'수수료 부가세',`원가 제외${iv.payee_id?' · '+esc(coName(iv.payee_id)):''}`,money(iv.fee_vat)):'');
  const uc=fxp?unitCosts(p):{};
  const unitRows=fxp?p.lines.map(l=>{const u=uc[l.id]||{};return row('',esc(itemName(l)),[opt(l),`${n0(l.qty)}개`,`도착원가 ${money(u.total)}`].filter(Boolean).join(' · '),money(u.unit));}).join(''):'';
  const retRows=(p.returns||[]).map(t=>dlRow('t',t,(t.posted_at?esc(t.reason||'반품 완료'):warn('마무리 필요')),t.lines.reduce((a,x)=>a+x.qty,0),'',false)).join('');
  const retQty=(p.returns||[]).reduce((a,t)=>a+t.lines.reduce((b,x)=>b+x.qty,0),0);
  const canReturn=live&&p.lines.some(l=>received(p,l)-returned(p,l)>0),tax=p.tax_invoice||{};
  const recSum=live?`${n0(q)}개 중 ${n0(got)}개${got<q?' · '+warn(n0(q-got)+'개 남음'):got?' · 완료':''}`:`취소된 매입${got?` · 재고에 ${n0(got)}개 남음`:''}`;
  const paySum=!live?cancelPaySummary(p):fxp?`매입처 ${fx(ps.due,p.currency)} 중 ${fx(ps.paid)}${left>=0.005?' · '+warn(fx(left)+' 남음'):ps.paid?' · 완료':''}${cl>0.5?' · '+warn('부대비용 '+n0(cl)+'원 남음'):''}`
   :`${n0(ps.due)}원 중 ${n0(ps.paid)}원${left>0?' · '+warn(n0(left)+'원 남음'):ps.paid>ps.due?' · '+warn(n0(ps.paid-ps.due)+'원 초과'):ps.paid?' · 완료':''}`;
  return `<div class="nd-rec">
   ${section('receipt','입고',recSum,live&&got<q?action('입고 추가','receive-part'):'',recs?dlHead([['날짜'],['품목'],['상태'],['수량',true],['']])+recs:empty(live?'아직 입고 기록이 없어요.':'입고 기록이 없어요.'))}
   ${section('payment','출금',paySum,live?action('출금 추가','pay'):'',payRows?head([['날짜'],[fxp?'받는 곳 · 방법':'방법 · 메모'],['금액',true],['']])+payRows:empty(live&&ps.due>0?`아직 출금 기록이 없어요 · 지급할 금액 ${fxp?fx(left,p.currency):n0(left)+'원'}`:'출금 기록이 없어요.'))}
   ${fxp?section('cost','부대비용',`${n0(cSum)}원 · 원가에 포함`,live?action('비용 추가','cost'):'',costRows?head([['날짜'],['구분 · 낸 곳'],['금액',true],['']])+costRows:empty('운임·관세·통관수수료 같은 비용을 더하면 개당 원가에 나눠 들어가요.')):''}
   ${fxp?section('unit','개당 원가',`환율 ${esc(String(p.fx?.booking_rate??''))} · 부대비용 금액 비율`,'',head([[''],['품목'],['개당',true],['']])+unitRows):''}
   ${section('return','반품',retQty?`${n0(retQty)}개 돌려보냄`:'없음',canReturn?action('반품','return'):'',retRows?dlHead([['날짜'],['품목'],['사유'],['수량',true],['']])+retRows:empty('입고된 것 중 매입처로 돌려보낸 수량을 기록해요.'))}
   ${section('tax','계산서',tax.received?'받음':warn('미수취'),action(tax.received?'수정':'받음 기록','tax'),tax.received?head([['날짜'],['구분'],['합계',true],['']])+row(tax.date||'','수취','',amtOf(p,ps.due)):empty('계산서를 받으면 받은 날을 남겨 두세요.'))}
  </div>`;
 }
 function basic(p,sv){
  const vendors=companies().filter(c=>c.type==='매입'||c.id===p.vendor_id);
  const lockV=sv&&!editable(p),dateHtml=typeof g.dateControlHtml==='function'?g.dateControlHtml('pu_date',p.date,'매입일'):`<input type="date" id="pu_date" value="${esc(p.date)}" aria-label="매입일">`;
  // 정보 묶음(10/16, UI-RULES 'Information groups'): 견적서 정보 탭 · 거래처와 같은 '묶음 이름 + 설명 / 칸' 모양
  const grp=(k,t,d,h)=>`<section class="cp-grp nd-ig-${k}"><div class="cp-grph"><h4>${t}</h4>${d?`<p>${d}</p>`:''}</div><div class="cp-grpb">${h}</div></section>`;
  return grp('basic','기본 정보','매입 장부 기록',`<div class="field"><label for="pu_co">매입처 *</label><select id="pu_co" ${lockV?'disabled':''}><option value="">매입처 선택</option>${vendors.map(c=>`<option value="${esc(c.id)}" ${c.id===p.vendor_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>${vendors.length?'':'<div class="hint">거래처 화면에서 구분을 \'매입\'으로 등록하면 이곳에 표시됩니다.</div>'}</div>
    <div class="grid2 nd-ig-pair"><div class="field"><label for="pu_date">매입일</label>${dateHtml}</div>
    ${isFx(p)?`<div class="field"><label for="pu_curView">통화</label><input id="pu_curView" value="${esc(p.currency)}" disabled></div>`:`<div class="field"><label for="pu_vatSel">부가세</label><select id="pu_vatSel" ${lockV?'disabled':''}><option value="1" ${p.vat_on===false?'':'selected'}>10% 별도</option><option value="0" ${p.vat_on===false?'selected':''}>없음</option></select></div>`}</div>`)
   +(isFx(p)?importGroup(p,grp,lockV):'')
   +grp('memo','비고','내부 메모(출력 안 됨)',`<div class="field"><textarea id="pu_memo" placeholder="입고 일정, 결제 조건 등">${esc(p.memo||'')}</textarea></div>`)
   +(sv&&g.NaroChangeLog?grp('manage','관리','','<button type="button" class="nd-log-link nd-ig-log" data-act="log">이 매입의 변경 기록 보기</button>'):'');
 }
 // 수입 정보(10/17 결정 ①②): 수입신고번호 · B/L · 인도조건 · 결제방법 · 신고일 · 수리일 · 매입 환율(기본 = 과세 환율)
 function importGroup(p,grp,lock){
  const cu=p.customs||{},f=(id,label,v,type='text',mode='')=>`<div class="field"><label for="${id}">${label}</label><input type="${type}" id="${id}" value="${esc(v??'')}" ${mode?`inputmode="${mode}"`:''} ${lock?'disabled':''}></div>`,pair=(a,b)=>`<div class="grid2 nd-ig-pair">${a}${b}</div>`;
  return grp('import','수입 정보','수입신고필증 기록',pair(f('pu_declNo','수입신고번호',cu.declaration_no),f('pu_bl','B/L 번호',cu.bl_no))
   +pair(f('pu_inco','인도조건',cu.incoterms),f('pu_payMethod','결제방법',cu.pay_method))
   +pair(f('pu_declOn','신고일',cu.declared_on,'date'),f('pu_accOn','수리일',cu.accepted_on,'date'))
   +pair(f('pu_rateBook',`매입 환율 (${esc(p.currency)} → 원)`,p.fx?.booking_rate,'text','decimal'),f('pu_rateCustoms','과세 환율',p.fx?.customs_rate,'text','decimal'))
   +'<div class="hint">매입 환율로 원가를 계산해요. 실제 송금 때 원화를 적으면 차이는 환차손익으로 보여요.</div>');
 }
 const moreBtns=p=>p.removed_at?'':`${p.status!=='취소'?'<button class="btn ghost" type="button" data-act="cancel">매입 취소</button>':''}<button class="btn del" type="button" data-act="delete">삭제</button>`;
 const cancelPaySummary=p=>{const ps=pays(p).filter(x=>x.company_id===p.vendor_id),out=ps.filter(x=>x.kind==='지급').reduce((a,x)=>a+(Number(x.amount)||0),0),back=ps.filter(x=>x.kind!=='지급').reduce((a,x)=>a+(Number(x.amount)||0),0);return `취소된 매입 · 지급할 금액 없음${out?` · 출금액 ${n0(out)}원`:''}${back?` · 돌려받음 ${n0(back)}원`:''}${out>back?` · <b class="amber">${n0(out-back)}원 아직 못 돌려받음</b>`:''}`;};
 const deletable=p=>!(p.receipts||[]).length&&!(p.returns||[]).length&&!(D().payments||[]).some(x=>x.purchase_id===p.id)&&!(D().stock_moves||[]).some(m=>m.purchase_id===p.id);

 // ── 고치기 ──
 const blank=()=>({id:'l'+uid(),item_id:'',qty:1,unit_price:0});
 const purchaseSnapshot=p=>JSON.stringify({...p,memo:p.memo||'',vat_on:p.vat_on!==false,lines:p.lines.map(l=>{const v={...l};if(!v.color)delete v.color;if(!v.spec)delete v.spec;return v;})},(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 function edit(fn,redraw=true){const base=st.draft&&st.draft.id===st.sel?st.draft:structuredClone(cur());fn(base);st.draft=base;st.dirty=!cur()||purchaseSnapshot(base)!==purchaseSnapshot(cur());if(redraw)render();}
 function pickItem(i,id){
  if(id==='__free__'){toast('매입은 등록된 품목만 넣을 수 있어요. 품목 화면에서 먼저 등록해 주세요.');return;}
  const it=itemOf(id);if(!it)return;if(isWork(it)){toast('작업 품목은 매입에 넣을 수 없어요.');return;}
  edit(p=>{const l=p.lines[i]||(p.lines[i]=blank());l.item_id=it.id;l.color=(it.colors||[])[0];l.spec=specsOf(it)[0];l.unit_price=isFx(p)?(l.unit_price||0):buyOf(it,l.spec);for(const k of ['color','spec'])if(l[k]===undefined)delete l[k];});
 }
 function chooseVendor(){
  const p=shown(),sel=view.querySelector('#pu_co'),anchor=view.querySelector('#puForm .quote-summary .co');
  if(!p||!sel||sel.disabled||!anchor)return;
  g.NaroQuoteActions?.chooseCompany(anchor,sel,c=>c.type==='매입'||c.id===p.vendor_id,'매입처');
 }
 function newPurchase(){
  const d=today(),n=rows().filter(p=>p.date===d).length+1;
  st.draft={id:'pu_'+uid(),no:`PO-${d.slice(0,4)}${d.slice(5,7)}${d.slice(8)}-${n}`,kind:'국내',vendor_id:'',date:d,status:'작성중',currency:'KRW',lines:[blank()],vat:{supply:0,tax:0},vat_on:true,tax_invoice:{received:false},costs:[],receipts:[],returns:[],cost_runs:[],created_at:nowIso(),updated_at:nowIso()};
  while(rows().some(p=>p.no===st.draft.no))st.draft.no=st.draft.no.replace(/-(\d+)$/,(m,x)=>'-'+(Number(x)+1));
  st.sel=st.draft.id;st.dirty=true;st.editing=true;st.tab='basic';st.sz=null;render();chooseVendor();
 }
 const recalcVat=p=>{const t=totals(p);p.vat={supply:t.supply,tax:t.tax};};
 async function save(){
  if(!st.dirty||st.working)return;
  const p=structuredClone(st.draft);if(!p)return;
  p.lines=p.lines.filter(l=>l.item_id);
  if(!p.vendor_id){toast('매입처를 선택해 주세요.');st.tab='basic';render();return;}
  if(!p.lines.length||p.lines.some(l=>!(Number.isSafeInteger(l.qty)&&l.qty>0)||!(l.unit_price>=0))){toast('품목·수량·단가를 확인해 주세요.');st.tab='items';st.editing=true;render();return;}
  if(!isFx(p))recalcVat(p);p.updated_at=nowIso();
  const next={...st.doc,rows:cur()?st.doc.rows.map(x=>x.id===p.id?p:x):[...st.doc.rows,p]};
  st.working=true;const b=view.querySelector('#puSaveBtn');if(b){b.disabled=true;b.textContent='저장 중…';}
  try{await savePurchase(next);st.draft=null;st.dirty=false;st.editing=false;st.sz=null;toast('매입을 저장했어요');}catch(e){st.working=false;await fail(e);return;}
  st.working=false;render();
 }

 // ── 처리 창: 견적서의 납품 처리·입금 받기 창과 같은 부품(nd-pay-sheet nd-qa-sheet) ──
 let sheetEl=null,guard=null; // guard: 작성 중이면 바깥 누름·Esc로 닫지 않고 묻는다(수입 붙여넣기)
 function qa(html,cls=''){
  if(!sheetEl){sheetEl=document.createElement('dialog');sheetEl.className='nd-pay-sheet nd-qa-sheet pu-qa';
   sheetEl.addEventListener('click',ev=>{if(ev.target!==sheetEl)return;if(guard&&guard())return;sheetEl.close();});
   sheetEl.addEventListener('cancel',ev=>{if(guard&&guard())ev.preventDefault();});
   sheetEl.addEventListener('close',()=>{guard=null;});}
  guard=null;
  if(!sheetEl.isConnected)(document.getElementById('appView')||document.body).append(sheetEl);
  sheetEl.classList.toggle('pu-imp',cls==='pu-imp');sheetEl.innerHTML=html;if(!sheetEl.open){sheetEl.tabIndex=-1;sheetEl.showModal();sheetEl.focus({preventScroll:true});}
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
   after:n=>n?`확인하면 <b>재고에서 ${n0(n)}개 빠지고</b>, 지급할 금액이 줄어요.`:'반품할 수량을 넣어 주세요.',
   onGo:async(d,lines)=>{if(!lines.length)throw Error('반품할 수량을 넣어 주세요.');void unit;await postReturn(io,p.id,{returnId:tid,date:d.querySelector('#puQaDate').value||today(),lines,reason:d.querySelector('#puQaMemo').value.trim(),at:nowIso()});toast('반품을 기록했어요 · 재고에서 뺐어요');}});
 }
 const METHODS=['계좌이체','카드','현금','기타'];
 // 출금 기록: 국내는 매입처에 원화. 수입은 받는 곳을 고른다 — 매입처(외화 금액 + 실제 보낸 원화 → 환율) 또는 운송사·관세사(원화).
 function paySheet(){
  const p=cur();if(!p)return;const ps=payState(p),ref='pay_'+uid(),fxp=isFx(p),rate=Number(p.fx?.booking_rate)||0;
  const targets=[{id:p.vendor_id,fx:fxp,bal:Math.max(0,Math.round((ps.due-ps.paid)*100)/100),name:coName(p.vendor_id)||'매입처'},
   ...(fxp?(ps.costs||[]).filter(c=>c.payee_id!==p.vendor_id).map(c=>({id:c.payee_id,fx:false,bal:Math.max(0,Math.round(c.due-c.paid)),name:coName(c.payee_id)||'낸 곳'})):[])];
  let t=targets.find(x=>x.bal>0)||targets[0];
  let amount=t.bal,krw=t.fx?Math.round(t.bal*rate):0,method='계좌이체',preset='all',date=today(),memo='';
  const unitOf=x=>x.fx?p.currency:'원',show=(x,v)=>x.fx?fx(v,p.currency):`${n0(v)}원`,parse=v=>t.fx?dec(v):num(v);
  const label=()=>amount>0?`${show(t,amount)} 출금 확인`:'금액을 넣어 주세요';
  const paint=()=>{
   const over=amount>t.bal+(t.fx?0.005:0);
   const d=qa(`${head('출금 기록',`${esc(t.name)} · 남은 금액 ${show(t,t.bal)}`)}<div class="nd-qa-body">
     ${targets.length>1?`<div class="nd-qa-chips pu-pay-to" role="group" aria-label="받는 곳">${targets.map((x,i)=>`<button type="button" data-to="${i}" aria-pressed="${x===t}">${esc(x.id===p.vendor_id?'매입처':x.name)} · ${show(x,x.bal)}</button>`).join('')}</div>`:''}
     <label class="nd-qa-money">보낸 금액${t.fx?` (${esc(p.currency)})`:''}<input id="puQaAmt" inputmode="${t.fx?'decimal':'numeric'}" value="${amount?(t.fx?fx(amount):n0(amount)):''}" placeholder="0"><span>${esc(unitOf(t))}</span></label>
     ${t.fx?`<label class="nd-qa-money">실제 보낸 원화<input id="puQaKrw" inputmode="numeric" value="${krw?n0(krw):''}" placeholder="0"><span>원</span></label><p class="nd-qa-note" id="puQaRate">${amount>0&&krw>0?`송금 환율 ${(krw/amount).toFixed(2)} · 매입 환율 ${rate} · 환차 ${n0(amount*rate-krw)}원`:'은행 출금 원화를 적으면 환차손익이 계산돼요.'}</p>`:''}
     <div class="nd-qa-chips" role="group" aria-label="금액">${[['all','남은 금액 전부'],['half','절반'],['custom','직접 입력']].map(([k,x])=>`<button type="button" data-p="${k}" aria-pressed="${preset===k}">${x}</button>`).join('')}</div>
     <div class="nd-qa-chips" role="group" aria-label="출금 방법">${METHODS.map(m=>`<button type="button" data-me="${m}" aria-pressed="${method===m}">${m}</button>`).join('')}</div>
     <div class="nd-qa-fields"><label>출금일<input type="date" id="puQaDate" value="${esc(date)}"></label><label>메모 (선택)<input id="puQaMemo" value="${esc(memo)}" placeholder="예: 잔금"></label></div>
     ${over?`<p class="nd-qa-warn">남은 금액보다 ${show(t,Math.round((amount-t.bal)*100)/100)} 많아요. 초과 출금으로 기록돼요.</p>`:''}
    </div>${acts(label(),amount>0&&(!t.fx||krw>0))}`);
   d.querySelector('#puQaDate').onchange=ev=>{date=ev.target.value;};d.querySelector('#puQaMemo').oninput=ev=>{memo=ev.target.value;};
   const inp=d.querySelector('#puQaAmt'),ki=d.querySelector('#puQaKrw');
   const sync=()=>{const b=d.querySelector('.nd-qa-go');b.disabled=!(amount>0&&(!t.fx||krw>0));b.textContent=label();const r=d.querySelector('#puQaRate');if(r)r.textContent=amount>0&&krw>0?`송금 환율 ${(krw/amount).toFixed(2)} · 매입 환율 ${rate} · 환차 ${n0(amount*rate-krw)}원`:'은행 출금 원화를 적으면 환차손익이 계산돼요.';};
   inp.oninput=()=>{amount=parse(inp.value);if(t.fx&&!ki.dataset.touched)krw=Math.round(amount*rate),ki.value=krw?n0(krw):'';preset='custom';d.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.p==='custom')));sync();};
   // 손을 뗄 때 창을 다시 그리면 같이 누른 확인 버튼이 사라진다 — 숫자 모양만 정리
   inp.onblur=()=>{inp.value=amount?(t.fx?fx(amount):n0(amount)):'';};
   if(ki){ki.oninput=()=>{ki.dataset.touched='1';krw=num(ki.value);sync();};ki.onblur=()=>{ki.value=krw?n0(krw):'';};}
   d.querySelectorAll('[data-to]').forEach(b=>b.onclick=()=>{t=targets[Number(b.dataset.to)];amount=t.bal;krw=t.fx?Math.round(t.bal*rate):0;preset='all';paint();});
   d.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{preset=b.dataset.p;if(preset==='all')amount=t.bal;else if(preset==='half')amount=t.fx?Math.round(t.bal*50)/100:Math.round(t.bal/2);if(t.fx&&preset!=='custom')krw=Math.round(amount*rate);paint();if(preset==='custom'){const i=sheetEl.querySelector('#puQaAmt');i.focus();i.select();}});
   d.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{method=b.dataset.me;paint();});
   d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
    if(!(amount>0))throw Error('금액을 넣어 주세요.');if(t.fx&&!(krw>0))throw Error('실제 보낸 원화를 넣어 주세요.');
    const list=D().payments||[];if(list.some(x=>x.client_ref===ref))return; // 같은 창에서 두 번 눌러도 한 번만
    const row={id:'pay'+uid(),date:d.querySelector('#puQaDate').value||today(),company_id:t.id,kind:'지급',method,amount:t.fx?krw:amount,memo:d.querySelector('#puQaMemo').value.trim()||`매입 ${p.no}`,purchase_id:p.id,client_ref:ref,created_at:nowIso(),
     ...(t.fx?{currency:p.currency,amount_fx:amount,fx_rate:Math.round(krw/amount*10000)/10000}:{})};
    await app.Table.save('payments',[...list,row]);
    toast(`${show(t,amount)} 출금을 기록했어요`);});
  };
  paint();
 }
 // 부대비용 더하기(수입): 저장 규칙상 비용은 더하기만 한다. 원가에는 금액 비율로 나눠 들어간다(결정 ③).
 function costSheet(){
  const p=cur();if(!p)return;let type='운임',amount=0;
  const payees=companies().filter(c=>c.type==='매입'&&c.id!==p.vendor_id),last=(p.costs||[]).map(c=>c.payee_id).filter(Boolean).pop()||p.import_vat?.payee_id||'';
  const paint=()=>{
   const d=qa(`${head('비용 추가',`${esc(p.no)} · 개당 원가에 금액 비율로 나눠 들어가요`)}<div class="nd-qa-body">
     <div class="nd-qa-chips" role="group" aria-label="구분">${COST_TYPES.map(x=>`<button type="button" data-ty="${x}" aria-pressed="${x===type}">${x}</button>`).join('')}</div>
     <label class="nd-qa-money">금액<input id="puQaAmt" inputmode="numeric" value="${amount?n0(amount):''}" placeholder="0"><span>원</span></label>
     <div class="nd-qa-fields"><label>낸 곳<select id="puQaPayee"><option value="">미지정</option>${payees.map(c=>`<option value="${esc(c.id)}" ${c.id===last?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div>
     <p class="nd-qa-after">낸 곳을 고르면 그곳에 <b>지급할 금액</b>으로 잡혀요. 입고 전에 더하면 입고 원가에 바로 들어가요.</p></div>${acts(amount>0?`${n0(amount)}원 추가`:'금액을 넣어 주세요',amount>0)}`);
   const inp=d.querySelector('#puQaAmt');inp.oninput=()=>{amount=num(inp.value);const b=d.querySelector('.nd-qa-go');b.disabled=!(amount>0);b.textContent=amount>0?`${n0(amount)}원 추가`:'금액을 넣어 주세요';};inp.onblur=()=>{inp.value=amount?n0(amount):'';};
   d.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>{type=b.dataset.ty;d.querySelectorAll('[data-ty]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
   d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
    if(!(amount>0))throw Error('금액을 넣어 주세요.');const payee=d.querySelector('#puQaPayee').value,np=structuredClone(p);
    np.costs=[...(np.costs||[]),{id:'c'+uid(),type,amount_krw:amount,alloc:'금액',...(payee?{payee_id:payee}:{}),added_at:nowIso()}];np.updated_at=nowIso();
    await savePurchase({...st.doc,rows:st.doc.rows.map(x=>x.id===p.id?np:x)});toast(`${type} ${n0(amount)}원을 더했어요`);});
  };
  paint();
 }
 // ── 수입 매입 붙여넣기(10/17 시안): 프롬프트 복사 → AI 답 붙여넣기 → 확인(품목 짝 · 구분 · 검사) → [매입 만들기] ──
 const nameKey=s=>String(s||'').replace(/\(주\)|주식회사|\s+/g,'').toLowerCase();
 const findCo=name=>name?companies().find(c=>c.type==='매입'&&nameKey(c.name)===nameKey(name))||null:null;
 async function ensureCompany(name){
  const hit=findCo(name);if(hit)return hit.id;
  // 거래처 저장 규칙(company-contract)의 칸을 빠짐없이
  const row={id:crypto.randomUUID(),name:name.trim().slice(0,200),type:'매입',biz_no:'',contact:'',phone:'',email:'',address_base:'',address_detail:'',address:'',memo:'수입 매입 붙여넣기로 등록',quote_memo:'',prices:[],created_at:nowIso()};
  const next=[...companies(),row];await app.Table.save('companies',next);if(!companies().some(c=>c.id===row.id))D().companies=next;
  return row.id;
 }
 // 확인 칸(10/17 시안 2): 기본 선택 상자 대신 앱 부품 모양 — 거래처 고르기 창 · 품목 고르기 창(+ 새 품목 등록) · 색상 칩 ·
 // 옵션별 수량 칸(옵션별 한번에와 같은 칸) · 청구서 구분 표시(자동, 눌러서 바꾸기). 창은 모달이라 고르기 창도 창 안에 띄운다.
 let impDraft=null; // 수입 붙여넣기 임시 저장(이 기기 · 앱을 다시 열기 전까지)
 const TYPE_LABEL={import_vat:'수입부가세',skip:'넣지 않음'};
 const typeLabel=t=>TYPE_LABEL[t]||t;
 function importSheet(){
  let created=false,text='',parsed=null,vendor='',payee='',map=[],types=[],tsrc=[],copied=false,vendorPicked=false,payeePicked=false,nf=null,pop=null;
  const lines=()=>parsed?.decl.lines||[];
  const optsOf=it=>{const sp=specsOf(it);return sp.length>1?sp:[];}; // 옵션이 둘 이상이면 수량 칸
  const sumOf=i=>{const m=map[i],it=itemOf(m?.item_id);if(!it)return 0;return optsOf(it).length?Object.values(m.qty||{}).reduce((a,v)=>a+(v||0),0):lines()[i].qty;};
  const partsOf=i=>{const m=map[i],it=itemOf(m?.item_id),sp=optsOf(it);return sp.length?sp.map(x=>({spec:x,qty:m.qty?.[x]||0})):[{spec:specsOf(it)[0]||'',qty:lines()[i].qty}];};
  const reparse=()=>{
   const prevNames=lines().map(l=>l.name).join('\n');parsed=text.trim()?parseImportPaste(text):null;if(!parsed?.found)return;
   const v=findCo(parsed.decl.vendor);if(!vendorPicked||!vendor||!companies().some(c=>c.id===vendor))vendor=v?v.id:parsed.decl.vendor?'new':'';
   const py=findCo(parsed.inv?.payee);if(!payeePicked||!payee||!companies().some(c=>c.id===payee))payee=py?py.id:parsed.inv?.payee?'new':'';
   types=(parsed.inv?.items||[]).map(x=>costTypeOf(x.name));tsrc=types.map(()=>'auto');
   if(lines().map(l=>l.name).join('\n')!==prevNames){map=lines().map(()=>null);nf=null;}
   remember();rememberTypes();
  };
  // 같은 매입처의 지난 수입 매입에서 품목·색상 짝(사이즈 수량은 매번 다름 — 결정 ④)
  const remember=()=>{if(!parsed?.found||!vendor||vendor==='new')return;const r=rememberedMap(rows(),vendor,lines().map(l=>l.name));map=map.map((m,i)=>m||(r[i]&&itemOf(r[i].item_id)?{item_id:r[i].item_id,color:r[i].color,qty:{},auto:true}:null));};
  // 같은 낸 곳의 지난 수입 매입에서 청구서 구분(결정 ③). 사용자가 이 창에서 바꾼 것은 그대로.
  const rememberTypes=()=>{if(!parsed?.inv||!payee||payee==='new')return;const r=rememberedTypes(rows(),payee,parsed.inv.items.map(x=>x.name));r.forEach((t,i)=>{if(t&&tsrc[i]!=='user'){types[i]=t;tsrc[i]='memo';}});};
  const checks=()=>{if(!parsed?.found)return [];const out=checkImport(parsed,types);
   const miss=lines().filter((l,i)=>!itemOf(map[i]?.item_id)).length;if(miss)out.push({ok:false,block:true,text:`등록 품목을 고르지 않은 줄이 ${miss}개 있어요`});
   lines().forEach((l,i)=>{const it=itemOf(map[i]?.item_id);if(it&&optsOf(it).length&&sumOf(i)!==l.qty)out.push({ok:false,block:true,text:`${l.name||'품목'} 사이즈 수량 ${n0(l.qty)}개 중 ${n0(sumOf(i))}개 — 필증 수량과 같아야 해요`});});
   if(!vendor)out.push({ok:false,block:true,text:'매입처를 선택해 주세요'});
   const dup=parsed.decl.no&&rows().find(x=>!x.removed_at&&x.customs?.declaration_no===parsed.decl.no);if(dup)out.push({ok:false,block:true,text:`이미 만든 수입 매입이에요(신고번호 ${parsed.decl.no} · ${dup.no})`});
   if(parsed.inv&&!payee)out.push({ok:false,block:true,text:'청구서를 낸 곳(운송사·관세사)을 선택해 주세요'});
   return out;};
  const coBtn=(id,sel,name,label)=>{const c=companies().find(x=>x.id===sel);return `<button type="button" class="pu-imp-btn pu-imp-party${sel?'':' need'}" id="${id}" aria-haspopup="dialog" title="${esc(sel==='new'?name:c?.name||'')}"><span class="nm">${sel==='new'?esc(name):c?esc(c.name):esc(label+' 선택')}</span>${sel==='new'?'<span class="pu-imp-newtag">새로 등록</span>':''}</button>`;};
  const sumHtml=i=>{const l=lines()[i],n=sumOf(i),ok=n===l.qty;return `<div class="pu-imp-sum ${ok?'ok':'bad'}" data-sum="${i}">${ok?`${OK}${n0(l.qty)}개 중 ${n0(n)}개`:`${n0(l.qty)}개 중 ${n0(n)}개 · ${n<l.qty?`${n0(l.qty-n)}개 남음`:`${n0(n-l.qty)}개 많음`}`}</div>`;};
  const newForm=i=>`<div class="pu-imp-nf" data-nf="${i}">
     <label class="full">품명<input data-nfk="name" value="${esc(nf.name)}"></label>
     <label>코드<input data-nfk="code" value="${esc(nf.code)}" placeholder="비우면 코드 없음"></label>
     <label>단위<input data-nfk="unit" value="${esc(nf.unit)}"></label>
     <label>색상 · 쉼표로 구분<input data-nfk="colors" value="${esc(nf.colors)}" placeholder="예: WH, BK"></label>
     <label>사이즈 · 쉼표로 구분<input data-nfk="sizes" value="${esc(nf.sizes)}" placeholder="예: S, M, L, XL"></label>
     ${nf.err?`<p class="nd-qa-warn full">${esc(nf.err)}</p>`:''}
     <div class="act full"><button type="button" class="pu-imp-ghost" data-nf-x>취소</button><button type="button" class="pu-imp-pri" data-nf-go>품목 등록</button></div></div>`;
  const lineHtml=(l,i)=>{const m=map[i]||{},it=itemOf(m.item_id),colors=it?.colors||[],sp=optsOf(it);
   return `<div class="pu-imp-ln" data-ln="${i}">
    <div class="pu-imp-src"><b>${esc(l.name||'이름 없음')}</b><small>${[l.hs,`${n0(l.qty)} ${l.unit||'PCS'}`,`${esc(parsed.decl.currency)} ${fx(l.price)}`].filter(Boolean).map(esc).join(' · ')}</small></div>
    <div class="pu-imp-pick">
     <button type="button" class="pu-imp-btn${it?'':' need'}" data-pick-item="${i}" aria-haspopup="dialog">${it?`${esc(it.name||'')} <span class="pu-imp-cd">${esc(it.code||'')}</span>`:'품목 선택'}</button>
     ${nf&&nf.i===i?newForm(i):''}
     ${it&&colors.length?`<div class="pu-imp-chips" role="group" aria-label="색상">${colors.map(c=>`<button type="button" data-mc="${i}" data-v="${esc(c)}" aria-pressed="${c===m.color}">${esc(c)}</button>`).join('')}</div>`:''}
     ${it&&sp.length?`<div class="pu-imp-sz" role="group" aria-label="사이즈별 수량">${sp.map(x=>`<label class="pu-imp-szc"><span>${esc(x)}</span><input inputmode="numeric" data-mq="${i}" data-spec="${esc(x)}" value="${m.qty?.[x]?n0(m.qty[x]):''}" placeholder="0" aria-label="${esc(x)} 수량"></label>`).join('')}</div>${sumHtml(i)}`:''}
     ${it?`<small class="pu-imp-hint">${m.auto?'지난번 짝 기억':'이 매입처에 기억해요'}${sp.length?' · 사이즈마다 매입 품목 한 줄(같은 단가)':''}</small>`:'<small class="pu-imp-hint">처음 보는 품명 — 한 번 고르면 기억</small>'}
    </div>
    <div class="pu-imp-amt">${esc(parsed.decl.currency)} ${fx(l.amount)}<small>${l.amount!==null&&parsed.decl.customs_rate?money(Math.round(l.amount*parsed.decl.customs_rate)):''}</small></div></div>`;};
  const invHtml=(x,i)=>`<div class="pu-imp-cost"><span class="nm">${esc(x.name)}${x.currency&&x.currency!=='KRW'&&x.amount_fx?`<small>${esc(x.currency)} ${fx(x.amount_fx)}</small>`:''}</span>
    <span><button type="button" class="pu-imp-tag${tsrc[i]==='user'?' chg':''}" data-ty="${i}" aria-haspopup="menu">${esc(typeLabel(types[i]))}${tsrc[i]==='user'?' <i>바꿈</i>':tsrc[i]==='memo'?' <i>기억</i>':''}</button>${types[i]==='관세'?'<small>원가는 필증 관세로</small>':types[i]==='import_vat'?'<small>원가 제외 · 필증 값</small>':''}</span>
    <span class="n">${n0(x.amount_krw)}</span><span class="n v">${n0(x.vat)}</span></div>`;
  const checksHtml=()=>checks().map(c=>`<li class="${c.ok?'ok':c.block?'bad':'warn'}">${c.ok?OK:'!'}<span>${esc(c.text)}</span></li>`).join('');
  const preview=()=>{
   if(!text.trim())return '';
   if(!parsed?.found)return '<p class="nd-qa-warn">[수입신고필증] 부분을 찾지 못했어요. AI 답을 그대로 붙여 넣어 주세요.</p>';
   const {decl,inv}=parsed;
   return `<div class="pu-imp-party-row"><span class="lab">매입처</span>${coBtn('puImpVendor',vendor,decl.vendor,'매입처')}</div>
    <div class="pu-imp-kv"><div><span class="lab">신고번호</span><b>${esc(decl.no||'—')}</b></div><div><span class="lab">B/L</span><b>${esc(decl.bl||'—')}</b></div><div><span class="lab">결제 · 과세 환율</span><b>${esc([decl.incoterms,decl.currency].filter(Boolean).join(' '))} · ${esc(String(decl.customs_rate??'—'))}</b></div></div>
    <div class="pu-imp-lines">${decl.lines.map(lineHtml).join('')}<div class="pu-imp-tot"><span>합계</span><b>${esc(decl.currency)} ${fx(decl.lines.reduce((a,l)=>a+(l.amount||0),0))}</b></div></div>
    ${inv?`<div class="pu-imp-party-row"><span class="lab">청구서 낸 곳</span>${coBtn('puImpPayee',payee,inv.payee,'낸 곳')}</div><div class="pu-imp-kv"><div><span class="lab">청구 합계</span><b>${n0(inv.total??inv.items.reduce((a,x)=>a+(x.amount_krw||0)+(x.vat||0),0))}원</b></div><div><span class="lab">관세 (필증)</span><b>${n0(decl.duty_total??decl.lines.reduce((a,l)=>a+(l.duty||0),0))}원</b></div><div><span class="lab">수입부가세 (필증)</span><b>${n0(decl.vat_total??decl.lines.reduce((a,l)=>a+(l.vat||0),0))}원</b></div></div>
    <p class="pu-imp-note">구분은 항목 이름으로 자동으로 정해져요. 눌러서 바꾸면 이 운송사·관세사의 다음 붙여넣기에도 그대로 써요.</p><div class="pu-imp-costs"><div class="pu-imp-cost hd"><span>청구서 항목</span><span>앱 구분</span><span class="n">금액(원)</span><span class="n v">부가세</span></div>${inv.items.map(invHtml).join('')}</div>`:'<p class="nd-qa-note">청구서가 없으면 관세만 부대비용으로 넣어요. 운임 등은 나중에 [비용 추가]로 더할 수 있어요.</p>'}
    <ul class="pu-imp-checks" id="puImpChecks">${checksHtml()}</ul>`;
  };
  const ready=()=>parsed?.found&&!checks().some(c=>!c.ok&&c.block);
  let d;
  const snapshot=()=>structuredClone({text,vendor,payee,vendorPicked,payeePicked,map,types,tsrc,nf});
  function showLeave(){
   closePop();let bar=d.querySelector('.pu-imp-leave');
   if(!bar){bar=document.createElement('div');bar.className='pu-imp-leave';bar.setAttribute('role','alert');
    bar.innerHTML='<span>작성 중인 내용이 있어요.</span><button type="button" class="pu-imp-ghost" data-leave="stay">계속 작성</button><button type="button" class="pu-imp-pri" data-leave="go">임시 저장하고 닫기</button>';
    d.querySelector('.nd-ps-act').before(bar);
    bar.querySelector('[data-leave="stay"]').onclick=()=>bar.remove();
    bar.querySelector('[data-leave="go"]').onclick=()=>{d.close();toast('임시 저장했어요 · 다시 열면 이어서 할 수 있어요');};}
   bar.querySelector('[data-leave="stay"]').focus();
  }
  function restore(o){text=o.text;vendor=o.vendor;payee=o.payee;vendorPicked=o.vendorPicked;payeePicked=o.payeePicked;map=o.map;types=o.types;tsrc=o.tsrc;nf=o.nf;
   parsed=text.trim()?parseImportPaste(text):null;d.querySelector('#puImpText').value=text;paintPreview();}
  const closePop=()=>{pop?.remove();pop=null;};
  const syncGo=()=>{const b=d.querySelector('.nd-qa-go');if(b&&b.textContent!=='저장 중…')b.disabled=!ready();};
  const paintChecks=()=>{const ul=d.querySelector('#puImpChecks');if(ul)ul.innerHTML=checksHtml();syncGo();};
  const paintPreview=()=>{closePop();const box=d.querySelector('#puImpPreview');const y=d.scrollTop;box.innerHTML=preview();d.scrollTop=y;syncGo();bindPreview();};
  // 창 안의 고르기 창: 검색 + 목록 + (맨 위/아래) 추가 동작. 앵커 아래(공간이 없으면 위)에 띄운다.
  function openPop(anchor,{cls,placeholder,rows:all,render,onPick,extra}){
   closePop();const el=document.createElement('div');el.className=cls+' pu-imp-pop';el.setAttribute('role','dialog');
   el.innerHTML=`<input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><div class="pu-imp-poplist" role="listbox"></div>`;
   d.append(el);pop=el;
   const r=anchor.getBoundingClientRect(),w=Math.min(380,innerWidth-24),below=innerHeight-r.bottom,up=below<260&&r.top>below;
   el.style.width=w+'px';el.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';
   if(up){el.style.bottom=(innerHeight-r.top+6)+'px';el.style.maxHeight=Math.max(160,r.top-18)+'px';}else{el.style.top=(r.bottom+6)+'px';el.style.maxHeight=Math.max(160,below-18)+'px';}
   const input=el.querySelector('input'),list=el.querySelector('.pu-imp-poplist');let hi=0,shown=[];
   const draw=()=>{const q=input.value.trim().toLowerCase();shown=all(q);hi=Math.min(hi,Math.max(0,shown.length-1));
    list.innerHTML=(extra?.top?extra.top():'')+(shown.length?shown.map((x,i)=>render(x,i===hi,i)).join(''):`<p class="pu-imp-popempty">${q?`'${esc(input.value)}'에 맞는 항목이 없어요`:'항목이 없어요'}</p>`)+(extra?.bottom?extra.bottom(input.value):'');
    list.querySelectorAll('[data-pi]').forEach(b=>b.onmousedown=ev=>{ev.preventDefault();const x=shown[Number(b.dataset.pi)];closePop();onPick(x);});
    list.querySelectorAll('[data-pextra]').forEach(b=>b.onmousedown=ev=>{ev.preventDefault();const k=b.dataset.pextra;closePop();extra.onExtra(k,input.value);});};
   input.oninput=()=>{hi=0;draw();};
   input.onkeydown=ev=>{if(ev.isComposing)return;if(ev.key==='ArrowDown'){ev.preventDefault();hi=Math.min(hi+1,shown.length-1);draw();}else if(ev.key==='ArrowUp'){ev.preventDefault();hi=Math.max(hi-1,0);draw();}else if(ev.key==='Enter'){ev.preventDefault();if(shown[hi]){const x=shown[hi];closePop();onPick(x);}}else if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();closePop();anchor.focus();}};
   draw();setTimeout(()=>input.focus(),0);
  }
  const pickCompany=(anchor,which)=>{
   const name=which==='v'?parsed.decl.vendor:parsed.inv?.payee,hidden=window.NaroTrash?NaroTrash.hidden('companies'):[];
   const set=v=>{if(which==='v'){vendor=v;vendorPicked=true;map=map.map(m=>m?.auto?null:m);remember();}else{payee=v;payeePicked=true;tsrc=tsrc.map(t=>t==='memo'?'auto':t);types=types.map((t,i)=>tsrc[i]==='auto'?costTypeOf(parsed.inv.items[i].name):t);rememberTypes();}paintPreview();};
   openPop(anchor,{cls:'nd-co-pop',placeholder:'거래처 이름·담당자 검색',
    rows:q=>companies().filter(c=>c.type==='매입'&&!hidden.includes(c.id)&&(!q||(c.name||'').toLowerCase().includes(q)||(c.contact||'').toLowerCase().includes(q))).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko')).slice(0,60),
    render:(c,on,i)=>`<button type="button" role="option" class="nd-co-opt${on?' on':''}" data-pi="${i}"><span>${esc(c.name||'(이름 없음)')}</span>${c.contact?`<small>${esc(c.contact)}</small>`:''}<em>매입</em></button>`,
    onPick:c=>set(c.id),
    extra:{top:()=>name&&!findCo(name)?`<button type="button" class="nd-co-opt pu-imp-addopt" data-pextra="new" title="${esc(name)}"><span>새로 등록 · ${esc(name)}</span></button>`:'',onExtra:()=>set('new')}});
  };
  const pickItem=(anchor,i)=>{
   const l=lines()[i],hidden=window.NaroTrash?NaroTrash.hidden('items'):[];
   openPop(anchor,{cls:'ip-pop',placeholder:'품명·코드 검색',
    rows:q=>(D()?.items||[]).filter(x=>!isWork(x)&&!hidden.includes(x.id)&&(!q||(x.name||'').toLowerCase().includes(q)||(x.code||'').toLowerCase().includes(q))).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko')).slice(0,50),
    render:(x,on,k)=>`<div class="ip-opt${on?' hi':''}" role="option" data-pi="${k}"><span class="nm">${esc(x.name||'')}</span>${x.code?`<span class="cd">${esc(x.code)}</span>`:'<span></span>'}<span class="pr">${specsOf(x).length>1?`옵션 ${specsOf(x).length}`:''}</span></div>`,
    onPick:x=>{map[i]={item_id:x.id,color:(x.colors||[])[0]||'',qty:{}};if(nf?.i===i)nf=null;paintPreview();},
    extra:{bottom:q=>`<div class="ip-opt pu-imp-addopt" role="option" data-pextra="new"><span class="nm">새 품목으로 등록 · ${esc(q.trim()||l.name||'')}</span></div>`,
     onExtra:(k,q)=>{nf={i,name:(q.trim()||l.name||'').slice(0,200),code:'',unit:'EA',colors:'',sizes:'',err:''};paintPreview();setTimeout(()=>d.querySelector(`[data-nf="${i}"] [data-nfk="code"]`)?.focus(),0);}}});
  };
  const pickType=(anchor,i)=>{
   closePop();const el=document.createElement('div');el.className='pu-imp-menu pu-imp-pop';el.setAttribute('role','menu');
   el.innerHTML=[...COST_TYPES,'import_vat','skip'].map(t=>`<button type="button" role="menuitemradio" aria-checked="${types[i]===t}" data-t="${t}">${esc(typeLabel(t))}</button>`).join('');
   d.append(el);pop=el;const r=anchor.getBoundingClientRect(),below=innerHeight-r.bottom;el.style.left=Math.max(12,Math.min(r.left,innerWidth-180))+'px';
   if(below<300&&r.top>below)el.style.bottom=(innerHeight-r.top+6)+'px';else el.style.top=(r.bottom+6)+'px';
   el.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{types[i]=b.dataset.t;tsrc[i]='user';paintPreview();d.querySelector(`[data-ty="${i}"]`)?.focus();});
   el.querySelector('[aria-checked="true"]')?.focus();
  };
  async function saveNewItem(){
   const name=String(nf.name||'').trim(),code=String(nf.code||'').trim(),split=v=>[...new Set(String(v||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean))];
   if(!name){nf.err='품명을 넣어 주세요.';paintPreview();return;}
   const dup=code&&(D()?.items||[]).find(x=>(x.code||'')===code);if(dup){nf.err=`품목코드 ${code}는 이미 '${dup.name}'에 쓰이고 있어요.`;paintPreview();return;}
   // 품목 화면의 새 품목과 같은 모양(blankItem) — 판매가·사진·메모는 나중에 품목 화면에서
   const row={id:crypto.randomUUID(),code,name:name.slice(0,200),type:'단품',spec:'',unit:String(nf.unit||'').trim()||'EA',buy_price:0,sell_price:0,colors:split(nf.colors),variants:split(nf.sizes).map(x=>({spec:x,buy_price:'',sell_price:''})),components:[],memo:'수입 매입 붙여넣기로 등록',created_at:nowIso()};
   const btn=d.querySelector('[data-nf-go]');if(btn){btn.disabled=true;btn.textContent='저장 중…';}
   try{const next=[...(D()?.items||[]),row];await app.Table.save('items',next);if(!(D()?.items||[]).some(x=>x.id===row.id))D().items=next;}
   catch(e){nf.err=MSG[e?.code]||e?.message||'품목을 저장하지 못했어요.';paintPreview();return;}
   const i=nf.i;nf=null;map[i]={item_id:row.id,color:row.colors[0]||'',qty:{}};toast(`'${row.name}' 품목을 등록했어요`);paintPreview();
  }
  const bindPreview=()=>{
   d.querySelector('#puImpVendor')?.addEventListener('click',e=>pickCompany(e.currentTarget,'v'));
   d.querySelector('#puImpPayee')?.addEventListener('click',e=>pickCompany(e.currentTarget,'p'));
   d.querySelectorAll('[data-pick-item]').forEach(b=>b.onclick=()=>pickItem(b,Number(b.dataset.pickItem)));
   d.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>{const m=map[Number(b.dataset.mc)];if(m){m.color=b.dataset.v;m.auto=false;}paintPreview();});
   d.querySelectorAll('[data-mq]').forEach(inp=>{const i=Number(inp.dataset.mq);
    inp.oninput=()=>{const m=map[i];if(!m)return;(m.qty||(m.qty={}))[inp.dataset.spec]=num(inp.value);const s=d.querySelector(`[data-sum="${i}"]`);if(s)s.outerHTML=sumHtml(i);paintChecks();};
    inp.onblur=()=>{const v=map[i]?.qty?.[inp.dataset.spec];inp.value=v?n0(v):'';};});
   d.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>pickType(b,Number(b.dataset.ty)));
   d.querySelectorAll('[data-nfk]').forEach(inp=>inp.oninput=()=>{if(nf)nf[inp.dataset.nfk]=inp.value;});
   d.querySelector('[data-nf-x]')?.addEventListener('click',()=>{nf=null;paintPreview();});
   d.querySelector('[data-nf-go]')?.addEventListener('click',saveNewItem);
  };
  d=qa(`${head('수입 매입 붙여넣기','수입신고필증 · 운송사 청구서를 AI로 정리해 붙여 넣어요')}<div class="nd-qa-body">
    <div class="pu-imp-step"><div class="pu-imp-sh"><span class="pu-imp-n">1</span><b>프롬프트 복사</b></div><div><p>ChatGPT · Claude 같은 AI에 이 프롬프트와 필증 PDF(+ 청구서)를 함께 올리세요. 앱은 파일을 밖으로 보내지 않아요.</p><button type="button" class="nd-record-action" id="puImpCopy">프롬프트 복사</button></div></div>
    <div class="pu-imp-step"><div class="pu-imp-sh"><span class="pu-imp-n">2</span><b>AI 결과 붙여넣기</b></div><div><textarea id="puImpText" rows="6" placeholder="[수입신고필증]&#10;신고번호: …" aria-label="AI 결과"></textarea></div></div>
    <div class="pu-imp-step"><div class="pu-imp-sh"><span class="pu-imp-n">3</span><b>확인</b></div><div><div id="puImpPreview"><p class="nd-qa-note">붙여 넣으면 품목 짝 · 합계 · B/L 검사가 여기에 나와요.</p></div></div></div>
   </div>${acts('매입 만들기',false)}`,'pu-imp');
  // 고르기 창 바깥을 누르면 닫는다(창 안에서만)
  d.addEventListener('mousedown',ev=>{if(pop&&!pop.contains(ev.target)&&!ev.target.closest('[data-pick-item],#puImpVendor,#puImpPayee,[data-ty]'))closePop();});
  d.addEventListener('close',()=>{closePop();if(!created&&text.trim()){impDraft=snapshot();}},{once:true});
  // 작성 중 바깥 누름·Esc: 바로 닫지 않고 [계속 작성] / [임시 저장하고 닫기]
  guard=()=>{if(!text.trim())return false;showLeave();return true;};
  d.querySelector('[data-x]')?.addEventListener('click',()=>{if(text.trim()&&!created)toast('작성 중인 내용을 임시 저장했어요 · 다시 열면 이어서 할 수 있어요');});
  // 창(폰은 창 전체)이 스크롤되면 고르기 창이 버튼에서 떨어지므로 닫는다
  d.addEventListener('scroll',closePop,{passive:true});d.querySelector('.nd-qa-body')?.addEventListener('scroll',closePop,{passive:true});
  d.querySelector('#puImpCopy').onclick=async ev=>{const b=ev.currentTarget;try{await navigator.clipboard.writeText(IMPORT_PROMPT);copied=true;b.textContent='복사했어요';}catch{const ta=d.querySelector('#puImpText');ta.value=IMPORT_PROMPT;ta.select();b.textContent='아래 글을 복사해 주세요';}};
  let tm=0;const ta=d.querySelector('#puImpText');
  ta.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(()=>{if(ta.value===IMPORT_PROMPT&&!copied)return;text=ta.value;reparse();paintPreview();},250);});
  d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
   if(!ready())throw Error('확인 항목을 먼저 처리해 주세요.');
   const {decl,inv}=parsed;
   const vendor_id=vendor==='new'?await ensureCompany(decl.vendor):vendor;
   const payee_id=inv?(payee==='new'?await ensureCompany(inv.payee):payee):'';
   const draft=importDraft(parsed,{uid,vendor_id,payee_id,map:lines().map((l,i)=>({item_id:map[i].item_id,color:map[i].color||'',parts:partsOf(i)})),types});
   const dd=draft.date||today(),n=rows().filter(x=>x.date===dd).length+1;
   const np={id:'pu_'+uid(),no:`IM-${dd.slice(0,4)}${dd.slice(5,7)}${dd.slice(8)}-${n}`,status:'작성중',...draft,date:dd,tax_invoice:{received:false},receipts:[],returns:[],cost_runs:[],created_at:nowIso(),updated_at:nowIso()};
   while(rows().some(x=>x.no===np.no))np.no=np.no.replace(/-(\d+)$/,(m,x)=>'-'+(Number(x)+1));
   for(const l of np.lines){for(const k of ['color','spec'])if(!l[k])delete l[k];}
   await savePurchase({...st.doc,rows:[...st.doc.rows,np]});
   created=true;impDraft=null;st.sel=np.id;st.draft=null;st.dirty=false;st.editing=false;st.tab='items';toast('수입 매입을 만들었어요 · 물건이 오면 [입고 처리]');});
  // 임시 저장한 붙여넣기가 있으면 맨 위에서 묻는다
  if(impDraft){const o=impDraft,no=parseImportPaste(o.text)?.decl?.no;const bar=document.createElement('div');bar.className='pu-imp-resume';
   bar.innerHTML=`<span>임시 저장한 붙여넣기가 있어요${no?` · 신고번호 ${esc(no)}`:''}</span><button type="button" class="pu-imp-ghost" data-resume="new">새로 시작</button><button type="button" class="pu-imp-pri" data-resume="go">이어서 하기</button>`;
   d.querySelector('.nd-qa-body').prepend(bar);
   bar.querySelector('[data-resume="go"]').onclick=()=>{bar.remove();restore(o);};
   bar.querySelector('[data-resume="new"]').onclick=()=>{impDraft=null;bar.remove();ta.focus();};}
  setTimeout(()=>ta.focus(),0);
 }
 function newMenu(btn){
  if(!window.NaroPop){newPurchase();return;}
  window.NaroPop.open(btn,el=>{el.classList.add('pu-new-pop');const w=document.createElement('div');w.className='pu-new-menu';
   w.innerHTML='<button type="button" data-k="d"><b>국내 매입</b><small>매입처 · 품목 · 수량 · 단가 직접 입력</small></button><button type="button" data-k="i"><b>수입 매입 붙여넣기</b><small>수입신고필증 · 청구서를 AI로 정리해 붙여넣기</small></button>';
   w.querySelector('[data-k="d"]').onclick=()=>{window.NaroPop.close();newPurchase();};
   w.querySelector('[data-k="i"]').onclick=()=>{window.NaroPop.close();importSheet();};el.append(w);},null,'새 매입');
 }
 // 입고 취소로 재고가 음수가 되는 옵션(이미 나간 수량) — 창에서 미리 알린다.
 function negWarn(p,receipts){
  const ids=new Set((D().stock_moves||[]).map(m=>m.id)),sum={};
  for(const r of receipts)for(const rl of r.lines){if(!ids.has(stockMoveId(r.id,rl.line_id))||ids.has(voidMoveId(r.id,rl.line_id)))continue;const l=p.lines.find(x=>x.id===rl.line_id);if(!l)continue;const k=[l.item_id,l.color||'',l.spec||''].join('|');sum[k]=(sum[k]||0)+rl.qty;}
  const st=typeof window.currentStocks==='function'?window.currentStocks():{};
  const out=Object.entries(sum).map(([k,q])=>{const [id,c,sp]=k.split('|'),after=(Number(st[k])||0)-q;return after<0?`${esc(itemOf(id)?.name||'품목')} ${esc([c,sp].filter(Boolean).join('·'))} 재고가 <b>${n0(after)}개</b>가 돼요`:'';}).filter(Boolean);
  return out.length?`<p class="nd-qa-warn">${out.join('<br>')} — 이미 나간 수량이 있어서예요. 그래도 취소는 기록돼요.</p>`:'';
 }
 function voidSheet(rid){
  const p=cur(),r=p?.receipts.find(x=>x.id===rid);if(!r)return;const n=r.lines.reduce((a,x)=>a+x.qty,0);
  const d=qa(`${head('입고 취소',`${mdShort(r.date)} 입고 ${n0(n)}개`)}<div class="nd-qa-body">
    <div class="nd-qa-fields"><label>사유<input id="puQaMemo" placeholder="예: 수량을 잘못 넣음"></label></div>
    <p class="nd-qa-after">확인하면 <b>재고에서 ${n0(n)}개가 되돌아가요</b>. 기록은 지우지 않고 '취소됨'으로 남아요.</p>${negWarn(p,[r])}</div>${acts('입고 취소 확인',true,' danger')}`);
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
  const p=cur();if(!p)return;const live=(p.receipts||[]).filter(r=>!r.void_at);
  if(live.length){const d=qa(`${head('먼저 입고를 취소해야 해요',esc(p.no))}<div class="nd-qa-body"><p class="nd-qa-after">재고에 들어간 매입은 <b>진행 탭에서 입고 취소</b>를 한 뒤에 매입을 취소할 수 있어요.</p></div><div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go">진행 탭 열기</button></div>`);d.querySelector('.nd-qa-go').onclick=()=>{d.close();st.tab='flow';render();};return;}
  const vPaid=Math.max(0,Math.round(netByCo(p)[p.vendor_id]||0)),oPaid=netPaid(p)-vPaid;let refund=vPaid>0;
  const paint=()=>{const d=qa(`${head('매입 취소',`${esc(coName(p.vendor_id))} · ${esc(p.no)}`)}<div class="nd-qa-body">
    ${vPaid>0?`<div class="nd-qa-chips" role="group" aria-label="환불"><button type="button" data-rf="1" aria-pressed="${refund}">${n0(vPaid)}원 돌려받음</button><button type="button" data-rf="0" aria-pressed="${!refund}">아직 안 받음</button></div>`:''}
    <p class="nd-qa-after">확인하면 매입이 <b>취소됨</b>으로 남아요(지우지 않아요).${vPaid>0&&refund?` 돌려받은 ${n0(vPaid)}원은 <b>환불 입금</b>으로 기록돼요.`:''}${oPaid>0?` 운송사·관세사에 낸 ${n0(oPaid)}원은 그대로 남아요.`:''}</p></div>${acts('매입 취소 확인',true,' danger')}`);
   d.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>{refund=b.dataset.rf==='1';paint();});
   d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
    if(vPaid>0&&refund)await app.Table.save('payments',[...(D().payments||[]),{id:'pay'+uid(),date:today(),company_id:p.vendor_id,kind:'수금',refund:true,method:'계좌이체',amount:vPaid,memo:`매입 취소 환불 ${p.no}`,purchase_id:p.id,client_ref:'refund_'+uid(),created_at:nowIso()}]);
    await savePurchase({...st.doc,rows:st.doc.rows.map(x=>x.id===p.id?{...x,status:'취소',updated_at:nowIso()}:x)});st.draft=null;st.dirty=false;st.editing=false;toast('매입을 취소했어요');});};
  paint();
 }
 function removeSheet(){const p=cur();if(p&&!p.removed_at)wipeSheet(p);}
 // 한번에 삭제: 입고 취소(재고 되돌림) · 마무리 안 된 입고 정리 · 보낸 돈은 돌려받음 기록 · 목록에서 빼기를 버튼 한 번에.
 // 기록 규칙상 재고·입출금 기록은 지우지 않고 되돌리는 기록을 더한다. 중간에 끊기면 다시 눌러 이어서 한다(같은 번호라 두 번 되지 않음).
 const netByCo=p=>pays(p).reduce((m,x)=>(m[x.company_id]=(m[x.company_id]||0)+(x.kind==='지급'?1:-1)*(Number(x.amount)||0),m),{});
 const netPaid=p=>Math.round(Object.values(netByCo(p)).filter(v=>v>0).reduce((a,v)=>a+v,0));
 function wipeSheet(p){
  if((p.returns||[]).length){const d=qa(`${head('반품이 있는 매입',esc(p.no))}<div class="nd-qa-body"><p class="nd-qa-after">반품 기록이 있는 매입은 한번에 지울 수 없어요. <b>매입 취소</b>를 써 주세요.</p></div><div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`);return d;}
  const ids=new Set((D().stock_moves||[]).map(m=>m.id)),live=(p.receipts||[]).filter(r=>!r.void_at||receiptState(r,ids)==='voiding');
  const inStock=live.filter(r=>receiptState(r,ids)!=='planned').reduce((a,r)=>a+r.lines.reduce((b,x)=>b+x.qty,0),0),stuck=live.filter(r=>receiptState(r,ids)==='planned').length,paid=netPaid(p);
  const items=[inStock?`입고된 <b>${n0(inStock)}개는 재고에서 되돌려요</b>`:'',stuck?`마무리 안 된 입고 ${stuck}건은 취소로 정리해요`:'',paid>0?`보낸 <b>${n0(paid)}원은 돌려받은 것으로</b> 기록해요`:'','매입은 목록에서 빠져요 — 필터(≡)의 삭제된 매입 보기에서 복원할 수 있어요'].filter(Boolean);
  const d=qa(`${head('매입 삭제',`${esc(coName(p.vendor_id))} · ${esc(p.no)}`)}<div class="nd-qa-body">
    <p class="nd-qa-after">삭제를 누르면 한 번에 처리돼요.</p><ul class="pu-wipe">${items.map(t=>`<li>${t}</li>`).join('')}</ul>
    <p class="nd-qa-after" style="color:var(--nd-ink3,#7A808C)">재고·입출금 기록은 지우지 않고 '취소됨'·'돌려받음'으로 남아요.</p>${negWarn(p,live)}</div>${acts('삭제',true,' danger')}`);
  d.querySelector('.nd-qa-go').onclick=()=>go(d,async()=>{
   const at=nowIso();
   for(const r of live)await voidReceipt(io,p.id,r.id,{reason:r.void_reason||'매입 삭제',at:r.void_at||at});
   const back=Object.entries(netByCo(p)).map(([cid,v])=>[cid,Math.round(v)]).filter(([,v])=>v>0);
   // 저장 규칙상 입출금은 한 번에 1건 — 받은 곳마다 따로 저장(끊기면 다시 눌러 남은 곳만)
   for(const [cid,v] of back)await app.Table.save('payments',[...(D().payments||[]),{id:'pay'+uid(),date:today(),company_id:cid,kind:'수금',refund:true,method:'계좌이체',amount:v,memo:`매입 삭제 환불 ${p.no}`,purchase_id:p.id,client_ref:'refund_'+uid(),created_at:at}]);
   // 지우지 않고 '삭제됨'으로 보관 → 필터(≡)의 '삭제된 매입 보기'에서 다시 보고 복원할 수 있다.
   await savePurchase({...st.doc,rows:st.doc.rows.map(x=>x.id===p.id?{...x,status:'취소',removed_at:at,removed_from:x.removed_from||x.status,updated_at:at}:x)});
   st.sel=null;st.draft=null;st.dirty=false;st.editing=false;toast('매입을 삭제했어요');});
 }
 // 복원: 품목·수량·단가가 다시 살아난다. 되돌린 입고·출금은 기록으로 남고, 필요하면 새로 입고·출금한다.
 async function restorePurchase(){
  const p=cur();if(!p?.removed_at||st.working)return;st.working=true;
  const back=p.removed_from==='취소'?'취소':'작성중';
  try{await savePurchase({...st.doc,rows:st.doc.rows.map(x=>{if(x.id!==p.id)return x;const n={...x,status:back,updated_at:nowIso()};delete n.removed_at;delete n.removed_from;return n;})});
   st.filter='';toast(back==='취소'?'복원했어요 · 취소된 매입으로 돌아왔어요':'복원했어요 · 입고·출금은 새로 기록해 주세요');}
  catch(e){st.working=false;await fail(e);return;}st.working=false;render();
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
     res.innerHTML=m.length?m.map(x=>`<button type="button" class="qp-result" data-pick="${esc(x.id)}"><span><strong>${esc(x.name||'')}</strong><small>${esc(x.code||'')}</small></span><span>${isFx(p)?'':money(buyOf(x,specsOf(x)[0]))}</span></button>`).join(''):'<p>검색 결과가 없습니다.</p>';
     res.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const x=itemOf(b.dataset.pick);w.item_id=x.id;w.color=(x.colors||[])[0];w.spec=specsOf(x)[0];w.unit_price=isFx(p)?(w.unit_price||0):buyOf(x,w.spec);search=false;draw();});};
    inp.oninput=list;list();setTimeout(()=>inp.focus(),0);
   }else{
    const chips=(f,opts,v)=>opts.length?`<div class="qp-chips option-chip-grid" role="group" aria-label="${f==='color'?'색상':'규격/옵션'}">${opts.map(o=>`<button type="button" data-${f}="${esc(o)}" aria-pressed="${o===v}">${esc(o)}</button>`).join('')}</div>`:'<p class="qp-muted">—</p>';
    lineSheet.innerHTML=`<div class="qp-sheet-head"><h3>품목 편집</h3><button class="naro-sheet-close" type="button" data-close aria-label="편집 취소하고 닫기">닫기</button></div>
     <div class="qp-sheet-body"><div class="qp-field"><label>품목</label><button type="button" class="ip-btn" data-search>${it?`${esc(it.name||'')}<span class="cd">${esc(it.code||'')}</span>`:'<span class="ph">품목 선택</span>'}</button></div>
      <div class="qp-field"><label>색상</label>${chips('color',colors,w.color)}</div><div class="qp-field"><label>규격/옵션</label>${chips('spec',specs,w.spec)}</div>
      <div class="qp-field"><label for="pu-edit-qty">수량</label><div class="qp-edit-stepper"><button type="button" data-q="-1" aria-label="수량 줄이기">−</button><input type="text" inputmode="numeric" class="num" id="pu-edit-qty" value="${n0(w.qty)}"><button type="button" data-q="1" aria-label="수량 늘리기">+</button></div></div>
      <div class="qp-field"><label for="pu-edit-price">단가</label><input type="text" inputmode="${isFx(p)?'decimal':'numeric'}" class="num" id="pu-edit-price" value="${w.unit_price?(isFx(p)?fx(w.unit_price):n0(w.unit_price)):''}" placeholder="0"></div>
      <div class="qp-edit-amount">금액<span class="amt">${isFx(p)?fx((w.qty||0)*(w.unit_price||0)):n0((w.qty||0)*(w.unit_price||0))}</span></div></div>
     <div class="qp-sheet-footer"><button class="qp-delete" type="button" data-del>${confirmDel?'삭제 확인':'행 삭제'}</button><button class="qp-primary" type="button" data-apply>적용</button></div>`;
    const sync=()=>{w.qty=num(lineSheet.querySelector('#pu-edit-qty').value);w.unit_price=(isFx(p)?dec:num)(lineSheet.querySelector('#pu-edit-price').value);};
    lineSheet.querySelector('[data-search]').onclick=()=>{sync();search=true;draw();};
    lineSheet.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{sync();w.color=b.dataset.color;draw();});
    lineSheet.querySelectorAll('[data-spec]').forEach(b=>b.onclick=()=>{sync();w.spec=b.dataset.spec;if(!isFx(p))w.unit_price=buyOf(itemOf(w.item_id),w.spec)||w.unit_price;draw();});
    lineSheet.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{sync();w.qty=Math.max(0,w.qty+Number(b.dataset.q));draw();});
    // 손을 뗄 때 창을 다시 그리면 같이 누른 [적용]이 사라진다 — 금액 숫자만 고친다
    lineSheet.querySelectorAll('#pu-edit-qty,#pu-edit-price').forEach(inp=>inp.oninput=()=>{sync();lineSheet.querySelector('.qp-edit-amount .amt').textContent=isFx(p)?fx((w.qty||0)*(w.unit_price||0)):n0((w.qty||0)*(w.unit_price||0));});
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
  edit(p=>{it.variants.forEach(v=>{const q=num(box.querySelector(`[data-sz="${CSS.escape(v.spec)}"]`)?.value),pr=(isFx(p)?dec:num)(box.querySelector(`[data-szp="${CSS.escape(v.spec)}"]`)?.value);
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
  el.innerHTML=items.map((it,i)=>`<button type="button" role="menuitem" data-i="${i}" class="${it.danger?'danger':''}"><span><b>${esc(it.t)}</b>${it.sub?`<small>${esc(it.sub)}</small>`:''}</span></button>`).join('');
  el.addEventListener('click',ev=>{const b=ev.target.closest('[data-i]');if(!b)return;const it=items[Number(b.dataset.i)];closeMenu();it.fn();});
  btn.closest('.nd-rec-row').append(el);const row=btn.closest('.nd-rec-row'),rr=row.getBoundingClientRect(),br=btn.getBoundingClientRect();el.style.right='0px';el.style.top=Math.round(br.bottom-rr.top+4)+'px';btn.setAttribute('aria-expanded','true');menu={btn,el};
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
  // 입고·반품 줄 펼치기(견적서 납품 줄과 같은 동작): 줄을 누르거나 Enter/Space
  view.querySelectorAll('#puForm [data-pl-open]').forEach(el=>{const t=()=>{const k=el.dataset.plOpen;st.rowOpen.has(k)?st.rowOpen.delete(k):st.rowOpen.add(k);render();view.querySelector(`#puForm [data-pl-open="${CSS.escape(k)}"]`)?.focus({preventScroll:true});};
   el.addEventListener('click',ev=>{if(ev.target.closest('button,a'))return;t();});el.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target===el){ev.preventDefault();t();}});});
  view.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',async()=>{
   const a=b.dataset.act;
   if(a==='reload')return load(true);
   if(a==='start'){b.disabled=true;try{const r=await ask('PURCHASE_START');st.status=r.state.status;st.doc=r.doc;render();}catch(err){b.disabled=false;await fail(err);}return;}
   if(a==='resume')return resumeAll();
   if(a==='restore')return restorePurchase();
   if(a==='trash-off'){st.filter='';render();return;}
   if(a==='back'){if(st.dirty&&!saved(shown()||{})){st.draft=null;st.dirty=false;}st.sel=st.dirty?st.sel:null;if(st.dirty){toast('저장하지 않은 변경이 있어요. [저장] 또는 [되돌리기]를 먼저 눌러 주세요.');return;}st.editing=false;render();return;}
   if(a==='log'){const p=cur();if(p)g.NaroChangeLog?.open({ref:p.id,title:p.no||'매입',noun:'매입'});return;}
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
   if(a==='cost')return costSheet();
   if(a==='return')return returnSheet();
   if(a==='tax')return taxSheet();
   if(a==='cancel'){b.closest('details')?.removeAttribute('open');return cancelSheet();}
   if(a==='delete'){b.closest('details')?.removeAttribute('open');return removeSheet();}
  }));
  view.querySelector('#puNewBtn')?.addEventListener('click',ev=>{if(st.dirty){toast('저장하지 않은 변경이 있어요. [저장] 또는 [되돌리기]를 먼저 눌러 주세요.');return;}newMenu(ev.currentTarget);});
  view.querySelectorAll('#puList .list-item').forEach(el=>{el.onclick=()=>select(el.dataset.id);el.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(el.dataset.id);}};});
  // 필터(≡): 다른 화면과 같은 팝업 — 맨 아래 '삭제된 항목'
  const fb=view.querySelector('#puFilterBtn');if(fb&&window.NaroPop)fb.onclick=()=>window.NaroPop.open(fb,el=>{el.classList.add('nd-pop-filter');const n=rows().filter(x=>x.removed_at).length,w=document.createElement('div');w.className='nd-pop-field nd-trash-field nd-trash-solo';
   w.innerHTML=`<span>삭제된 항목</span><button type="button" class="nd-trash-go" ${n?'':'disabled'}>${n?`삭제된 매입 보기 · ${n}건`:'삭제된 매입 없음'}</button>`;
   w.querySelector('button').onclick=()=>{window.NaroPop.close();st.filter='삭제됨';st.sel=null;render();};el.append(w);},null,'필터');
  view.querySelectorAll('.nd-chips [data-v]').forEach(b=>b.onclick=()=>{if(st.filter==='삭제됨'){st.filter=b.dataset.v;render();return;}st.filter=b.dataset.v;view.querySelectorAll('.nd-chips [data-v]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paintList();});
  view.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{st.tab=b.dataset.tab;render();}));
  view.querySelectorAll('[data-menu-r]').forEach(b=>b.onclick=()=>openMenu(b,[{t:'입고 취소',danger:true,fn:()=>voidSheet(b.dataset.menuR)}]));
  view.querySelectorAll('#puForm [data-record-toggle]').forEach(b=>b.onclick=()=>{const t=b.dataset.recordToggle,open=b.getAttribute('aria-expanded')!=='true';(st.recOpen||(st.recOpen={}))[t]=open;b.setAttribute('aria-expanded',String(open));const body=document.getElementById(b.getAttribute('aria-controls'));if(body)body.hidden=!open;});
  const q=view.querySelector('#puSearch');if(q){let comp=false;q.addEventListener('compositionstart',()=>comp=true);q.addEventListener('compositionend',()=>{comp=false;st.q=q.value.trim();paintList();});q.addEventListener('input',()=>{if(comp)return;st.q=q.value.trim();paintList();});}
  const f=view.querySelector('#puForm');if(!f)return;
  f.querySelectorAll('.qline .ip-btn[data-f="item"]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.idx);if(typeof g.openItemPicker==='function')g.openItemPicker(el,v=>pickItem(i,v));});
  f.querySelectorAll('.qline [data-f]:not(.ip-btn)').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.dataset.idx),k=el.dataset.f;
   edit(p=>{const l=p.lines[i];if(!l)return;if(k==='qty')l.qty=num(el.value);else if(k==='price')l.unit_price=(isFx(p)?dec:num)(el.value);else if(k==='lcolor'){if(el.value)l.color=el.value;else delete l.color;}else if(k==='vspec'){if(el.value)l.spec=el.value;else delete l.spec;if(!isFx(p))l.unit_price=buyOf(itemOf(l.item_id),l.spec)||l.unit_price;}});}));
  f.querySelectorAll('.qline [data-rm]').forEach(b=>b.onclick=()=>edit(p=>{p.lines.splice(Number(b.dataset.rm),1);if(!p.lines.length)p.lines.push(blank());}));
  f.querySelectorAll('[data-qp-edit],[data-qp-more]').forEach(b=>b.onclick=()=>{if(st.editing)lineEditor(Number(b.dataset.qpEdit??b.dataset.qpMore));});
  f.querySelectorAll('[data-qstep]').forEach(b=>b.onclick=()=>edit(p=>{const l=p.lines[Number(b.dataset.qstep)];if(l)l.qty=Math.max(0,(l.qty||0)+Number(b.dataset.v));}));
  const vendorHeader=f.querySelector('.quote-summary .co'),vendorSelect=f.querySelector('#pu_co');
  if(vendorHeader&&vendorSelect&&!vendorSelect.disabled){
   vendorHeader.classList.add('nd-co-editable');vendorHeader.setAttribute('role','button');vendorHeader.tabIndex=0;
   vendorHeader.onclick=chooseVendor;vendorHeader.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();chooseVendor();}};
  }
  f.querySelector('#pu_date')?.addEventListener('change',e=>edit(p=>{p.date=e.target.value||p.date;}));
  f.querySelector('#pu_co')?.addEventListener('change',e=>{if(e.target.value&&!saved(shown()))st.tab='items';edit(p=>{p.vendor_id=e.target.value;});});
  const cuMap={pu_declNo:'declaration_no',pu_bl:'bl_no',pu_inco:'incoterms',pu_payMethod:'pay_method',pu_declOn:'declared_on',pu_accOn:'accepted_on'};
  for(const [id,k] of Object.entries(cuMap))f.querySelector('#'+id)?.addEventListener('change',e=>edit(p=>{const c={...(p.customs||{})},v=e.target.value.trim();if(v)c[k]=k==='incoterms'?v.toUpperCase():v;else delete c[k];p.customs=c;}));
  for(const [id,k] of [['pu_rateBook','booking_rate'],['pu_rateCustoms','customs_rate']])f.querySelector('#'+id)?.addEventListener('change',e=>edit(p=>{const v=Number(String(e.target.value).replace(/[^\d.]/g,''));if(v>0)p.fx={...p.fx,[k]:v};}));
  f.querySelector('#pu_vatSel')?.addEventListener('change',e=>edit(p=>{p.vat_on=e.target.value!=='0';}));
  f.querySelector('#pu_memo')?.addEventListener('change',e=>{if(st.draft&&st.draft.id===st.sel&&(st.draft.memo||'')===e.target.value)return;edit(p=>{p.memo=e.target.value;});}); // 치는 동안 이미 반영했으면 다시 그리지 않는다(그 사이 누른 [저장]이 사라지지 않게)
  // 글자를 치는 동안에도 '저장'이 켜지게(다시 그리지 않음) — 비고를 쓰고 바로 [저장]을 눌러도 한 번에 저장된다.
  f.querySelector('#pu_memo')?.addEventListener('input',e=>{edit(p=>{p.memo=e.target.value;},false);const b=f.querySelector('#puSaveBtn');if(b){b.classList.toggle('nd-saved',!st.dirty);b.textContent=st.dirty?'저장':'저장됨';b.setAttribute('aria-label',st.dirty?'저장':'저장됨 — 바뀐 내용 없음');}});
  f.querySelector('#pu_szItem')?.addEventListener('change',e=>{st.sz={item:e.target.value,color:null};render();});
  f.querySelector('#pu_szColor')?.addEventListener('change',e=>{st.sz.color=e.target.value;render();});
  const szs=[...f.querySelectorAll('[data-sz]')];szs.forEach(inp=>inp.addEventListener('input',()=>{const s=view.querySelector('#pu_szSum');if(s)s.textContent=`총 ${n0(szs.reduce((a,i)=>a+num(i.value),0))}개`;}));
  // 견적서 옵션별 한번에와 같은 규칙: Tab은 단가를 건너뛰고 옆 옵션 수량으로(Shift+Tab은 앞으로), 마지막 수량 다음은 [품목에 넣기]
  szs.forEach((inp,n)=>{inp.addEventListener('keydown',ev=>{if(ev.key!=='Tab'||ev.isComposing)return;const to=ev.shiftKey?szs[n-1]:szs[n+1];
   if(to){ev.preventDefault();to.focus();}else if(!ev.shiftKey){ev.preventDefault();f.querySelector('[data-act="szapply"]')?.focus();}});
   inp.addEventListener('focus',()=>inp.select());});
 }
 function paintList(){const el=view.querySelector('#puList');if(!el)return;el.innerHTML=listHtml(rows().filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.no.localeCompare(a.no)));el.querySelectorAll('.list-item').forEach(x=>{x.onclick=()=>select(x.dataset.id);});}
 // 거래처 화면(company-panel.js)이 매입처의 매입·남은 돈을 보여 줄 때 쓴다. 읽기만 한다.
 const vendor=cid=>rows().filter(p=>p.vendor_id===cid&&!p.removed_at&&p.status!=='취소'&&p.kind!=='기초재고').map(p=>{
  const ps=payState(p),[label,cls]=disp(p),names=p.lines.map(l=>itemOf(l.item_id)?.name||l.name||'').filter(Boolean);
  return {id:p.id,no:p.no,date:p.date,label,cls,cur:p.currency||'KRW',total:p.currency&&p.currency!=='KRW'?ps.due:totals(p).total,due:ps.due,paid:ps.paid,qty:qtyOf(p),got:gotOf(p),
   title:names.length?names[0]+(names.length>1?` 외 ${names.length-1}건`:''):'매입',
   receipts:(p.receipts||[]).filter(r=>!r.void_at).map(r=>({date:r.date||'',qty:r.lines.reduce((s,x)=>s+(x.qty||0),0)})),
   pays:pays(p).filter(x=>x.company_id===cid).map(x=>({date:x.date||'',kind:x.kind,amount:Number(x.amount)||0,method:x.method||'',refund:!!x.refund}))};
 }).concat(rows().filter(p=>p.vendor_id!==cid&&!p.removed_at&&p.status!=='취소'&&p.kind!=='기초재고'&&((p.costs||[]).some(c=>!c.void_at&&c.payee_id===cid)||p.import_vat?.payee_id===cid)).map(p=>{
  // 운송사·관세사: 이 매입에서 그곳에 줄 돈(부대비용 + 대신 낸 부가세, 원화)
  const c=(payState(p).costs||[]).find(x=>x.payee_id===cid)||{due:0,paid:0},left=c.due-c.paid,names=p.lines.map(l=>itemOf(l.item_id)?.name||'').filter(Boolean);
  return {id:p.id,no:p.no,date:p.date,label:left>0.5?'미출금':'완료',cls:left>0.5?'st-won':'st-done',cur:'KRW',total:c.due,due:c.due,paid:c.paid,qty:0,got:0,payee:true,
   title:`부대비용 · ${coName(p.vendor_id)||'수입'}${names.length?' · '+names[0]+(names.length>1?` 외 ${names.length-1}건`:''):''}`,receipts:[],
   pays:pays(p).filter(x=>x.company_id===cid).map(x=>({date:x.date||'',kind:x.kind,amount:Number(x.amount)||0,method:x.method||'',refund:!!x.refund}))};
 }));
 const open=(id,tab)=>{if(typeof g.switchView==='function'&&g.switchView('purchases')===false)return;select(id);if(tab&&st.sel===id){st.tab=tab;render();}};
 // 대시보드 '계산서 미수취'(10/17): 입고가 시작됐는데 계산서(수입은 세관 수입세금계산서)를 아직 안 받은 매입. 불러오기 전이면 null.
 const untaxed=()=>!features()?undefined:st.status!=='ready'?null:rows().filter(p=>!p.removed_at&&p.status!=='취소'&&p.kind!=='기초재고'&&gotOf(p)>0&&!p.tax_invoice?.received)
  .map(p=>{const first=(p.receipts||[]).filter(r=>!r.void_at).map(r=>r.date).sort()[0]||'';return {id:p.id,no:p.no,vendor_id:p.vendor_id,kind:p.kind,received:first};})
  .sort((a,b)=>a.received.localeCompare(b.received));
 // 입금·출금 화면의 '아직 안 준 돈': 목록의 '미출금'과 같은 기준(입고된 원화 매입 중 줄 돈이 남은 것). 불러오기 전이면 null.
 // 운송사·관세사에 줄 부대비용(원화)은 입고 전에도 생기므로 입고 여부와 상관없이 더한다.
 const payables=()=>{if(st.status!=='ready')return null;const live=rows().filter(p=>!p.removed_at&&p.status!=='취소'&&p.kind!=='기초재고');
  return [...live.filter(p=>p.currency==='KRW'&&gotOf(p)>0).map(p=>{const ps=payState(p);return {id:p.id,no:p.no,vendor_id:p.vendor_id,open:Math.round(ps.due-ps.paid)};}),
   ...live.flatMap(p=>(payState(p).costs||[]).filter(c=>c.payee_id!==p.vendor_id).map(c=>({id:p.id,no:p.no,vendor_id:c.payee_id,open:Math.round(c.due-c.paid)})))].filter(x=>x.open>0);};
 // 거래처·품목 삭제 전 확인용: 진행 중(목록에서 빼지 않은) 매입 몇 건이 쓰는지. 매입 권한 없음/매입 안 씀 = 0, 아직 못 읽음 = null
 const uses=(key,id)=>{if(!features()||st.status==='absent'||st.status==='unsupported')return 0;if(st.status!=='ready')return null;
  return rows().filter(p=>!p.removed_at&&(key==='companies'?[p.vendor_id,p.import_vat?.payee_id,...(p.costs||[]).map(c=>c.payee_id)].includes(id):(p.lines||[]).some(l=>l.item_id===id))).length;};
 g.NaroPurchases={render,load,vendor,open,payables,untaxed,uses,state:()=>structuredClone({status:st.status,count:rows().length})};
 return {onMessage};
}
