// 매입 2단계 저장 흐름 테스트: 반품 · 입고 취소 · 매입 취소 · 여러 기기 · 끊김 · 취소 뒤 재고·원가·지급 일관성. 가짜 Dropbox만 사용.
import test from 'node:test';import assert from 'node:assert/strict';
import {emptyData} from '../personal-cloud-onboarding/core.mjs';
import {validatePurchasesChange,returnMoveId,voidMoveId,stockMoveId} from '../personal-cloud-onboarding/purchase-contract.mjs';
import {costLedger,paymentStatus,optionKey,impact} from './purchase-ledger.mjs';
import {planReceipt,planReturn,postReceipt,postReturn,voidReceipt,unfinished,receiptState} from './purchase-saga.mjs';
import {AT,base,domestic,doc,fakeDropbox,open,snap7} from './purchase-fixtures.mjs';
const V=e=>e.code==='VALIDATION';
async function ready(seed={}){
 const fake=fakeDropbox({...emptyData(),...base(),...seed}),dev=await open(fake);await dev.repo.loadPurchases();await dev.repo.startPurchases();
 await dev.repo.savePurchases(doc([domestic()]));
 return {fake,...dev,io:io(dev.repo)};
}
const io=repo=>({getDoc:()=>repo.loadPurchasesDoc(),getStock:()=>repo.loadCollection('stock_moves'),savePurchases:d=>repo.savePurchases(d),saveStock:rows=>repo.saveTable('stock_moves',rows)});
const receive=(x,lines=[{line_id:'l1',qty:20},{line_id:'l2',qty:30}],id='r1')=>postReceipt(x.io,'p1',{receiptId:id,date:'2026-10-10',lines,at:AT});

test('반품: 입고 수량까지만, 번호 고정, 재고 출고 + 지급할 금액 줄어듦, 매출 원가에 안 섞임',async()=>{
 const x=await ready();await receive(x);
 await postReturn(x.io,'p1',{returnId:'t1',date:'2026-10-11',lines:[{line_id:'l1',qty:5}],reason:'불량',at:AT});
 const st=x.repo.loadCollection('stock_moves');assert.ok(st.some(m=>m.id===returnMoveId('t1','l1')&&m.kind==='출고'&&m.qty===5));
 const p=x.repo.loadPurchasesDoc().rows[0];
 const L=costLedger({stock_moves:st,purchases:x.repo.loadPurchasesDoc()});
 assert.equal(L.outflows.length,0); // 반품은 매출 원가(출고 원가)가 아님
 assert.equal(L.options.find(o=>o.key===optionKey('jk','BK','S')).qty,15);
 const due=paymentStatus(p,[]).due;assert.equal(due,Math.round((210000-21000)*1.1)); // 20×4,200 중 5개(21,000원) 반품, 부가세도 비율대로
 // 입고보다 많이 반품 불가
 const over=planReturn(p,{returnId:'t2',date:'2026-10-12',lines:[{line_id:'l1',qty:16}],at:AT});
 await assert.rejects(x.repo.savePurchases({...x.repo.loadPurchasesDoc(),rows:[over]}),V);
 // 같은 반품 다시 실행해도 한 번만
 assert.equal(await postReturn(x.io,'p1',{returnId:'t1',date:'2026-10-11',lines:[{line_id:'l1',qty:5}],reason:'불량',at:AT}),'posted');
 assert.equal(x.repo.loadCollection('stock_moves').filter(m=>m.return_id==='t1').length,1);
});
test('반품 저장이 재고 단계에서 끊겨도 이어서 한 번만',async()=>{
 const x=await ready();await receive(x);
 x.fake.loseNextResponse(path=>/stock_moves/.test(path));
 await assert.rejects(postReturn(x.io,'p1',{returnId:'t1',date:'2026-10-11',lines:[{line_id:'l2',qty:3}],at:AT}),{code:'SAVE_UNCONFIRMED'});
 await x.repo.saveTable('stock_moves',null,{recover:true}); // 지금 앱의 '저장 결과 확인'
 assert.equal(unfinished(x.repo.loadPurchasesDoc(),x.repo.loadCollection('stock_moves')).length,1);
 await postReturn(x.io,'p1',{returnId:'t1',date:'2026-10-11',lines:[{line_id:'l2',qty:3}],at:AT});
 assert.equal(x.repo.loadCollection('stock_moves').filter(m=>m.return_id==='t1').length,1);
 assert.equal(unfinished(x.repo.loadPurchasesDoc(),x.repo.loadCollection('stock_moves')).length,0);
});
test('입고 취소: 지금 재고 규칙(취소 표시 + 반대 기록)으로, 재고·원가 0으로 돌아오고 매입은 다시 입고 가능',async()=>{
 const x=await ready();await receive(x);
 const before=x.repo.loadCollection('stock_moves');
 assert.equal(await voidReceipt(x.io,'p1','r1',{reason:'수량 착오',at:AT}),'void');
 const st=x.repo.loadCollection('stock_moves');
 assert.equal(st.length,before.length+2);
 assert.ok(st.find(m=>m.id===stockMoveId('r1','l1')).cancelled_at);
 assert.ok(st.some(m=>m.id===voidMoveId('r1','l1')&&m.reversal_of===stockMoveId('r1','l1')));
 const L=costLedger({stock_moves:st,purchases:x.repo.loadPurchasesDoc()});
 for(const k of [optionKey('jk','BK','S'),optionKey('jk','BK','M')]){const o=L.options.find(z=>z.key===k);assert.equal(o.qty,0);assert.equal(o.value,0);}
 assert.equal(receiptState(x.repo.loadPurchasesDoc().rows[0].receipts[0],new Set(st.map(m=>m.id))),'void');
 // 취소한 만큼 다시 입고할 수 있다(주문 수량 안에서)
 assert.equal(await receive(x,[{line_id:'l1',qty:20}],'r2'),'posted');
 // 같은 취소를 또 해도 아무것도 더하지 않음
 await voidReceipt(x.io,'p1','r1',{reason:'수량 착오',at:AT});assert.equal(x.repo.loadCollection('stock_moves').length,st.length+1);
});
test('입고 취소가 줄 사이에서 끊기면 voiding으로 표시되고 이어서 마무리',async()=>{
 const x=await ready();await receive(x);
 let n=0;const flaky={...x.io,saveStock:async rows=>{if(++n===2)throw Object.assign(Error('x'),{code:'NETWORK_ERROR'});return x.repo.saveTable('stock_moves',rows);}};
 await assert.rejects(voidReceipt(flaky,'p1','r1',{reason:'착오',at:AT}));
 assert.deepEqual(unfinished(x.repo.loadPurchasesDoc(),x.repo.loadCollection('stock_moves')).map(u=>u.state),['voiding']);
 await voidReceipt(x.io,'p1','r1',{reason:'착오',at:AT});
 assert.equal(unfinished(x.repo.loadPurchasesDoc(),x.repo.loadCollection('stock_moves')).length,0);
});
test('매입 취소: 입고가 남아 있으면 불가, 모두 취소한 뒤 가능 · 지급이 있으면 환불(수금) 기록으로 맞춤',async()=>{
 const x=await ready();await receive(x);
 const pay={id:'y1',company_id:'v1',kind:'지급',method:'계좌',amount:100000,date:'2026-10-11',purchase_id:'p1',client_ref:'a'};
 await x.repo.saveTable('payments',[pay]);
 let p=x.repo.loadPurchasesDoc().rows[0];
 await assert.rejects(x.repo.savePurchases({...x.repo.loadPurchasesDoc(),rows:[{...p,status:'취소'}]}),V);
 await voidReceipt(x.io,'p1','r1',{reason:'거래 취소',at:AT});
 p=x.repo.loadPurchasesDoc().rows[0];await x.repo.savePurchases({...x.repo.loadPurchasesDoc(),rows:[{...p,status:'취소',updated_at:AT}]});
 await x.repo.saveTable('payments',[pay,{id:'y2',company_id:'v1',kind:'수금',refund:true,method:'계좌',amount:100000,date:'2026-10-12',purchase_id:'p1',client_ref:'b'}]);
 const s=paymentStatus(x.repo.loadPurchasesDoc().rows[0],x.repo.loadCollection('payments'));assert.equal(s.paid,0);
 const L=costLedger({stock_moves:x.repo.loadCollection('stock_moves'),purchases:x.repo.loadPurchasesDoc()});
 assert.ok(L.options.every(o=>o.qty===0&&o.value===0));
});
test('여러 기기가 같은 매입을 고치면 나중 저장은 거절(덮어쓰지 않음) → 다시 불러오면 앞 기기 내용',async()=>{
 const x=await ready();const B=await open(x.fake);await B.repo.loadPurchases();
 const A1={...x.repo.loadPurchasesDoc()};A1.rows=[{...A1.rows[0],memo:'A 기기 메모',updated_at:AT}];await x.repo.savePurchases(A1);
 const B1={...B.repo.loadPurchasesDoc()};B1.rows=[{...B1.rows[0],memo:'B 기기 메모',updated_at:AT}];
 await assert.rejects(B.repo.savePurchases(B1),{code:'STORAGE_CONFLICT'});
 await B.repo.loadAll();await B.repo.loadPurchases();assert.equal(B.repo.loadPurchasesDoc().rows[0].memo,'A 기기 메모');
});
test('두 기기가 같은 입고를 동시에: 하나만 계획 저장 → 재고는 한 번만',async()=>{
 const x=await ready();const B=await open(x.fake);await B.repo.loadPurchases();
 await receive(x); // A가 먼저 입고 완료
 await assert.rejects(postReceipt(io(B.repo),'p1',{receiptId:'rB',date:'2026-10-10',lines:[{line_id:'l1',qty:20}],at:AT}),{code:'STORAGE_CONFLICT'});
 await B.repo.loadAll();await B.repo.loadPurchases();
 // 다시 시도해도 주문 수량 초과라 거절 → 중복 입고 없음
 await assert.rejects(postReceipt(io(B.repo),'p1',{receiptId:'rB',date:'2026-10-10',lines:[{line_id:'l1',qty:20}],at:AT}),V);
 assert.equal(B.repo.loadCollection('stock_moves').filter(m=>m.purchase_id==='p1').length,2);
});
test('입고·반품·취소를 거쳐도 7개 파일 중 재고·입출금만 바뀌고, 지난 출고 원가는 그대로',async()=>{
 const x=await ready({stock_moves:[]});const s0=snap7(x.fake);
 await receive(x);
 await x.repo.saveTable('stock_moves',[...x.repo.loadCollection('stock_moves'),{id:'o1',item_id:'jk',color:'BK',spec:'S',kind:'출고',qty:4,date:'2026-10-12'}]);
 const L1=costLedger({stock_moves:x.repo.loadCollection('stock_moves'),purchases:x.repo.loadPurchasesDoc()});
 await postReturn(x.io,'p1',{returnId:'t1',date:'2026-10-13',lines:[{line_id:'l2',qty:10}],at:AT});
 const L2=costLedger({stock_moves:x.repo.loadCollection('stock_moves'),purchases:x.repo.loadPurchasesDoc()});
 assert.deepEqual(impact(L1,L2).changedOutflows,[]);
 const s1=snap7(x.fake);['companies','items','quotes','payments','material_moves','settings'].forEach(k=>{const i=['companies','items','quotes','payments','stock_moves','material_moves','settings'].indexOf(k);assert.equal(s1[i],s0[i],k);});
});
