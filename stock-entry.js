/* Manual stock entry only. Corrections append compensating moves; ledger math is unchanged. */
let stockReview=null,stockReviewBusy=false,stockQuickMode=false,stockQuickValues={},stockQuickKey='';
function stockManual(m){return !!m&&!m.quote_id&&!/^견적 .+ (수주|출고)/.test(m.memo||'')&&!m.reversal_of&&!m.cancelled_at;}
function stockRecordActions(m){
  const status=m.cancelled_at?'취소됨':m.reversal_of?'취소 반영':m.quote_id?'견적 연결':'';
  const audit=(m.audit||[]).map(a=>`${a.at} · ${{add:'등록',edit:'수정',void:'취소'}[a.action]||a.action} · ${a.reason}\n수량 ${a.before?.qty??'—'} → ${a.after?.map(x=>x.qty).join(', ')??'취소'}`).join('\n');
  return `<div class="stock-record-actions">${stockManual(m)?`<button type="button" class="btn" data-stock-edit="${escapeAttr(m.id)}">수정</button><button type="button" class="btn" data-stock-void="${escapeAttr(m.id)}">취소</button>`:escapeHtml(status||'연결 기록')}${audit?`<details><summary>이력</summary><p>${escapeHtml(audit)}</p></details>`:''}</div>`;
}
function stockStrictQty(value,zero=false){const s=String(value).trim();if(!/^\d+(\.\d+)?$/.test(s))throw Error('수량은 0 이상의 숫자로 입력하세요.');const n=Number(s);if(!Number.isFinite(n)||n>1e12||(!zero&&n<=0))throw Error('유효한 수량을 입력하세요.');return n;}
function setupStockQuickEntry(){
  const area=document.getElementById('stockQuickEntry');if(!area)return;
  const item=db.items.find(i=>i.id===document.getElementById('ivItem').value),color=document.getElementById('ivColor').value;
  const specs=[...new Set((item?.variants||[]).map(v=>v.spec).filter(Boolean))];
  const key=[item?.id,color].join('|');if(key!==stockQuickKey){stockQuickValues={};stockQuickKey=key;}
  if(!specs.length)stockQuickMode=false;
  document.getElementById('ivQty').hidden=stockQuickMode;document.getElementById('ivSpec').hidden=stockQuickMode;
  area.innerHTML=specs.length?`<button type="button" class="btn" id="stockQuickToggle">${stockQuickMode?'한 옵션씩 입력':'사이즈별 한 번에 입력'}</button>${stockQuickMode?`<div class="stock-size-grid">${specs.map((s,i)=>`<label>${escapeHtml(s)}<input data-stock-size="${i}" aria-label="${escapeAttr(s)} 수량" inputmode="decimal" value="${escapeAttr(stockQuickValues[s]??'')}" placeholder="0"><small>현재 ${fmt(currentStocks()[stockKeyOf({item_id:item.id,color,spec:s})]||0)}</small></label>`).join('')}</div>`:''}`:'';
  const toggle=document.getElementById('stockQuickToggle');if(toggle)toggle.onclick=()=>{stockQuickMode=!stockQuickMode;setupStockQuickEntry();};
  area.querySelectorAll('[data-stock-size]').forEach(input=>input.oninput=()=>stockQuickValues[specs[+input.dataset.stockSize]]=input.value);
  document.getElementById('ivColor').onchange=setupStockQuickEntry;
  ['ivColor','ivSpec','ivKind','ivQty','ivMemo'].forEach((id,i)=>document.getElementById(id).setAttribute('aria-label',['색상','규격/옵션','입출고 구분','수량','메모'][i]));
}
function stockFingerprint(rows){return JSON.stringify(rows.map(m=>{const n={...m};if(n.quote_id===undefined){const hit=/^견적 (.+?) (?:수주|출고)/.exec(n.memo||'');const q=hit&&typeof db!=='undefined'&&db.quotes?.find(q=>q.no===hit[1]);if(q)n.quote_id=q.id;}if(n.quote_id==null)delete n.quote_id;return n;}));}
function stockPlan(moves,change,items){
  const {kind,entries,id,reason}=change,original=id?moves.find(m=>m.id===id):null;
  if(!['add','edit','void'].includes(kind))throw Error('잘못된 변경 요청입니다.');
  if(kind!=='add'&&(!stockManual(original)||!reason?.trim()))throw Error('연결/취소 기록은 변경할 수 없으며 변경 사유가 필요합니다.');
  if(kind==='edit'&&(entries.length!==1||['item_id','color','spec','kind','date'].some(k=>entries[0][k]!==original[k])))throw Error('수정에서는 수량과 메모만 변경할 수 있습니다.');
  const at=new Date().toISOString(),actor=change.actor||'사용자 재확인',batch=crypto.randomUUID();
  const audit={at,actor,action:kind,reason:reason?.trim()||'입출고 등록',before:original?{qty:original.qty,memo:original.memo||''}:null,after:kind==='void'?null:entries.map(e=>({qty:e.qty,memo:e.memo||''}))};
  const added=entries.map(e=>{if(!tracksStock(items.find(i=>i.id===e.item_id)))throw Error('재고 관리 품목을 선택하세요.');stockStrictQty(e.qty);const date=new Date(e.date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==e.date||!['입고','출고'].includes(e.kind))throw Error('일자와 입출고 구분을 확인하세요.');return {...e,id:crypto.randomUUID(),quote_id:null,created_at:at,batch_id:batch,...(kind==='edit'?{replaces_id:id}:{}),audit:[audit]};});
  if(kind==='void'&&entries.length)throw Error('취소 요청이 올바르지 않습니다.');
  if(kind==='add'&&!added.length)throw Error('수량을 입력하세요.');
  if(kind==='edit'&&Number(original.qty)===Number(added[0].qty)&&(original.memo||'')===(added[0].memo||''))throw Error('변경된 내용이 없습니다.');
  if(original)added.unshift({...original,id:crypto.randomUUID(),kind:original.kind==='입고'?'출고':'입고',date:localDate(),quote_id:null,reversal_of:original.id,cancelled_at:undefined,created_at:at,batch_id:batch,memo:`원본 ${original.id} 취소: ${reason.trim()}`,audit:[audit]});
  const balance={};moves.forEach(m=>{const k=stockKeyOf(m);balance[k]=(balance[k]||0)+(m.kind==='출고'?-1:1)*Number(m.qty||0);});
  const deltas={};added.forEach(m=>{const k=stockKeyOf(m);deltas[k]=(deltas[k]||0)+(m.kind==='출고'?-1:1)*m.qty;});
  const impacts=Object.entries(deltas).map(([key,delta])=>({key,before:balance[key]||0,after:(balance[key]||0)+delta}));
  if(impacts.some(x=>x.after<0&&x.after<x.before))throw Error('변경 후 재고가 음수가 됩니다. 연결 출고와 현재 수량을 확인하세요.');
  return {next:[...moves.map(m=>m.id===id?{...m,cancelled_at:at,audit:[...(m.audit||[]),audit]}:m),...added],impacts};
}
function reviewStockEntry(){
  if(stockReviewBusy)return;
  try{
    const get=id=>document.getElementById(id).value,item_id=get('ivItem'),color=get('ivColor');
    const base={item_id,color,date:get('ivDate'),kind:get('ivKind'),memo:get('ivMemo').trim()};
    const entries=stockQuickMode?Object.entries(stockQuickValues).filter(([,v])=>v.trim()!==''&&stockStrictQty(v,true)>0).map(([spec,qty])=>({...base,spec,qty:stockStrictQty(qty)})):[{...base,spec:get('ivSpec'),qty:stockStrictQty(get('ivQty').replace(/,/g,''))}];
    openStockReview({kind:'add',entries});
  }catch(e){toast(e.message);}
}
function openStockChange(id,kind){if(stockReviewBusy)return;const m=db.stock_moves.find(x=>x.id===id);if(!stockManual(m)){toast('견적 연결 기록은 원본 견적에서 변경하세요. 취소된 기록은 변경할 수 없습니다.');return;}openStockReview({kind,id,entries:kind==='edit'?[{...m}]:[],reason:''});}
function openStockReview(change){
  document.getElementById('stockReviewDialog')?.remove();
  stockReview={...change,fingerprint:stockFingerprint(db.stock_moves),itemFingerprint:JSON.stringify(db.items)};
  const dialog=document.createElement('dialog');dialog.id='stockReviewDialog';dialog.setAttribute('aria-labelledby','stockReviewTitle');
  const original=change.id?db.stock_moves.find(m=>m.id===change.id):null,first=original||change.entries[0],item=db.items.find(i=>i.id===first?.item_id);
  if(!first){toast('수량을 입력하세요.');return;}
  dialog.innerHTML=`<h3 id="stockReviewTitle">${change.kind==='add'?'입출고 최종 확인':change.kind==='edit'?'수정 · 2차 확인':'취소 · 2차 확인'}</h3><p>${escapeHtml(itemLabel(item?.name||'',item?.code))} · ${escapeHtml(first.color||'색상 없음')} · ${escapeHtml(first.date||'')} · ${escapeHtml(first.kind)}</p>${change.kind==='edit'?`<label>변경 수량<input id="stockEditQty" inputmode="decimal" value="${escapeAttr(first.qty)}"></label><label>메모<input id="stockEditMemo" value="${escapeAttr(first.memo||'')}"></label>`:''}<div id="stockReviewImpact"></div>${change.kind!=='add'?'<p>원본은 보존하고 반대 입출고 기록으로 취소합니다.</p><label>변경 사유 (필수)<input id="stockReviewReason" placeholder="예: 입고 수량 오입력"></label>':''}<label class="stock-review-check"><input type="checkbox" id="stockReviewCheck">품목코드·옵션·변경 후 수량을 확인했습니다</label><p id="stockReviewError" role="alert"></p><div class="stock-review-actions"><button type="button" class="btn" id="stockReviewBack">돌아가기</button><button type="button" class="btn primary" id="stockReviewCommit" disabled>최종 확정</button></div>`;
  document.body.append(dialog);dialog.showModal();
  const close=()=>{if(stockReviewBusy)return;dialog.close();dialog.remove();stockReview=null;};
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});document.getElementById('stockReviewBack').onclick=close;
  dialog.querySelectorAll('input').forEach(e=>e.oninput=()=>{if(e.id!=='stockReviewCheck')document.getElementById('stockReviewCheck').checked=false;refreshStockReview();});
  document.getElementById('stockReviewCommit').onclick=commitStockReview;refreshStockReview();
}
function refreshStockReview(){
  const error=document.getElementById('stockReviewError'),button=document.getElementById('stockReviewCommit');button.disabled=true;
  try{
    if(stockReview.kind==='edit'){stockReview.entries[0].qty=stockStrictQty(document.getElementById('stockEditQty').value);stockReview.entries[0].memo=document.getElementById('stockEditMemo').value.trim();}
    stockReview.reason=document.getElementById('stockReviewReason')?.value.trim()||'';
    const plan=stockPlan(db.stock_moves,{...stockReview,reason:stockReview.reason||'미입력 (미리보기)'},db.items);
    document.getElementById('stockReviewImpact').innerHTML='<div class="stock-impact-row"><span>옵션</span><span>현재 → 변경 후</span></div>'+plan.impacts.map(i=>`<div class="stock-impact-row"><span>${escapeHtml(i.key.split('|').slice(1).join(' · ')||'기본')}</span><b>${fmt(i.before)} → ${fmt(i.after)}</b></div>`).join('');
    error.textContent='';button.disabled=stockReviewBusy||!document.getElementById('stockReviewCheck').checked||(stockReview.kind!=='add'&&!stockReview.reason);
  }catch(e){document.getElementById('stockReviewImpact').innerHTML='';error.textContent=e.message;}
}
/* Read latest ledger, then revision-conditional upload. Never overwrite a conflicting ledger. */
async function saveStockChecked(expected,next){
  const token=await needToken(),path=`${DATA_DIR}/stock_moves.json`;
  const response=await fetch('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:'Bearer '+token,'Dropbox-API-Arg':dbxArg({path})}});
  let rev=null,latest=[];
  if(response.ok){latest=JSON.parse(await response.text());rev=JSON.parse(response.headers.get('Dropbox-API-Result')||'{}').rev;if(!rev)throw Error('저장 버전을 확인할 수 없습니다. 다시 동기화하세요.');}
  else if(response.status===409){const body=await response.text();if(!body.includes('not_found'))throw Error('최신 재고를 확인하지 못했습니다.');latest=await Table.load('stock_moves');}
  else throw Error('최신 재고를 확인하지 못했습니다. 다시 로그인/동기화하세요.');
  if(stockFingerprint(latest)!==expected)throw Error('다른 변경이 발견되었습니다. 동기화 후 변경 내용을 다시 확인하세요.');
  const saved=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:'Bearer '+token,'Dropbox-API-Arg':dbxArg({path,mode:rev?{'.tag':'update',update:rev}:'add',autorename:false,strict_conflict:true,mute:true}),'Content-Type':'application/octet-stream'},body:JSON.stringify(next,null,2)});
  if(!saved.ok)throw Error(saved.status===409?'동시에 재고가 변경되었습니다. 동기화 후 다시 확인하세요.':'저장 실패: '+saved.status);
}
async function commitStockReview(){
  if(stockReviewBusy||!stockReview)return;
  refreshStockReview();if(document.getElementById('stockReviewCommit').disabled)return;
  stockReviewBusy=true;document.getElementById('stockReviewCommit').disabled=true;
  document.querySelectorAll('#stockReviewDialog input,#stockReviewBack').forEach(e=>e.disabled=true);
  try{
    if(stockFingerprint(db.stock_moves)!==stockReview.fingerprint||JSON.stringify(db.items)!==stockReview.itemFingerprint)throw Error('재고 또는 품목이 변경되었습니다. 창을 닫고 다시 확인하세요.');
    const plan=stockPlan(db.stock_moves,stockReview,db.items);
    await saveStockChecked(stockReview.fingerprint,plan.next);
    db.stock_moves=plan.next;stockQuickValues={};document.getElementById('ivQty').value='';document.getElementById('ivMemo').value='';document.querySelector('#view-stock .stock-add').hidden=true;
    const dialog=document.getElementById('stockReviewDialog');dialog.close();dialog.remove();stockReview=null;renderStock();toast('재고 변경과 이력을 저장했습니다.');
  }catch(e){document.getElementById('stockReviewError').textContent=e.message;document.getElementById('stockReviewCheck').checked=false;}
  finally{stockReviewBusy=false;document.querySelectorAll('#stockReviewDialog input,#stockReviewBack').forEach(e=>e.disabled=false);}
}
