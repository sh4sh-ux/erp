// 수입 매입 붙여넣기(10/17 시안 확정, UI-RULES 'Import purchase paste').
// 영수증 앱과 같은 방식: 앱은 밖으로 아무것도 보내지 않는다. 사용자가 수입신고필증(+ 운송사·관세사 청구서)을
// 무료 AI에 이 프롬프트와 함께 올려 정해진 형식으로 정리받고, 그 글을 붙여 넣으면 여기서 읽는다(순수 함수 — 저장·화면 없음).
export const IMPORT_PROMPT=`첨부한 수입신고필증(필수)과 운송사·관세사 청구서(있으면)를 읽고, 아래 형식 그대로만 답해 주세요. 설명·인사말은 쓰지 마세요.
숫자는 쉼표 없이 쓰고, 문서에 없는 칸은 '없음'이라고 쓰세요. 품목은 필증의 란(품명·규격)마다 한 줄입니다.

[수입신고필증]
신고번호:
신고일: (YYYY-MM-DD)
수리일: (YYYY-MM-DD)
B/L:
매입처: (무역거래처 상호)
결제: (인도조건 통화 금액 결제방법, 예: FOB CNY 14800 TT)
과세환율:
품목 | 수량 | 단위 | 단가 | 금액 | 세번 | 관세 | 부가세
(품명) | (수량) | (PCS 등) | (외화 단가) | (외화 금액) | (세번부호) | (관세 원) | (부가세 원)
관세 합계:
부가세 합계:

[청구서]
청구처: (운송사·관세사 상호)
B/L:
청구일: (YYYY-MM-DD)
항목 | 통화 | 외화금액 | 원화금액 | 부가세
(항목명 그대로) | (KRW/USD) | (외화) | (원화) | (부가세 원, 없으면 0)
합계: (원화)`;

const INCOTERMS=['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DAT','DDP'];
const clean=s=>String(s??'').trim();
const none=s=>{const t=clean(s);return !t||/^(없음|-|n\/?a)$/i.test(t);};
export const num=s=>{if(none(s))return null;const t=clean(s).replace(/[,\s원₩]/g,'').replace(/^[A-Z]{3}/,'');const n=Number(t);return Number.isFinite(n)?n:null;};
export const day=s=>{const m=/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(clean(s));return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
const val=s=>none(s)?'':clean(s);
// "FOB CNY 14800 TT" → 인도조건 · 통화 · 금액 · 결제방법(순서가 바뀌어도 읽는다)
export function parsePay(s){
 const out={incoterms:'',currency:'',amount:null,pay_method:''},rest=[];
 for(const t of clean(s).replace(/,/g,'').split(/[\s-]+/).filter(Boolean)){
  const u=t.toUpperCase();
  if(!out.incoterms&&INCOTERMS.includes(u))out.incoterms=u;
  else if(!out.currency&&/^[A-Z]{3}$/.test(u)&&u!=='TT')out.currency=u;
  else if(out.amount===null&&Number.isFinite(Number(t)))out.amount=Number(t);
  else rest.push(t);
 }
 out.pay_method=rest.join(' ').replace(/^T\/?T$/i,'TT');
 return out;
}
const cells=line=>line.split('|').map(clean);
const isHead=c=>/^(품목|품명|항목|description)$/i.test(c[0]||'');
// 붙여넣은 글 → {decl, inv}. 형식이 조금 달라도(앞뒤 설명, 굵은 글씨 표시, 표 구분선) 읽는다.
export function parseImportPaste(text){
 const decl={no:'',declared_on:'',accepted_on:'',bl:'',vendor:'',incoterms:'',currency:'',amount:null,pay_method:'',customs_rate:null,lines:[],duty_total:null,vat_total:null};
 const inv={payee:'',bl:'',date:'',items:[],total:null};
 let sec=null,seen={decl:false,inv:false};
 // 표 머리 줄로 칸 순서를 정한다(AI가 '단위' 칸을 빼먹거나 순서를 바꿔도 읽도록). 머리가 없으면 프롬프트 순서.
 const DH={name:/^(품목|품명)/,qty:/^수량/,unit:/^단위/,price:/^단가/,amount:/^금액/,hs:/^(세번|HS)/i,duty:/^관세/,vat:/^부가/};
 const IH={name:/^(항목|품목)/,currency:/^통화/,amount_fx:/^외화/,amount_krw:/^원화/,vat:/^부가/};
 let dCols=['name','qty','unit','price','amount','hs','duty','vat'],iCols=['name','currency','amount_fx','amount_krw','vat'];
 const colsOf=(c,H)=>c.map(h=>Object.keys(H).find(k=>H[k].test(h.replace(/\s/g,'')))||'');
 const kv=(k,v)=>{
  k=k.replace(/\s/g,'');
  if(sec==='decl'){
   if(k==='신고번호')decl.no=val(v);
   else if(k==='신고일')decl.declared_on=day(v);
   else if(k==='수리일')decl.accepted_on=day(v);
   else if(/^B\/?L/i.test(k))decl.bl=val(v);
   else if(k==='매입처'||k==='무역거래처')decl.vendor=val(v);
   else if(k==='결제'||k==='결제금액'){const p=parsePay(v);Object.assign(decl,{incoterms:p.incoterms,currency:p.currency,amount:p.amount,pay_method:p.pay_method});}
   else if(k==='과세환율'||k==='환율')decl.customs_rate=num(v);
   else if(k==='관세합계')decl.duty_total=num(v);
   else if(k==='부가세합계')decl.vat_total=num(v);
  }else{
   if(k==='청구처')inv.payee=val(v);
   else if(/^B\/?L/i.test(k))inv.bl=val(v);
   else if(k==='청구일')inv.date=day(v);
   else if(k==='합계')inv.total=num(v);
  }
 };
 const KV=/^([^:：|]{1,20})[:：]\s*(.*)$/;
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.replace(/\*\*/g,'').replace(/^[#>\s-]+(?=\[)/,'').trim();
  if(!line||/^\|?\s*:?-{3,}/.test(line))continue;
  if(/^\[?\s*수입\s*신고\s*필증\s*\]?$/.test(line)){sec='decl';seen.decl=true;continue;}
  if(/^\[?\s*(청구서|운송사.*청구서|관세사.*청구서|invoice)\s*\]?$/i.test(line)){sec='inv';seen.inv=true;continue;}
  if(!sec)continue;
  if(line.includes('|')){
   const c=cells(line.replace(/^\||\|$/g,''));
   // '신고번호: … | 신고일: …'처럼 한 줄에 여러 칸을 쓴 경우
   if(c.every(x=>KV.test(x))){for(const x of c){const m=KV.exec(x);kv(m[1],m[2]);}continue;}
   if(isHead(c)){if(sec==='decl')dCols=colsOf(c,DH);else iCols=colsOf(c,IH);continue;}
   const row=cols=>Object.fromEntries(cols.map((k,i)=>[k,c[i]]).filter(([k])=>k));
   if(sec==='decl'&&c.length>=4){
    const r=row(dCols);
    decl.lines.push({name:val(r.name),qty:num(r.qty),unit:val(r.unit),price:num(r.price),amount:num(r.amount),hs:val(r.hs),duty:num(r.duty),vat:num(r.vat)});
   }else if(sec==='inv'&&c.length>=3){
    const r=row(iCols);
    inv.items.push({name:val(r.name),currency:val(r.currency).toUpperCase()||'KRW',amount_fx:num(r.amount_fx),amount_krw:num(r.amount_krw),vat:num(r.vat)||0});
   }
   continue;
  }
  const m=KV.exec(line);if(m)kv(m[1],m[2]);
 }
 return {decl,inv:seen.inv&&(inv.items.length||inv.payee)?inv:null,found:seen.decl};
}
// 청구서 항목 이름 → 앱의 비용 구분. 부가세는 원가가 아니라 따로(수입부가세).
export function costTypeOf(name){
 const n=clean(name).toUpperCase();
 if(/부가세|부가가치세|\bVAT\b/.test(n))return 'import_vat';
 if(/관세(?!사)|\bDUTY\b|TARIFF/.test(n))return '관세';
 if(/통관|CUSTOMS?\s*(CLEARANCE|CHARGE|FEE)|CUSTOM\s*CHARGE|관세사/.test(n))return '통관수수료';
 if(/보험|INSURANCE/.test(n))return '보험';
 if(/내륙|국내|운송료|TRUCK|DELIVERY|DRAYAGE|INLAND/.test(n))return '국내운송';
 if(/FREIGHT|운임|CAF|BAF|유류|할증|SURCHARGE|THC|해상|항공/.test(n))return '운임';
 return '기타';
}
const B=s=>clean(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
const near=(a,b,eps)=>a!==null&&b!==null&&Math.abs(a-b)<=eps;
// 확인 창의 검사 줄. ok=false인 것 중 block=true면 [매입 만들기]를 막는다.
export function checkImport({decl,inv}){
 const out=[],sumBy=k=>decl.lines.reduce((s,l)=>s+(Number(l[k])||0),0);
 const lineSum=Math.round(sumBy('amount')*100)/100;
 if(!decl.lines.length)out.push({ok:false,block:true,text:'필증 품목을 읽지 못했어요. AI 답에 품목 표가 있는지 확인해 주세요.'});
 if(!decl.currency)out.push({ok:false,block:true,text:'결제 통화를 읽지 못했어요(예: FOB CNY 14800 TT).'});
 if(!(decl.customs_rate>0))out.push({ok:false,block:true,text:'과세환율을 읽지 못했어요.'});
 const badQty=decl.lines.filter(l=>!(Number.isInteger(l.qty)&&l.qty>0));
 if(badQty.length)out.push({ok:false,block:true,text:`수량이 비었거나 정수가 아닌 품목이 있어요: ${badQty.map(l=>l.name||'이름 없음').join(', ')}`});
 const badRow=decl.lines.filter(l=>l.qty>0&&l.price!==null&&l.amount!==null&&!near(l.qty*l.price,l.amount,0.011));
 if(badRow.length)out.push({ok:false,block:false,text:`수량 × 단가 ≠ 금액인 줄이 있어요: ${badRow.map(l=>l.name).join(', ')}`});
 if(decl.amount!==null&&decl.lines.length)out.push(near(lineSum,decl.amount,0.011)?{ok:true,text:`품목 금액 합계 ${decl.currency} ${lineSum.toLocaleString('ko-KR',{maximumFractionDigits:2})} = 필증 결제금액`}:{ok:false,block:false,text:`품목 금액 합계(${lineSum.toLocaleString('ko-KR',{maximumFractionDigits:2})})와 필증 결제금액(${decl.amount.toLocaleString('ko-KR',{maximumFractionDigits:2})})이 달라요`});
 const dSum=sumBy('duty'),vSum=sumBy('vat');
 // 란별 세액은 원 단위로 끊어 신고해 합계와 몇 원 다를 수 있다 → 품목 수만큼 허용
 const tol=Math.max(5,decl.lines.length*5);
 if(decl.duty_total!==null||decl.vat_total!==null){
  const dOk=decl.duty_total===null||near(dSum,decl.duty_total,tol),vOk=decl.vat_total===null||near(vSum,decl.vat_total,tol);
  out.push(dOk&&vOk?{ok:true,text:`관세 · 부가세 합계 = 필증 세액(관세 ${Math.round(decl.duty_total??dSum).toLocaleString('ko-KR')} · 부가세 ${Math.round(decl.vat_total??vSum).toLocaleString('ko-KR')})`}:{ok:false,block:false,text:'품목별 관세·부가세 합계가 필증 합계와 달라요 — 합계 줄 값을 써요'});
 }
 if(inv){
  if(decl.bl&&inv.bl)out.push(B(decl.bl)===B(inv.bl)?{ok:true,text:`필증 B/L = 청구서 B/L (${decl.bl})`}:{ok:false,block:true,text:`필증과 청구서가 다른 건이에요(필증 B/L ${decl.bl} · 청구서 B/L ${inv.bl})`});
  const invDuty=inv.items.filter(x=>costTypeOf(x.name)==='관세').reduce((s,x)=>s+(x.amount_krw||0),0);
  const declDuty=decl.duty_total??dSum;
  if(invDuty&&!near(invDuty,declDuty,tol))out.push({ok:false,block:false,text:`청구서 관세 ${invDuty.toLocaleString('ko-KR')}원 ≠ 필증 관세 ${Math.round(declDuty).toLocaleString('ko-KR')}원 — 원가는 필증 기준`});
  if(inv.total!==null){const s=inv.items.reduce((a,x)=>a+(x.amount_krw||0)+(x.vat||0),0);if(!near(s,inv.total,2))out.push({ok:false,block:false,text:`청구서 항목 합계(${s.toLocaleString('ko-KR')}원)와 청구서 합계(${inv.total.toLocaleString('ko-KR')}원)가 달라요`});}
 }
 return out;
}
// 매입 1건을 만들 재료(품목 짝·낸 곳은 화면에서 고른다). 관세는 필증 기준(결정 ④), 매입 환율 = 과세환율(결정 ②), 나눔 기준 = 금액(결정 ③).
// types[i]: 청구서 i번째 항목의 구분을 화면에서 바꾼 값('skip'이면 넣지 않음). 비우면 costTypeOf.
export function importDraft({decl,inv},{uid,vendor_id,payee_id,map,date,types=[]}){
 const lines=decl.lines.map((l,i)=>{const m=map[i]||{};return {id:'l'+uid(),item_id:m.item_id||'',...(m.color?{color:m.color}:{}),...(m.spec?{spec:m.spec}:{}),qty:l.qty,unit_price:l.price??(l.qty?Math.round(l.amount/l.qty*100)/100:0),...(l.name?{src_name:l.name}:{}),...(l.hs?{hs:l.hs}:{})};});
 const dutyTotal=Math.round(decl.duty_total??decl.lines.reduce((s,l)=>s+(l.duty||0),0));
 const vatTotal=Math.round(decl.vat_total??decl.lines.reduce((s,l)=>s+(l.vat||0),0));
 const costs=[];
 const add=(type,amount,extra={})=>{if(amount>0)costs.push({id:'c'+uid(),type,amount_krw:Math.round(amount),alloc:'금액',...(payee_id&&inv?{payee_id}:{}),...extra});};
 add('관세',dutyTotal);
 const groups={};
 const typeAt=i=>types[i]||costTypeOf(inv.items[i].name);
 (inv?.items||[]).forEach((x,i)=>{const t=typeAt(i);if(t==='관세'||t==='import_vat'||t==='skip')return;(groups[t]=groups[t]||[]).push(x);});
 for(const t of ['운임','보험','통관수수료','국내운송','기타'])if(groups[t])add(t,groups[t].reduce((s,x)=>s+(x.amount_krw||0),0));
 const feeVat=Math.round((inv?.items||[]).filter((x,i)=>!['import_vat','skip'].includes(typeAt(i))).reduce((s,x)=>s+(x.vat||0),0));
 const customs=Object.fromEntries(Object.entries({declaration_no:decl.no,bl_no:decl.bl,incoterms:decl.incoterms,pay_method:decl.pay_method,declared_on:decl.declared_on,accepted_on:decl.accepted_on}).filter(([,v])=>v));
 return {kind:'수입',vendor_id,date:date||decl.declared_on,currency:decl.currency,fx:{booking_rate:decl.customs_rate,customs_rate:decl.customs_rate},lines,costs,
  import_vat:{amount:vatTotal,...(payee_id&&inv?{payee_id}:{}),...(feeVat?{fee_vat:feeVat}:{})},customs};
}
// 같은 매입처의 지난 수입 매입에서 필증 품명 → 품목 짝을 찾는다(결정 ⑤ — 따로 저장하지 않고 줄의 src_name에서 읽는다).
export function rememberedMap(rows,vendor_id,names){
 const key=s=>clean(s).toUpperCase().replace(/\s+/g,' ');
 const seen=new Map();
 for(const p of [...(rows||[])].filter(p=>p.kind==='수입'&&p.vendor_id===vendor_id&&!p.removed_at).sort((a,b)=>String(a.date).localeCompare(String(b.date))))
  for(const l of p.lines||[])if(l.src_name)seen.set(key(l.src_name),{item_id:l.item_id,color:l.color||'',spec:l.spec||''});
 return names.map(n=>seen.get(key(n))||null);
}
