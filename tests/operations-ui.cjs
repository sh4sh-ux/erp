const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=execFileSync('git',['show','9ca0259:index.html'],{cwd:root,encoding:'utf8',maxBuffer:2e6});
function context(source){
  const ctx=vm.createContext({document:{addEventListener(){},querySelectorAll(){return []},getElementById(){return {}}},window:{location:{origin:'http://localhost',pathname:'/'},addEventListener(){}},MutationObserver:class{observe(){}},console,URL,URLSearchParams,localStorage:{getItem(){return null}},setTimeout(){},clearTimeout(){}});
  vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/,''),ctx);return ctx;
}
const before=context(baseline),after=context(html),run=s=>vm.runInContext(s,after);
const functions=['addPayment','deletePayment','submitItem','deleteItem','saveTable','currentStocks','stockOptionRows','matchesStockFilter','stockRowStatus','saveStockMinimums','addStockMove','deleteStockMove','quoteTotals','quoteMargin','quoteShortage','quoteStockNeeds','quoteStockDone','expandBom','stockDeltaForQuote','syncStockForQuote','syncDecorationWorkQty','bindDeliveryPanel','loadAll','runMigrations'];
for(const name of functions)assert.equal(run(`${name}.toString()`),vm.runInContext(`${name}.toString()`,before),name+' changed');
// Wrapped entry points must also preserve the underlying declaration, not just wrapper text.
for(const name of ['addPayment','deletePayment','submitItem','deleteItem']){
  const declaration=s=>s.slice(s.indexOf('async function '+name+'('),s.indexOf('\n}',s.indexOf('async function '+name+'('))+2);
  assert.equal(declaration(html),declaration(baseline),name+' body changed');
}
for(const file of ['stock-entry.js','sw.js']){
  const normalize=s=>file==='sw.js'?s.replace(/const CACHE = "[^"]+";/,'const CACHE = "VERSION";'):s;
  assert.equal(normalize(fs.readFileSync(path.join(root,file),'utf8')),normalize(execFileSync('git',['show','9ca0259:'+file],{cwd:root,encoding:'utf8'})));
}
run(`db.items=[{id:'a',name:'Legacy'},{id:'b',category:''},{id:'c',category:' 조리복 '},{id:'d',category:'사용자 분류'}];const originals=JSON.stringify(db.items);`);
assert.equal(run(`JSON.stringify(itemCategories())`),JSON.stringify(['사용자 분류','조리복']));
assert.equal(run(`matchesItemCategory(db.items[0],'uncategorized')`),true);
assert.equal(run(`matchesItemCategory(db.items[1],'uncategorized')`),true);
assert.equal(run(`matchesItemCategory(db.items[2],'cat:조리복')`),true);
assert.equal(run(`matchesItemCategory(db.items[2],'cat:사용자 분류')`),false);
assert.equal(run(`JSON.stringify(db.items)===originals`),true);
run(`db.companies=[{id:'c',name:'긴 합성 거래처'}];db.quotes=[{id:'q',no:'UI-123'}];const payment={company_id:'c',quote_id:'q',date:'2026-09-20',kind:'수금',memo:'테스트'};const criteria={period:'month',month:'2026-09',from:'',to:'',kind:'',query:''};`);
assert.equal(run(`paymentMatches(payment,criteria)`),true);
for(const query of ['거래처','테스트','ui-123'])assert.equal(run(`paymentMatches(payment,{...criteria,query:${JSON.stringify(query)}})`),true);
assert.equal(run(`paymentMatches(payment,{...criteria,kind:'지급'})`),false);
assert.equal(run(`paymentMatches(payment,{...criteria,month:'2026-08'})`),false);
assert.equal(run(`paymentMatches(payment,{...criteria,period:'all',month:'2026-08'})`),true);
assert.equal(run(`paymentMatches(payment,{...criteria,period:'range',from:'2026-09-21'})`),false);
assert.equal(run(`paymentMatches(payment,{...criteria,period:'range',to:'2026-09-19'})`),false);
assert.equal(run(`paymentMatches(payment,{...criteria,period:'range',from:'2026-09-20',to:'2026-09-20'})`),true);
console.log('PASS: 24 protected functions, underlying save declarations, SW policy and stock-entry unchanged; optional category backward compatibility; payment search/date/kind filters');
