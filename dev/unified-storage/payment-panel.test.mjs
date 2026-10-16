import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const js=await readFile(new URL('./payment-panel.js',import.meta.url),'utf8');
const css=await readFile(new URL('./payment-panel.css',import.meta.url),'utf8');
const design=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const layout=await readFile(new URL('./panel-layout-b.js',import.meta.url),'utf8');
function fixture(extra={}){
 const db={companies:[{id:'c',name:'검증 거래처'}],quotes:[{id:'q',company_id:'c',no:'Q-TEST'}],payments:[
  {id:'p',company_id:'c',quote_id:'q',date:'2026-10-11',kind:'수금',amount:100000,method:'계좌이체'},
  {id:'r',company_id:'c',date:'2026-10-10',kind:'지급',refund:true,amount:10000},
  {id:'unlinked',company_id:'c',date:'2026-10-01',kind:'수금',amount:20000},
  {id:'old',company_id:'c',date:'2026-09-30',kind:'수금',amount:999999},
  {id:'other',company_id:'d',date:'2026-10-11',kind:'수금',amount:888888},
  {id:'void',company_id:'c',date:'2026-10-11',kind:'수금',amount:777777,void_at:'x'}]};
 const values={payPeriod:'month',payMonth:'2026-10',payFilter:'수금',payFrom:'',payTo:''},ids=['p','unlinked','other'];
 const context={...extra,db,window:{},matchMedia:()=>({matches:true}),document:{readyState:'loading',addEventListener(){},getElementById:id=>({value:values[id]}),querySelectorAll:()=>ids.map(id=>({dataset:{id}}))}};
 vm.runInNewContext(js.replace('window.NaroPaymentPanel={open:show};','window.test={history,totals,markup,inPeriod,owed};window.NaroPaymentPanel={open:show};'),context);
 return {db,values,ids,api:context.window.test};
}
test('company history includes all directions and unlinked payments in period, never another company or voids',()=>{
 const {api,db}=fixture(),rows=api.history(db.payments[0]);
 assert.deepEqual(Array.from(rows,x=>x.id),['p','r','unlinked']);
 assert.deepEqual({...api.totals(rows)},{in:120000,out:10000,nIn:2,nOut:1,count:3});
});
test('overview respects the native filtered list',()=>{
 const {api}=fixture();assert.deepEqual(Array.from(api.history(null),x=>x.id),['p','other','unlinked']);
});
test('inclusive custom range, all dates, and invalid range',()=>{
 const {api,db,values}=fixture();values.payPeriod='range';values.payFrom='2026-10-01';values.payTo='2026-10-10';
 assert.equal(api.history(db.payments[0]).length,2);values.payFrom='2026-11-01';assert.equal(api.history(db.payments[0]).length,0);
 values.payPeriod='all';assert.equal(api.history(db.payments[0]).length,4);
});
test('unnamed counterparties do not get merged together',()=>{
 const {api,db}=fixture();delete db.payments[0].company_id;delete db.payments[1].company_id;
 assert.deepEqual(Array.from(api.history(db.payments[0]),x=>x.id),['p']);
});
test('overview header says 차액 (입금 − 출금) without a plus sign; numbers match the native list',()=>{
 const {api}=fixture(),html=api.markup(null);
 assert.match(html,/입출금 현황/);assert.match(html,/>2026년 10월<\/h3>/);
 assert.match(html,/<span>차액 · 입금 − 출금<\/span><strong class="">1,008,888원<\/strong>/);
 assert.doesNotMatch(html,/>\+[\d,]+원<\/strong>/);
 assert.match(html,/입금 · 3건/);assert.match(html,/출금 · 0건/);assert.match(html,/차액<em class="pp-hint"> \(입금 − 출금\)/);
 assert.match(html,/<th class="pp-c-num pp-c-io">입금<\/th><th class="pp-c-num pp-c-io">출금<\/th><th class="pp-c-num pp-c-amt">금액<\/th>/);
 assert.doesNotMatch(html,/들어온 돈|나간 돈|남은 돈|pp-overview|pp-list-scope|초기화/);
 assert.match(html,/data-pp="add">입금·출금 기록<\/button>/);
});
test('record detail: quote-linked list, current row marked once, edit and delete actions, no voided or other-company rows',()=>{
 const {api,db}=fixture(),html=api.markup(db.payments[0]);
 assert.match(html,/<span class="pp-caption">입금<\/span><h3 title="검증 거래처">검증 거래처<\/h3>/);
 assert.match(html,/<span>입금액<\/span><strong>100,000원<\/strong>/);
 assert.match(html,/이 견적의 입금·환불 <small>1건<\/small>/);assert.match(html,/>견적서 열기<\/button>/);assert.doesNotMatch(html,/[＋›]/);
 assert.equal((html.match(/aria-current="true"/g)||[]).length,1);
 assert.match(html,/data-pp="edit">수정/);assert.match(html,/data-pp="menu"/);
 assert.doesNotMatch(html,/777,777|888,888|999,999/);
 const refund=api.markup(db.payments[1]);assert.match(refund,/<span class="pp-caption">환불<\/span>/);assert.match(refund,/이 거래처의 입출금/);
});
test('counterparty, document and memo are escaped; empty overview is safe',()=>{
 const {api,db,ids}=fixture();db.companies[0].name='<img>';db.quotes[0].no='<svg>';db.payments[0].memo='<script> & "';
 const html=api.markup(db.payments[0]);assert.doesNotMatch(html,/<img|<svg|<script/);assert.match(html,/&lt;script&gt; &amp; &quot;/);
 ids.length=0;assert.match(api.markup(null),/이 기간에 입금·출금 기록이 없어요/);
});
test('no network or browser storage; edits save the new record before removing the original (append then delete, like quote progress)',()=>{
 assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|cloneNode|<input|<select|<textarea/);
 assert.match(js,/deletePayment\(p.id\)/);
 const w=js.slice(js.indexOf('function wrapAdd'),js.indexOf('function mount'));
 assert.ok(w.indexOf('await base.apply')<w.indexOf("save('payments',next)"),'original is removed only after the new record is saved');
 assert.match(w,/if\(added&&orig&&/);assert.match(w,/filter\(p=>p.id!==orig\)/);
});
test('left list: kind tabs restored, date groups, signed amounts, no scope row; title count beside the heading',()=>{
 assert.match(js,/if\(select&&!tabs\)/);
 assert.match(js,/\[\['','전체'\],\['수금','입금'\],\['지급','출금'\]\]/);
 assert.match(js,/class="pp-dg"/);assert.match(js,/signedAmount\(p\)/);
 assert.match(js,/c.className='count pp-count'/);
 assert.match(css,/\.workspace-left>\.panel-b-index,\s*html body #appView :is\(#view-payments,#view-ar\) \.workspace-left>:is\(\.pp-list-scope,\.pp-overview\)\{display:none!important\}/);
});
test('summary uses dashboard numeric tokens and recovery footer stays inside padding',()=>{
 assert.match(css,/font-family:var\(--nd-number-font\)!important;font-size:var\(--nd-stat-size\)!important;font-weight:var\(--nd-stat-weight\)!important/);
 assert.match(css,/\.nd-pay-filter>\.nd-trash-field\{margin:0!important;padding:12px 16px!important/);
});
test('payment search reset syncs from native input on desktop as well as mobile',()=>{
 assert.ok(design.includes("if(view==='payments'){if(o&&o.value!==input.value)input.value=o.value;}"));
 assert.ok(!design.includes("if(view==='payments'&&matchMedia('(max-width:780px)').matches){if(o&&o.value!==input.value)input.value=o.value;}"));
});
test('responsive layout restores popup controls before tearing down their origin markers',()=>{
 assert.ok(layout.includes('function update(){window.NaroPop?.close();if(desktop.matches)mount();else{const tasks=undo;'));
});
test('payment date labels remain above inputs even when native month mode hides labels',()=>{
 assert.match(css,/:is\(#payFromLabel,#payToLabel\)\{display:flex!important;flex-direction:column;align-items:stretch;gap:7px;min-width:0;white-space:nowrap/);
 assert.doesNotMatch(css,/:is\(#payFromLabel,#payToLabel\)\[hidden\]\{display:flex!important\}/);
});
test('tables reuse the quote table rules and selection uses the soft fill, never a heavy stripe in the detail',()=>{
 assert.match(css,/\.pp-table th\{[^}]*border-bottom:var\(--quote-table-head-rule\)/);
 assert.match(css,/--quote-table-head-rule:1\.5px solid #D4D4D8/);
 assert.match(css,/\.pp-table tbody tr\.on\{background:var\(--nd-blue-soft\)\}/);
 assert.match(css,/\.pp-row\.on\{background:var\(--nd-blue-soft\);box-shadow:inset 3px 0 0 var\(--nd-blue\)/);
 assert.match(css,/tr:focus-visible\{outline:2px solid var\(--nd-blue\)/);
});
test('entry: open quotes of the company are offered and fill the remaining amount; PC keeps 거래처 → 어느 건 → 금액',()=>{
 assert.match(js,/open\(cid\)/);assert.match(js,/a.value=num\(owed\(q\).fill\)/);
 assert.match(css,/grid-template-areas:"kind kind" "co co" "pick pick" "amt date" "method memo" "btn btn"/);
 assert.match(css,/#payEntry\.pp-has-pick \.pf-quote\{display:none!important\}/);
});

test('quote picker amount: receivable (delivered − paid) first, quote remainder shown beside it; before delivery the quote remainder',()=>{
 const q={id:'q'};let delivered=50000;
 const {api}=fixture({quoteBalance:()=>200000,deliveredAmount:()=>delivered,quotePaid:()=>30000});
 assert.deepEqual({...api.owed(q)},{fill:20000,note:'받을 금액 · 견적 남은 200,000원'});
 delivered=0;assert.deepEqual({...api.owed(q)},{fill:200000,note:'견적 남은 · 납품 전'});
 delivered=230000;assert.deepEqual({...api.owed(q)},{fill:200000,note:'받을 금액'});
});
