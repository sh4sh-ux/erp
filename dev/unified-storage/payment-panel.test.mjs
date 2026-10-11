import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const js=await readFile(new URL('./payment-panel.js',import.meta.url),'utf8');
const css=await readFile(new URL('./payment-panel.css',import.meta.url),'utf8');
const design=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const layout=await readFile(new URL('./panel-layout-b.js',import.meta.url),'utf8');
function fixture(){
 const db={companies:[{id:'c',name:'검증 거래처'}],quotes:[{id:'q',company_id:'c',no:'Q-TEST'}],payments:[
  {id:'p',company_id:'c',quote_id:'q',date:'2026-10-11',kind:'수금',amount:100000,method:'계좌이체'},
  {id:'r',company_id:'c',date:'2026-10-10',kind:'지급',refund:true,amount:10000},
  {id:'unlinked',company_id:'c',date:'2026-10-01',kind:'수금',amount:20000},
  {id:'old',company_id:'c',date:'2026-09-30',kind:'수금',amount:999999},
  {id:'other',company_id:'d',date:'2026-10-11',kind:'수금',amount:888888},
  {id:'void',company_id:'c',date:'2026-10-11',kind:'수금',amount:777777,void_at:'x'}]};
 const values={payPeriod:'month',payMonth:'2026-10',payFilter:'수금',payFrom:'',payTo:''},ids=['p','unlinked','other'];
 const context={db,window:{},matchMedia:()=>({matches:true}),document:{readyState:'loading',addEventListener(){},getElementById:id=>({value:values[id]}),querySelectorAll:()=>ids.map(id=>({dataset:{id}}))}};
 vm.runInNewContext(js.replace('window.NaroPaymentPanel={open:show};','window.test={history,totals,markup,inPeriod};window.NaroPaymentPanel={open:show};'),context);
 return {db,values,ids,api:context.window.test};
}
test('company history includes all directions and unlinked payments in period, never another company or voids',()=>{
 const {api,db}=fixture(),rows=api.history(db.payments[0]);
 assert.deepEqual(Array.from(rows,x=>x.id),['p','r','unlinked']);
 assert.deepEqual({...api.totals(rows)},{in:120000,out:10000,count:3});
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
test('header net and summary match records; selected record and refunds visible without route or document blocks',()=>{
 const {api,db}=fixture(),html=api.markup(db.payments[0]);
 assert.match(html,/>검증 거래처<\/h3>/);assert.match(html,/>\+110,000원<\/strong>/);
 assert.match(html,/120,000<small>원/);assert.match(html,/10,000<small>원/);assert.match(html,/<small>3건<\/small>/);
 assert.match(html,/환불 출금/);assert.equal((html.match(/aria-current="true"/g)||[]).length,1);
 assert.doesNotMatch(html,/이번 입금의 흐름|연결 견적|pp-route|777,777|888,888|999,999/);
});
test('approved ledger has two metrics, one unsigned money column and expandable actual records',()=>{
 const {api,db}=fixture(),html=api.markup(db.payments[0]);
 assert.match(html,/거래처 입출금 내역/);assert.match(html,/결제수단<\/span><span>금액/);
 assert.equal((html.match(/<details class="pp-record/g)||[]).length,3);
 assert.match(html,/>100,000원<i class="pp-chevron/);
 assert.doesNotMatch(html,/선택한 기록<|pp-tabs|거래 건수/);
 assert.match(js,/case 'delete-record':if\(get\(b.dataset.id\)/);
 assert.match(css,/grid-template-columns:1fr 1fr/);
});
test('counterparty, document and memo are escaped; empty overview is safe',()=>{
 const {api,db,ids}=fixture();db.companies[0].name='<img>';db.quotes[0].no='<svg>';db.payments[0].memo='<script> & "';
 const html=api.markup(db.payments[0]);assert.doesNotMatch(html,/<img|<svg|<script/);assert.match(html,/&lt;script&gt; &amp; &quot;/);
 ids.length=0;assert.match(api.markup(null),/표시할 입출금 기록이 없습니다/);
});
test('no storage, network or replacement input controls; existing confirmed deletion preserved',()=>{
 assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|saveTable|cloneNode|<input|<select|<textarea/);
 assert.match(js,/deletePayment\(p.id\)/);assert.match(js,/switchView\('companies'\)!==false/);
});
test('left tabs are restored independently of one-time header setup; amounts remain unsigned in list',()=>{
 assert.match(js,/syncLeft\(left,index,ids\)/);
 assert.match(js,/if\(select&&!tabs\)/);
 assert.match(js,/\[\['','전체'\],\['수금','입금'\],\['지급','출금'\]\]/);
 assert.match(js,/amount.textContent=won\(p.amount\)/);
 assert.match(css,/\.pbr \.pbr-amt\{color:var\(--nd-ink\)!important/);
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
test('desktop totals divider matches tabs plus scope height without changing mobile spacing',()=>{
 assert.match(css,/@media\(min-width:1024px\)\{\s*html body #appView \.pp-detail \.pp-metrics\{padding-bottom:12px\}/);
 assert.equal(28+20+10+24+12+1,47+48);
 assert.match(css,/\.pp-metrics\{grid-template-columns:1fr 1fr;gap:16px;padding-bottom:24px\}/);
});
test('detail records have no selected stripe or background while master selection and keyboard focus remain',()=>{
 assert.match(css,/\.pp-selected-record>summary\{background:none;box-shadow:none\}/);
 assert.match(css,/\.pp-record\[open\]\{background:none\}/);
 assert.doesNotMatch(css,/\.pp-selected-record[^\{]*\{[^}]*var\(--nd-blue/);
 assert.match(css,/\.pp-overview\.on\{background:var\(--nd-blue-soft\);box-shadow:inset 3px 0 0 var\(--nd-blue\)/);
 assert.match(css,/summary:focus-visible\{outline:2px solid var\(--nd-blue\)/);
});
