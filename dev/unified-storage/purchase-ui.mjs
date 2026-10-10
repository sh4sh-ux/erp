// 매입 화면(2단계 — feature/naro-purchase). 업무 화면(iframe) 안에서 동작한다.
// 데이터: 매입 파일은 PURCHASE_* 메시지로(저장소 쪽 business-workspace), 재고·입출금은 기존 Table.save(SAVE_TABLE) 그대로.
// 매입 저장(작성)과 재고 입고 확정은 서로 다른 버튼·창. 입고·반품·입고 취소는 purchase-saga 절차(끊겨도 이어서, 두 번 안 됨).
import {costLedger,paymentStatus,lineBase} from './purchase-ledger.mjs';
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

export function installPurchaseUI({port,features=()=>true}){
 const g=globalThis;
 // 업무 화면의 전역 상수(db·renderers·Table·currentView)는 window 속성이 아니라 이름으로만 닿는다.
 /* global db, renderers, Table, currentView */
 const app={get db(){try{return db;}catch{return null;}},get renderers(){try{return renderers;}catch{return null;}},get Table(){try{return Table;}catch{return null;}},get view(){try{return currentView;}catch{return '';}}};
 const wait=new Map();
 const ask=(type,body={})=>new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();wait.set(requestId,{resolve,reject});port().postMessage({type,requestId,...body});setTimeout(()=>{if(wait.has(requestId)){wait.delete(requestId);reject(Object.assign(Error('NETWORK_ERROR'),{code:'NETWORK_ERROR'}));}},45000);});
 const onMessage=m=>{if(typeof m?.type!=='string'||!m.type.startsWith('PURCHASE_'))return false;const w=wait.get(m.requestId);if(!w)return true;wait.delete(m.requestId);if(m.type==='PURCHASE_ERROR')w.reject(Object.assign(Error(m.code||'INTERNAL_ERROR'),{code:m.code||'INTERNAL_ERROR'}));else w.resolve(m);return true;};
 const st={status:'unknown',doc:null,sel:null,tab:'items',filter:'',q:'',draft:null,dirty:false,mobileDetail:false,working:false,note:''};
 const D=()=>app.db,companies=()=>D()?.companies||[],items=()=>(D()?.items||[]).filter(i=>i.type!=='작업');
 const coName=id=>companies().find(c=>c.id===id)?.name||'거래처 없음';
 const itemOf=id=>(D()?.items||[]).find(i=>i.id===id);
 const specsOf=i=>[...new Set([...(i?.variants||[]).map(v=>v.spec).filter(Boolean),...(i?.spec?[i.spec]:[])])];
 const buyOf=(i,spec)=>typeof g.itemBuy==='function'?g.itemBuy(i,spec):Number(i?.buy_price)||0;
 const rows=()=>st.doc?.rows||[];
 const cur=()=>rows().find(p=>p.id===st.sel)||null;
 const shown=()=>st.draft&&st.draft.id===st.sel?st.draft:cur();
 const received=(p,l)=>(p.receipts||[]).filter(r=>!r.void_at).reduce((s,r)=>s+(r.lines.find(x=>x.line_id===l.id)?.qty||0),0);
 const returned=(p,l)=>(p.returns||[]).reduce((s,r)=>s+(r.lines.find(x=>x.line_id===l.id)?.qty||0),0);
 const totals=p=>{const supply=Object.values(lineBase(p)).reduce((s,v)=>s+v,0);const tax=p.vat?.tax??0;return {supply,tax,total:supply+tax};};
 const payState=p=>paymentStatus(p,D()?.payments||[]);
 const toast=t=>typeof g.toast==='function'?g.toast(t):null;

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

 async function load(reload=false){
  try{const r=await ask('PURCHASE_STATE',{reload});st.status=r.state.status;st.doc=r.doc;st.note=r.state.capacity?.warn?'매입 파일이 70% 찼어요. 연도별로 나누는 작업이 필요해요.':'';}
  catch(e){st.status='error';st.note=MSG[e.code]||'매입을 불러오지 못했어요.';}
  render();
 }
 const fail=async e=>{st.note=MSG[e?.code]||e?.message||'저장하지 못했어요.';if(e?.code==='STORAGE_CONFLICT'){st.draft=null;st.dirty=false;await load(true);return;}render();};
 async function savePurchase(next){const r=await ask('PURCHASE_SAVE',{doc:next});st.doc=r.doc;return r.doc;}
 const io={getDoc:()=>structuredClone(st.doc),getStock:()=>structuredClone(D().stock_moves||[]),savePurchases:savePurchase,saveStock:rows=>app.Table.save('stock_moves',rows)};

 // ── 그리기 ──
 function render(){
  if(!view.isConnected)return;
  if(st.status==='unknown'){st.status='loading';view.classList.add('pu-state');view.innerHTML=shell('<p class="pu-empty">불러오는 중…</p>');load();return;}
  view.classList.toggle('pu-mdetail',st.mobileDetail&&st.status==='ready');view.classList.toggle('pu-state',st.status!=='ready');
  const more=document.getElementById('moreNavBtn');if(more&&app.view==='purchases')more.classList.add('on');
  if(st.status==='loading'){view.innerHTML=shell('<p class="pu-empty">불러오는 중…</p>');return;}
  if(st.status==='unsupported'){view.innerHTML=shell(emptyState('Google Drive에서는 아직 매입을 쓸 수 없어요','매입 기록은 지금 Dropbox에서만 저장돼요. 다른 기능은 그대로 쓸 수 있어요.'));return;}
  if(st.status==='error'){view.innerHTML=shell(emptyState('매입을 불러오지 못했어요',esc(st.note||'잠시 뒤 다시 시도해 주세요.'),'<button type="button" class="pu-btn" data-act="reload">다시 불러오기</button>'));bind();return;}
  if(st.status==='absent'){view.innerHTML=shell(emptyState('매입을 시작할까요?','매입처·품목·수량·단가를 한 번 적으면, [입고 확정] 때 재고에 더해지고 줄 돈(미출금)이 잡혀요. 기존 재고·입출금 기록은 바뀌지 않아요.','<button type="button" class="pu-btn pri" data-act="start">매입 시작하기</button>'));bind();return;}
  view.innerHTML=shell(detail(),true);bind();
 }
 function shell(right,ready=false){
  const list=ready?rows().filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.no.localeCompare(a.no)):[];
  const tabs=[['','전체'],['작성중','작성중'],['입고 완료','입고 완료'],['미지급','미출금'],['취소','취소']];
  const pending=ready?unfinished(st.doc,D().stock_moves||[]):[];
  return `<div class="pu-left"><header class="pu-lhead"><div class="pu-eye">NARO BIZ</div><h2>매입 <span class="pu-count">${ready?rows().filter(p=>p.kind!=='기초재고').length+'건':''}</span></h2>
   <div class="pu-tools"><label class="pu-search">${ICON.search}<input type="search" id="puSearch" placeholder="매입처·번호·품목 검색" aria-label="매입 검색" value="${esc(st.q)}" ${ready?'':'disabled'}></label><button type="button" class="pu-add" data-act="new" aria-label="새 매입" ${ready?'':'disabled'}>${ICON.plus}</button></div></header>
   <div class="pu-tabs" role="group" aria-label="매입 상태">${tabs.map(([k,t])=>`<button type="button" data-filter="${k}" aria-pressed="${st.filter===k}">${t}</button>`).join('')}</div>
   ${pending.length?`<div class="pu-banner" role="status">마무리 안 된 입고·반품 ${pending.length}건 <button type="button" data-act="resume">이어서 하기</button></div>`:''}
   ${st.note?`<div class="pu-banner warn" role="status">${esc(st.note)}</div>`:''}
   <div class="pu-list" id="puList">${ready?(list.length?list.map(rowHtml).join(''):`<p class="pu-empty">${rows().length?'조건에 맞는 매입이 없어요.':'아직 매입이 없어요. [+]로 첫 매입을 적어 보세요.'}</p>`):''}</div></div>
   <div class="pu-right">${right}</div>`;
 }
 function match(p){
  if(p.kind==='기초재고')return false;
  if(st.filter==='미지급'){if(p.status==='취소'||payState(p).status==='지급 완료')return false;}
  else if(st.filter&&p.status!==st.filter)return false;
  if(!st.q)return true;
  const hay=[p.no,coName(p.vendor_id),p.memo,...p.lines.map(l=>itemOf(l.item_id)?.name||'')].join(' ').toLowerCase();
  return hay.includes(st.q.toLowerCase());
 }
 function pill(p){
  const cls={작성중:'draft','입고 완료':'ok','원가 확정':'ok',취소:'bad'}[p.status]||'draft';
  const saved=rows().some(x=>x.id===p.id),ps=p.status==='취소'||!saved?null:payState(p);
  return `<span class="pu-pill ${cls}">${esc(p.status)}</span>${ps&&ps.status!=='지급 완료'?`<span class="pu-pill ${ps.status==='초과 지급'?'bad':'warn'}">${esc(ps.status==='미지급'?'미출금':ps.status.replace('지급','출금'))}</span>`:''}${saved&&p.status!=='취소'&&p.tax_invoice&&!p.tax_invoice.received?'<span class="pu-pill warn">계산서 미수취</span>':''}`;
 }
 function rowHtml(p){
  const qty=p.lines.reduce((s,l)=>s+l.qty,0),got=p.lines.reduce((s,l)=>s+received(p,l),0);
  // 목록에는 표시 2개까지: 상태 + 가장 급한 것 하나(미출금·부분 출금 → 계산서 미수취)
  const ps=p.status==='취소'?null:payState(p),alert=ps&&ps.status!=='지급 완료'?`<span class="pu-pill ${ps.status==='초과 지급'?'bad':'warn'}">${esc(ps.status==='미지급'?'미출금':ps.status.replace('지급','출금'))}</span>`:p.status!=='취소'&&p.tax_invoice&&!p.tax_invoice.received?'<span class="pu-pill warn">계산서 미수취</span>':'';
  const cls={작성중:'draft','입고 완료':'ok','원가 확정':'ok',취소:'bad'}[p.status]||'draft';
  return `<button type="button" class="pu-row${p.id===st.sel?' on':''}" data-sel="${esc(p.id)}"><span class="pu-rl"><b>${esc(coName(p.vendor_id))}</b><small>${esc(p.no)}</small><small>${esc(p.date)} · 입고 ${n0(got)}/${n0(qty)}개</small></span><span class="pu-rr"><strong>${money(totals(p).total)}</strong><span class="pu-pills"><span class="pu-pill ${cls}">${esc(p.status)}</span>${alert}</span></span></button>`;
 }
 function emptyState(title,body,action=''){return `<div class="pu-start"><div class="pu-start-ic">${ICON.cart}</div><h3>${title}</h3><p>${body}</p>${action}</div>`;}

 function detail(){
  const p=shown();
  if(!p)return `<div class="pu-rhead pu-rhead-empty"><div class="pu-eye">NARO BIZ</div><h2>매입 상세</h2></div><div class="pu-tabsr"></div><div class="pu-body">${emptyState('매입을 고르거나 새로 적어 주세요','왼쪽 목록에서 매입을 고르거나 [+] 버튼으로 새 매입을 적어요.')}</div>`;
  const saved=!!cur(),locked=(p.receipts||[]).length>0||p.status==='취소',t=totals(p),ps=saved?payState(p):null;
  const qty=p.lines.reduce((s,l)=>s+l.qty,0),got=p.lines.reduce((s,l)=>s+received(p,l),0);
  const steps=[['작성',saved],[`입고 ${n0(got)}/${n0(qty)}개`,got>0&&got>=qty],[ps?(ps.status==='미지급'?'출금 전':ps.status.replace('지급','출금')):'지급 전',ps?.status==='지급 완료'],[p.tax_invoice?.received?'계산서 받음':'계산서 미수취',!!p.tax_invoice?.received]];
  const next=[];if(saved&&p.status!=='취소'&&got<qty&&!st.dirty)next.push('<button type="button" class="pu-btn pri" data-act="receive">입고 확정</button>');
  if(saved&&p.status!=='취소'&&ps&&ps.due-ps.paid>0&&!st.dirty)next.push(`<button type="button" class="pu-btn${next.length?'':' pri'}" data-act="pay">출금 기록</button>`);
  return `<div class="pu-rhead">
    ${st.mobileDetail?`<button type="button" class="pu-back" data-act="back">${ICON.back}매입</button>`:''}
    <div class="pu-rtitle"><div class="pu-eye">매입처</div><h2>${p.vendor_id?esc(coName(p.vendor_id)):'매입처를 골라 주세요'}</h2><div class="pu-sub">${esc(p.no)} · ${md(p.date)} ${pill(p)}</div></div>
    <div class="pu-ramt"><span>매입 금액 (부가세 포함)</span><strong>${money(t.total)}</strong></div></div>
   <div class="pu-tabsr" role="tablist">${[['items','품목'],['flow','진행'],['info','정보']].map(([k,l])=>`<button type="button" role="tab" data-tab="${k}" aria-selected="${st.tab===k}">${l}</button>`).join('')}</div>
   <div class="pu-body">
    <div class="pu-next"><ol class="pu-steps" aria-label="진행 단계">${steps.map(([l,on],i)=>`${i?'<li class="pu-sep" aria-hidden="true"></li>':''}<li class="${on?'on':''}"><span class="pu-dot">${on?ICON.check:''}</span>${esc(l)}</li>`).join('')}</ol><div class="pu-nextb">${next.join('')}</div></div>
    ${st.tab==='items'?itemsTab(p,locked):st.tab==='flow'?flowTab(p,saved):infoTab(p,locked,saved)}
   </div>
   <div class="pu-actions">${st.tab==='info'&&saved?'<details class="pu-more"><summary aria-label="더보기">···</summary><div class="pu-menu"><button type="button" data-act="cancel">매입 취소</button>'+(deletable(p)?'<button type="button" class="bad" data-act="delete">매입 삭제</button>':'')+'</div></details>':''}<span class="pu-sp"></span>${st.dirty?'<button type="button" class="pu-btn" data-act="revert">되돌리기</button>':''}<button type="button" class="pu-btn pri" data-act="save" ${st.dirty?'':'disabled'}>${st.dirty?'매입 저장':'저장됨'}</button></div>`;
 }
 const deletable=p=>!(p.receipts||[]).length&&!(p.returns||[]).length&&!(D().payments||[]).some(x=>x.purchase_id===p.id)&&!(D().stock_moves||[]).some(m=>m.purchase_id===p.id);
 function itemsTab(p,locked){
  const head='<div class="pu-ln h"><span>품목</span><span>색상</span><span>규격</span><span class="r">수량</span><span class="r">단가</span><span class="r">금액</span><span></span></div>';
  const lines=p.lines.map((l,i)=>{const it=itemOf(l.item_id),colors=it?.colors||[],specs=specsOf(it);
   if(locked)return `<div class="pu-ln"><span>${esc(it?.name||'품목 없음')} <em>${esc(it?.code||'')}</em></span><span>${esc(l.color||'—')}</span><span>${esc(l.spec||'—')}</span><span class="r">${n0(l.qty)}</span><span class="r">${n0(l.unit_price)}</span><span class="r b">${n0(l.qty*l.unit_price)}</span><span class="r s">${received(p,l)<l.qty?`입고 ${n0(received(p,l))}`:'입고 완료'}${returned(p,l)?` · 반품 ${n0(returned(p,l))}`:''}</span></div>`;
   return `<div class="pu-ln" data-line="${i}">
    <select data-f="item_id" aria-label="${i+1}번 품목"><option value="">품목 선택</option>${items().map(x=>`<option value="${esc(x.id)}" ${x.id===l.item_id?'selected':''}>${esc(x.name)}${x.code?' · '+esc(x.code):''}</option>`).join('')}</select>
    <select data-f="color" aria-label="${i+1}번 색상" ${colors.length?'':'disabled'}>${colors.length?colors.map(c=>`<option ${c===l.color?'selected':''}>${esc(c)}</option>`).join(''):'<option value="">—</option>'}</select>
    <select data-f="spec" aria-label="${i+1}번 규격" ${specs.length?'':'disabled'}>${specs.length?specs.map(s=>`<option ${s===l.spec?'selected':''}>${esc(s)}</option>`).join(''):'<option value="">—</option>'}</select>
    <input data-f="qty" inputmode="numeric" class="r" aria-label="${i+1}번 수량" value="${l.qty||''}">
    <input data-f="unit_price" inputmode="numeric" class="r" aria-label="${i+1}번 단가" value="${l.unit_price||''}">
    <span class="r b">${n0((l.qty||0)*(l.unit_price||0))}</span>
    <button type="button" class="pu-x" data-act="rmline" data-i="${i}" aria-label="${i+1}번 줄 지우기">${ICON.x}</button></div>`;}).join('');
  const t=totals(p);
  return `<div class="pu-sec-t"><b>품목</b><span>${p.lines.length}건 · 총 ${n0(p.lines.reduce((s,l)=>s+(l.qty||0),0))}개</span>${locked?'<em class="pu-lock">입고가 시작되어 품목은 고칠 수 없어요(반품·입고 취소로 바로잡아요)</em>':''}</div>
   <div class="pu-lines">${head}${lines}</div>
   ${locked?'':'<button type="button" class="pu-addline" data-act="addline">'+ICON.plus+'품목 추가</button>'}
   <div class="pu-tot"><div><span>공급가액</span><b>${money(t.supply)}</b></div><div><span>부가세 ${locked?'':`<label class="pu-vat"><input type="checkbox" data-act="vat" ${p.vat_on===false?'':'checked'}> 10%</label>`}</span><b>${money(t.tax)}</b></div><div class="g"><span>합계</span><b>${money(t.total)}</b></div></div>`;
 }
 function flowTab(p,saved){
  if(!saved)return '<p class="pu-hint">먼저 [매입 저장]을 눌러 주세요. 저장한 뒤 입고 확정·출금을 기록할 수 있어요.</p>';
  const ids=new Set((D().stock_moves||[]).map(m=>m.id)),ps=payState(p),pays=(D().payments||[]).filter(x=>x.purchase_id===p.id);
  const rec=(p.receipts||[]).map(r=>{const s=receiptState(r,ids),q=r.lines.reduce((n,x)=>n+x.qty,0);return `<div class="pu-rec"><span><b>${md(r.date)}</b> 입고 ${n0(q)}개 <small>${s==='posted'?'재고 반영됨':s==='void'?'취소됨 · '+esc(r.void_reason||''):s==='voiding'?'취소 마무리 필요':'마무리 필요'}</small></span>${s==='posted'?`<button type="button" class="pu-link" data-act="void" data-r="${esc(r.id)}">입고 취소</button>`:''}</div>`;}).join('')||'<p class="pu-hint">아직 입고하지 않았어요.</p>';
  const ret=(p.returns||[]).map(t=>`<div class="pu-rec"><span><b>${md(t.date)}</b> 반품 ${n0(t.lines.reduce((n,x)=>n+x.qty,0))}개 <small>${esc(t.reason||'')}${t.posted_at?'':' · 마무리 필요'}</small></span></div>`).join('');
  const pay=pays.map(x=>`<div class="pu-rec"><span><b>${md(x.date)}</b> ${x.kind==='지급'?'출금':'환불 받음'} ${money(x.amount)} <small>${esc(x.method||'')}</small></span></div>`).join('')||'<p class="pu-hint">아직 출금 기록이 없어요.</p>';
  const canReturn=p.status!=='취소'&&p.lines.some(l=>received(p,l)-returned(p,l)>0);
  return `<section class="pu-card"><div class="pu-card-h"><b>입고</b><span>재고에 더해진 기록</span></div>${rec}</section>
   <section class="pu-card"><div class="pu-card-h"><b>출금</b><span>${money(ps.paid)} / ${money(ps.due)} · ${esc(ps.status)}</span>${p.status!=='취소'&&ps.due-ps.paid>0?'<button type="button" class="pu-btn" data-act="pay">출금 기록</button>':''}</div>${pay}</section>
   <section class="pu-card"><div class="pu-card-h"><b>반품</b><span>매입처로 돌려보낸 수량</span>${canReturn?'<button type="button" class="pu-btn" data-act="return">반품</button>':''}</div>${ret||'<p class="pu-hint">반품 기록이 없어요.</p>'}</section>`;
 }
 function infoTab(p,locked,saved){
  const vendors=companies().filter(c=>c.type==='매입'||c.id===p.vendor_id);
  return `<div class="pu-form">
   <div class="pu-f"><label for="puVendor">매입처</label><select id="puVendor" data-f="vendor_id" ${locked?'disabled':''}><option value="">매입처 선택</option>${vendors.map(c=>`<option value="${esc(c.id)}" ${c.id===p.vendor_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>${vendors.length?'':'<small>거래처에서 구분을 \'매입\'으로 등록하면 여기에 나와요.</small>'}</div>
   <div class="pu-f"><label for="puDate">매입일</label><input type="date" id="puDate" data-f="date" value="${esc(p.date)}" ${p.status==='취소'?'disabled':''}></div>
   <div class="pu-f"><label for="puTax">세금계산서</label><select id="puTax" data-f="tax"><option value="0" ${p.tax_invoice?.received?'':'selected'}>아직 안 받음</option><option value="1" ${p.tax_invoice?.received?'selected':''}>받음</option></select></div>
   <div class="pu-f"><label for="puTaxDate">계산서 받은 날</label><input type="date" id="puTaxDate" data-f="taxdate" value="${esc(p.tax_invoice?.date||'')}" ${p.tax_invoice?.received?'':'disabled'}></div>
   <div class="pu-f full"><label for="puMemo">메모</label><input id="puMemo" data-f="memo" value="${esc(p.memo||'')}" placeholder="선택 입력"></div></div>
   ${saved?'':'<p class="pu-hint">저장한 뒤에 입고 확정과 출금 기록을 할 수 있어요.</p>'}`;
 }

 // ── 동작 ──
 function edit(fn){const base=st.draft&&st.draft.id===st.sel?st.draft:structuredClone(cur());fn(base);st.draft=base;st.dirty=true;render();}
 function newPurchase(){
  const d=today(),n=rows().filter(p=>p.date===d).length+1,vendor=companies().find(c=>c.type==='매입');
  st.draft={id:'pu_'+uid(),no:`PO-${d.slice(0,4)}-${d.slice(5,7)}${d.slice(8)}-${n}`,kind:'국내',vendor_id:vendor?.id||'',date:d,status:'작성중',currency:'KRW',lines:[{id:'l'+uid(),item_id:'',qty:1,unit_price:0}],vat:{supply:0,tax:0},vat_on:true,tax_invoice:{received:false},costs:[],receipts:[],returns:[],cost_runs:[],created_at:nowIso(),updated_at:nowIso()};
  while(rows().some(p=>p.no===st.draft.no))st.draft.no=st.draft.no.replace(/-(\d+)$/,(m,x)=>'-'+(Number(x)+1));
  st.sel=st.draft.id;st.dirty=true;st.tab='items';st.mobileDetail=true;render();
 }
 // 부가세: vat_on(기본 켬)이면 공급가의 10%, 끄면 0 — 금액이 0일 때도 켬/끔이 유지된다.
 const recalcVat=p=>{const supply=Object.values(lineBase(p)).reduce((s,v)=>s+v,0);p.vat={supply,tax:p.vat_on===false?0:Math.round(supply*.1)};};
 async function save(){
  const p=structuredClone(st.draft);if(!p)return;
  p.lines=p.lines.filter(l=>l.item_id);
  if(!p.vendor_id){st.note='매입처를 골라 주세요(정보 탭).';st.tab='info';render();return;}
  if(!p.lines.length||p.lines.some(l=>!(Number.isSafeInteger(l.qty)&&l.qty>0)||!(l.unit_price>=0))){st.note='품목·수량·단가를 확인해 주세요.';st.tab='items';render();return;}
  recalcVat(p);p.updated_at=nowIso();
  const next={...st.doc,rows:cur()?st.doc.rows.map(x=>x.id===p.id?p:x):[...st.doc.rows,p]};
  st.working=true;try{await savePurchase(next);st.draft=null;st.dirty=false;st.note='';toast?.('매입을 저장했어요');}catch(e){await fail(e);}finally{st.working=false;render();}
 }
 // 창(바깥을 누르면 닫힘)
 function sheet(html,onOk){
  const d=document.createElement('dialog');d.className='pu-sheet';d.innerHTML=html;(document.getElementById('appView')||document.body).append(d);
  d.addEventListener('click',e=>{if(e.target===d)d.close();});d.addEventListener('close',()=>d.remove());
  d.querySelector('[data-x]')?.addEventListener('click',()=>d.close());
  d.querySelector('[data-ok]')?.addEventListener('click',async()=>{const b=d.querySelector('[data-ok]');if(b.disabled)return;b.disabled=true;const err=d.querySelector('.pu-err');try{const ok=await onOk(d);if(ok!==false)d.close();}catch(e){if(err)err.textContent=MSG[e?.code]||e?.message||'저장하지 못했어요.';if(e?.code==='STORAGE_CONFLICT'){d.close();await load(true);}}finally{b.disabled=false;}});
  d.showModal();return d;
 }
 const sheetHead=(t,sub='')=>`<div class="pu-sh-h"><b>${t}</b>${sub?`<span>${sub}</span>`:''}</div>`;
 const sheetAct=ok=>`<p class="pu-err" role="alert"></p><div class="pu-sh-a"><button type="button" class="pu-btn" data-x>닫기</button><button type="button" class="pu-btn pri" data-ok>${ok}</button></div>`;
 function receiveSheet(){
  const p=cur(),left=p.lines.map(l=>({l,max:l.qty-received(p,l)})).filter(x=>x.max>0);
  sheet(`${sheetHead('입고 확정','확정하면 재고에 바로 더해져요. 잘못 넣었으면 [입고 취소]로 되돌려요.')}
   <div class="pu-sh-b"><div class="pu-f"><label for="puRecDate">입고일</label><input type="date" id="puRecDate" value="${today()}"></div>
   ${left.map(({l,max})=>{const it=itemOf(l.item_id);return `<div class="pu-qrow"><span>${esc(it?.name||'')} <em>${esc([l.color,l.spec].filter(Boolean).join(' · '))}</em><small>주문 ${n0(l.qty)} · 남음 ${n0(max)}</small></span><input inputmode="numeric" class="r" data-line="${esc(l.id)}" data-max="${max}" value="${max}" aria-label="${esc(it?.name||'')} 입고 수량"></div>`;}).join('')}</div>${sheetAct('입고 확정')}`,async d=>{
   const date=d.querySelector('#puRecDate').value||today();
   const lines=[...d.querySelectorAll('[data-line]')].map(i=>({line_id:i.dataset.line,qty:Number(i.value),max:Number(i.dataset.max)})).filter(x=>x.qty);
   if(!lines.length||lines.some(x=>!Number.isSafeInteger(x.qty)||x.qty<0||x.qty>x.max))throw Error('수량은 0 이상, 남은 수량 이하로 적어 주세요.');
   const at=nowIso();await postReceipt(io,p.id,{receiptId:'r'+uid(),date,lines:lines.map(({line_id,qty})=>({line_id,qty})),at});
   toast?.('입고를 확정했어요 · 재고에 반영');render();
  });
 }
 function paySheet(){
  const p=cur(),ps=payState(p),ref='pay_'+uid();
  sheet(`${sheetHead('출금 기록',`${esc(coName(p.vendor_id))} · 남은 금액 ${money(ps.due-ps.paid)}`)}
   <div class="pu-sh-b"><div class="pu-f"><label for="puPayAmt">금액</label><input id="puPayAmt" inputmode="numeric" class="r" value="${Math.max(0,ps.due-ps.paid)}"></div>
   <div class="pu-f"><label for="puPayDate">출금일</label><input type="date" id="puPayDate" value="${today()}"></div>
   <div class="pu-f"><label for="puPayMethod">결제 방법</label><select id="puPayMethod"><option>계좌이체</option><option>현금</option><option>카드</option><option>기타</option></select></div>
   <div class="pu-f"><label for="puPayMemo">메모</label><input id="puPayMemo" placeholder="선택 입력"></div></div>${sheetAct('출금 저장')}`,async d=>{
   const amount=Math.round(Number(String(d.querySelector('#puPayAmt').value).replace(/[^\d.]/g,'')));
   if(!(amount>0))throw Error('금액을 적어 주세요.');
   const list=D().payments||[];if(list.some(x=>x.client_ref===ref))return; // 같은 창에서 두 번 저장 방지
   await app.Table.save('payments',[...list,{id:'pay'+uid(),date:d.querySelector('#puPayDate').value||today(),company_id:p.vendor_id,kind:'지급',method:d.querySelector('#puPayMethod').value,amount,memo:d.querySelector('#puPayMemo').value||`매입 ${p.no}`,purchase_id:p.id,client_ref:ref}]);
   toast?.('출금을 기록했어요');render();
  });
 }
 function returnSheet(){
  const p=cur(),left=p.lines.map(l=>({l,max:received(p,l)-returned(p,l)})).filter(x=>x.max>0);
  sheet(`${sheetHead('반품','매입처로 돌려보낸 수량만큼 재고에서 빠지고, 줄 돈(미출금)도 줄어요.')}
   <div class="pu-sh-b"><div class="pu-f"><label for="puRetDate">반품일</label><input type="date" id="puRetDate" value="${today()}"></div>
   <div class="pu-f"><label for="puRetWhy">사유</label><select id="puRetWhy"><option>불량</option><option>오배송</option><option>수량 초과</option><option>기타</option></select></div>
   ${left.map(({l,max})=>{const it=itemOf(l.item_id);return `<div class="pu-qrow"><span>${esc(it?.name||'')} <em>${esc([l.color,l.spec].filter(Boolean).join(' · '))}</em><small>반품 가능 ${n0(max)}</small></span><input inputmode="numeric" class="r" data-line="${esc(l.id)}" data-max="${max}" value="0" aria-label="${esc(it?.name||'')} 반품 수량"></div>`;}).join('')}</div>${sheetAct('반품 저장')}`,async d=>{
   const lines=[...d.querySelectorAll('[data-line]')].map(i=>({line_id:i.dataset.line,qty:Number(i.value),max:Number(i.dataset.max)})).filter(x=>x.qty);
   if(!lines.length||lines.some(x=>!Number.isSafeInteger(x.qty)||x.qty<0||x.qty>x.max))throw Error('반품 수량을 확인해 주세요.');
   await postReturn(io,p.id,{returnId:'t'+uid(),date:d.querySelector('#puRetDate').value||today(),lines:lines.map(({line_id,qty})=>({line_id,qty})),reason:d.querySelector('#puRetWhy').value,at:nowIso()});
   toast?.('반품을 기록했어요 · 재고에서 뺐어요');render();
  });
 }
 function voidSheet(rid){
  const p=cur(),r=p.receipts.find(x=>x.id===rid);
  sheet(`${sheetHead('입고 취소',`${md(r.date)} 입고 ${n0(r.lines.reduce((n,x)=>n+x.qty,0))}개를 재고에서 되돌려요. 기록은 지우지 않고 '취소'로 남겨요.`)}
   <div class="pu-sh-b"><div class="pu-f"><label for="puVoidWhy">사유</label><select id="puVoidWhy"><option>수량을 잘못 넣음</option><option>다른 매입에 넣음</option><option>거래 취소</option><option>기타</option></select></div></div>${sheetAct('입고 취소')}`,async d=>{
   await voidReceipt(io,p.id,rid,{reason:d.querySelector('#puVoidWhy').value,at:nowIso()});toast?.('입고를 취소했어요 · 재고에서 되돌림');render();
  });
 }
 function cancelSheet(){
  const p=cur(),open=(p.receipts||[]).filter(r=>!r.void_at),ps=payState(p);
  if(open.length){sheet(`${sheetHead('먼저 입고를 취소해야 해요','재고에 들어간 매입은 [진행] 탭에서 입고 취소를 한 뒤에 매입을 취소할 수 있어요.')}<div class="pu-sh-a"><button type="button" class="pu-btn pri" data-x>확인</button></div>`);return;}
  sheet(`${sheetHead('매입 취소','기록은 지우지 않고 \'취소\'로 남겨요.')}<div class="pu-sh-b">${ps.paid>0?`<p class="pu-hint">이미 ${money(ps.paid)}을 출금했어요. 돌려받았다면 아래를 켜 주세요.</p><label class="pu-chk"><input type="checkbox" id="puRefund"> 돌려받음(환불) 기록</label>`:''}</div>${sheetAct('매입 취소')}`,async d=>{
   const at=nowIso();
   if(d.querySelector('#puRefund')?.checked)await app.Table.save('payments',[...(D().payments||[]),{id:'pay'+uid(),date:today(),company_id:p.vendor_id,kind:'수금',refund:true,method:'계좌이체',amount:Math.round(ps.paid),memo:`매입 취소 환불 ${p.no}`,purchase_id:p.id,client_ref:'refund_'+uid()}]);
   await savePurchase({...st.doc,rows:st.doc.rows.map(x=>x.id===p.id?{...x,status:'취소',updated_at:at}:x)});toast?.('매입을 취소했어요');render();
  });
 }
 async function remove(){const p=cur();if(!deletable(p))return;sheet(`${sheetHead('매입 삭제','입고·출금이 없는 작성 중 매입만 지울 수 있어요.')}${sheetAct('삭제')}`,async()=>{await savePurchase({...st.doc,rows:st.doc.rows.filter(x=>x.id!==p.id)});st.sel=null;st.mobileDetail=false;render();});}
 async function resumeAll(){
  st.working=true;try{for(const u of unfinished(st.doc,D().stock_moves||[])){
   const p=rows().find(x=>x.id===u.purchase_id);
   if(u.receipt_id){const r=p.receipts.find(x=>x.id===u.receipt_id);if(u.state==='voiding')await voidReceipt(io,p.id,r.id,{reason:r.void_reason,at:r.void_at});else if(u.state!=='mismatch')await resume(io,p.id,r.id,nowIso());}
   else if(u.return_id&&u.state!=='mismatch'){const t=p.returns.find(x=>x.id===u.return_id);await postReturn(io,p.id,{returnId:t.id,date:t.date,lines:t.lines,reason:t.reason,at:nowIso()});}
  }st.note='';toast?.('마무리했어요');}catch(e){await fail(e);}finally{st.working=false;render();}
 }
 function bind(){
  view.querySelectorAll('[data-act]').forEach(b=>b.addEventListener(b.matches('input[type=checkbox]')?'change':'click',async e=>{
   const a=b.dataset.act;
   if(a==='reload')return load(true);
   if(a==='start'){try{const r=await ask('PURCHASE_START');st.status=r.state.status;st.doc=r.doc;render();}catch(err){await fail(err);}return;}
   if(a==='new')return newPurchase();
   if(a==='resume')return resumeAll();
   if(a==='back'){st.mobileDetail=false;render();return;}
   if(a==='save')return save();
   if(a==='revert'){st.draft=null;st.dirty=false;if(!cur()){st.sel=null;st.mobileDetail=false;}render();return;}
   if(a==='addline')return edit(p=>p.lines.push({id:'l'+uid(),item_id:'',qty:1,unit_price:0}));
   if(a==='rmline')return edit(p=>{p.lines.splice(Number(b.dataset.i),1);if(!p.lines.length)p.lines.push({id:'l'+uid(),item_id:'',qty:1,unit_price:0});recalcVat(p);});
   if(a==='vat')return edit(p=>{p.vat_on=b.checked;recalcVat(p);});
   if(a==='receive')return receiveSheet();
   if(a==='pay')return paySheet();
   if(a==='return')return returnSheet();
   if(a==='void')return voidSheet(b.dataset.r);
   if(a==='cancel')return cancelSheet();
   if(a==='delete')return remove();
  }));
  view.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{if(st.dirty&&st.sel!==b.dataset.sel){st.note='저장하지 않은 변경이 있어요. [매입 저장] 또는 [되돌리기]를 먼저 눌러 주세요.';render();return;}st.sel=b.dataset.sel;st.draft=null;st.dirty=false;st.mobileDetail=true;st.note='';render();});
  view.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{st.filter=b.dataset.filter;render();});
  view.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.tab;render();});
  const q=view.querySelector('#puSearch');if(q){let comp=false;q.addEventListener('compositionstart',()=>comp=true);q.addEventListener('compositionend',()=>{comp=false;st.q=q.value.trim();paintList();});q.addEventListener('input',()=>{if(comp)return;st.q=q.value.trim();paintList();});}
  view.querySelectorAll('.pu-ln[data-line] [data-f]').forEach(el=>el.addEventListener('change',()=>{
   const i=Number(el.closest('[data-line]').dataset.line),f=el.dataset.f;
   edit(p=>{const l=p.lines[i];if(f==='item_id'){const it=itemOf(el.value);l.item_id=el.value;l.color=(it?.colors||[])[0]||undefined;l.spec=specsOf(it)[0]||undefined;l.unit_price=buyOf(it,l.spec)||0;}
    else if(f==='qty')l.qty=Math.round(Number(String(el.value).replace(/[^\d]/g,''))||0);
    else if(f==='unit_price')l.unit_price=Math.max(0,Number(String(el.value).replace(/[^\d.]/g,''))||0);
    else{l[f]=el.value||undefined;if(f==='spec'){const it=itemOf(l.item_id);l.unit_price=buyOf(it,l.spec)||l.unit_price;}}
    for(const k of ['color','spec'])if(l[k]===undefined)delete l[k];recalcVat(p);});
  }));
  view.querySelectorAll('.pu-form [data-f]').forEach(el=>el.addEventListener('change',()=>edit(p=>{const f=el.dataset.f;
   if(f==='tax'){p.tax_invoice={received:el.value==='1',...(el.value==='1'?{date:p.tax_invoice?.date||today()}:{})};}
   else if(f==='taxdate'){p.tax_invoice={...p.tax_invoice,date:el.value||undefined};if(!p.tax_invoice.date)delete p.tax_invoice.date;}
   else if(f==='memo'){p.memo=el.value;}else p[f]=el.value;})));
  // 저장된 매입의 세금계산서·메모·매입일은 입고 뒤에도 고칠 수 있다(품목·매입처만 잠김).
 }
 function paintList(){const el=view.querySelector('#puList');if(!el)return;const list=rows().filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.no.localeCompare(a.no));el.innerHTML=list.length?list.map(rowHtml).join(''):'<p class="pu-empty">조건에 맞는 매입이 없어요.</p>';el.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{st.sel=b.dataset.sel;st.draft=null;st.dirty=false;st.mobileDetail=true;render();});}
 g.NaroPurchases={render,load,state:()=>structuredClone({status:st.status,count:rows().length})};
 return {onMessage};
}
