// 변경 기록(10/9): 저장 한 번(표 하나의 이전 → 이후)을 사람이 읽는 한 줄로 바꾼다.
// 예) {action:'수정', label:'견적서 Q-20261001-1 · 메디랩코리아(주)', changes:['셰프복 BK·S 수량 5 → 4','상태 수주 → 납품']}
// 금액·이름처럼 화면에 보이는 값만 적는다(내부 id·토큰·사진 경로는 적지 않는다). 순수 함수 — 테스트: change-log.test.mjs.
const won=v=>`${Math.round(Number(v)||0).toLocaleString('ko-KR')}원`;
const num=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
const short=v=>{const t=String(v??'').replace(/\s+/g,' ').trim();return t.length>40?t.slice(0,39)+'…':t||'(빈칸)';};
const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?`${Number(m[2])}.${m[3]}`:'';};
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const TABLE={purchases:'매입',quotes:'견적서',companies:'거래처',items:'품목',payments:'입금·출금',stock_moves:'재고',material_moves:'업체 제공 자재',settings:'공급자 정보'};
const FIELDS={
 quotes:{status:'상태',date:'견적일자',valid:'유효기간',memo:'비고',tax_at:'계산서 발행일',no_tax:'계산서 발행 안 함',cancel_reason:'취소 사유'},
 companies:{name:'이름',type:'구분',biz_no:'사업자번호',contact:'담당자',phone:'전화',email:'이메일',address:'주소',address_base:'주소',address_detail:'상세 주소',memo:'메모',quote_memo:'견적 메모',no_tax:'계산서 발행 안 함'},
 items:{name:'품명',code:'품번',category:'분류',price:'판매가',cost:'매입가',unit:'단위',type:'종류',memo:'메모'},
 payments:{date:'날짜',amount:'금액',method:'방법',memo:'메모',kind:'구분'},
 material_moves:{date:'날짜',material:'자재',qty:'수량',kind:'구분',memo:'메모'}
};
export function describeChange(key,before,after,ref={}){
 const co=id=>(ref.companies||[]).find(c=>c.id===id)?.name||'거래처 없음';
 const table=TABLE[key]||key;
 if(key==='settings'){
  const b=before||{},a=after||{},all=[...new Set([...Object.keys(b),...Object.keys(a)])].filter(k=>!same(b[k],a[k]));
  // 휴지통(trash)은 표 쪽 기록(삭제·추가)이 대신 남는다. 숨김(hidden)은 거래처·품목 '삭제(숨김)'·'복원'으로 적는다.
  if(all.includes('hidden')&&all.every(k=>k==='hidden'||k==='trash')){
   const names={companies:id=>(ref.companies||[]).find(c=>c.id===id)?.name,items:id=>(ref.items||[]).find(i=>i.id===id)?.name};
   for(const k of ['companies','items']){
    const was=b.hidden?.[k]||[],now=a.hidden?.[k]||[],on=now.filter(x=>!was.includes(x)),off=was.filter(x=>!now.includes(x));
    const id=on[0]||off[0];if(!id)continue;
    return {key:k,table:TABLE[k],action:on.length?'삭제':'복원',ref:id,label:`${TABLE[k]} ${names[k](id)||''}`.trim(),changes:[on.length?'목록에서 숨김 · 지난 기록은 그대로':'다시 목록에 보임']};
   }
  }
  const keys=all.filter(k=>k!=='assets'&&k!=='schema'&&k!=='trash'&&k!=='hidden');
  return keys.length?{key,table,action:'수정',ref:'settings',label:'공급자 정보',changes:keys.slice(0,12).map(k=>`${k} 변경`)}:null;
 }
 if(key==='purchases')return describePurchase(before,after,co);
 const B=new Map((before||[]).map(r=>[r.id,r])),A=new Map((after||[]).map(r=>[r.id,r]));
 const added=[...A.values()].filter(r=>!B.has(r.id)),removed=[...B.values()].filter(r=>!A.has(r.id));
 const changed=[...A.values()].filter(r=>B.has(r.id)&&!same(r,B.get(r.id)));
 if(key==='stock_moves'){
  if(!added.length&&!changed.length&&!removed.length)return null;
  const out=added.filter(m=>m.kind==='출고').reduce((s,m)=>s+(Number(m.qty)||0),0),inn=added.filter(m=>m.kind==='입고').reduce((s,m)=>s+(Number(m.qty)||0),0);
  const memo=added.map(m=>m.memo).find(Boolean)||'';
  return {key,table,action:added.length?'추가':'수정',ref:added[0]?.quote_id||added[0]?.id||changed[0]?.id||'',label:`재고 ${added.length||changed.length}건${memo?` · ${short(memo)}`:''}`,changes:[out?`출고 ${num(out)}개`:'',inn?`입고 ${num(inn)}개`:'',changed.length?`취소 ${changed.length}건`:''].filter(Boolean)};
 }
 const row=added[0]||changed[0]||removed[0];if(!row)return null;
 const label=r=>key==='quotes'?`견적서 ${r.no||'(새 견적)'} · ${co(r.company_id)}`
  :key==='companies'?`거래처 ${r.name||''}`
  :key==='items'?`품목 ${r.name||''}${r.code?` ${r.code}`:''}`
  :key==='payments'?`${r.kind==='지급'?(r.refund?'환불':'출금'):'입금'} ${won(r.amount)} · ${co(r.company_id)}`
  :`${table} ${short(r.name||r.material||r.id)}`;
 if(added.length)return {key,table,action:'추가',ref:row.id,label:label(row),changes:addedDetail(key,row,ref)};
 if(removed.length&&!changed.length)return {key,table,action:'삭제',ref:row.id,label:label(row),changes:[]};
 const b=B.get(row.id),a=row,changes=[];
 for(const [f,name] of Object.entries(FIELDS[key]||{})){
  if(same(a[f],b[f]))continue;
  if(f==='company_id')continue;
  const money=['amount','price','cost'].includes(f),fmt=v=>f==='no_tax'?(v?'예':'아니오'):money?won(v):short(v);
  changes.push(`${name} ${fmt(b[f])} → ${fmt(a[f])}`);
 }
 if(key==='quotes'){
  if(!same(a.company_id,b.company_id))changes.push(`거래처 ${co(b.company_id)} → ${co(a.company_id)}`);
  const lineName=l=>[l.name,[l.color,l.spec].filter(Boolean).join('·')].filter(Boolean).join(' ');
  const BL=new Map((b.lines||[]).map(l=>[l.id,l])),AL=new Map((a.lines||[]).map(l=>[l.id,l]));
  for(const l of a.lines||[]){const o=BL.get(l.id);
   if(!o){changes.push(`품목 추가: ${lineName(l)} ${num(l.qty)}개 × ${won(l.price)}`);continue;}
   if(!same(o.qty,l.qty))changes.push(`${lineName(l)} 수량 ${num(o.qty)} → ${num(l.qty)}`);
   if(!same(o.price,l.price))changes.push(`${lineName(l)} 단가 ${won(o.price)} → ${won(l.price)}`);
   if(!same(o.name,l.name)||!same(o.color,l.color)||!same(o.spec,l.spec))changes.push(`품목 변경: ${lineName(o)} → ${lineName(l)}`);
  }
  for(const l of b.lines||[])if(!AL.has(l.id))changes.push(`품목 삭제: ${lineName(l)}`);
  const BD=new Map((b.deliveries||[]).map(d=>[d.id,d])),qty=d=>(d.lines||[]).reduce((s,x)=>s+(Number(x.qty)||0),0);
  for(const d of a.deliveries||[]){const o=BD.get(d.id);
   if(!o)changes.push(`납품 기록 ${md(d.date)} ${num(qty(d))}개`);
   else if(d.void_at&&!o.void_at)changes.push(`납품 기록 ${d.void_reason==='고침'?'고침':'취소'} ${md(d.date)} ${num(qty(d))}개`);
  }
 }
 if(key==='companies'&&!same(a.prices,b.prices))changes.push('거래처 단가 변경');
 if(key==='items'&&!same(a.variants,b.variants))changes.push('옵션(색상·규격) 변경');
 let action=key==='quotes'&&a.status==='취소'&&b.status!=='취소'?'취소':key==='quotes'&&b.status==='취소'&&a.status!=='취소'?'되살리기':'수정';
 // 견적서 '삭제'(지우지 않고 보관: 상태 취소 + 사유 '삭제')와 그 복원
 if(key==='quotes'&&a.status==='취소'&&a.cancel_reason==='삭제'&&b.cancel_reason!=='삭제')action='취소';
 if(key==='quotes'&&action==='취소'&&a.cancel_reason==='삭제'){action='삭제';changes.length=0;changes.push('목록에서 뺌 · 복원 가능');}
 if(key==='quotes'&&a.status==='취소'&&b.status==='취소'&&b.cancel_reason==='삭제'&&a.cancel_reason!=='삭제'){action='복원';changes.length=0;changes.push('취소된 견적으로 돌아옴');}
 if(key==='quotes'&&action==='되살리기'){action='복원';if(b.cancel_reason==='삭제'){changes.length=0;changes.push(`상태 → ${a.status}`);}}
 if(!changes.length)changes.push('세부 내용 변경');
 return {key,table,action,ref:row.id,label:label(a),changes:changes.slice(0,12).concat(changes.length>12?[`외 ${changes.length-12}건`]:[])};
}
function addedDetail(key,r){
 if(key==='quotes')return [`품목 ${(r.lines||[]).length}건 · 상태 ${r.status||''}`];
 if(key==='payments')return [[r.date,r.method,r.memo].filter(Boolean).map(short).join(' · ')].filter(Boolean);
 if(key==='items')return [r.price!=null?`판매가 ${won(r.price)}`:''].filter(Boolean);
 return [];
}
// 저장 직후 한 줄 기록: 누가(이메일)·언제·무엇을. id는 같은 저장이 두 번 기록되지 않게.
// 고치기 전(10/11 이전)에 이미 저장된 기록을 보여 줄 때만 바로잡는다 — 저장된 기록은 바꾸지 않는다.
//  · 견적서 '취소' + '취소 사유 … → 삭제' → 삭제 · 매입 '수정 · 세부 내용 변경'(그때는 삭제 표시만 바뀌어 이렇게 적혔다) → 삭제
//  · 공급자 정보 'trash 변경'만 → 숨김(표 쪽 삭제 기록이 대신 있다) · 'hidden 변경'만 → 거래처·품목 숨김
export function presentEntry(r){
 if(!r||typeof r!=='object')return r;
 const ch=Array.isArray(r.changes)?r.changes:[];
 if(r.key==='quotes'&&r.action==='취소'&&ch.some(c=>/^취소 사유 .* → 삭제$/.test(c)))return {...r,action:'삭제',changes:['목록에서 뺌 · 복원 가능']};
 if(r.key==='purchases'&&r.action==='수정'&&ch.length===1&&ch[0]==='세부 내용 변경')return {...r,action:'삭제',changes:['목록에서 뺌 · 복원 가능']};
 if(r.key==='settings'&&r.action==='수정'&&ch.length&&ch.every(c=>c==='trash 변경'||c==='hidden 변경')){
  if(ch.includes('hidden 변경'))return {...r,action:'삭제',label:'거래처·품목 숨김',changes:['목록에서 숨김 · 지난 기록은 그대로']};
  return null;
 }
 return r;
}
export function logEntry(key,before,after,{who='',ref={},at=new Date().toISOString(),id=crypto.randomUUID()}={}){
 const d=describeChange(key,before,after,ref);
 return d?{id,at,by:String(who||''),...d}:null;
}

// 매입(2단계): 매입 1건의 변화를 한 줄로. 금액·수량·상태처럼 화면에 보이는 값만.
function describePurchase(before,after,co){
 const B=new Map((before||[]).map(r=>[r.id,r])),A=new Map((after||[]).map(r=>[r.id,r]));
 const added=[...A.values()].find(r=>!B.has(r.id)),removed=[...B.values()].find(r=>!A.has(r.id)),changed=[...A.values()].find(r=>B.has(r.id)&&!same(r,B.get(r.id)));
 const row=added||changed||removed;if(!row)return null;
 const label=`매입 ${row.no||''} · ${row.vendor_id?co(row.vendor_id):'기초 재고'}`;
 const qty=list=>list.reduce((n,x)=>n+(Number(x.qty)||0),0);
 const base={key:'purchases',table:'매입',ref:row.id,label};
 if(added)return {...base,action:'추가',changes:[`${row.kind} · 품목 ${(row.lines||[]).length}건 · ${row.status}`]};
 if(removed)return {...base,action:'삭제',changes:[]};
 const b=B.get(row.id),a=row,changes=[];
 if(a.status!==b.status)changes.push(`상태 ${b.status} → ${a.status}`);
 for(const r of a.receipts||[]){const o=(b.receipts||[]).find(x=>x.id===r.id);
  if(!o)changes.push(`입고 계획 ${md(r.date)} ${num(qty(r.lines))}개`);
  else{if(r.posted_at&&!o.posted_at)changes.push(`입고 확정 ${md(r.date)} ${num(qty(r.lines))}개`);if(r.void_at&&!o.void_at)changes.push(`입고 취소 ${md(r.date)} ${num(qty(r.lines))}개${r.void_reason?` · ${short(r.void_reason)}`:''}`);}
 }
 for(const t of a.returns||[]){const o=(b.returns||[]).find(x=>x.id===t.id);if(!o)changes.push(`반품 ${md(t.date)} ${num(qty(t.lines))}개${t.reason?` · ${short(t.reason)}`:''}`);}
 for(const c of a.costs||[]){const o=(b.costs||[]).find(x=>x.id===c.id);if(!o)changes.push(`비용 추가: ${c.type} ${won(c.amount_krw)}`);else if(c.void_at&&!o.void_at)changes.push(`비용 취소: ${c.type} ${won(c.amount_krw)}`);}
 if((a.cost_runs||[]).length>(b.cost_runs||[]).length)changes.push('원가 확정');
 if(!same(a.lines,b.lines))changes.push(`품목 ${(b.lines||[]).length}건 → ${(a.lines||[]).length}건 · 수량 ${num(qty(b.lines||[]))} → ${num(qty(a.lines||[]))}`);
 if(a.vendor_id!==b.vendor_id)changes.push(`매입처 ${co(b.vendor_id)} → ${co(a.vendor_id)}`);
 if(a.date!==b.date)changes.push(`매입일 ${b.date} → ${a.date}`);
 if(!same(a.tax_invoice,b.tax_invoice))changes.push(`세금계산서 ${a.tax_invoice?.received?'받음':'안 받음'}`);
 if((a.memo||'')!==(b.memo||''))changes.push(`메모 ${short(b.memo)} → ${short(a.memo)}`);
 if(!changes.length)changes.push('세부 내용 변경');
 // 매입 '삭제'(보관: removed_at)와 그 복원
 if(a.removed_at&&!b.removed_at)return {...base,action:'삭제',changes:['목록에서 뺌 · 복원 가능']};
 if(b.removed_at&&!a.removed_at)return {...base,action:'복원',changes:[`상태 → ${a.status}`]};
 return {...base,action:a.status==='취소'&&b.status!=='취소'?'취소':'수정',changes:changes.slice(0,12)};
}
