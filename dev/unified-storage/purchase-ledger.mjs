// 매입 원가 계산(1단계, 순수 함수 — 저장·화면 없음).
// 원칙(사용자 승인 10/10):
//  · 원가 단위 = 옵션(품목+색상+규격). 품목 전체 평균은 참고용.
//  · 이동평균은 저장하지 않고 '재고 기록 순서(추가만 되는 배열 순서)'대로 매번 다시 계산 → 어느 기기에서나 같은 숫자.
//  · 지난 출고(매출)의 원가는 나중 입고·나중 원가 확정 때문에 바뀌지 않는다:
//      - 입고 원가는 입고 차수에 고정된 값(receipts[].unit_costs)을 쓴다.
//      - 원가 확정(cost_runs)은 확정한 그 시점(after_move_count) 이후에만 반영하고,
//        이미 팔린 수량 몫의 차이는 '원가 조정'으로 따로 기록한다(지난 출고는 그대로).
//  · 원가를 모르는 재고(초기 재고·원가 없는 입고)와 음수 재고는 숫자를 지어내지 않고 '검토 필요'로 표시.
export const optionKey=(item_id,color,spec)=>JSON.stringify([item_id||'',color||'',spec||'']);
const won=v=>Math.round(v);
const cents=v=>Math.round(v*100)/100;

// 줄별 원화 물품대: 외화면 '매입 처리 환율'(booking_rate). 세관 신고 환율은 신고가격 확인용(원가 아님).
export function lineBase(p){
 const rate=p.currency==='KRW'?1:Number(p.fx?.booking_rate)||0;
 return Object.fromEntries(p.lines.map(l=>[l.id,won(l.qty*l.unit_price*rate)]));
}
// 금액 하나를 줄에 나눈다. 원 단위로 내리고 남는 원은 기준값이 가장 큰 줄(같으면 앞줄)에 → 합계가 정확히 맞는다.
export function split(amount,weights){
 const ids=Object.keys(weights),total=ids.reduce((s,k)=>s+weights[k],0);
 const out=Object.fromEntries(ids.map(k=>[k,0]));if(!ids.length)return out;
 const target=won(amount);
 if(total<=0){out[ids[0]]=target;return out;}
 let used=0;for(const k of ids){out[k]=Math.trunc(target*weights[k]/total);used+=out[k];}
 const big=ids.reduce((a,k)=>weights[k]>weights[a]?k:a,ids[0]);out[big]+=target-used;
 return out;
}
// 부대비용 배분(취소 표시된 비용 제외). 기준: 금액(기본)·수량·중량·직접.
export function allocate(p){
 const base=lineBase(p),sum=Object.fromEntries(p.lines.map(l=>[l.id,0]));
 for(const c of (p.costs||[]).filter(c=>!c.void_at)){
  let part;
  if(c.alloc==='직접')part=Object.fromEntries(p.lines.map(l=>[l.id,won(c.direct?.[l.id]||0)]));
  else part=split(c.amount_krw,Object.fromEntries(p.lines.map(l=>[l.id,c.alloc==='수량'?l.qty:c.alloc==='중량'?Number(l.weight)||0:base[l.id]])));
  for(const k in part)sum[k]+=part[k];
 }
 return sum;
}
// 줄별 도착원가와 개당 원가(원, 소수 2자리). 수입부가세는 포함하지 않는다(공제 대상 — 원가와 분리).
export function unitCosts(p){
 const base=lineBase(p),alloc=allocate(p);
 return Object.fromEntries(p.lines.map(l=>{const total=base[l.id]+alloc[l.id];return [l.id,{base:base[l.id],allocated:alloc[l.id],total,unit:cents(total/l.qty)}];}));
}
// 지금 유효한 원가 확정(대체되지 않은 마지막 것)
export function currentRun(p){const runs=p.cost_runs||[];const replaced=new Set(runs.map(r=>r.supersedes).filter(Boolean));for(let i=runs.length-1;i>=0;i--)if(!replaced.has(runs[i].id))return runs[i];return null;}

// 원가 원장: 재고 기록을 배열 순서대로 다시 읽는다. 원가 확정은 after_move_count 위치에 끼워 넣는다.
export function costLedger({stock_moves=[],purchases=null}={}){
 const rows=purchases?.rows||[];
 const byMove=new Map(),runsAt=new Map();
 for(const p of rows){
  for(const r of p.receipts||[])r.lines.forEach(rl=>byMove.set(`pm_${r.id}_${rl.line_id}`,{p,r,rl}));
  for(const run of p.cost_runs||[]){const n=run.after_move_count;if(!runsAt.has(n))runsAt.set(n,[]);runsAt.get(n).push({p,run});}
 }
 const opts=new Map(),outflows=[],adjustments=[],issues=[],entries=[];
 const unitApplied=new Map(); // `${매입}|${입고차수}|${줄}` → 지금까지 반영된 개당 원가
 const st=k=>{if(!opts.has(k))opts.set(k,{key:k,qty:0,value:0,unknown:0,issues:new Set()});return opts.get(k);};
 const issue=(s,type,at,extra={})=>{s.issues.add(type);issues.push({option:s.key,type,at,...extra});};
 const avg=s=>s.qty>0&&s.unknown===0?s.value/s.qty:null;
 const applyRuns=pos=>{for(const {p,run} of runsAt.get(pos)||[]){
  if(p.kind==='기초재고'){
   // 기초 재고 원가 확인: 그 시점 재고(원가 모름)에 원가를 정해 준다. 지난 출고는 그대로.
   for(const l of p.lines){const s=st(optionKey(l.item_id,l.color,l.spec)),u=run.unit_costs[l.id];
    if(s.qty<=0){issue(s,'opening_without_stock',pos);continue;}
    const known=s.qty-s.unknown;s.value=s.value+s.unknown*u;s.unknown=0;
    entries.push({at:pos,option:s.key,type:'opening',qty:s.qty,unit:u,known_before:known});}
   continue;
  }
  // 입고 차수마다: 반영된 개당 원가와 새 확정 원가의 차이. 남아 있는 수량 몫은 재고 가치에, 이미 나간 몫은 '원가 조정'으로.
  for(const r of (p.receipts||[]).filter(r=>!r.void_at&&r.stock_move_ids.every(id=>seen.has(id))))for(const rl of r.lines){
   const l=p.lines.find(x=>x.id===rl.line_id),k=`${p.id}|${r.id}|${l.id}`;if(!unitApplied.has(k))continue;
   const delta=run.unit_costs[l.id]-unitApplied.get(k);unitApplied.set(k,run.unit_costs[l.id]);
   if(Math.abs(delta)<1e-9)continue;
   const s=st(optionKey(l.item_id,l.color,l.spec)),onHand=Math.max(0,Math.min(rl.qty,s.qty-s.unknown));
   const toStock=cents(delta*onHand),toSold=cents(delta*rl.qty-toStock);
   s.value+=toStock;
   if(toSold)adjustments.push({at:pos,purchase_id:p.id,receipt_id:r.id,line_id:l.id,option:s.key,run_id:run.id,date:String(run.at).slice(0,10),amount:toSold,qty:rl.qty-onHand,unit_delta:delta});
   entries.push({at:pos,option:s.key,type:'cost_run',purchase_id:p.id,receipt_id:r.id,run_id:run.id,unit_delta:delta,to_stock:toStock,to_sold:toSold});
  }
 }};
 const seen=new Set();
 applyRuns(0);
 stock_moves.forEach((m,i)=>{
  seen.add(m.id);
  const s=st(optionKey(m.item_id,m.color,m.spec)),q=Number(m.qty)||0,link=byMove.get(m.id);
  if(m.kind==='입고'){
   if(link){
    const u=link.r.unit_costs[link.rl.line_id];unitApplied.set(`${link.p.id}|${link.r.id}|${link.rl.line_id}`,u);
    if(s.qty<0){issue(s,'receipt_while_negative',i,{move_id:m.id});s.value=0;s.unknown=0;s.qty+=q;s.value=Math.max(0,s.qty)*u;}
    else{s.qty+=q;s.value+=q*u;}
    entries.push({at:i,option:s.key,type:'receipt',move_id:m.id,qty:q,unit:u,purchase_id:link.p.id});
   }else{
    // 원가 없는 입고(예전 '입고' 기록, 수동 입고): 원가를 지어내지 않는다.
    s.qty+=q;s.unknown+=q;issue(s,'uncosted_receipt',i,{move_id:m.id});
    entries.push({at:i,option:s.key,type:'uncosted_receipt',move_id:m.id,qty:q});
   }
  }else{
   const rev=m.reversal_of&&byMove.get(m.reversal_of);
   if(rev){ // 매입 입고 취소: 그 입고 원가로 빼낸다(평균 아님)
    const u=unitApplied.get(`${rev.p.id}|${rev.r.id}|${rev.rl.line_id}`)??rev.r.unit_costs[rev.rl.line_id];
    s.qty-=q;s.value-=q*u;entries.push({at:i,option:s.key,type:'receipt_void',move_id:m.id,qty:q,unit:u});
   }else{
    // 출고: 원가를 아는 재고만 있으면 평균 원가. 원가 모르는 재고가 섞여 있으면 '추정'(숫자를 지어내지 않음).
    if(s.qty-q<0)issue(s,'negative',i,{move_id:m.id});
    const a=avg(s),knownQty=s.qty-s.unknown;
    outflows.push({move_id:m.id,quote_id:m.quote_id,date:m.date,option:s.key,qty:q,unit_cost:a===null?null:cents(a),estimated:a===null});
    let left=q;const fromUnknown=Math.min(left,Math.max(0,s.unknown));s.unknown-=fromUnknown;left-=fromUnknown; // 원가 모르는 재고(초기 재고)가 먼저 나간다고 본다
    const fromKnown=Math.min(left,Math.max(0,knownQty));if(fromKnown>0)s.value-=fromKnown*(s.value/knownQty);
    s.qty-=q;if(s.qty<=0)s.value=0;
   }
  }
  applyRuns(i+1);
 });
 const options=[...opts.values()].map(s=>({key:s.key,qty:s.qty,value:cents(s.value),unknown:s.unknown,avg:avg(s)===null?null:cents(avg(s)),issues:[...s.issues]}));
 return {options,outflows,adjustments,issues,entries,moveCount:stock_moves.length};
}
// 품목 전체 평균(참고용): 원가를 아는 옵션만 합친다.
export function itemAverage(ledger,item_id){
 const list=ledger.options.filter(o=>JSON.parse(o.key)[0]===item_id&&o.avg!==null&&o.qty>0);
 const qty=list.reduce((s,o)=>s+o.qty,0),value=list.reduce((s,o)=>s+o.value,0);
 return {qty,value:cents(value),avg:qty?cents(value/qty):null,options:list.length,partial:ledger.options.some(o=>JSON.parse(o.key)[0]===item_id&&o.qty>0&&o.avg===null)};
}
// 변경 전후 영향 비교: 지난 출고 원가가 하나라도 바뀌면 changedOutflows에 나온다(정상이라면 항상 빈 목록).
export function impact(before,after){
 const a=new Map(before.outflows.map(o=>[o.move_id,o])),changed=[];
 for(const o of after.outflows){const p=a.get(o.move_id);if(p&&(p.unit_cost!==o.unit_cost||p.estimated!==o.estimated))changed.push({move_id:o.move_id,quote_id:o.quote_id,before:p.unit_cost,after:o.unit_cost});}
 const oldAdj=new Set(before.adjustments.map(x=>`${x.run_id}|${x.receipt_id}|${x.line_id}`));
 return {changedOutflows:changed,newAdjustments:after.adjustments.filter(x=>!oldAdj.has(`${x.run_id}|${x.receipt_id}|${x.line_id}`))};
}
// 원가 확정 전에 확인할 문제(음수 재고·원가 모르는 재고). 코드: '<옵션키>:<종류>'
export function runIssues(ledger,p){
 const keys=new Set(p.lines.map(l=>optionKey(l.item_id,l.color,l.spec)));
 return ledger.options.filter(o=>keys.has(o.key)).flatMap(o=>[...(o.qty<0?['negative']:[]),...(o.unknown>0?['unknown_cost']:[])].map(t=>`${o.key}:${t}`));
}
// 지급 상태: 국내=원화(부가세 포함), 수입=매입처는 외화, 부대비용 낸 곳은 원화. 환차손익 = 실제 송금 원화 − 매입 처리 환율 원화.
export function paymentStatus(p,payments=[]){
 const linked=payments.filter(x=>x.purchase_id===p.id),sign=x=>x.kind==='지급'?1:-1;
 const vendorPays=linked.filter(x=>x.company_id===p.vendor_id);
 const krwLines=Object.values(lineBase(p)).reduce((s,v)=>s+v,0);
 const vat=p.currency==='KRW'?(p.vat?.tax??0):0;
 let due,paid,fxGain=0;
 if(p.currency==='KRW'){due=krwLines+vat;paid=vendorPays.reduce((s,x)=>s+sign(x)*x.amount,0);}
 else{
  due=p.lines.reduce((s,l)=>s+l.qty*l.unit_price,0);paid=vendorPays.reduce((s,x)=>s+sign(x)*(Number(x.amount_fx)||0),0);
  fxGain=vendorPays.filter(x=>x.amount_fx).reduce((s,x)=>s+sign(x)*(x.amount_fx*p.fx.booking_rate-x.amount),0); // +면 환차익
 }
 const firstReceipt=(p.receipts||[]).filter(r=>!r.void_at).map(r=>r.date).sort()[0];
 const prepaid=vendorPays.filter(x=>x.kind==='지급'&&(!firstReceipt||x.date<firstReceipt)).reduce((s,x)=>s+(p.currency==='KRW'?x.amount:Number(x.amount_fx)||0),0);
 const eps=p.currency==='KRW'?0.5:0.005;
 const status=paid<=eps?'미지급':paid<due-eps?'부분 지급':paid<=due+eps?'지급 완료':'초과 지급';
 const costDue=(p.costs||[]).filter(c=>!c.void_at&&c.payee_id).reduce((m,c)=>(m[c.payee_id]=(m[c.payee_id]||0)+c.amount_krw,m),{});
 const costPaid=linked.filter(x=>x.company_id!==p.vendor_id).reduce((m,x)=>(m[x.company_id]=(m[x.company_id]||0)+sign(x)*x.amount,m),{});
 return {currency:p.currency,due:p.currency==='KRW'?won(due):Math.round(due*100)/100,paid:p.currency==='KRW'?won(paid):Math.round(paid*100)/100,status,prepaid,fxGain:won(fxGain),costs:Object.keys({...costDue,...costPaid}).map(id=>({payee_id:id,due:costDue[id]||0,paid:costPaid[id]||0}))};
}
