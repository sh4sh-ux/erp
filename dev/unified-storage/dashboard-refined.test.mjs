import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./dashboard-refined.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const {periods,aggregate,progress,recent}=context.NaroDashboardModel;
const plain=v=>JSON.parse(JSON.stringify(v));
test('month/day/year boundaries are calendar-based, including leap day',()=>{
 assert.deepEqual(plain(periods('month','2026-01-04').map(x=>x.key)),['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01']);
 assert.equal(periods('day','2024-03-01').at(-2).key,'2024-02-29');
 assert.equal(periods('year','2026-01-01')[0].key,'2022');
});
test('same delivered-amount adapter across modes; receipts exclude outgoing and void records',()=>{
 const data={quotes:[{deliveries:[{date:'2026-10-03',total:1100},{date:'2026-10-04',total:2200},{date:'2025-10-04',total:4400}]}],payments:[{date:'2026-10-03',kind:'수금',amount:1000},{date:'2026-10-03',kind:'지급',amount:500},{date:'2026-10-03',kind:'수금',amount:999,void_at:'x'}]};
 const before=JSON.stringify(data),total=(q,d)=>d.total;
 assert.equal(aggregate(data,'day','2026-10-04',total).at(-2).sale,1100);
 for(const mode of ['year','month']){const row=aggregate(data,mode,'2026-10-04',total).at(-1);assert.equal(row.sale,3300);assert.equal(row.receipt,1000);}
 assert.equal(JSON.stringify(data),before,'must not mutate data');
});
test('empty data and negative amounts remain real, without fabricated bars/counts',()=>{
 assert(aggregate({},'month','2026-10-04',()=>0).every(r=>r.sale===0&&r.receipt===0));
 assert.equal(aggregate({quotes:[{deliveries:[{date:'2026-10-01'}]}]},'month','2026-10-04',()=>-550).at(-1).sale,-550);
 assert(progress([]).every(r=>r.count===0));
});
test('approved labels keep stored status values and separate partial deliveries/cancellations',()=>{
 const quotes=['작성중','발송','수주','납품','부분납품','취소'].map(status=>({status}));
 const before=JSON.stringify(quotes),rows=progress(quotes);
 assert.deepEqual(plain(rows.map(r=>r.label+' ('+r.hint+')')),['작성 중 (견적 준비)','발송 (고객 답변 대기)','수주 (주문 확정·납품 준비)','부분납품 (남은 수량 납품 준비)','납품 (납품 완료)']);
 assert.equal(rows.find(r=>r.status==='납품').count,1);
 assert(!rows.some(r=>r.status==='취소'));
 assert.equal(JSON.stringify(quotes),before);
});
test('recent quotes only, sorted without modifying the original collection',()=>{
 const quotes=[1,3,2,5,4].map(n=>({id:n,date:`2026-10-0${n}`})),before=JSON.stringify(quotes);
 assert.deepEqual(plain(recent(quotes).map(q=>q.id)),[5,4,3,2]);assert.equal(JSON.stringify(quotes),before);
});
test('presentation has no persistence, provider calls or dataset mutations',()=>{
 assert.doesNotMatch(source,/\b(?:fetch|localStorage|sessionStorage|indexedDB|saveTable|postMessage)\b\s*[.(]/);
 assert.doesNotMatch(source,/db\.\w+\s*=|db\.\w+\.(?:push|splice|sort)\(/);
});
