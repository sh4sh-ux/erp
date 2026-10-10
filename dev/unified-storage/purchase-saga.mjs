// 매입 입고 저장 절차(1단계 — 화면에서 아직 쓰지 않음). 파일을 한 번에 묶어 저장할 수 없으므로
//   ① 매입에 입고 계획(차수·재고 기록 번호·고정 원가)을 먼저 저장 → ② 정해진 번호로 재고 기록 추가 → ③ 매입에 완료 표시
// 순서로 진행한다. 어느 단계에서 끊겨도 다음에 resume()이 같은 번호로 이어서 끝낸다(두 번 입고되지 않음).
import {stockMoveId,voidMoveId,returnMoveId} from '../personal-cloud-onboarding/purchase-contract.mjs';
import {unitCosts,currentRun} from './purchase-ledger.mjs';

// 입고 차수 계획: 지금 유효한 원가 확정이 있으면 그 원가, 없으면 임시 원가(매입 처리 환율 + 지금까지 비용)를 고정한다.
export function planReceipt(p,{receiptId,date,lines,at}){
 const run=currentRun(p),uc=unitCosts(p);
 const unit=Object.fromEntries(lines.map(rl=>[rl.line_id,run?run.unit_costs[rl.line_id]:uc[rl.line_id].unit]));
 const receipt={id:receiptId,date,lines:lines.map(rl=>({line_id:rl.line_id,qty:rl.qty})),stock_move_ids:lines.map(rl=>stockMoveId(receiptId,rl.line_id)),unit_costs:unit,planned_at:at};
 return {...structuredClone(p),receipts:[...(p.receipts||[]),receipt],updated_at:at};
}
// 계획된 차수의 재고 기록(입고). 메모에 매입 번호를 남긴다.
export function receiptMoves(p,receiptId){
 const r=p.receipts.find(x=>x.id===receiptId);
 return r.lines.map(rl=>{const l=p.lines.find(x=>x.id===rl.line_id);return {id:stockMoveId(r.id,rl.line_id),date:r.date,item_id:l.item_id,...(l.color?{color:l.color}:{}),...(l.spec?{spec:l.spec}:{}),kind:'입고',qty:rl.qty,memo:`매입 ${p.no}`,purchase_id:p.id,receipt_id:r.id,purchase_line_id:rl.line_id};});
}
export function markPosted(p,receiptId,at){return {...structuredClone(p),receipts:p.receipts.map(r=>r.id===receiptId?{...r,posted_at:at}:r),status:p.status==='작성중'?'입고 완료':p.status,updated_at:at};}
// 차수 상태: planned(재고 없음) · written(재고 있음, 완료 표시 전) · posted · void · mismatch(일부만 있음 — 있을 수 없는 상태, 검토)
export function receiptState(r,stockIds){
 if(r.void_at){const done=r.lines.filter(rl=>stockIds.has(voidMoveId(r.id,rl.line_id))||!stockIds.has(stockMoveId(r.id,rl.line_id))).length;return done===r.lines.length?'void':'voiding';}
 const have=r.stock_move_ids.filter(id=>stockIds.has(id)).length;
 if(r.posted_at)return have===r.stock_move_ids.length?'posted':'mismatch';
 return have===0?'planned':have===r.stock_move_ids.length?'written':'mismatch';
}
// 끊긴 입고 찾기: 앱을 열 때 이것으로 '마무리가 필요한 매입'을 보여 준다.
export function unfinished(doc,stock_moves){
 const ids=new Set((stock_moves||[]).map(m=>m.id)),out=[];
 for(const p of doc?.rows||[])for(const r of p.receipts||[]){const s=receiptState(r,ids);if(s==='planned'||s==='written'||s==='mismatch'||s==='voiding')out.push({purchase_id:p.id,receipt_id:r.id,state:s});}
 for(const p of doc?.rows||[])for(const t of p.returns||[]){const have=t.stock_move_ids.filter(id=>ids.has(id)).length;if(!t.posted_at||have!==t.stock_move_ids.length)out.push({purchase_id:p.id,return_id:t.id,state:have===0?'planned':have===t.stock_move_ids.length?'written':'mismatch'});}
 return out;
}
// 실행기: io = {getDoc, getStock, savePurchases(doc), saveStock(rows)}. 각 저장이 실패하면 예외 그대로 — 다시 부르면 이어서 한다.
export async function postReceipt(io,purchaseId,plan){
 let doc=io.getDoc(),p=doc.rows.find(x=>x.id===purchaseId);
 if(!p.receipts?.some(r=>r.id===plan.receiptId)){
  const np=planReceipt(p,plan);doc={...doc,rows:doc.rows.map(x=>x.id===purchaseId?np:x)};await io.savePurchases(doc);
 }
 return resume(io,purchaseId,plan.receiptId,plan.at);
}
export async function resume(io,purchaseId,receiptId,at){
 let doc=io.getDoc(),p=doc.rows.find(x=>x.id===purchaseId),r=p.receipts.find(x=>x.id===receiptId);
 const state=receiptState(r,new Set(io.getStock().map(m=>m.id)));
 if(state==='mismatch')throw Object.assign(Error('RECEIPT_MISMATCH'),{code:'VALIDATION'});
 if(state==='void'||state==='posted')return state;
 if(state==='planned'){const stock=io.getStock();await io.saveStock([...stock,...receiptMoves(p,receiptId)]);}
 doc=io.getDoc();p=doc.rows.find(x=>x.id===purchaseId);
 await io.savePurchases({...doc,rows:doc.rows.map(x=>x.id===purchaseId?markPosted(p,receiptId,at):x)});
 return 'posted';
}

// ── 반품: 계획(매입) → 재고 출고 → 완료 표시. 번호 pr_<반품>_<줄> ──
export function planReturn(p,{returnId,date,lines,reason,at}){
 const t={id:returnId,date,lines:lines.map(rl=>({line_id:rl.line_id,qty:rl.qty})),stock_move_ids:lines.map(rl=>returnMoveId(returnId,rl.line_id)),reason:reason||'',planned_at:at};
 return {...structuredClone(p),returns:[...(p.returns||[]),t],updated_at:at};
}
export function returnMoves(p,returnId){
 const t=p.returns.find(x=>x.id===returnId);
 return t.lines.map(rl=>{const l=p.lines.find(x=>x.id===rl.line_id);return {id:returnMoveId(t.id,rl.line_id),date:t.date,item_id:l.item_id,...(l.color?{color:l.color}:{}),...(l.spec?{spec:l.spec}:{}),kind:'출고',qty:rl.qty,memo:`반품 ${p.no}${t.reason?' · '+t.reason:''}`,purchase_id:p.id,return_id:t.id,purchase_line_id:rl.line_id};});
}
export async function postReturn(io,purchaseId,plan){
 let doc=io.getDoc(),p=doc.rows.find(x=>x.id===purchaseId);
 if(!p.returns?.some(t=>t.id===plan.returnId)){await io.savePurchases({...doc,rows:doc.rows.map(x=>x.id===purchaseId?planReturn(p,plan):x)});}
 doc=io.getDoc();p=doc.rows.find(x=>x.id===purchaseId);const t=p.returns.find(x=>x.id===plan.returnId);
 const ids=new Set(io.getStock().map(m=>m.id)),have=t.stock_move_ids.filter(id=>ids.has(id)).length;
 if(have&&have!==t.stock_move_ids.length)throw Object.assign(Error('RETURN_MISMATCH'),{code:'VALIDATION'});
 if(!have)await io.saveStock([...io.getStock(),...returnMoves(p,plan.returnId)]);
 doc=io.getDoc();p=doc.rows.find(x=>x.id===purchaseId);
 if(!p.returns.find(x=>x.id===plan.returnId).posted_at)await io.savePurchases({...doc,rows:doc.rows.map(x=>x.id===purchaseId?{...p,returns:p.returns.map(r=>r.id===plan.returnId?{...r,posted_at:plan.at}:r),updated_at:plan.at}:x)});
 return 'posted';
}
// ── 입고 취소: ① 매입에 취소 표시(이유) → ② 줄마다 '원래 기록 취소 표시 + 반대 기록'(지금 재고 규칙, 1번에 1줄) ──
export async function voidReceipt(io,purchaseId,receiptId,{reason,at,by=''}){
 let doc=io.getDoc(),p=doc.rows.find(x=>x.id===purchaseId),r=p.receipts.find(x=>x.id===receiptId);
 if(!r.void_at){await io.savePurchases({...doc,rows:doc.rows.map(x=>x.id===purchaseId?{...p,receipts:p.receipts.map(z=>z.id===receiptId?{...z,void_at:at,void_reason:reason}:z),updated_at:at}:x)});
  doc=io.getDoc();p=doc.rows.find(x=>x.id===purchaseId);r=p.receipts.find(x=>x.id===receiptId);}
 for(const rl of r.lines){
  const stock=io.getStock(),orig=stock.find(m=>m.id===stockMoveId(r.id,rl.line_id));
  if(!orig||stock.some(m=>m.id===voidMoveId(r.id,rl.line_id)))continue; // 재고가 없었거나 이미 취소됨
  const audit={action:'void',reason:r.void_reason||reason,at:r.void_at,...(by?{by}:{})};
  const edited={...orig,cancelled_at:r.void_at,audit:[...(orig.audit||[]),audit]};
  const reverse={id:voidMoveId(r.id,rl.line_id),date:String(r.void_at).slice(0,10),item_id:orig.item_id,...(orig.color?{color:orig.color}:{}),...(orig.spec?{spec:orig.spec}:{}),kind:'출고',qty:orig.qty,memo:`입고 취소 ${p.no}`,reversal_of:orig.id,audit:[audit],purchase_id:p.id,receipt_id:r.id,purchase_line_id:rl.line_id};
  await io.saveStock([...stock.map(m=>m.id===orig.id?edited:m),reverse]);
 }
 return 'void';
}
