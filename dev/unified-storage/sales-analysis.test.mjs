import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const js=await readFile(new URL('./sales-analysis.js',import.meta.url),'utf8');
const css=await readFile(new URL('./sales-analysis.css',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(js.slice(0,js.indexOf('/* UI only.'))+';globalThis.model=NaroSalesAnalysis;',ctx);
const m=ctx.model;
const items=[{id:'a',name:'동일명',code:'CODE-A',category:'의류'},{id:'b',name:'동일명',code:'CODE-B',category:'잡화'}];
const companies=[{id:'c',name:'회사 C'},{id:'d',name:'회사 D'}];
const groups={c:{a:{item_id:'a',name:'동일명',qty:3,price:101},b:{item_id:'b',name:'동일명',qty:2,price:99}},d:{a:{item_id:'a',name:'동일명',qty:1,price:101},free:{item_id:'__free__',name:'배송비',qty:1,price:10}}};
const rows=()=>m.rows(groups,items,companies);
test('quote and sales tabs share desktop and mobile font-size tokens',()=>{
 assert.match(css,/--nd-section-tab-size:13px/);
 assert.match(css,/--nd-section-tab-size:14px/);
 assert.match(css,/#qtForm \.qp-tabs>button\{font-size:var\(--nd-section-tab-size\)!important/);
 assert.match(css,/\.nd-sa-tabs button\{[^}]*font:500 var\(--nd-section-tab-size\)/);
});
test('mobile sales list header matches quote title/search spacing and full-width tabs',()=>{
 const mobile=css.slice(css.indexOf('@media screen and (max-width:1023px)'));
 assert.match(mobile,/nd-sales-ready>\.page-head\{[^}]*padding:42px 16px 18px!important[^}]*border-bottom:1px solid var\(--nd-line\)!important/);
 assert.match(mobile,/\.page-head \.nd-tools\{margin-top:18px!important[^}]*height:44px!important/);
 assert.match(mobile,/nd-sales-ready>\.nd-sales-index\{[^}]*padding:0!important;width:100%/);
 assert.match(mobile,/\.nd-sa-tabs\{padding:0 16px;height:44px/);
});
test('mobile sales detail follows quote form insets without changing desktop layout',()=>{
 const mobile=css.slice(css.indexOf('@media screen and (max-width:1023px)'));
 assert.match(mobile,/nd-sales-ready.nd-sa-mobile-detail\{padding:0 12px!important;background:var\(--nd-page\)/);
 assert.match(mobile,/nd-sa-mobile-detail \.nd-sales-analysis\{padding:16px 16px 24px!important;border-radius:16px!important/);
 assert.match(mobile,/nd-sa-header\{padding:0 0 20px/);
 assert.match(mobile,/nd-sa-result\{padding:22px 0 0/);
 assert.match(mobile,/nd-sa-headline\{display:flex/);
 assert.match(mobile,/nd-sa-table thead\{display:none/);
 assert.match(mobile,/#bottomNav\{display:none!important/);
 assert.match(js,/class="nd-sa-mobile-qty">수량 \$\{n\(r.qty\)\}/);
});
test('sales total and VAT preserve existing per-company grouped-line rounding',()=>{
 const total=m.summary(rows());assert.equal(total.supply,612);assert.equal(total.vat,61);assert.equal(total.total,673);assert.equal(total.qty,7);
});
test('company, item and category totals reconcile to the same sum',()=>{
 for(const mode of ['company','item','category'])assert.equal(m.group(rows(),mode).reduce((s,g)=>s+g.total,0),673);
});
test('same display name never merges distinct item IDs',()=>{
 const result=m.group(rows(),'item');assert.equal(result.length,3);assert.equal(result.find(g=>g.code==='CODE-A').qty,4);
});
test('missing and deleted item categories are classified as 미분류 without dropping money',()=>{
 const result=m.group(m.rows(groups,[],companies),'category');assert.equal(result.length,1);assert.equal(result[0].name,'미분류');assert.equal(result[0].total,673);
});
test('category trims whitespace and unknown company is kept',()=>{
 const r=m.rows(groups,[{...items[0],category:' 의류 '}],[]);assert.equal(r[0].category,'의류');assert.equal(r[0].company,'거래처 정보 없음');
});
test('search matches code, category and options without mutating data',()=>{
 assert.equal(m.filter(rows(),'code-a').length,2);assert.equal(m.filter(rows(),'잡화').length,1);assert.equal(m.filter(rows(),'불일치').length,0);assert.equal(rows().length,4);
});
test('sort works for amount, quantity and Korean name',()=>{
 const r=rows();assert.equal(m.group(r,'company','amount')[0].id,'c');assert.equal(m.group(r,'item','qty')[0].qty,4);assert.equal(m.group(r,'category','name')[0].name,'미분류');
});
test('negative discount and zero values survive the projection',()=>{
 const r=m.rows({c:{discount:{name:'할인',qty:1,price:-100},zero:{name:'무상',qty:0,price:10}}},[],companies);assert.equal(m.summary(r).total,-110);assert.equal(m.group(r,'category')[0].total,-110);
});
test('empty data and unsafe text are handled',()=>{
 assert.equal(m.group([],'item').length,0);assert.equal(m.summary([]).total,0);assert.equal(m.escape('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
test('read-only design has three requested tabs and no record tab or persistence',()=>{
 assert.match(js,/data-sa-mode="company"/);assert.match(js,/data-sa-mode="item"/);assert.match(js,/data-sa-mode="category"/);
 assert.doesNotMatch(js,/saveTable|fetch\(|localStorage|sessionStorage|data-sa-mode="records"/);
 assert.match(js,/견적일 기준/);assert.match(js,/salesData\(\)\.groups/);
});
test('single-line name and sales header use shared geometry tokens',()=>{
 assert.match(css,/#qtList \.li-nm\{[^}]*white-space:nowrap!important[^}]*text-overflow:ellipsis!important/);
 assert.match(css,/workspace-heading\{height:var\(--panel-head\)!important/);
 assert.match(css,/font:700 var\(--panel-title,24px\)\/var\(--panel-title-line,30px\)/);
});
test('dashboard and sales share number family, KPI size, weight and comma spacing',async()=>{
 const dashboard=await readFile(new URL('./dashboard-refined.css',import.meta.url),'utf8');
 assert.match(dashboard,/--nd-number-font:Inter,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif/);
 assert.match(dashboard,/--nd-db-number-font:var\(--nd-number-font\)/);
 for(const token of ['nd-number-font','nd-stat-size','nd-stat-weight','nd-stat-spacing'])assert.ok(css.includes(`var(--${token})`));
 assert.match(css,/\.nd-sa-num\{letter-spacing:inherit\}/);
 assert.match(css,/\.nd-sa-currency\{font:400 12px\/1.5 var\(--sans\);letter-spacing:0;margin-left:3px/);
 assert.doesNotMatch(css,/font:700 25px|nd-sa-num\{font-family:var\(--sans\)/);
});
test('toolbar controls have equal exact outer heights on desktop and mobile',()=>{
 assert.match(css,/:is\(\.nd-sa-search,select\)\{box-sizing:border-box;height:40px!important;min-height:40px!important;max-height:40px/);
 assert.match(css,/:is\(\.nd-sa-search,select\)\{height:44px!important;min-height:44px!important;max-height:44px/);
});
test('master-detail uses native list buttons and restores focus after selection/back',()=>{
 assert.match(js,/data-sa-select=/);
 assert.match(js,/else focusSelected\(\)/);
 assert.match(js,/focus\(\{preventScroll:true\}\)/);
 assert.match(js,/state.mobileDetail=false;render\(\);focusSelected\(\)/);
 assert.doesNotMatch(js,/slCo[^;]*\.value\s*=/);
});
test('left and right searches do not change selection totals or each other',()=>{
 const p=m.project(rows(),{mode:'company',selected:'c',query:'CODE-A',leftQuery:'회사 D'});
 assert.equal(p.index.length,1);assert.equal(p.index[0].id,'d');assert.equal(p.selected.id,'c');
 assert.equal(p.summary.total,551);assert.equal(p.details.length,1);assert.equal(p.details[0].total,333);assert.equal(p.detailCount,2);
});
test('mobile list and detail are separate and shares move below the item name',()=>{
 assert.match(css,/>\.nd-chips-m\{display:none!important/);
 assert.match(css,/nd-sa-mobile-detail .nd-sales-analysis\{display:block!important/);
 assert.match(css,/nd-sa-mobile-detail>:is\(\.page-head,\.nd-sales-index\)\{display:none!important/);
 assert.match(css,/\.nd-sa-mobile-share\{display:block;margin-top:8px/);
 assert.match(css,/\.nd-sa-table .nd-sa-share\{display:none/);
});
test('item selection shows purchasing companies, categories keep uncategorized items',()=>{
 const id=m.group(rows(),'item').find(g=>g.code==='CODE-A').id;
 const p=m.project(rows(),{mode:'item',selected:id,sort:'name'});
 assert.equal(p.detailMode,'company');assert.equal(p.details.length,2);assert.equal(p.summary.total,444);
 const cat=m.project(rows(),{mode:'category',selected:'미분류'});
 assert.equal(cat.summary.total,11);assert.equal(cat.details[0].name,'배송비');
});
test('each overview ranks its own tab; only an individual selection changes detail grouping',()=>{
 for(const mode of ['company','item','category']){
  const overview=m.project(rows(),{mode,selected:null});
  assert.equal(overview.detailMode,mode);assert.equal(overview.summary.total,673);
  assert.equal(overview.details.reduce((sum,g)=>sum+g.total,0),673);
  assert.equal(overview.details.length,m.group(rows(),mode).length);
  const detail=m.project(rows(),{mode,selected:overview.details[0].id});
  assert.equal(detail.detailMode,mode==='item'?'company':'item');
  assert.equal(detail.summary.total,overview.details[0].total);
 }
});
test('overview company search matches names, item search distinguishes identical names by code',()=>{
 const company=m.project(rows(),{mode:'company',query:'회사 D'});
 assert.equal(company.details.length,1);assert.equal(company.details[0].id,'d');assert.equal(company.summary.total,673);
 const item=m.project(rows(),{mode:'item',query:'CODE-B'});
 assert.equal(item.details.length,1);assert.equal(item.details[0].total,218);
});
test('overview omits redundant 100 percent KPI, shows item codes, and exposes detail buttons',()=>{
 assert.match(js,/nd-sa-overview/);assert.match(js,/g.code\?e\(g.code\)\+' · '/);
 assert.match(js,/data-sa-detail=/);assert.match(js,/current.details\[Number\(button.dataset.saDetail\)\]/);
 assert.match(css,/nd-sa-kpis.nd-sa-overview\{grid-template-columns:repeat\(2/);
 assert.match(css,/nd-sa-share-meter\{display:flex;flex-direction:row/);
 assert.match(css,/:is\(th,td\).nd-sa-n\{text-align:right!important/);
});
test('invalid selection falls back to all; sorting and search never mutate source state',()=>{
 const r=rows(),state={mode:'company',selected:'missing',query:'nothing',sort:'qty'};
 const before=JSON.stringify({r,state}),p=m.project(r,state);
 assert.equal(p.selected,null);assert.equal(p.summary.total,673);assert.equal(p.details.length,0);
 assert.equal(JSON.stringify({r,state}),before);
});
test('percent bars preserve value labels while bounding visual width',()=>{
 assert.equal(m.share(333,551).label,'60.4%');assert.equal(m.share(1,0).label,'—');
 assert.equal(m.share(-10,100).width,0);assert.equal(m.share(-10,100).label,'-10.0%');
 assert.equal(m.share(110,100).width,100);assert.equal(m.share(110,100).label,'110.0%');
});
