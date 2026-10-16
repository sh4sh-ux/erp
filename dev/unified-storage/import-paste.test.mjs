// 수입 매입 붙여넣기 — AI가 정리한 글(시험용 이름·숫자)을 읽어 검사하고 매입 1건 재료를 만든다. 밖으로 아무것도 보내지 않는다.
import test from 'node:test';import assert from 'node:assert/strict';
import {IMPORT_PROMPT,parseImportPaste,parsePay,costTypeOf,checkImport,importDraft,rememberedMap,rememberedTypes,num,day} from './import-paste.mjs';
import {validatePurchasesChange} from '../personal-cloud-onboarding/purchase-contract.mjs';
import {unitCosts,paymentStatus} from './purchase-ledger.mjs';
import {AT,base,doc} from './purchase-fixtures.mjs';

const PASTE=`네, 정리했습니다.
**[수입신고필증]**
신고번호: 12345-26-000001M
신고일: 2026-01-19
수리일: 2026.01.20
B/L: TEST260119A
매입처: (시험) 이우 무역
결제: FOB CNY 14,800 T/T
과세환율: 210.67
| 품목 | 수량 | 단위 | 단가 | 금액 | 세번 | 관세 | 부가세 |
|---|---|---|---|---|---|---|---|
| CHEF JACKET | 200 | PCS | 70 | 14000 | 6211.33-1000 | 387029 | 336418 |
| CHEF PANTS | 20 | PCS | 40 | 800 | 6104.63-0000 | 22111 | 19222 |
관세 합계: 409140
부가세 합계: 355640

[청구서]
청구처: (시험) 바다 해운
B/L: TEST-260119A
청구일: 2026-01-21
항목 | 통화 | 외화금액 | 원화금액 | 부가세
OCEAN FREIGHT | USD | 72 | 105397 | 0
CAF | USD | 20 | 28000 | 0
DOCUMENT FEE | KRW | 없음 | 25000 | 2500
CHINA CUSTOM CHARGE | KRW | 없음 | 70000 | 7000
내륙 운송료 | KRW | 없음 | 80000 | 4000
관세 | KRW | 없음 | 409140 | 0
부가세 | KRW | 없음 | 355640 | 0
합계: 1086677`;

test('프롬프트: 두 문서의 칸과 표 머리를 고정한다',()=>{
 for(const k of ['[수입신고필증]','신고번호:','B/L:','과세환율:','품목 | 수량 | 단위 | 단가 | 금액 | 세번 | 관세 | 부가세','[청구서]','청구처:','항목 | 통화 | 외화금액 | 원화금액 | 부가세','합계:'])assert.ok(IMPORT_PROMPT.includes(k),k);
});
test('숫자·날짜·결제 조건 읽기',()=>{
 assert.equal(num('14,800'),14800);assert.equal(num('없음'),null);assert.equal(num('1,234원'),1234);assert.equal(num('-2,400'),-2400);
 assert.equal(day('2026.1.9'),'2026-01-09');assert.equal(day('2026년 1월 20일'),'2026-01-20');assert.equal(day('없음'),'');
 assert.deepEqual(parsePay('FOB CNY 14,800 T/T'),{incoterms:'FOB',currency:'CNY',amount:14800,pay_method:'TT'});
 assert.deepEqual(parsePay('CNY 14800 TT CIF'),{incoterms:'CIF',currency:'CNY',amount:14800,pay_method:'TT'});
});
test('붙여넣은 글 읽기: 앞뒤 설명·굵은 글씨·표 구분선은 건너뛴다',()=>{
 const {decl,inv,found}=parseImportPaste(PASTE);
 assert.equal(found,true);
 assert.equal(decl.no,'12345-26-000001M');assert.equal(decl.accepted_on,'2026-01-20');assert.equal(decl.vendor,'(시험) 이우 무역');
 assert.equal(decl.currency,'CNY');assert.equal(decl.amount,14800);assert.equal(decl.customs_rate,210.67);
 assert.equal(decl.lines.length,2);assert.deepEqual(decl.lines[1],{name:'CHEF PANTS',qty:20,unit:'PCS',price:40,amount:800,hs:'6104.63-0000',duty:22111,vat:19222});
 assert.equal(inv.payee,'(시험) 바다 해운');assert.equal(inv.items.length,7);assert.equal(inv.items[2].amount_fx,null);assert.equal(inv.total,1086677);
});
test('한 줄에 여러 칸, 단위 칸이 빠진 표도 읽는다',()=>{
 const {decl,inv}=parseImportPaste(`[수입신고필증]
신고번호: 1-2 | 신고일: 2026-01-19 | B/L: X1 | 결제: FOB CNY 1000 TT | 과세환율: 200
품목 | 수량 | 단가 | 금액 | 세번 | 관세 | 부가세
A | 10 | 100 | 1000 | 1 | 10000 | 21000`);
 assert.equal(decl.no,'1-2');assert.equal(decl.bl,'X1');assert.equal(decl.customs_rate,200);
 assert.deepEqual(decl.lines[0],{name:'A',qty:10,unit:'',price:100,amount:1000,hs:'1',duty:10000,vat:21000});
 assert.equal(inv,null);
});
test('청구서 항목 → 비용 구분',()=>{
 const t=n=>costTypeOf(n);
 assert.equal(t('OCEAN FREIGHT'),'운임');assert.equal(t('CAF'),'운임');assert.equal(t('BAF 유류할증'),'운임');
 assert.equal(t('INSURANCE'),'보험');assert.equal(t('CHINA CUSTOM CHARGE'),'통관수수료');assert.equal(t('통관수수료'),'통관수수료');assert.equal(t('관세사 수수료'),'통관수수료');
 assert.equal(t('내륙 운송료'),'국내운송');assert.equal(t('TRUCKING'),'국내운송');
 assert.equal(t('관세'),'관세');assert.equal(t('부가세'),'import_vat');assert.equal(t('DOCUMENT FEE'),'운임');assert.equal(t('MISC'),'기타');
});
test('검사: 정상 건은 막는 것 없음, B/L은 기호를 빼고 비교',()=>{
 const out=checkImport(parseImportPaste(PASTE));
 assert.equal(out.filter(x=>!x.ok).length,0,JSON.stringify(out));
 assert.ok(out.some(x=>x.ok&&/B\/L/.test(x.text)));
});
test('검사: 다른 건의 청구서는 막고, 관세가 다르면 필증 기준 경고',()=>{
 const other=checkImport(parseImportPaste(PASTE.replace('B/L: TEST-260119A','B/L: OTHER999')));
 assert.ok(other.some(x=>!x.ok&&x.block&&/다른 건/.test(x.text)));
 const duty=checkImport(parseImportPaste(PASTE.replace('관세 | KRW | 없음 | 409140','관세 | KRW | 없음 | 400000').replace('합계: 1086677','합계: 1077537')));
 const w=duty.find(x=>!x.ok&&/필증 기준/.test(x.text));assert.ok(w);assert.equal(w.block,false);
 const bad=checkImport(parseImportPaste(PASTE.replace('| CHEF PANTS | 20 |','| CHEF PANTS | 2.5 |')));
 assert.ok(bad.some(x=>x.block&&/정수/.test(x.text)));
 assert.ok(checkImport(parseImportPaste('그냥 글')).some(x=>x.block));
});
test('매입 재료: 과세환율 · 필증 관세 · 금액 나눔 · 수입부가세와 수수료 부가세는 원가 밖',()=>{
 const s=base();s.companies.push({id:'f2',name:'(시험) 바다 해운',type:'매입',prices:[]});
 let n=0;const parsed=parseImportPaste(PASTE.replace('관세 | KRW | 없음 | 409140','관세 | KRW | 없음 | 400000'));
 const d=importDraft(parsed,{uid:()=>String(++n),vendor_id:'v2',payee_id:'f2',map:[{item_id:'jk',color:'WH'},{item_id:'ap'}]});
 assert.deepEqual(d.fx,{booking_rate:210.67,customs_rate:210.67});assert.equal(d.currency,'CNY');assert.equal(d.date,'2026-01-19');
 assert.deepEqual(d.costs.map(c=>[c.type,c.amount_krw]),[['관세',409140],['운임',158397],['통관수수료',70000],['국내운송',80000]]);
 assert.ok(d.costs.every(c=>c.alloc==='금액'&&c.payee_id==='f2'));
 assert.deepEqual(d.import_vat,{amount:355640,payee_id:'f2',fee_vat:13500});
 assert.deepEqual(d.customs,{declaration_no:'12345-26-000001M',bl_no:'TEST260119A',incoterms:'FOB',pay_method:'TT',declared_on:'2026-01-19',accepted_on:'2026-01-20'});
 assert.equal(d.lines[0].src_name,'CHEF JACKET');assert.equal(d.lines[0].hs,'6211.33-1000');assert.equal(d.lines[0].color,'WH');
 const p={id:'p9',no:'IM-2026-0119-1',status:'작성중',receipts:[],cost_runs:[],created_at:AT,updated_at:AT,...d};
 assert.equal(validatePurchasesChange(doc([]),doc([p]),s).rows.length,1);
 const u=unitCosts(p);
 assert.equal(u[p.lines[0].id].unit,18140.67);assert.equal(u[p.lines[1].id].unit,10366);
 assert.equal(paymentStatus(p,[]).costs.find(c=>c.payee_id==='f2').due,1086677); // 청구서 합계 = 운송사에 갚을 돈
});
test('품명 짝 기억: 같은 매입처의 지난 수입 매입에서 최근 짝',()=>{
 const rows=[
  {kind:'수입',vendor_id:'v2',date:'2026-01-01',lines:[{item_id:'ap',src_name:'chef  jacket'}]},
  {kind:'수입',vendor_id:'v2',date:'2026-02-01',lines:[{item_id:'jk',color:'WH',src_name:'CHEF JACKET'}]},
  {kind:'수입',vendor_id:'v1',date:'2026-03-01',lines:[{item_id:'ch',src_name:'CHEF PANTS'}]},
  {kind:'수입',vendor_id:'v2',date:'2026-04-01',removed_at:AT,lines:[{item_id:'ch',src_name:'CHEF JACKET'}]}];
 assert.deepEqual(rememberedMap(rows,'v2',['CHEF JACKET','CHEF PANTS']),[{item_id:'jk',color:'WH'},null]);
});
test('AI가 덧붙인 합계 줄·자리 표시 줄은 품목·청구 항목으로 넣지 않는다',()=>{
 const t=`[수입신고필증]
결제: USD14800 TT
과세환율: 1380.5
품목명 | 수량 | 단위 | 단가 | 금액 | 세번 | 관세 | 부가세
(품명) | (수량) | (PCS 등) | (외화 단가) | (외화 금액) | (세번부호) | (관세 원) | (부가세 원)
A | 10 | PCS | $100 | 1,000 | 1 | 10000 | 21000
**합계** | | | | 1000 | | 10000 | 21000
[청구서]
청구처: X
항목명 | 통화 | 외화금액 | 원화금액 | 부가세
FREIGHT | USD | 20 | 27610 | 0
합계 | | | 27610 | 0`;
 const r=parseImportPaste(t);
 assert.equal(r.decl.currency,'USD');assert.equal(r.decl.amount,14800);
 assert.equal(r.decl.lines.length,1);assert.equal(r.decl.lines[0].price,100);
 assert.equal(r.decl.duty_total,10000);assert.equal(r.decl.vat_total,21000);
 assert.equal(r.inv.items.length,1);assert.equal(r.inv.total,27610);
});
test('원화금액이 빈 청구서 항목은 막는다(넣지 않음으로 바꾸면 통과)',()=>{
 const p=parseImportPaste(PASTE.replace('OCEAN FREIGHT | USD | 72 | 105397 | 0','OCEAN FREIGHT | USD | 72 | 없음 | 0').replace('합계: 1086677','합계: 981280'));
 assert.ok(checkImport(p).some(x=>x.block&&/원화금액이 빈/.test(x.text)));
 assert.ok(!checkImport(p,['skip']).some(x=>/원화금액이 빈/.test(x.text)));
});
test('청구서에 관세·부가세가 없으면 세관에 직접 낸 것 — 운송사에 갚을 돈에 넣지 않는다',()=>{
 const s=base();s.companies.push({id:'f2',name:'(시험) 바다 해운',type:'매입',prices:[]});
 const lines=PASTE.split('\n').filter(l=>!/^관세 \||^부가세 \|/.test(l)).join('\n').replace('합계: 1086677','합계: 321897');
 let n=0;const d=importDraft(parseImportPaste(lines),{uid:()=>String(++n),vendor_id:'v2',payee_id:'f2',map:[{item_id:'jk'},{item_id:'ap'}]});
 const duty=d.costs.find(c=>c.type==='관세');assert.equal(duty.amount_krw,409140);assert.equal(duty.payee_id,undefined);
 assert.equal(d.import_vat.direct,true);
 const p={id:'p9',no:'IM-1',status:'작성중',receipts:[],cost_runs:[],created_at:AT,updated_at:AT,...d};
 assert.equal(validatePurchasesChange(doc([]),doc([p]),s).rows.length,1);
 // 운임 133,397 + 통관 70,000 + 국내운송 80,000 + 기타 25,000 + 수수료 부가세 13,500
 assert.equal(paymentStatus(p,[]).costs.find(c=>c.payee_id==='f2').due,321897);
 assert.throws(()=>validatePurchasesChange(doc([]),doc([{...p,import_vat:{...p.import_vat,direct:'yes'}}]),s),e=>e.code==='VALIDATION');
});
test('사이즈 나누기: 필증 한 줄 → 같은 단가의 매입 품목 여러 줄, 청구서 구분은 낸 곳별로 기억',()=>{
 const s=base();s.companies.push({id:'f2',name:'(시험) 바다 해운',type:'매입',prices:[]});
 let n=0;const parsed=parseImportPaste(PASTE);
 const d=importDraft(parsed,{uid:()=>String(++n),vendor_id:'v2',payee_id:'f2',map:[{item_id:'jk',color:'WH',parts:[{spec:'S',qty:120},{spec:'M',qty:80},{spec:'L',qty:0}]},{item_id:'ap'}],types:[undefined,undefined,'운임']});
 assert.deepEqual(d.lines.map(l=>[l.spec||'',l.qty,l.unit_price,l.src_name]),[['S',120,70,'CHEF JACKET'],['M',80,70,'CHEF JACKET'],['',20,40,'CHEF PANTS']]);
 assert.equal(d.invoice_map.find(x=>x.name==='DOCUMENT FEE').type,'운임');assert.equal(d.invoice_map.find(x=>x.name==='CAF').type,'운임');
 const p={id:'p9',no:'IM-1',status:'작성중',receipts:[],cost_runs:[],created_at:AT,updated_at:AT,...d};
 assert.equal(validatePurchasesChange(doc([]),doc([p]),s).rows.length,1);
 assert.deepEqual(rememberedTypes([p],'f2',['document fee','NEW ITEM']),['운임',null]);
 assert.throws(()=>validatePurchasesChange(doc([]),doc([{...p,invoice_map:[{name:'X',type:'아무거나'}]}]),s),e=>e.code==='VALIDATION');
});
test('사전 보강: 통화·유류 할증은 운임, CLEARANCE는 통관수수료',()=>{
 assert.equal(costTypeOf('CURRENCY ADJUSTMENT FACTOR CHARGE'),'운임');assert.equal(costTypeOf('BUNKER SURCHARGE'),'운임');assert.equal(costTypeOf('LSS'),'운임');
 assert.equal(costTypeOf('CUSTOMS CLEARANCE FEE'),'통관수수료');assert.equal(costTypeOf('DOCUMENT FEE'),'운임');assert.equal(costTypeOf('D/O FEE'),'운임');assert.equal(costTypeOf('DELIVERY ORDER FEE'),'운임');assert.equal(costTypeOf('INLAND DELIVERY'),'국내운송');assert.equal(costTypeOf('BANK CHARGE'),'기타');
});
