// 매입 1단계(데이터 구조·저장 안전성) 테스트 — 모두 메모리 속 가짜 Dropbox·가짜 데이터. 운영 데이터에 접속하지 않는다.
import test from 'node:test';import assert from 'node:assert/strict';
import {createDropboxBackend,PURCHASES_PATH} from '../personal-cloud-onboarding/dropbox-backend.mjs';
import {emptyData} from '../personal-cloud-onboarding/core.mjs';
import {validatePurchasesChange,validatePurchaseLinks,stockMoveId,emptyPurchases,capacity} from '../personal-cloud-onboarding/purchase-contract.mjs';
import {DropboxProvider,GoogleDriveProvider,createStorageRepository,keys} from './storage.mjs';
import {lineBase,allocate,unitCosts,split,costLedger,impact,itemAverage,runIssues,paymentStatus,optionKey} from './purchase-ledger.mjs';
import {planReceipt,receiptMoves,postReceipt,resume,unfinished,receiptState} from './purchase-saga.mjs';

import {AT,base,domestic,imported,doc,fakeDropbox,open,snap7} from './purchase-fixtures.mjs';
const V=e=>e.code==='VALIDATION';

// ─────────────── 저장 규칙 ───────────────
test('매입 시작: 빈 파일만, 저장 1번에 매입 1건, 번호 중복 불가',()=>{
 const s=base();
 assert.deepEqual(validatePurchasesChange(null,emptyPurchases(),s),emptyPurchases());
 assert.throws(()=>validatePurchasesChange(null,doc([domestic()]),s),V);
 const one=validatePurchasesChange(doc([]),doc([domestic()]),s);assert.equal(one.rows.length,1);
 assert.throws(()=>validatePurchasesChange(doc([]),doc([domestic(),imported()]),s),V);
 assert.throws(()=>validatePurchasesChange(doc([domestic()]),doc([domestic(),domestic({id:'p9'})]),s),V); // 같은 번호
 assert.throws(()=>validatePurchasesChange(doc([]),{...doc([]),archives:[{year:2025}]},s),V); // 연도 분할은 아직 바꾸지 않음
});
test('없는 거래처·품목, 0 이하 수량, 외화인데 환율 없음 → 거절',()=>{
 const s=base(),t=p=>()=>validatePurchasesChange(doc([]),doc([p]),s);
 assert.throws(t(domestic({vendor_id:'zz'})),V);
 assert.throws(t(domestic({lines:[{id:'l1',item_id:'zz',qty:1,unit_price:1}]})),V);
 assert.throws(t(domestic({lines:[{id:'l1',item_id:'jk',qty:0,unit_price:1}]})),V);
 assert.throws(t(imported({fx:undefined})),V);
});
test('입고 차수: 재고 기록 번호는 정해진 값, 주문 수량 초과 입고 불가, 입고 뒤 줄 수정 불가',()=>{
 const s=base(),p=planReceipt(domestic(),{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20}],at:AT});
 assert.deepEqual(p.receipts[0].stock_move_ids,[stockMoveId('r1','l1')]);
 validatePurchasesChange(doc([domestic()]),doc([p]),s);
 const bad={...p,receipts:[{...p.receipts[0],stock_move_ids:['other']}]};
 assert.throws(()=>validatePurchasesChange(doc([domestic()]),doc([bad]),s),V);
 const over=planReceipt(p,{receiptId:'r2',date:'2026-10-11',lines:[{line_id:'l1',qty:1}],at:AT});
 assert.throws(()=>validatePurchasesChange(doc([p]),doc([over]),s),V);
 const edited={...p,lines:p.lines.map(l=>l.id==='l2'?{...l,qty:31}:l)};
 assert.throws(()=>validatePurchasesChange(doc([p]),doc([edited]),s),V);
});
test('지난 기록은 고치지 않음: 입고 차수는 완료·취소 표시만, 비용은 취소 표시만, 원가 이력은 추가만',()=>{
 const s=base(),p=planReceipt(domestic(),{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20}],at:AT});
 const posted={...p,receipts:[{...p.receipts[0],posted_at:AT}]};validatePurchasesChange(doc([p]),doc([posted]),s);
 assert.throws(()=>validatePurchasesChange(doc([posted]),doc([{...posted,receipts:[{...posted.receipts[0],posted_at:'2026-10-11T00:00:00Z'}]}]),s),V);
 assert.throws(()=>validatePurchasesChange(doc([posted]),doc([{...posted,receipts:[{...posted.receipts[0],unit_costs:{l1:1}}]}]),s),V);
 const voided={...posted,receipts:[{...posted.receipts[0],void_at:AT,void_reason:'잘못 입고'}]};validatePurchasesChange(doc([posted]),doc([voided]),s);
 const ip=imported(),runA={id:'run1',at:AT,basis:'금액',after_move_count:0,reason:'최초',unit_costs:{a:5431.5,b:2546.01}};
 const withRun={...ip,cost_runs:[runA]};validatePurchasesChange(doc([ip]),doc([withRun]),s);
 assert.throws(()=>validatePurchasesChange(doc([withRun]),doc([{...withRun,cost_runs:[]}]),s),V);
 assert.throws(()=>validatePurchasesChange(doc([withRun]),doc([{...withRun,cost_runs:[{...runA,unit_costs:{a:1,b:1}}]}]),s),V);
 assert.throws(()=>validatePurchasesChange(doc([ip]),doc([{...ip,costs:ip.costs.slice(1)}]),s),V); // 비용 줄 삭제 불가
 validatePurchasesChange(doc([ip]),doc([{...ip,costs:ip.costs.map((c,i)=>i?c:{...c,void_at:AT,void_reason:'중복 입력'})}]),s);
});
test('삭제: 입고·원가 이력·연결된 재고/지급이 있으면 불가',()=>{
 const s=base(),p=domestic();
 assert.equal(validatePurchasesChange(doc([p]),doc([]),s).rows.length,0);
 assert.throws(()=>validatePurchasesChange(doc([p]),doc([]),s,{stock_moves:[],payments:[{id:'x',purchase_id:'p1'}]}),V);
 const r=planReceipt(p,{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:1}],at:AT});
 assert.throws(()=>validatePurchasesChange(doc([r]),doc([]),s),V);
});
test('연결 검사: 매입 없는 기존 저장은 그대로, 매입 연결 재고는 계획과 정확히 같아야, 중복 지급 차단',()=>{
 const p=planReceipt(domestic(),{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20}],at:AT}),d=doc([p]);
 assert.equal(validatePurchaseLinks('stock_moves',[],[{id:'m1',item_id:'jk',kind:'입고',qty:5}],null),true); // 기존 방식(연결 없음)
 const mv=receiptMoves(p,'r1');
 assert.throws(()=>validatePurchaseLinks('stock_moves',[],mv,null),V); // 매입 시작 전엔 연결 기록 불가
 assert.equal(validatePurchaseLinks('stock_moves',[],mv,d),true);
 assert.throws(()=>validatePurchaseLinks('stock_moves',[],[{...mv[0],qty:21}],d),V);
 assert.throws(()=>validatePurchaseLinks('stock_moves',[],[{...mv[0],id:'other'}],d),V);
 const pay={id:'y1',company_id:'v1',kind:'지급',amount:100000,method:'계좌',date:'2026-10-11',purchase_id:'p1',client_ref:'req-1'};
 assert.equal(validatePurchaseLinks('payments',[],[pay],d),true);
 assert.throws(()=>validatePurchaseLinks('payments',[pay],[pay,{...pay,id:'y2'}],d),V); // 같은 요청 두 번
 assert.throws(()=>validatePurchaseLinks('payments',[],[{...pay,client_ref:undefined}],d),V);
 assert.throws(()=>validatePurchaseLinks('payments',[],[{...pay,company_id:'c1'}],d),V); // 매입처·비용 낸 곳이 아님
});

// ─────────────── 원가 계산 ───────────────
test('수입 도착원가(시안 예시): 물품대 2,829,000 · 부대비용 650,550 · 개당 5,431.5 / 2,546.01',()=>{
 const p=imported(),uc=unitCosts(p);
 assert.deepEqual(lineBase(p),{a:2208000,b:621000});
 assert.equal(uc.a.allocated+uc.b.allocated,650550);
 assert.equal(uc.a.unit,5431.5);assert.equal(uc.b.unit,2546.01);
 assert.equal(Math.round(uc.a.unit),5432);assert.equal(Math.round(uc.b.unit),2546);
 // 수입부가세는 원가에 들어가지 않는다
 assert.equal(uc.a.total+uc.b.total,2829000+650550);
});
test('배분 기준: 수량·중량·직접, 나머지 원은 큰 줄에 → 합계 정확',()=>{
 assert.deepEqual(split(100,{x:1,y:1,z:1}),{x:34,y:33,z:33});
 const p=imported({lines:[{id:'a',item_id:'ap',qty:500,unit_price:3.2,weight:250},{id:'b',item_id:'ch',qty:300,unit_price:1.5,weight:60}],costs:[{id:'q',type:'운임',amount_krw:80000,alloc:'수량'},{id:'w',type:'국내운송',amount_krw:31000,alloc:'중량'},{id:'d',type:'기타',amount_krw:5000,alloc:'직접',direct:{a:5000}}]});
 assert.deepEqual(allocate(p),{a:50000+25000+5000,b:30000+6000});
});
test('이동평균(옵션별) · 지난 출고 원가는 나중 입고에 바뀌지 않음',()=>{
 const k=optionKey('jk','BK','S');
 const pA=planReceipt(domestic({lines:[{id:'l1',item_id:'jk',color:'BK',spec:'S',qty:70,unit_price:4200}]}),{receiptId:'r1',date:'2026-10-01',lines:[{line_id:'l1',qty:70}],at:AT});
 const moves1=[...receiptMoves(pA,'r1'),{id:'o1',item_id:'jk',color:'BK',spec:'S',kind:'출고',qty:20,date:'2026-10-02',quote_id:'q1'}];
 const L1=costLedger({stock_moves:moves1,purchases:doc([pA])});
 assert.equal(L1.outflows[0].unit_cost,4200);
 const pB=planReceipt(domestic({id:'p3',no:'PO-3',lines:[{id:'l1',item_id:'jk',color:'BK',spec:'S',qty:30,unit_price:5000}]}),{receiptId:'r3',date:'2026-09-01',lines:[{line_id:'l1',qty:30}],at:AT}); // 날짜를 과거로 적어도
 const moves2=[...moves1,...receiptMoves(pB,'r3'),{id:'o2',item_id:'jk',color:'BK',spec:'S',kind:'출고',qty:10,date:'2026-10-05',quote_id:'q2'}];
 const L2=costLedger({stock_moves:moves2,purchases:doc([pA,pB])});
 assert.equal(L2.outflows[0].unit_cost,4200);                  // 지난 출고 그대로
 assert.equal(L2.outflows[1].unit_cost,4500);                  // (50×4200+30×5000)/80
 assert.deepEqual(impact(L1,L2).changedOutflows,[]);
 assert.equal(L2.options.find(o=>o.key===k).qty,70);
});
test('원가 확정(추가 비용): 남은 재고에만 반영, 이미 팔린 몫은 원가 조정 — 지난 출고 그대로',()=>{
 let p=planReceipt(imported(),{receiptId:'r1',date:'2026-10-08',lines:[{line_id:'a',qty:500},{line_id:'b',qty:300}],at:AT});
 const moves=[...receiptMoves(p,'r1'),{id:'o1',item_id:'ap',kind:'출고',qty:200,date:'2026-10-09'}];
 const before=costLedger({stock_moves:moves,purchases:doc([p])});
 assert.equal(before.outflows[0].unit_cost,5431.5);
 p={...p,costs:[...p.costs,{id:'c9',type:'기타',amount_krw:80000,alloc:'금액',added_at:AT}]};
 const u=unitCosts(p);p={...p,cost_runs:[{id:'run1',at:AT,basis:'금액',after_move_count:moves.length,reason:'추가 비용',unit_costs:{a:u.a.unit,b:u.b.unit}}]};
 const after=costLedger({stock_moves:moves,purchases:doc([p])});
 const imp=impact(before,after);assert.deepEqual(imp.changedOutflows,[]);
 const adj=imp.newAdjustments.find(x=>x.line_id==='a');assert.equal(adj.qty,200);
 assert.equal(adj.amount,Math.round((u.a.unit-5431.5)*200*100)/100);
 const opt=after.options.find(o=>o.key===optionKey('ap'));assert.equal(opt.avg,u.a.unit);
});
test('초기 재고(원가 모름)·음수 재고는 지어내지 않고 검토 표시 → 기초재고 확인 뒤부터 원가',()=>{
 const moves=[{id:'m0',item_id:'ch',kind:'입고',qty:10,date:'2026-01-01'},{id:'o1',item_id:'ch',kind:'출고',qty:4,date:'2026-02-01'}];
 const L=costLedger({stock_moves:moves,purchases:doc([])});
 assert.equal(L.outflows[0].unit_cost,null);assert.equal(L.outflows[0].estimated,true);
 const op={id:'p0',no:'OP-1',kind:'기초재고',date:'2026-10-10',status:'원가 확정',currency:'KRW',lines:[{id:'x',item_id:'ch',qty:6,unit_price:2300}],cost_runs:[{id:'o',at:AT,basis:'금액',after_move_count:2,reason:'최초',unit_costs:{x:2300}}]};
 const L2=costLedger({stock_moves:[...moves,{id:'o2',item_id:'ch',kind:'출고',qty:2,date:'2026-10-11'}],purchases:doc([op])});
 assert.equal(L2.outflows[0].unit_cost,null); // 지난 출고는 그대로(추정)
 assert.equal(L2.outflows[1].unit_cost,2300);
 const neg=costLedger({stock_moves:[{id:'o9',item_id:'jk',color:'BK',spec:'S',kind:'출고',qty:3,date:'2026-10-01'}],purchases:doc([])});
 assert.ok(neg.issues.some(i=>i.type==='negative'));
 assert.deepEqual(runIssues(neg,domestic()),[optionKey('jk','BK','S')+':negative']);
});
test('품목 전체 평균(참고) · 지급 상태 · 환차손익 · 선급금',()=>{
 let p=planReceipt(domestic(),{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20},{line_id:'l2',qty:30}],at:AT});
 const L=costLedger({stock_moves:receiptMoves(p,'r1'),purchases:doc([p])});
 assert.deepEqual(itemAverage(L,'jk'),{qty:50,value:210000,avg:4200,options:2,partial:false});
 const pay=(id,amount,date='2026-10-12')=>({id,company_id:'v1',kind:'지급',amount,date,purchase_id:'p1',client_ref:id});
 assert.equal(paymentStatus(p,[]).status,'미지급');
 assert.equal(paymentStatus(p,[pay('a',100000)]).status,'부분 지급');
 assert.equal(paymentStatus(p,[pay('a',100000),pay('b',131000)]).status,'지급 완료');
 assert.equal(paymentStatus(p,[pay('a',100000,'2026-10-01')]).prepaid,100000);
 const ip=imported(),st=paymentStatus(ip,[{id:'w',company_id:'v2',kind:'지급',amount:2870000,amount_fx:2050,currency:'USD',fx_rate:1400,date:'2026-10-20',purchase_id:'p2',client_ref:'w'}]);
 assert.equal(st.status,'지급 완료');assert.equal(st.fxGain,2050*1380-2870000); // 음수 = 환차손 41,000원
});

// ─────────────── 저장 중단 복구 ───────────────
function memoryIO(failAt){
 let doc_=doc([domestic()]),stock=[],calls=0;
 const io={getDoc:()=>structuredClone(doc_),getStock:()=>structuredClone(stock),
  async savePurchases(d){calls++;if(failAt.has(`p${calls}`))throw Object.assign(Error('x'),{code:'NETWORK_ERROR'});validatePurchasesChange(doc_,d,base());doc_=d;},
  async saveStock(rows){calls++;if(failAt.has(`s${calls}`))throw Object.assign(Error('x'),{code:'NETWORK_ERROR'});validatePurchaseLinks('stock_moves',stock,rows,doc_);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);stock=rows;}};
 return {io,state:()=>({doc:doc_,stock})};
}
for(const fail of ['p1','s2','p3']){
 test(`입고 저장이 ${fail==='p1'?'① 계획':fail==='s2'?'② 재고':'③ 완료 표시'}에서 끊겨도 다시 하면 한 번만 입고`,async()=>{
  const m=memoryIO(new Set([fail])),plan={receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20}],at:AT};
  await assert.rejects(postReceipt(m.io,'p1',plan));
  if(fail!=='p1')assert.equal(unfinished(m.state().doc,m.state().stock).length,1);
  const result=fail==='p1'?await postReceipt(m.io,'p1',plan):await resume(m.io,'p1','r1',AT);
  assert.equal(result,'posted');
  assert.equal(m.state().stock.length,1);assert.equal(m.state().stock[0].id,stockMoveId('r1','l1'));
  assert.equal(unfinished(m.state().doc,m.state().stock).length,0);
  assert.equal(await resume(m.io,'p1','r1',AT),'posted'); // 또 불러도 아무것도 더하지 않음
  assert.equal(m.state().stock.length,1);
 });
}
test('일부만 있는 이상한 상태는 멈추고 검토(mismatch)',()=>{
 const p=planReceipt(domestic(),{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:1},{line_id:'l2',qty:1}],at:AT});
 assert.equal(receiptState(p.receipts[0],new Set([stockMoveId('r1','l1')])),'mismatch');
});

// ─────────────── 저장소(가짜 Dropbox) ───────────────
test('매입 파일이 없어도 기존 기능 정상: 상태 absent, 7개 저장·읽기 그대로, 매입 파일은 만들어지지 않음',async()=>{
 const fake=fakeDropbox({...emptyData(),...base()}),{repo}=await open(fake);
 assert.equal(repo.purchasesState().status,'unknown');
 assert.equal((await repo.loadPurchases()).status,'absent');
 await repo.saveTable('companies',[...repo.loadCollection('companies'),{id:'c2',name:'새 거래처',type:'매출',prices:[]}]);
 await repo.saveTable('stock_moves',[{id:'m1',item_id:'jk',kind:'입고',qty:3,date:'2026-10-10'}]);
 assert.equal(fake.files.has(PURCHASES_PATH.toLowerCase().replace(/^/,'/')),false);
 assert.ok(!fake.writes.some(p=>/purchases/.test(p)));
 await assert.rejects(repo.saveTable('stock_moves',[...repo.loadCollection('stock_moves'),{id:'m2',item_id:'jk',kind:'입고',qty:1,purchase_id:'p1'}]),V);
});
test('Google Drive(매입 미지원): unsupported, 시작·저장 거절, 7개 기능 그대로',async()=>{
 const fake=fakeDropbox({...emptyData(),...base()}),{repo}=await open(fake,{drive:true});
 assert.equal((await repo.loadPurchases()).status,'unsupported');
 await assert.rejects(repo.startPurchases(),{code:'UNAVAILABLE'});
 await repo.saveTable('settings',{schema:3,name:'합성'});
});
test('[매입 시작하기] → 매입 저장 → 입고 → 지급: 7개 파일 중 의도한 파일만 바뀌고, 옛 버전(7개 검사)도 그대로 열림',async()=>{
 const fake=fakeDropbox({...emptyData(),...base()}),{repo}=await open(fake);await repo.loadPurchases();
 const before7=snap7(fake);
 const started=await repo.startPurchases();assert.equal(started.created,true);assert.equal(started.status,'ready');
 assert.deepEqual(snap7(fake),before7); // 시작은 7개 파일을 건드리지 않는다
 await repo.savePurchases(doc([domestic()]));
 assert.deepEqual(snap7(fake),before7);
 const io={getDoc:()=>repo.loadPurchasesDoc(),getStock:()=>repo.loadCollection('stock_moves'),savePurchases:d=>repo.savePurchases(d),saveStock:rows=>repo.saveTable('stock_moves',rows)};
 assert.equal(await postReceipt(io,'p1',{receiptId:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20},{line_id:'l2',qty:30}],at:AT}),'posted');
 const after=snap7(fake);
 keys.forEach((k,i)=>{if(k!=='stock_moves')assert.equal(after[i],before7[i],k+' 바뀌면 안 됨');});
 assert.equal(repo.loadCollection('stock_moves').length,2);
 const pay={id:'y1',company_id:'v1',kind:'지급',method:'계좌',amount:231000,date:'2026-10-12',purchase_id:'p1',client_ref:'req-1'};
 await repo.saveTable('payments',[pay]);
 await assert.rejects(repo.saveTable('payments',[pay,{...pay,id:'y2'}]),V); // 중복 지급
 // 다른 기기가 다시 [매입 시작하기]를 눌러도 덮어쓰지 않음
 const other=await open(fake);await other.repo.loadPurchases();assert.equal(other.repo.purchasesState().status,'ready');assert.equal(other.repo.loadPurchasesDoc().rows.length,1);
 // 8개 파일이 있는 작업 공간도 기존 7개 검사로 열림(옛 버전과 같은 경로)
 const old=await open(fake);assert.equal(old.repo.loadCollection('stock_moves').length,2);
});
test('매입 저장 응답이 끊기면 다시 보내지 않고 확인만(복구), 그 사이 다른 매입 저장 차단',async()=>{
 const fake=fakeDropbox({...emptyData(),...base()}),{repo}=await open(fake);await repo.loadPurchases();await repo.startPurchases();
 fake.loseNextResponse(p=>/purchases/.test(p));
 await assert.rejects(repo.savePurchases(doc([domestic()])),{code:'SAVE_UNCONFIRMED'});
 assert.equal(repo.purchasesState().unfinishedSave,true);
 await assert.rejects(repo.savePurchases(doc([domestic(),imported()])),{code:'SAVE_UNCONFIRMED'});
 const uploads=fake.writes.filter(p=>/purchases/.test(p)).length;
 await repo.savePurchases(null,{recover:true});
 assert.equal(fake.writes.filter(p=>/purchases/.test(p)).length,uploads); // 다시 올리지 않음
 assert.equal(repo.loadPurchasesDoc().rows.length,1);
});
test('손상된 매입 파일: 매입만 error, 7개 데이터는 읽기·저장 정상',async()=>{
 const fake=fakeDropbox({...emptyData(),...base()});
 fake.files.set(PURCHASES_PATH.toLowerCase().replace(/^/,'/'),{path:'/'+PURCHASES_PATH,id:'id:x',rev:'r1',body:JSON.stringify({schema:1,rows:[{id:'bad'}],archives:[]})});
 const {repo}=await open(fake);
 assert.equal((await repo.loadPurchases()).status,'error');
 await repo.saveTable('settings',{schema:3,name:'합성'});
 await assert.rejects(repo.savePurchases(doc([])),{code:'WRITE_BLOCKED'});
});
test('원가 확정은 지금 시점만 + 음수 재고는 확인 표시 필수',async()=>{
 const fake=fakeDropbox({...emptyData(),...base(),stock_moves:[{id:'o9',item_id:'ap',kind:'출고',qty:3,date:'2026-10-01'}]}),{repo}=await open(fake);
 await repo.loadPurchases();await repo.startPurchases();await repo.savePurchases(doc([imported()]));
 const p=repo.loadPurchasesDoc().rows[0],u=unitCosts(p),run={id:'run1',at:AT,basis:'금액',reason:'최초',unit_costs:{a:u.a.unit,b:u.b.unit}};
 await assert.rejects(repo.savePurchases(doc([{...p,cost_runs:[{...run,after_move_count:0}]}])),V);  // 과거 시점
 await assert.rejects(repo.savePurchases(doc([{...p,cost_runs:[{...run,after_move_count:1}]}])),V);  // 음수 재고 확인 안 함
 await repo.savePurchases(doc([{...p,cost_runs:[{...run,after_move_count:1,acknowledged_issues:[optionKey('ap')+':negative']}]}]));
});
test('용량: 1MB의 70%에서 안내 표시',()=>{
 assert.equal(capacity(emptyPurchases()).warn,false);
 const big={...emptyPurchases(),rows:[{pad:'x'.repeat(760000)}]};assert.equal(capacity(big).warn,true);
});
