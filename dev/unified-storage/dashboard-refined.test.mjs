import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./dashboard-refined.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const {periods,aggregate,progress,recent,chartEmphasis,money,amountHtml,needsAttention,rangeError,defaultRange,quickRange}=context.NaroDashboardModel;
const plain=v=>JSON.parse(JSON.stringify(v));
test('dashboard title follows the current local month without changing receivables scope',()=>{
 for(const [date,title] of [['2026-10-05','10월 현황'],['2026-12-31','12월 현황'],['2027-01-01','1월 현황']])assert.equal(context.NaroDashboardModel.monthHeading(date),title);
 assert.match(source,/panel\(monthHeading\(today\)/);
 assert.match(source,/metric\('받을 금액',open,'전체 납품 − 입금 · 선입금 포함','ar'\)/);
});
test('date range validates impossible/empty/reversed dates and bounds excessive chart work',()=>{
 for(const range of [{from:'',to:''},{from:'2026-02-29',to:'2026-03-01'},{from:'2026-10-04',to:'2026-10-01'},{from:'2020-01-01',to:'2030-01-01'}])assert.notEqual(rangeError(range),'');
 assert.equal(rangeError({from:'2024-02-29',to:'2024-02-29'}),'');
 assert.throws(()=>periods('day','2026-10-04',{from:'bad',to:'2026-10-04'}));
});
test('quick ranges cross year boundaries and preserve leap-month endings',()=>{
 assert.deepEqual(plain(quickRange('last-month','2024-03-02')),{from:'2024-02-01',to:'2024-02-29'});
 assert.deepEqual(plain(quickRange('last-month','2026-01-04')),{from:'2025-12-01',to:'2025-12-31'});
 assert.deepEqual(plain(quickRange('three-months','2026-01-04')),{from:'2025-11-01',to:'2026-01-04'});
 assert.deepEqual(plain(quickRange('this-month','2026-10-04')),{from:'2026-10-01',to:'2026-10-04'});
 assert.deepEqual(plain(quickRange('this-year','2026-10-04')),{from:'2026-01-01',to:'2026-10-04'});
 assert.deepEqual(plain(quickRange('this-year','2024-02-29')),{from:'2024-01-01',to:'2024-02-29'});
 assert.deepEqual(plain(defaultRange('month','2026-10-04')),{from:'2026-05-01',to:'2026-10-04'});
 assert.deepEqual(plain(defaultRange('day','2026-01-04')),{from:'2025-12-29',to:'2026-01-04'});
});
test('custom date bounds are inclusive and identical across daily, monthly, yearly aggregation',()=>{
 const dates=['2025-12-30','2025-12-31','2026-01-01','2026-01-02'];
 const data={quotes:[{deliveries:dates.map(date=>({date,total:1100}))}],payments:dates.map(date=>({date,kind:'수금',amount:1000}))};
 data.payments.push({date:'2026-01-01',kind:'지급',amount:999},{date:'2026-01-01',kind:'수금',amount:999,void_at:'x'});
 const before=JSON.stringify(data),range={from:'2025-12-31',to:'2026-01-01'};
 for(const mode of ['year','month','day']){
  const rows=aggregate(data,mode,'2026-10-04',(q,d)=>d.total,range);
  assert.equal(rows.reduce((s,r)=>s+r.sale,0),2200);
  assert.equal(rows.reduce((s,r)=>s+r.receipt,0),2000);
  assert.equal(rows.length,2);
 }
 assert.equal(JSON.stringify(data),before);
});
test('single date, leap days, empty periods, and long daily ranges retain every bucket',()=>{
 assert.equal(periods('day','2024-03-01',{from:'2024-02-28',to:'2024-03-01'}).length,3);
 for(const mode of ['year','month','day'])assert.equal(periods(mode,'2026-10-04',{from:'2026-10-04',to:'2026-10-04'}).length,1);
 const range={from:'2024-01-01',to:'2024-12-31'},rows=aggregate({},'day','2026-10-04',()=>0,range);
 assert.equal(rows.length,366);assert(rows.every(r=>r.sale===0&&r.receipt===0));
});
test('default range stops at today, rejecting future or invalid ledger dates without modifying them',()=>{
 const data={payments:[{date:'2026-10-04',kind:'수금',amount:10},{date:'2026-10-05',kind:'수금',amount:20},{date:'2026-10-99',kind:'수금',amount:30}]};
 for(const mode of ['year','month','day'])assert.equal(aggregate(data,mode,'2026-10-04',()=>0).reduce((s,r)=>s+r.receipt,0),10);
 assert.equal(data.payments.length,3);
});
test('date controls are graph scoped, preserve the chosen bounds on mode switches, and bound rendered bars',()=>{
 assert.match(source,/chartRange=next;chartPage=0/);
 assert.match(source,/chartMode=b.dataset.period;chartPage=0;selectedKey=null;renderChart/);
 assert.match(source,/allRows.slice\(chartPage\*31,\(chartPage\+1\)\*31\)/);
 assert.match(source,/allRows.flatMap/);
 assert.match(source,/이 그래프에만 적용됩니다/);
});
test('month/day/year boundaries are calendar-based, including leap day',()=>{
 assert.deepEqual(plain(periods('month','2026-01-04').map(x=>x.key)),['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01']);
 assert.equal(periods('day','2024-03-01').at(-2).key,'2024-02-29');
 assert.equal(periods('year','2026-01-01')[0].key,'2022');
});
test('period popover shares the field/filter width and keeps draft edits unapplied until submit',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.match(css,/\.nd-db-range-group\{position:relative;[^}]*width:320px;max-width:100%/);
 assert.match(css,/\.nd-db-range-form\{position:absolute;[^}]*left:0;[^}]*width:100%;max-width:none;box-sizing:border-box/);
 assert.match(css,/\.nd-db-range-group\{width:100%\}/);
 assert.match(source,/role="dialog" aria-modal="false"/);
 assert.match(source,/document.addEventListener\('pointerdown'/);
 assert.match(source,/document.addEventListener\('focusin'/);
 assert.match(source,/rangeListeners\?\.abort\(\)/);
 assert.match(source,/\[data-range-reset\].*defaultRange\(chartMode,today\).*resetDraft=true/);
 assert.doesNotMatch(source.match(/form.querySelector\('\[data-range-reset\]'\).onclick=.*;/)?.[0]||'',/chartRange=|renderChart\(/);
 assert.match(source,/if\(resetDraft\)chartRange=null;closeRange\(false\);renderChart/);
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
test('default period is pale; preview overrides pinned selection with only one emphasis',()=>{
 const rows=periods('month','2026-10-04');
 assert.deepEqual(plain(chartEmphasis(rows,null)),{shown:5,active:-1,pinned:-1});
 assert.deepEqual(plain(chartEmphasis(rows,'2026-10',3)),{shown:3,active:3,pinned:5});
 assert.deepEqual(plain(chartEmphasis(rows,'2026-08')),{shown:3,active:3,pinned:3});
 assert.deepEqual(plain(chartEmphasis(rows,'2025-01')),{shown:5,active:-1,pinned:-1});
 for(const mode of ['year','day']){const r=periods(mode,'2026-10-04');assert.equal(chartEmphasis(r,null).active,-1);assert.equal(chartEmphasis(r,r[0].key).active,0);}
});
test('chart selection keeps its underline without a vertical guide between bars',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.nd-db-pair::?before/);
 assert.match(css,/\.nd-db-bar-group\.is-active \.nd-db-bar-label\{border-bottom-color:var\(--nd-blue\)/);
});
test('Dutch Pay number formatting uses ordinary thousands commas; only positive counts warn',()=>{
 assert.equal(money(1087350),'1,087,350원');assert.equal(money(115500),'115,500원');
 assert.equal(money(-1234.5),'-1,234원');assert.equal(money(0),'0원');
 assert.equal(needsAttention(0),false);assert.equal(needsAttention(1),true);assert.equal(needsAttention(30),true);
});
test('visible amounts retain ordinary commas and separate the small currency unit',()=>{
 assert.equal(amountHtml(1087350),'1,087,350<small class="nd-db-currency">원</small>');
 assert.equal(amountHtml(0),'0<small class="nd-db-currency">원</small>');
 assert.equal(amountHtml(-1234),'-1,234<small class="nd-db-currency">원</small>');
});
test('side-by-side work cards stretch equally, with shared headers and flexible rows',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.match(css,/\.nd-db-work\{[^}]*align-items:stretch/);
 assert.match(css,/@media\(min-width:1201px\)\{[\s\S]*?\.nd-db-work>\.nd-db-card\{display:flex;flex-direction:column\}/);
 assert.match(css,/\.nd-db-work \.nd-db-head\{flex:0 0 64px\}/);
 assert.match(css,/\.nd-db-work :is\(\.nd-db-quote,\.nd-db-stage\)\{flex:1\}/);
 assert.match(css,/@media\(max-width:1200px\)\{[^}]*\.nd-db-work\{grid-template-columns:1fr\}/);
});
test('task, recent and progress horizontal rules share desktop/mobile insets without shrinking hit areas',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.match(css,/--nd-db-divider-inset:24px/);
 assert.match(css,/@media\(max-width:780px\)\{[^}]*--nd-db-divider-inset:16px/);
 assert.match(css,/\.nd-db-quote:not\(:last-child\),\.nd-db-stage:not\(:last-child\)\):after\{[^}]*left:var\(--nd-db-divider-inset\);right:var\(--nd-db-divider-inset\)/);
 assert.match(css,/\.nd-db-attention>button\+button:before\{[^}]*pointer-events:none/);
 assert.match(css,/\.nd-db-attention>button\+button\{border-left:0;border-top:1px solid transparent\}/);
});
test('analysis disclosure and title use the card content left inset, without nested header padding',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.match(css,/\.nd-db-analysis>summary\{[^}]*padding:10px 24px[^}]*text-align:left/);
 assert.match(css,/#salesInsight\{padding:2px 24px 24px\}/);
 assert.match(css,/#salesInsight>\.card-head\{padding:14px 0;justify-content:flex-start;text-align:left\}/);
 assert.match(css,/#salesInsight\{padding:2px 16px 20px\}/);
});
test('analysis disclosure has a visible centered chevron and a 44px tap target',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.match(css,/\.nd-db-analysis>summary\{[^}]*min-height:44px/);
 assert.match(css,/\.nd-db-analysis>summary:before\{content:'';[^}]*top:50%;width:8px;height:8px;[^}]*border-right:2px solid var\(--nd-ink-2\)/);
 assert.match(css,/translateY\(-50%\) rotate\(-45deg\)/);
 assert.match(css,/\.nd-db-analysis\[open\]>summary:before\{transform:translateY\(-50%\) rotate\(45deg\)\}/);
});
test('dashboard inherits the shared page header, with pale hover and segmented controls',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/--nd-db-type-scale|\.page-head\s+(?:h2|p|button)\s*\{/);
 assert.match(css,/--nd-db-section-size:14px;--nd-db-value-size:var\(--nd-stat-size\)/);
 assert.match(css,/--nd-stat-size:20px/);
 assert.match(css,/font-weight:600;.*|letter-spacing:-\.6px;font-weight:600/);
 assert.match(css,/color-mix\(in srgb,var\(--nd-fill\) 35%,var\(--nd-surface\)\)/);
 assert.match(css,/button\[aria-pressed="true"\]\{background:var\(--nd-surface\);color:var\(--nd-blue\)/);
 assert.match(css,/\.nd-db-tabs\{width:100%;height:44px;box-sizing:border-box\}/);
});
test('mobile chart legend stays below the period and tabs match the 44px range control',async()=>{
 const css=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 const mobile=css.slice(css.indexOf('@media(max-width:780px)'));
 assert.match(mobile,/\.nd-db-chart-meta\{flex-direction:column;align-items:stretch;/);
 assert.match(mobile,/\.nd-db-values\{width:100%;gap:6px 10px\}/);
 assert.match(mobile,/:is\(\.nd-db-range-trigger,\.nd-db-range-filter\)\{min-height:44px\}/);
 assert.match(mobile,/\.nd-db-tabs\{width:100%;height:44px;box-sizing:border-box\}/);
 assert.match(mobile,/\.nd-db-tabs button\{flex:1;padding:4px 10px;min-height:36px;box-sizing:border-box\}/);
});
