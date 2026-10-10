// 변경 기록 한 줄: 무엇이 어떻게 바뀌었는지 사람이 읽는 말로.
import test from 'node:test';import assert from 'node:assert/strict';
import {describeChange,logEntry} from './change-log.mjs';
const companies=[{id:'c1',name:'메디랩코리아(주)'},{id:'c2',name:'스마트스토어'}];
const q={id:'q1',no:'Q-20261001-1',company_id:'c1',status:'수주',lines:[{id:'l1',name:'셰프복',color:'BK',spec:'S',qty:5,price:9800}],deliveries:[]};
test('견적서 수정: 수량·단가·상태·납품 기록',()=>{
 const after={...q,status:'납품',lines:[{...q.lines[0],qty:4,price:9500}],deliveries:[{id:'d1',date:'2026-10-08',lines:[{line_id:'l1',qty:4}]}]};
 const d=describeChange('quotes',[q],[after],{companies});
 assert.equal(d.action,'수정');assert.equal(d.label,'견적서 Q-20261001-1 · 메디랩코리아(주)');
 assert.deepEqual(d.changes,['상태 수주 → 납품','셰프복 BK·S 수량 5 → 4','셰프복 BK·S 단가 9,800원 → 9,500원','납품 기록 10.08 4개']);
});
test('취소·되살리기·납품 고침 · 추가·삭제',()=>{
 const cancelled={...q,status:'취소',cancel_reason:'거래 취소'};
 assert.equal(describeChange('quotes',[q],[cancelled],{companies}).action,'취소');
 assert.equal(describeChange('quotes',[cancelled],[q],{companies}).action,'되살리기');
 const del={...q,deliveries:[{id:'d1',date:'2026-10-08',lines:[{line_id:'l1',qty:5}]}]};
 assert.ok(describeChange('quotes',[del],[{...del,deliveries:[{...del.deliveries[0],void_at:'x',void_reason:'고침'}]}],{companies}).changes.includes('납품 기록 고침 10.08 5개'));
 assert.equal(describeChange('quotes',[],[q],{companies}).action,'추가');
 assert.equal(describeChange('quotes',[q],[],{companies}).action,'삭제');
});
test('입금·환불·재고·변화 없음',()=>{
 const p={id:'p1',kind:'수금',company_id:'c2',amount:161700,date:'2026-10-08',method:'현금'};
 assert.equal(describeChange('payments',[],[p],{companies}).label,'입금 161,700원 · 스마트스토어');
 assert.equal(describeChange('payments',[],[{...p,id:'p2',kind:'지급',refund:true}],{companies}).label,'환불 161,700원 · 스마트스토어');
 const s=describeChange('stock_moves',[],[{id:'m1',kind:'출고',qty:30,quote_id:'q1',memo:'견적 Q-1 출고'},{id:'m2',kind:'입고',qty:1,quote_id:'q1'}]);
 assert.deepEqual(s.changes,['출고 30개','입고 1개']);
 assert.equal(describeChange('quotes',[q],[structuredClone(q)]),null);
 const e=logEntry('payments',[],[p],{who:'a@b.c',ref:{companies},at:'2026-10-09T01:00:00.000Z',id:'x'});
 assert.equal(e.by,'a@b.c');assert.equal(e.at,'2026-10-09T01:00:00.000Z');assert.equal(e.key,'payments');
});
test('매입 변경 기록: 추가·입고 확정·반품·취소를 한 줄로',()=>{
 const ref={companies:[{id:'v1',name:'대한원단'}]};
 const p={id:'p1',no:'PO-1',kind:'국내',vendor_id:'v1',date:'2026-10-10',status:'작성중',lines:[{id:'l1',qty:20}],receipts:[]};
 assert.deepEqual(describeChange('purchases',[],[p],ref).changes,['국내 · 품목 1건 · 작성중']);
 const r={id:'r1',date:'2026-10-10',lines:[{line_id:'l1',qty:20}]};
 const d=describeChange('purchases',[{...p,receipts:[r]}],[{...p,status:'입고 완료',receipts:[{...r,posted_at:'2026-10-10T00:00:00Z'}]}],ref);
 assert.equal(d.label,'매입 PO-1 · 대한원단');assert.deepEqual(d.changes,['상태 작성중 → 입고 완료','입고 확정 10.10 20개']);
 const t=describeChange('purchases',[p],[{...p,returns:[{id:'t1',date:'2026-10-11',lines:[{line_id:'l1',qty:5}],reason:'불량'}]}],ref);
 assert.deepEqual(t.changes,['반품 10.11 5개 · 불량']);
 assert.equal(describeChange('purchases',[p],[{...p,status:'취소'}],ref).action,'취소');
});
