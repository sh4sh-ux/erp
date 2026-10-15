import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const js=await readFile(new URL('./ar-panel.js',import.meta.url),'utf8');
const css=await readFile(new URL('./ar-panel.css',import.meta.url),'utf8');
const pay=await readFile(new URL('./payment-panel.css',import.meta.url),'utf8');
const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
const ago=n=>{const t=new Date('2026-10-15T00:00:00');t.setDate(t.getDate()-n);return t.toISOString().slice(0,10);};
function fixture(){
 // 한 줄 = 납품 1건, 금액은 lines의 amount 합으로 계산(기본 앱 quoteTotals 대신 간단히).
 const db={companies:[{id:'c',name:'검증 거래처'},{id:'d',name:'두번째'}],quotes:[
  {id:'q1',company_id:'c',no:'Q-1',status:'납품',deliveries:[{id:'a',date:ago(70),amt:100000},{id:'b',date:ago(20),amt:50000},{id:'v',date:ago(90),amt:999999,void_at:'x'}]},
  {id:'q2',company_id:'c',no:'Q-2',status:'납품',deliveries:[{id:'c',date:ago(5),amt:30000}]},
  {id:'q3',company_id:'d',no:'Q-3',status:'납품',deliveries:[{id:'d',date:ago(40),amt:20000}]},
  {id:'qx',company_id:'c',no:'Q-X',status:'취소',deliveries:[{id:'x',date:ago(80),amt:70000}]}],
  payments:[{id:'p1',company_id:'c',quote_id:'q1',kind:'수금',amount:100000,date:ago(3),method:'계좌이체'},
   {id:'p2',company_id:'c',quote_id:'q1',kind:'수금',amount:500000,date:ago(1),void_at:'x'},
   {id:'p3',company_id:'d',quote_id:'q3',kind:'수금',amount:20000,date:ago(2)}]};
 const values={arView:'co',arFilter:'open'};
 const arData=()=>[{cid:'c',open:80000,delivered:180000,paid:100000,pending:0,untaxed:0,untaxedCount:0,lastPay:ago(3)},{cid:'d',open:0,delivered:20000,paid:20000,pending:0,untaxed:0,untaxedCount:0,lastPay:ago(2)}];
 const context={db,window:{},matchMedia:()=>({matches:true,addEventListener(){}}),localDate:()=>'2026-10-15',arData,
  deliveredLines:(q,d)=>d,quoteTotals:({lines})=>({total:lines.amt}),
  document:{readyState:'loading',addEventListener(){},getElementById:id=>({value:values[id]}),querySelector:()=>null}};
 context.globalThis=context;
 vm.runInNewContext(js.replace('window.NaroArPanel={render:schedule,companies};','window.test={companies,quoteOpen,overviewMarkup,detailMarkup,listMarkup,visible,sortOld,state};'),context);
 return {db,values,api:context.window.test};
}
test('quote open amount: delivered minus received, voided deliveries and payments ignored; age from the oldest unpaid delivery',()=>{
 const {api,db}=fixture(),o=api.quoteOpen(db.quotes[0]);
 assert.equal(o.delivered,150000);assert.equal(o.paid,100000);assert.equal(o.open,50000);
 // 100,000원 입금이 70일 전 납품을 다 채웠으니 남은 첫 납품은 20일 전.
 assert.equal(o.oldest,ago(20));assert.equal(o.age,20);
});
test('companies: open quotes oldest first, cancelled quotes left out, settled company hidden unless 다 받은 곳도 보기',()=>{
 const {api,values}=fixture(),all=api.companies(),c=all.find(r=>r.cid==='c');
 assert.deepEqual(c.opens.map(o=>o.q.no),['Q-1','Q-2']);assert.equal(c.age,20);
 assert.deepEqual(api.visible(all).map(r=>r.cid),['c']);values.arFilter='all';assert.deepEqual(api.visible(all).map(r=>r.cid),['c','d']);
});
test('overview: header, three numbers, 30/60-day buckets and table sorted oldest first',()=>{
 const {api}=fixture(),html=api.overviewMarkup(api.companies());
 assert.match(html,/받을 금액 현황/);assert.match(html,/<span>받을 금액 · 납품 − 입금<\/span><strong>80,000원<\/strong>/);
 assert.match(html,/받을 금액 · 2건/);assert.match(html,/납품 전 금액/);assert.match(html,/계산서 미발행/);
 assert.match(html,/30일 안 <b>80,000원<\/b>/);assert.match(html,/31–60일 <b>0원<\/b>/);assert.match(html,/61일 넘음 <b>0원<\/b>/);
 assert.match(html,/data-ap="pay">＋ 입금 기록/);assert.doesNotMatch(html,/수금|미수/);
});
test('company detail: progress, open quotes with links, recent payments without voids, and a prefilled 입금 button',()=>{
 const {api}=fixture(),state=api.state,c=api.companies().find(r=>r.cid==='c');let html=api.detailMarkup(c);
 assert.match(html,/<span class="pp-caption">거래처<\/span><h3 title="검증 거래처">검증 거래처<\/h3>/);
 assert.match(html,/납품 180,000원 중 100,000원 받음/);assert.match(html,/data-ap="doc" data-q="q1">Q-1</);
 assert.doesNotMatch(html,/500,000|999,999|Q-X/);assert.match(html,/입금 기록 · Q-1부터/);
 state.quote='q2';html=api.detailMarkup(c);assert.match(html,/입금 기록 · Q-2부터/);
});
test('age chips: 30일 안 plain, 31–60 amber, 61+ red; names are escaped',()=>{
 const {api,db}=fixture();db.companies[0].name='<img>';db.quotes[0].deliveries=[{id:'a',date:ago(70),amt:100000},{id:'b',date:ago(65),amt:50000}];
 const html=api.listMarkup(api.sortOld(api.visible(api.companies())));
 assert.match(html,/<b class="ap-age ap-old">65일<\/b>/);assert.doesNotMatch(html,/<img>/);assert.match(html,/&lt;img&gt;/);
});
test('styles: AR reuses the payments parts and adds only its age colours; bundled after payments',()=>{
 assert.match(pay,/:is\(#view-payments,#view-ar\) \.pp-row\{/);assert.doesNotMatch(pay,/:is\(#view-payments,#view-ar\)[^{}]*((?<!\()\.pp-entry-open|#payEntry)/);
 assert.match(css,/\.ap-age\.ap-mid\{[^}]*--nd-amber/);assert.match(css,/\.ap-age\.ap-old\{[^}]*--nd-red/);
 assert.ok(build.indexOf('naro-ar-panel')>build.indexOf('naro-payment-panel'));
});
