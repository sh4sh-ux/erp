// 견적서 '취소 처리'(quote-actions.js)가 저장소 장부 규칙 안에서만 움직이는지: 납품 기록은 못 지우고, 취소 + 재고 입고 추가는 된다.
import test from 'node:test';import assert from 'node:assert/strict';
import {validateExtendedChange} from '../personal-cloud-onboarding/extended-contract.mjs';
const co={id:'c1',name:'스마트스토어',type:'매출',prices:[]},it={id:'i1',name:'셰프복',components:[],variants:[]};
const q={id:'q1',company_id:'c1',status:'납품',lines:[{id:'l1',name:'셰프복',qty:2,price:100,item_id:'i1'}],deliveries:[{id:'d1',date:'2026-10-08',lines:[{line_id:'l1',qty:2}]}]};
const mv={id:'m1',item_id:'i1',kind:'출고',qty:2,quote_id:'q1'};
const snap={companies:[co],items:[it],quotes:[q],payments:[],stock_moves:[mv],material_moves:[],settings:{schema:3}};
test('취소 처리 = 상태만 취소(납품 기록 유지) + 재고 입고 추가',()=>{
 assert.doesNotThrow(()=>validateExtendedChange('quotes',[q],[{...q,status:'취소'}],snap));
 assert.doesNotThrow(()=>validateExtendedChange('stock_moves',[mv],[mv,{id:'m2',item_id:'i1',kind:'입고',qty:2,quote_id:'q1'}],snap));
});
test('저장된 납품 기록 지우기 · 기록 있는 견적 삭제는 막힌다',()=>{
 assert.throws(()=>validateExtendedChange('quotes',[q],[{...q,deliveries:[]}],snap),{code:'VALIDATION'});
 assert.throws(()=>validateExtendedChange('quotes',[q],[],snap),{code:'VALIDATION'});
});
test('quote-actions.js는 납품 기록을 비우거나 입금을 고치지 않는다',async()=>{
 const src=(await import('node:fs')).readFileSync(new URL('./quote-actions.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/deliveries:\[\]/);assert.doesNotMatch(src,/quote_id:''/);
});
test('납품 기록 바로잡기: 취소됨 표시(void_at)와 새 기록 추가만 허용',()=>{
 const at='2026-10-08T10:00:00.000Z',d=q.deliveries[0];
 const fixed={...q,deliveries:[{...d,void_at:at,void_reason:'고침'},{id:'d2',date:'2026-10-08',lines:[{line_id:'l1',qty:1}],corrects:'d1'}]};
 assert.doesNotThrow(()=>validateExtendedChange('quotes',[q],[fixed],snap));
 assert.throws(()=>validateExtendedChange('quotes',[q],[{...q,deliveries:[{...d,qty:9,void_at:at}]}],snap),{code:'VALIDATION'});
 assert.throws(()=>validateExtendedChange('quotes',[q],[{...q,deliveries:[{...d,lines:[{line_id:'l1',qty:1}],void_at:at}]}],snap),{code:'VALIDATION'});
 const s2={...snap,quotes:[fixed]};
 assert.throws(()=>validateExtendedChange('quotes',[fixed],[{...fixed,deliveries:[{...fixed.deliveries[0],void_at:undefined},fixed.deliveries[1]]}],s2),{code:'VALIDATION'});
 assert.throws(()=>validateExtendedChange('quotes',[fixed],[{...fixed,deliveries:[fixed.deliveries[1]]}],s2),{code:'VALIDATION'});
});
