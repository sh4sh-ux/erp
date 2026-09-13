// Real production functions, isolated memory/transport. Never accesses business files.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/,'');
function fixture(){
 const els=new Map();
 const document={addEventListener(){},querySelectorAll(){return []},getElementById(id){if(!els.has(id))els.set(id,{value:'',innerHTML:'',disabled:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){}});return els.get(id)}};
 const c=vm.createContext({document,window:{location:{origin:'http://localhost',pathname:'/'},addEventListener(){}},localStorage:{getItem(){return null}},MutationObserver:class{observe(){}},crypto:webcrypto,console,setTimeout,clearTimeout,URL,URLSearchParams,confirm:()=>true});
 vm.runInContext(source,c);vm.runInContext(fs.readFileSync(path.join(root,'stock-entry.js'),'utf8'),c);
 const run=s=>vm.runInContext(s,c);
 run(`toast=()=>{};renderQtList=()=>{};renderQtDetail=()=>{};renderPay=()=>{};renderCoList=()=>{};renderCoDetail=()=>{};renderItList=()=>{};renderItDetail=()=>{};
 db.items=[{id:'i',name:'셰프복',code:'JK-1',type:'단품',colors:['WH'],variants:[{spec:'L'}]}];
 db.companies=[{id:'c',name:'회사'}];db.stock_moves=[];db.payments=[];db.material_moves=[];
 const q={...blankQuote(),id:'q',no:'Q-1',company_id:'c',date:'2026-09-01',status:'수주',lines:[{id:'l',item_id:'i',name:'셰프복 [JK-1]',color:'WH',spec:'L',qty:10,price:100}],deliveries:[]};db.quotes=[q];
 const entry={item_id:'i',date:'2026-09-01',color:'WH',spec:'L',kind:'입고',qty:30,memo:''};
 saveStockChecked=async()=>{};saveTable=async()=>true;`);
 return {run,els};
}
let failures=0,passed=0;
async function check(name,test){try{await test();passed++;console.log('PASS: '+name)}catch(e){failures++;console.log('FAIL: '+name+' — '+e.message)}}
(async()=>{
 await check('stock lifecycle: receipt → partial delivery → repeat save → completion → correction → cancellation',async()=>{
  const {run}=fixture();run('db.stock_moves=stockPlan([], {kind:"add",entries:[entry]},db.items).next');
  assert.equal(run('currentStocks()["i|WH|L"]'),30);
  assert.equal(run('stockOptionRows()[0].available'),20);
  run('q.deliveries=[{id:"d1",date:"2026-08-31",lines:[{line_id:"l",qty:4}]}];normalizeDeliveryStatus(q)');
  await run('syncStockForQuote(q,{ask:false})');assert.equal(run('currentStocks()["i|WH|L"]'),26);
  assert.equal(run('stockOptionRows()[0].reserved'),6);assert.equal(run('stockOptionRows()[0].available'),20);
  const count=run('db.stock_moves.length');await run('syncStockForQuote(q,{ask:false})');assert.equal(run('db.stock_moves.length'),count);
  run('q.deliveries.push({id:"d2",date:"2026-09-02",lines:[{line_id:"l",qty:6}]});normalizeDeliveryStatus(q)');
  await run('syncStockForQuote(q,{ask:false})');assert.equal(run('currentStocks()["i|WH|L"]'),20);
  assert.equal(run('monthSales("2026-08").total'),440);assert.equal(run('monthSales("2026-09").total'),660);
  run('q.deliveries[1].lines[0].qty=3;normalizeDeliveryStatus(q)');await run('syncStockForQuote(q,{ask:false})');assert.equal(run('currentStocks()["i|WH|L"]'),23);
  run('q.deliveries=[];q.status="취소"');await run('syncStockForQuote(q,{ask:false})');assert.equal(run('currentStocks()["i|WH|L"]'),30);
  run('const original=db.stock_moves[0];db.stock_moves=stockPlan(db.stock_moves,{kind:"edit",id:original.id,entries:[{...entry,qty:35}],reason:"수량 정정"},db.items).next');
  assert.equal(run('currentStocks()["i|WH|L"]'),35);assert.equal(run('db.stock_moves[0].qty'),30);
  run('const replacement=db.stock_moves.at(-1);db.stock_moves=stockPlan(db.stock_moves,{kind:"void",id:replacement.id,entries:[],reason:"중복"},db.items).next');
  assert.equal(run('currentStocks()["i|WH|L"]'),0);
 });
 await check('nested set consumes components, not service or set inventory',async()=>{
  const {run}=fixture();run(`db.items.push({id:'work',name:'자수',type:'작업'},{id:'set',type:'세트',components:[{item_id:'i',color:'WH',spec:'L',qty:2},{item_id:'work',qty:1}]});q.lines=[{id:'l',item_id:'set',name:'세트',qty:3,price:1000}];q.deliveries=[{id:'d',date:'2026-09-01',lines:[{line_id:'l',qty:2}]}];normalizeDeliveryStatus(q)`);
  assert.equal(run('quoteStockNeeds(q)["i|WH|L"]'),4);assert.equal(run('Object.keys(quoteStockNeeds(q)).length'),1);
 });
 await check('quote save followed by stock conflict preserves stock and retry is idempotent',async()=>{
  const {run}=fixture();run('db.stock_moves=stockPlan([],{kind:"add",entries:[entry]},db.items).next;qtEditing=JSON.parse(JSON.stringify(q));qtEditing.deliveries=[{id:"d",date:"2026-09-01",lines:[{line_id:"l",qty:2}]}];saveStockChecked=async()=>{throw Error("conflict")}');
  await run('submitQuote(false)');assert.equal(run('quoteDeliveredQty(db.quotes[0])'),2);assert.equal(run('currentStocks()["i|WH|L"]'),30);
  run('saveStockChecked=async()=>{}');await run('syncStockForQuote(db.quotes[0],{ask:false})');assert.equal(run('currentStocks()["i|WH|L"]'),28);
  const n=run('db.stock_moves.length');await run('syncStockForQuote(db.quotes[0],{ask:false})');assert.equal(run('db.stock_moves.length'),n);
 });
 await check('quote deletion requires independently confirmed stock restoration',async()=>{
  const {run}=fixture();run('db.stock_moves=[{id:"out",quote_id:"q",item_id:"i",color:"WH",spec:"L",kind:"출고",qty:2}];saveStockChecked=async()=>{throw Error("offline")}');
  await run('deleteQuote("q")');assert.equal(run('db.quotes.length'),1);assert.equal(run('db.stock_moves.length'),1);
 });
 for(const [name,table,id,fn] of [['quote','quotes','q','deleteQuote'],['company','companies','c','deleteCompany'],['item','items','i','deleteItem'],['payment','payments','p','deletePayment']]){
  await check(name+' deletion failure preserves local record',async()=>{
   const {run}=fixture();run('db.payments=[{id:"p",company_id:"c",kind:"수금",amount:100}];saveTable=async()=>false');
   await run(`${fn}('${id}')`);assert.equal(run(`db.${table}.some(r=>r.id==='${id}')`),true);
  });
 }
 await check('successful deletions persist before removing local records',async()=>{
  for(const [table,id,fn] of [['quotes','q','deleteQuote'],['companies','c','deleteCompany'],['items','i','deleteItem'],['payments','p','deletePayment']]){
   const {run}=fixture();run(`db.payments=[{id:'p'}];saveTable=async(name,next)=>{if(!db[name].some(x=>x.id==='${id}'))throw Error('premature mutation');if(next.some(x=>x.id==='${id}'))throw Error('not removed from candidate');return true;}`);
   await run(`${fn}('${id}')`);assert.equal(run(`db.${table}.some(x=>x.id==='${id}')`),false);
  }
 });
 await check('failed item create/update preserves original and editable draft',async()=>{
  const {run}=fixture();run(`itSel='i';itEditing={...blankItem(),id:'i',name:'변경 품목'};saveTable=async()=>false`);
  await run('submitItem(false)');assert.notEqual(run('db.items[0].name'),'변경 품목');assert.equal(run('itEditing.name'),'변경 품목');
  run(`itEditing={...blankItem(),name:'새 품목'};itSel='__new__'`);await run('submitItem(true)');assert.equal(run('db.items.length'),1);assert.equal(run('itEditing.id'),null);
 });
 await check('failed payment add preserves input; success adds once',async()=>{
  const {run}=fixture();run(`document.getElementById('payDate').value='2026-09-13';document.getElementById('payCo').value='c';document.getElementById('payKind').value='수금';document.getElementById('payAmt').value='1,000';saveTable=async()=>false`);
  await run('addPayment()');assert.equal(run('db.payments.length'),0);assert.equal(run(`document.getElementById('payAmt').value`),'1,000');
  run('saveTable=async()=>true');await run('addPayment()');assert.equal(run('db.payments.length'),1);assert.equal(run('db.payments[0].amount'),1000);
 });
 await check('double submission is blocked until pending write finishes',async()=>{
  const {run}=fixture();run(`itEditing={...blankItem(),name:'신규'};let releaseWrite;let writeCount=0;saveTable=()=>{writeCount++;return new Promise(r=>releaseWrite=r)};`);
  const first=run('submitItem(true)');await run('submitItem(true)');assert.equal(run('writeCount'),1);assert.equal(run('guardMasterLeave("items")'),false);run('releaseWrite(true)');await first;assert.equal(run('db.items.length'),2);assert.equal(run('pendingMasterWrites.size'),0);
 });
 await check('company/item leave cancel preserves changes; confirm discards',async()=>{
  const {run}=fixture();run(`const control={id:'f_name',value:'old'};document.getElementById('coForm').querySelectorAll=()=>[control];coFormBaseline=companyFormSnapshot();control.value='draft';confirm=()=>false;itEditing={...blankItem(),name:'old'};itFormBaseline=JSON.stringify(itEditing);itEditing.name='draft'`);
  assert.equal(run('guardMasterLeave("companies")'),false);assert.equal(run('guardMasterLeave("items")'),false);assert.equal(run('itEditing.name'),'draft');
  run('confirm=()=>true');assert.equal(run('guardMasterLeave("companies")'),true);assert.equal(run('guardMasterLeave("items")'),true);assert.equal(run('itEditing'),null);
 });
 await check('receivables filter excludes credit and zero; all retains both',async()=>{
  const {run}=fixture();run(`arData=()=>[{open:100},{open:0},{open:-100}];document.getElementById('arFilter').value='open'`);
  assert.equal(run('arRows().length'),1);run(`document.getElementById('arFilter').value='all'`);assert.equal(run('arRows().length'),3);
 });
 await check('shortage warning identifies same-name items by code',async()=>{
  const {run}=fixture();assert(run('quoteShortage(q)[0].label').includes('JK-1'));
 });
 await check('printed quote retains historical code, totals and escaped memo',async()=>{
  const {run,els}=fixture();run(`window.matchMedia=()=>({matches:false});window.print=()=>{};db.settings={name:'공급자',address:'서울',bank:'은행'};q.lines[0].name='셰프복 [OLD-CODE]';q.memo='<script>unsafe</script>';printQuote(q,'견적서')`);
  const output=els.get('printArea').innerHTML;assert(output.includes('OLD-CODE'));assert(!output.includes('<script>unsafe'));assert(output.includes('1,100'));
 });
 console.log(JSON.stringify({passed,failed:failures}));if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
