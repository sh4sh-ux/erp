/* 휴지통(10/11): 지우기를 되돌릴 수 있게.
   - 입금·출금 / 연결 없는 거래처·품목: 원래 내용을 공급자 정보(settings.trash)에 먼저 담고 → 표에서 뺀다. [복원]은 같은 내용을 다시 넣는다.
   - 견적·재고가 연결된 거래처·품목: 지우면 지난 기록이 깨지므로 '숨김'(settings.hidden)만 — 목록·고르기에서 빠지고 기록은 그대로.
   저장 순서: 휴지통 먼저 → 표. 표 저장이 실패해도 휴지통에 남은 줄은 [복원] 때 '이미 있음'으로 정리된다(내용이 사라지는 일이 없다).
   주의: build.mjs가 String.replace로 끼워 넣으므로 달러+앰퍼샌드 같은 치환 특수 문자열을 쓰지 말 것. */
(()=>{
 'use strict';
 const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const won=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
 const say=t=>typeof toast==='function'?toast(t):alert(t);
 const MAX=300,NAME={payments:'입금·출금',companies:'거래처',items:'품목'};
 const coName=id=>(db.companies||[]).find(c=>c.id===id)?.name||'(삭제된 거래처)';
 const label=(key,r)=>key==='payments'?`${r.kind==='지급'?(r.refund?'환불':'출금'):'입금'} ${won(r.amount)}원 · ${coName(r.company_id)}${r.date?` · ${r.date}`:''}`
  :key==='companies'?(r.name||'(이름 없음)'):`${r.name||'(이름 없음)'}${r.code?` ${r.code}`:''}`;
 const trash=()=>Array.isArray(db.settings?.trash)?db.settings.trash:[];
 const hidden=key=>Array.isArray(db.settings?.hidden?.[key])?db.settings.hidden[key]:[];
 const showHidden={companies:false,items:false};
 async function putSettings(next){if(!await saveTable('settings',next))return false;db.settings=next;return true;}
 let sheet=null;
 function open(html){
  if(!sheet){sheet=document.createElement('dialog');sheet.className='nd-pay-sheet nd-qa-sheet nd-trash';sheet.addEventListener('click',ev=>{if(ev.target===sheet)sheet.close();});(document.getElementById('appView')||document.body).append(sheet);}
  sheet.innerHTML=html;if(!sheet.open){sheet.tabIndex=-1;sheet.showModal();sheet.focus({preventScroll:true});}
  sheet.querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',()=>sheet.close()));
  return sheet;
 }
 const head=(t,sub)=>`<div class="nd-ps-hd"><b>${t}</b>${sub?`<span class="nd-qa-sub">${e(sub)}</span>`:''}</div>`;
 const acts=(go,danger=true)=>`<div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go${danger?' nd-qa-del':''}">${go}</button></div>`;
 async function busy(btn,run,doing){const t=btn.textContent;btn.disabled=true;btn.textContent=doing;try{const ok=await run();if(ok===false){btn.disabled=false;btn.textContent='다시 시도';}return ok;}catch(err){btn.disabled=false;btn.textContent='다시 시도';say(err?.message||'저장하지 못했어요.');return false;}finally{void t;}}

 // 표에서 빼기(휴지통에 먼저 담는다)
 async function trashRow(key,id){
  const row=(db[key]||[]).find(r=>r.id===id);if(!row)return true;
  if(!trash().some(t=>t.key===key&&t.id===id)){
   const entry={key,id,at:new Date().toISOString(),label:label(key,row),row:JSON.parse(JSON.stringify(row))};
   if(!await putSettings({...db.settings,trash:[entry,...trash()].slice(0,MAX)}))return false;
  }
  const next=db[key].filter(r=>r.id!==id);
  if(!await saveTable(key,next))return false;
  db[key]=next;return true;
 }
 async function restoreEntry(t){
  if(!(db[t.key]||[]).some(r=>r.id===t.id)){
   const r=t.row;
   if(t.key==='payments'&&!(db.companies||[]).some(c=>c.id===r.company_id)){say('거래처가 없어서 복원할 수 없어요. 거래처를 먼저 복원해 주세요.');return false;}
   if(t.key==='payments'&&r.quote_id&&!(db.quotes||[]).some(q=>q.id===r.quote_id)){say('연결된 견적서가 없어서 복원할 수 없어요.');return false;}
   const next=[...db[t.key],JSON.parse(JSON.stringify(r))];
   if(!await saveTable(t.key,next))return false;db[t.key]=next;
  }
  return putSettings({...db.settings,trash:trash().filter(x=>!(x.key===t.key&&x.id===t.id))});
 }
 async function setHidden(key,id,on){
  const cur=hidden(key),list=on?[...new Set([...cur,id])]:cur.filter(x=>x!==id);
  return putSettings({...db.settings,hidden:{...(db.settings?.hidden||{}),[key]:list}});
 }
 const rerender=key=>{try{if(key==='payments')renderPay?.();if(key==='companies'){renderCoList?.();renderCoDetail?.();}if(key==='items'){renderItList?.();renderItDetail?.();}}catch{}};

 // ── 입금·출금 삭제 ──
 function deletePayment(id){
  const p=(db.payments||[]).find(x=>x.id===id);if(!p)return;
  const out=p.kind==='지급';
  const effect=p.purchase_id?'연결된 매입의 출금 기록에서 빠져요':out?(p.refund?'환불 기록이 빠져요':`${won(p.amount)}원 출금 기록이 빠져요`):`받을 금액이 ${won(p.amount)}원 늘어나요`;
  const d=open(`${head(`${out?(p.refund?'환불':'출금'):'입금'} 삭제`,label('payments',p))}<div class="nd-qa-body">
   <p class="nd-qa-note">삭제를 누르면 ${effect}.</p>
   <p class="nd-qa-note">지운 내역은 입금·출금 목록 아래 <b>휴지통</b>에 남아서 [복원]할 수 있어요.</p></div>${acts('삭제')}`);
  d.querySelector('.nd-qa-go').onclick=ev=>busy(ev.currentTarget,async()=>{
   if(!await trashRow('payments',id))return false;
   d.close();rerender('payments');try{renderQtDetail?.();}catch{}say('삭제했어요 · 휴지통에서 복원할 수 있어요');return true;},'삭제하는 중…');
 }
 // ── 거래처·품목 삭제(연결 있으면 숨김) ──
 const coLinks=id=>{const q=(db.quotes||[]).filter(x=>x.company_id===id).length,p=(db.payments||[]).filter(x=>x.company_id===id).length,m=(db.material_moves||[]).filter(x=>x.company_id===id).length;return [q&&`견적서 ${q}건`,p&&`입금·출금 ${p}건`,m&&`업체 제공 자재 ${m}건`].filter(Boolean);};
 const itLinks=id=>{const q=(db.quotes||[]).filter(x=>(x.lines||[]).some(l=>l.item_id===id)).length,s=(db.stock_moves||[]).filter(x=>x.item_id===id).length,c=(db.items||[]).filter(x=>(x.components||[]).some(k=>k.item_id===id)).length,m=(db.material_moves||[]).filter(x=>x.work_item_id===id).length;return [q&&`견적서 ${q}건`,s&&`재고 기록 ${s}건`,c&&`세트 구성 ${c}건`,m&&`업체 제공 자재 ${m}건`].filter(Boolean);};
 function deleteMaster(key,id){
  const r=(db[key]||[]).find(x=>x.id===id);if(!r)return;
  const links=key==='companies'?coLinks(id):itLinks(id),name=NAME[key];
  const keep=links.length>0;
  const d=open(`${head(`${name} 삭제`,label(key,r))}<div class="nd-qa-body">
   ${keep?`<p class="nd-qa-note">연결된 ${links.join(' · ')}이 있어서 지난 기록은 그대로 두고, <b>목록과 고르기에서만 빼요</b>(숨김).</p>`:`<p class="nd-qa-note">연결된 기록이 없는 ${name}이라 목록에서 지워요.</p>`}
   <p class="nd-qa-note">${name} 목록 아래 <b>휴지통</b>에서 [복원]할 수 있어요.</p></div>${acts('삭제')}`);
  d.querySelector('.nd-qa-go').onclick=ev=>busy(ev.currentTarget,async()=>{
   if(!(keep?await setHidden(key,id,true):await trashRow(key,id)))return false;
   if(key==='companies'&&typeof coSel!=='undefined')coSel=null;
   if(key==='items'&&typeof itSel!=='undefined'){itSel=null;if(typeof itEditing!=='undefined')itEditing=null;}
   d.close();rerender(key);say(keep?`${name}을 숨겼어요 · 복원할 수 있어요`:'삭제했어요 · 휴지통에서 복원할 수 있어요');return true;},'삭제하는 중…');
 }
 // ── 휴지통 창 ──
 function openBin(key){
  const t=trash().filter(x=>x.key===key),h=key==='payments'?[]:hidden(key).map(id=>(db[key]||[]).find(r=>r.id===id)).filter(Boolean);
  const when=at=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(at||'');return m?`${Number(m[2])}.${m[3]} 삭제`:'';};
  const rows=[...h.map(r=>`<div class="nd-qa-ln"><div><span>${e(label(key,r))}</span><small>숨김 · 지난 기록 있음</small></div><button type="button" class="nd-trash-b" data-unhide="${e(r.id)}">복원</button></div>`),
   ...t.map(x=>`<div class="nd-qa-ln"><div><span>${e(x.label)}</span><small>${e(when(x.at))}</small></div><button type="button" class="nd-trash-b" data-restore="${e(x.id)}">복원</button></div>`)];
  const d=open(`${head(`${NAME[key]} 휴지통`,rows.length?`${rows.length}건`:'')}<div class="nd-qa-body">
   ${rows.length?`<div class="nd-qa-lines">${rows.join('')}</div>`:'<p class="nd-qa-note">비어 있어요.</p>'}
   <p class="nd-qa-note">최근 ${MAX}건까지 보관해요.</p></div><div class="nd-ps-act nd-ps-one"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`);
  d.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>busy(b,async()=>{const x=trash().find(y=>y.key===key&&y.id===b.dataset.restore);if(!x||!await restoreEntry(x))return false;rerender(key);say('복원했어요');openBin(key);return true;},'복원 중…'));
  d.querySelectorAll('[data-unhide]').forEach(b=>b.onclick=()=>busy(b,async()=>{if(!await setHidden(key,b.dataset.unhide,false))return false;rerender(key);say('복원했어요');openBin(key);return true;},'복원 중…'));
 }
 function binButton(host,key){
  if(!host)return;const n=trash().filter(x=>x.key===key).length+(key==='payments'?0:hidden(key).filter(id=>(db[key]||[]).some(r=>r.id===id)).length);
  let b=host.querySelector(':scope>.nd-trash-open');
  if(!n){b?.remove();return;}
  if(!b){b=document.createElement('button');b.type='button';b.className='nd-cancel-toggle nd-trash-open';b.onclick=()=>openBin(key);}
  b.textContent=`휴지통 ${n}건`;if(b!==host.lastElementChild)host.append(b);
 }
 // 숨긴 거래처·품목은 목록 그릴 때만 빼고 그린다(데이터는 그대로).
 const visible=(key,rows)=>{const h=hidden(key);return h.length?rows.filter(r=>!h.includes(r.id)):rows;};
 function wrapList(fn,key,hostId){
  if(typeof window[fn]!=='function')return;const orig=window[fn];
  window[fn]=function(){const all=db[key];db[key]=visible(key,all);try{return orig.apply(this,arguments);}finally{db[key]=all;binButton(document.getElementById(hostId),key);}};
 }
 wrapList('renderCoList','companies','coList');
 wrapList('renderItList','items','itList');
 if(typeof window.renderPay==='function'){const o=window.renderPay;window.renderPay=function(){const r=o.apply(this,arguments);binButton(document.getElementById('payTbl')?.parentElement,'payments');return r;};}
 if(typeof window.deletePayment==='function')window.deletePayment=deletePayment;
 if(typeof window.deleteCompany==='function')window.deleteCompany=id=>deleteMaster('companies',id);
 if(typeof window.deleteItem==='function')window.deleteItem=id=>deleteMaster('items',id);
 // ── 재고 기록: [삭제] = 반대 기록으로 되돌림(확인 한 번) · '취소됨' 기록은 [복원] = 같은 기록을 새로 추가 ──
 const stockOrig=typeof window.openStockChange==='function'?window.openStockChange:null;
 const restorable=m=>!!m&&!!m.cancelled_at&&!m.quote_id&&!m.reversal_of&&!/^견적 .+ (수주|출고)/.test(m.memo||'')&&!m.purchase_id&&!(db.stock_moves||[]).some(x=>x.restored_from===m.id&&!x.cancelled_at);
 const mvLabel=m=>{const it=(db.items||[]).find(i=>i.id===m.item_id);return `${it?.name||'품목'} ${[m.color,m.spec].filter(Boolean).join('·')} · ${m.kind} ${won(m.qty)}개 · ${m.date||''}`;};
 async function saveStock(plan){await saveStockChecked(stockFingerprint(db.stock_moves),plan.next);db.stock_moves=plan.next;}
 function deleteStock(id){
  const m=(db.stock_moves||[]).find(x=>x.id===id);if(!m)return;
  if(typeof stockManual==='function'&&!stockManual(m)){say('견적·매입에서 만든 기록은 그 견적·매입에서 삭제해 주세요.');return;}
  const d=open(`${head('재고 기록 삭제',mvLabel(m))}<div class="nd-qa-body">
   <p class="nd-qa-note">삭제를 누르면 재고에서 ${m.kind==='입고'?`<b>${won(m.qty)}개가 빠져요</b>`:`<b>${won(m.qty)}개가 돌아와요</b>`}.</p>
   <p class="nd-qa-note">기록은 '취소됨'으로 남아서 [복원]할 수 있어요.</p></div>${acts('삭제')}`);
  d.querySelector('.nd-qa-go').onclick=ev=>busy(ev.currentTarget,async()=>{
   const plan=stockPlan(db.stock_moves,{kind:'void',id,entries:[],reason:'삭제'},db.items);await saveStock(plan);
   d.close();try{renderStock?.();}catch{}say('재고 기록을 삭제했어요 · 복원할 수 있어요');return true;},'삭제하는 중…');
 }
 async function restoreStock(id,btn){
  const m=(db.stock_moves||[]).find(x=>x.id===id);if(!restorable(m))return;
  await busy(btn,async()=>{
   const plan=stockPlan(db.stock_moves,{kind:'add',entries:[{item_id:m.item_id,color:m.color||'',spec:m.spec||'',date:m.date,kind:m.kind,memo:m.memo||'',qty:Number(m.qty)}],reason:'복원'},db.items);
   const added=plan.next.slice(db.stock_moves.length);added.forEach(x=>{x.restored_from=m.id;});
   await saveStock(plan);try{renderStock?.();}catch{}say('재고 기록을 복원했어요');return true;},'복원 중…');
 }
 if(stockOrig){
  window.openStockChange=(id,kind)=>kind==='void'?deleteStock(id):stockOrig(id,kind);
  if(typeof window.stockRecordActions==='function'){const o=window.stockRecordActions;window.stockRecordActions=m=>{
   let h=o(m);h=h.replace(/(data-stock-void="[^"]*">)취소(<\/button>)/,(all,a,b)=>a+'삭제'+b);
   if(restorable(m))h=h.replace('<div class="stock-record-actions">',`<div class="stock-record-actions"><button type="button" class="btn" data-stock-restore="${e(m.id)}">복원</button>`);
   return h;};}
  document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-stock-restore]');if(!b)return;ev.preventDefault();restoreStock(b.dataset.stockRestore,b);},true);
 }
 window.NaroTrash={deleteStock,deletePayment,deleteMaster,openBin,visible,hidden,trashRow,restoreEntry};
 void showHidden;
})();
