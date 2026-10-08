import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext(source.slice(0,source.indexOf('/* NARO theme:'))+'\nglobalThis.model=NaroCompanyLedger;',ctx);
const {rows,html,replaceLedger}=ctx.model;
const helpers={deliveredLines:(_q,d)=>d.lines,total:ls=>ls.reduce((s,l)=>s+l.amount,0),quoteAmount:q=>q.total,fullyDelivered:q=>q.full};
const quote=(id='q',extra={})=>({id,company_id:'c',no:'Q-001',total:100,full:true,deliveries:[{date:'2026-08-27',lines:[{name:'제품',amount:100}]}],...extra});
const pay=(extra={})=>({id:'p',company_id:'c',quote_id:'q',kind:'수금',date:'2026-09-10',amount:100,method:'계좌이체',...extra});
const build=(quotes=[quote()],payments=[pay()])=>rows({quotes,payments},'c',helpers);
test('same quote/company and equal amount becomes one completed row; original dates survive',()=>{
 const result=build();assert.equal(result.length,1);assert.equal(result[0].status,'납품·입금 완료');
 assert.equal(result[0].date,'2026-08-27');assert.equal(result[0].events.length,2);
 assert.equal(result[0].events[1].date,'2026-09-10');assert.equal(result[0].amount,100);
 const markup=html(result);assert.equal((markup.match(/<details /g)||[]).length,1);
 assert.equal((markup.split('</summary>')[0].match(/100/g)||[]).length,1);
});
test('equal amount and quote number alone never match; cross-company links stay separate',()=>{
 const result=build([quote(),quote('other',{company_id:'different'})],[pay({quote_id:'other'}),pay({quote_id:''}),pay({company_id:'different'})]);
 assert.equal(result.length,3);assert.equal(result[0].type,'payment');
 assert.equal(result.find(r=>r.type==='quote').payments.length,0);
 assert.ok(result.filter(r=>r.type==='payment').every(r=>!r.linked));
});
test('duplicate quote IDs fail closed without losing delivery or payment records',()=>{
 const result=build([quote(),quote('q',{no:'Q-duplicate'})]);assert.equal(result.length,3);
 assert.equal(result.filter(r=>r.type==='quote').length,2);assert.equal(result.filter(r=>r.type==='payment').length,1);
});
test('multiple installments sum once; partial receipt and partial delivery cannot look completed',()=>{
 let result=build([quote()],[pay({amount:40}),pay({id:'p2',amount:60})]);
 assert.equal(result[0].status,'납품·입금 완료');assert.equal(result[0].events.length,3);
 result=build([quote()],[pay({amount:40})]);assert.equal(result[0].balance,60);assert.match(result[0].status,/부분 입금/);
 result=build([quote('q',{full:false,total:200})]);assert.match(result[0].status,/부분 납품/);assert.notEqual(result[0].tone,'complete');
});
test('advance and excess payments stay explicit with a non-negative displayed excess',()=>{
 let result=build([quote('q',{deliveries:[],full:false})]);assert.equal(result[0].status,'선입금 · 납품 전');
 result=build([quote()],[pay({amount:150})]);assert.match(result[0].status,/초과 입금/);assert.equal(result[0].balance,-50);
 assert.match(html(result),/납품액 초과 입금/);
 result=build([quote('q',{full:false,total:200})],[pay({amount:150})]);assert.match(result[0].status,/선입금 포함/);
});
test('outgoing, refunds, unknown IDs and zero amounts are separate; voided receipts never settle',()=>{
 const result=build([quote()],[pay({kind:'지급'}),pay({amount:-10}),pay({amount:0}),pay({quote_id:'missing'}),pay({void_at:'cancelled'})]);
 assert.equal(result.length,5);assert.equal(result.find(r=>r.type==='quote').paid,0);
 assert.equal(result.filter(r=>r.type==='payment').length,4);
});
test('a separately retained signed correction cannot leave the quote marked paid in full',()=>{
 const result=build([quote()],[pay(),pay({id:'correction',amount:-20})]);
 const grouped=result.find(r=>r.type==='quote');assert.equal(grouped.tone,'warning');
 assert.match(grouped.status,/확인 필요/);assert.doesNotMatch(html(result),/납품·입금 완료/);
});
test('two deliveries are preserved, summed and sorted by recent delivery, not payment',()=>{
 const q=quote('q',{deliveries:[{date:'2026-08-20',lines:[{name:'첫 제품',amount:40}]},{date:'2026-08-27',lines:[{name:'둘째 제품',amount:60}]}]});
 const result=build([q,quote('q2',{deliveries:[{date:'2026-09-30',lines:[{name:'새 제품',amount:100}]}]})]);
 assert.equal(result[0].date,'2026-09-30');assert.equal(result[1].delivered,100);assert.equal(result[1].events.length,3);
});
test('no original data or totals are mutated; empty and no-number quotes render safely',()=>{
 const data={quotes:[quote('q',{no:''})],payments:[pay()]},before=JSON.stringify(data);
 const result=rows(data,'c',helpers);assert.equal(JSON.stringify(data),before);assert.equal(result[0].no,'견적번호 없음');
 assert.match(html([]),/아직 거래 내역이 없습니다/);
});
test('names, quote numbers, payment methods and memos are escaped',()=>{
 const result=build([quote('q',{no:'<img src=x>',deliveries:[{date:'2026-08-27',memo:'<script>x</script>',lines:[{name:'<b>제품</b>',amount:100}]}]})],[pay({method:'<svg>',memo:'<img>'})]);
 const markup=html(result);assert.doesNotMatch(markup,/<img|<script|<svg|<b>제품/);assert.match(markup,/&lt;img/);
});
test('adapter replaces only ledger and preserves hero, actions, form and fallback',()=>{
 const before='<div>hero & buttons</div>',after='<h3 class="co-ledger-h" style="margin-top:28px">거래처 정보</h3><input>';
 const old=before+'<h3 class="co-ledger-h">거래 내역 <span>2건</span></h3><table>old</table>'+after;
 const result=replaceLedger(old,build());assert.ok(result.startsWith(before));assert.ok(result.endsWith(after));assert.doesNotMatch(result,/<table>old/);
 assert.equal(replaceLedger('future markup',build()),'future markup');
 assert.doesNotMatch(source.slice(0,source.indexOf('/* NARO theme:')),/saveTable|fetch\(|localStorage|\.push\(p\)|\.amount\s*=/);
});
