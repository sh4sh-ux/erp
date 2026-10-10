// 매입 데이터 저장 규칙(1단계, 10/10 — 사용자 승인 설계 v1).
// purchases.json은 기존 7개 데이터 파일과 따로 있는 '선택' 파일이다. 이 규칙은 그 파일과,
// 재고·입출금 기록 중 purchase_id가 붙은 줄만 검사한다(purchase_id가 없는 기존 기록은 지금 규칙 그대로).
// 원칙: 저장 1번에 매입 1건 · 입고 차수·원가 이력·부대비용은 '추가만'(바로잡기는 취소 표시) ·
//       재고 기록 번호는 입고 차수와 줄에서 정해진다(다시 시도해도 같은 번호 → 중복 입고 불가) ·
//       매입 지급은 client_ref가 같으면 두 번 저장되지 않는다(중복 지급 방지).
import {fault} from './core.mjs';
import {canonical} from './company-contract.mjs';

export const PURCHASES_SCHEMA=1;
export const PURCHASE_KINDS=Object.freeze(['국내','수입','기초재고']);
export const PURCHASE_STATUS=Object.freeze(['작성중','입고 완료','원가 확정','취소']);
export const COST_TYPES=Object.freeze(['운임','보험','관세','통관수수료','국내운송','기타']);
export const ALLOC=Object.freeze(['금액','수량','중량','직접']);
export const MAX_BYTES=1048576;
export const WARN_RATIO=.7;

const valid=x=>{if(!x)throw fault('VALIDATION');};
const str=(v,max=10000)=>typeof v==='string'&&v.length<=max;
const id=v=>str(v,160)&&v.length>0&&/^[A-Za-z0-9_.:-]+$/.test(v);
const num=v=>typeof v==='number'&&Number.isFinite(v);
const int=v=>Number.isSafeInteger(v);
const iso=v=>str(v,40)&&Number.isFinite(Date.parse(v));
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const same=(a,b)=>canonical(a)===canonical(b);
const unique=list=>{const s=new Set();for(const x of list){valid(id(x?.id)&&!s.has(x.id));s.add(x.id);}return s;};
const without=(o,keys)=>{const c={...o};for(const k of keys)delete c[k];return c;};

// 입고 차수 + 줄 → 재고 기록 번호(결정적). 다시 시도해도 같은 번호라 같은 입고가 두 번 생길 수 없다.
export const stockMoveId=(receiptId,lineId)=>`pm_${receiptId}_${lineId}`;
export const emptyPurchases=()=>({schema:PURCHASES_SCHEMA,rows:[],archives:[]});
export function purchasesBytes(doc){return new TextEncoder().encode(JSON.stringify(doc)).length;}
export function capacity(doc){const bytes=purchasesBytes(doc);return {bytes,limit:MAX_BYTES,ratio:bytes/MAX_BYTES,warn:bytes/MAX_BYTES>=WARN_RATIO};}

function line(l,items){
 valid(l&&typeof l==='object'&&id(l.id));
 valid(items.some(i=>i.id===l.item_id));
 valid((l.color===undefined||str(l.color,200))&&(l.spec===undefined||str(l.spec,200)));
 valid(int(l.qty)&&l.qty>0&&num(l.unit_price)&&l.unit_price>=0);
 valid(l.weight===undefined||num(l.weight)&&l.weight>=0);
}
function cost(c,p,companies){
 valid(c&&typeof c==='object'&&id(c.id)&&COST_TYPES.includes(c.type)&&num(c.amount_krw)&&ALLOC.includes(c.alloc));
 valid(c.payee_id===undefined||companies.some(x=>x.id===c.payee_id));
 valid(c.amount_fx===undefined||num(c.amount_fx));
 valid(c.currency===undefined||/^[A-Z]{3}$/.test(c.currency));
 valid(c.added_at===undefined||iso(c.added_at));
 if(c.alloc==='직접'){
  valid(c.direct&&typeof c.direct==='object'&&!Array.isArray(c.direct));
  const keys=Object.keys(c.direct);valid(keys.length>0&&keys.every(k=>p.lines.some(l=>l.id===k)&&num(c.direct[k])));
  valid(Math.round(keys.reduce((s,k)=>s+c.direct[k],0))===Math.round(c.amount_krw));
 }
 if(c.alloc==='중량')valid(p.lines.every(l=>num(l.weight)&&l.weight>0));
 if(c.void_at!==undefined)valid(iso(c.void_at)&&(c.void_reason===undefined||str(c.void_reason,500)));
}
function receipt(r,p){
 valid(r&&typeof r==='object'&&id(r.id)&&day(r.date)&&Array.isArray(r.lines)&&r.lines.length>0&&iso(r.planned_at));
 const seen=new Set();
 for(const rl of r.lines){valid(p.lines.some(l=>l.id===rl.line_id)&&!seen.has(rl.line_id)&&int(rl.qty)&&rl.qty>0);seen.add(rl.line_id);}
 valid(Array.isArray(r.stock_move_ids)&&same(r.stock_move_ids,r.lines.map(rl=>stockMoveId(r.id,rl.line_id))));
 // 입고할 때의 임시 원가(원/개)는 입고 차수에 고정해 둔다 → 나중 변경이 지난 출고 원가를 바꾸지 않는다.
 valid(r.unit_costs&&typeof r.unit_costs==='object'&&r.lines.every(rl=>num(r.unit_costs[rl.line_id])&&r.unit_costs[rl.line_id]>=0));
 valid(r.posted_at===undefined||iso(r.posted_at));
 if(r.void_at!==undefined)valid(iso(r.void_at)&&str(r.void_reason||'',500));
}
function run(cr,p,prior){
 valid(cr&&typeof cr==='object'&&id(cr.id)&&iso(cr.at)&&ALLOC.includes(cr.basis)&&int(cr.after_move_count)&&cr.after_move_count>=0);
 valid(['최초','추가 비용','수정'].includes(cr.reason));
 valid(cr.unit_costs&&typeof cr.unit_costs==='object'&&p.lines.every(l=>num(cr.unit_costs[l.id])&&cr.unit_costs[l.id]>=0));
 valid(cr.supersedes===undefined||prior.some(x=>x.id===cr.supersedes));
 valid(cr.acknowledged_issues===undefined||Array.isArray(cr.acknowledged_issues)&&cr.acknowledged_issues.every(x=>str(x,200)));
 valid(cr.by===undefined||str(cr.by,320));
}
export function validatePurchase(p,snapshot){
 const companies=snapshot.companies||[],items=snapshot.items||[];
 valid(p&&typeof p==='object'&&!Array.isArray(p)&&id(p.id)&&str(p.no,80)&&p.no.length>0);
 valid(PURCHASE_KINDS.includes(p.kind)&&PURCHASE_STATUS.includes(p.status)&&day(p.date));
 valid(p.kind==='기초재고'?p.vendor_id===undefined||companies.some(c=>c.id===p.vendor_id):companies.some(c=>c.id===p.vendor_id));
 valid(/^[A-Z]{3}$/.test(p.currency||''));
 valid(Array.isArray(p.lines)&&p.lines.length>0&&p.lines.length<=500);unique(p.lines);
 for(const l of p.lines)line(l,items);
 if(p.currency!=='KRW')valid(p.fx&&num(p.fx.booking_rate)&&p.fx.booking_rate>0&&(p.fx.customs_rate===undefined||num(p.fx.customs_rate)&&p.fx.customs_rate>0));
 valid(p.costs===undefined||Array.isArray(p.costs));unique(p.costs||[]);for(const c of p.costs||[])cost(c,p,companies);
 valid(p.receipts===undefined||Array.isArray(p.receipts));unique(p.receipts||[]);for(const r of p.receipts||[])receipt(r,p);
 valid(p.cost_runs===undefined||Array.isArray(p.cost_runs));unique(p.cost_runs||[]);
 (p.cost_runs||[]).forEach((cr,i)=>run(cr,p,p.cost_runs.slice(0,i)));
 valid(p.import_vat===undefined||p.import_vat&&num(p.import_vat.amount)&&p.import_vat.amount>=0);
 valid(p.tax_invoice===undefined||p.tax_invoice&&typeof p.tax_invoice.received==='boolean'&&(p.tax_invoice.date===undefined||day(p.tax_invoice.date)));
 valid(p.attachments===undefined||Array.isArray(p.attachments)&&p.attachments.every(a=>str(a,500)&&/^NARO Biz\/Documents\//.test(a)&&!a.includes('..')));
 // 입고 수량은 주문 수량을 넘을 수 없다(취소된 차수 제외) — 같은 물건을 두 번 입고하는 실수를 막는다.
 for(const l of p.lines){const got=(p.receipts||[]).filter(r=>!r.void_at).reduce((s,r)=>s+(r.lines.find(x=>x.line_id===l.id)?.qty||0),0);valid(got<=l.qty);}
 if(p.status==='취소')valid((p.receipts||[]).every(r=>r.void_at));
 if(p.kind==='기초재고')valid(!(p.receipts||[]).length);
 return true;
}
// 지난 기록은 고치지 않는다: 바뀐 매입 1건을 이전 모습과 비교한다.
function frozen(prev,next){
 const hasReceipt=(prev.receipts||[]).length>0;
 if(hasReceipt){valid(same(prev.lines,next.lines)&&prev.vendor_id===next.vendor_id&&prev.currency===next.currency&&prev.kind===next.kind);}
 const nr=new Map((next.receipts||[]).map(r=>[r.id,r]));
 for(const r of prev.receipts||[]){
  const n=nr.get(r.id);valid(n);
  // 바뀔 수 있는 것: 완료 표시(posted_at) 한 번, 취소 표시(void_at·void_reason) 한 번. 나머지는 그대로.
  valid(same(without(n,['posted_at','void_at','void_reason']),without(r,['posted_at','void_at','void_reason'])));
  if(r.posted_at!==undefined)valid(n.posted_at===r.posted_at);
  if(r.void_at!==undefined)valid(n.void_at===r.void_at&&n.void_reason===r.void_reason);
 }
 const nc=new Map((next.costs||[]).map(c=>[c.id,c]));
 for(const c of prev.costs||[]){const n=nc.get(c.id);valid(n);valid(same(without(n,['void_at','void_reason']),without(c,['void_at','void_reason'])));if(c.void_at!==undefined)valid(n.void_at===c.void_at&&n.void_reason===c.void_reason);}
 const runs=next.cost_runs||[],old=prev.cost_runs||[];
 valid(runs.length>=old.length&&old.every((r,i)=>same(r,runs[i])));
}
// 매입 파일 저장 검사(저장 1번에 매입 1건). before가 없으면(매입 시작하기) 빈 파일만 허용.
export function validatePurchasesChange(before,next,snapshot,links={stock_moves:[],payments:[]}){
 valid(next&&typeof next==='object'&&!Array.isArray(next)&&next.schema===PURCHASES_SCHEMA&&Array.isArray(next.rows)&&Array.isArray(next.archives));
 valid(purchasesBytes(next)<=MAX_BYTES&&next.rows.length<=20000);
 unique(next.rows);
 valid(new Set(next.rows.map(r=>r.no)).size===next.rows.length);
 if(!before){valid(next.rows.length===0&&next.archives.length===0);return structuredClone(next);}
 valid(before.schema===PURCHASES_SCHEMA);
 valid(same(before.archives,next.archives)); // 연도 분할은 구조만 준비(1단계에서는 바꾸지 않음)
 const prev=new Map(before.rows.map(r=>[r.id,r])),ids=new Set(next.rows.map(r=>r.id));
 const removed=before.rows.filter(r=>!ids.has(r.id));
 const changed=next.rows.filter(r=>!prev.has(r.id)||!same(r,prev.get(r.id)));
 valid(removed.length+changed.length<=1);
 if(removed.length){
  const r=removed[0];
  valid(!(r.receipts||[]).length&&!(r.cost_runs||[]).length);
  valid(!links.stock_moves.some(m=>m.purchase_id===r.id)&&!links.payments.some(x=>x.purchase_id===r.id));
 }
 for(const r of changed){validatePurchase(r,snapshot);if(prev.has(r.id))frozen(prev.get(r.id),r);}
 return structuredClone(next);
}

// 재고·입출금 저장 때, purchase_id가 붙은 '새' 줄만 검사한다(기존 줄·연결 없는 줄은 지금 규칙만).
export function validatePurchaseLinks(key,before,next,purchasesDoc){
 if(key!=='stock_moves'&&key!=='payments')return true;
 const old=new Set((before||[]).map(r=>r.id));
 const added=(next||[]).filter(r=>!old.has(r.id)&&r.purchase_id!==undefined);
 if(!added.length)return true;
 valid(purchasesDoc&&Array.isArray(purchasesDoc.rows)); // 매입을 시작하지 않았으면 연결된 기록을 만들 수 없다
 const find=pid=>purchasesDoc.rows.find(p=>p.id===pid);
 for(const row of added){
  const p=find(row.purchase_id);valid(p);
  if(key==='stock_moves'){
   if(row.reversal_of){
    // 매입 입고의 취소(반대 기록)는 그 입고 차수에 취소 표시가 먼저 있어야 한다.
    const r=(p.receipts||[]).find(x=>x.id===row.receipt_id);valid(r&&r.void_at&&row.kind==='출고');
    valid(r.stock_move_ids.includes(row.reversal_of));
    continue;
   }
   const r=(p.receipts||[]).find(x=>x.id===row.receipt_id);valid(r&&!r.void_at);
   const rl=r.lines.find(x=>x.line_id===row.purchase_line_id);valid(rl);
   const l=p.lines.find(x=>x.id===rl.line_id);
   valid(row.id===stockMoveId(r.id,rl.line_id)&&row.kind==='입고'&&row.item_id===l.item_id&&(row.color||'')===(l.color||'')&&(row.spec||'')===(l.spec||'')&&row.qty===rl.qty);
  }else{
   valid(p.kind!=='기초재고'&&str(row.client_ref,160)&&row.client_ref.length>0);
   valid(row.company_id===p.vendor_id||(p.costs||[]).some(c=>c.payee_id===row.company_id));
   valid(row.kind==='지급'||row.kind==='수금'&&row.refund===true);
   valid(row.currency===undefined||/^[A-Z]{3}$/.test(row.currency));
   valid(row.amount_fx===undefined||num(row.amount_fx)&&row.amount_fx>0);
   valid(row.fx_rate===undefined||num(row.fx_rate)&&row.fx_rate>0);
   // 같은 지급 요청(client_ref)이 이미 있으면 거절 — 저장 응답이 끊겨 다시 눌러도 두 번 기록되지 않는다.
   valid((next||[]).filter(x=>x.purchase_id===row.purchase_id&&x.client_ref===row.client_ref).length===1);
  }
 }
 return true;
}
