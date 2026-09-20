// Synthetic storage only. The VM has no fetch or production credentials.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/, '');
const plain=x=>JSON.parse(JSON.stringify(x));
function harness(script=source){
 const files=new Map(),writes=[],elements=new Map();
 const document={addEventListener(){},querySelectorAll(){return []},getElementById(id){if(!elements.has(id))elements.set(id,{value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){}});return elements.get(id)}};
 const ctx=vm.createContext({document,window:{location:{origin:'https://test.invalid',pathname:'/'},addEventListener(){}},localStorage:{getItem(){return null}},MutationObserver:class{observe(){}},crypto:webcrypto,console,setTimeout,clearTimeout,URL,URLSearchParams});
 const run=s=>vm.runInContext(s,ctx);run(script);
 ctx.mockRead=async p=>{if(p===ctx.failRead)throw Error('read failed');return files.has(p)?files.get(p):null;};
 ctx.mockWrite=async(p,s)=>{writes.push(p);if(p===ctx.failWrite)throw Error('write failed');files.set(p,s);};
 run(`dbxDownload=mockRead;dbxUpload=mockWrite;toast=()=>{};setSyncState=()=>{};renderCurrentView=()=>{};offerImportIfEmpty=()=>{};`);
 const root=run('DATA_DIR'),legacy=run('DATA_DIR_LEGACY');
 return {ctx,run,files,writes,root,legacy,document};
}
const fixtures={
 companies:[{id:'c',name:'거래처',memo:'메모',quote_memo:'',prices:[{item_id:'i',color:'WH',spec:'S',price:0}],contact:null}],
 items:[{id:'i',name:'품목',type:'단품',memo:'',buy_price:0,sell_price:-1,colors:['WH','BK'],variants:[{spec:'S',buy_price:'',sell_price:0}],components:[{item_id:'child',color:'',spec:null,qty:2}],stock_minimums:{'WH|S':0}}],
 quotes:[{id:'q',no:'Q-TEST',status:'수주',date:'2026-09-20',company_id:'c',memo:'견적 메모',lines:[{id:'l',item_id:'i',name:'품목',color:'',spec:null,unit:'EA',qty:0,price:-100,auto_qty:false}],deliveries:[{id:'d',date:'2026-09-19',lines:[{line_id:'l',qty:0}],memo:''}],delivered_at:null}],
 payments:[{id:'p',quote_id:null,company_id:'c',kind:'지급',amount:0,memo:''}],
 stock_moves:[{id:'s',item_id:'i',color:'',spec:'S',qty:1,kind:'입고',memo:'정정',batch_id:'b',replaces_id:null,reversal_of:'old',cancelled_at:null,audit:[{at:'2026-09-20',actor:'user',action:'edit',reason:'수정',before:{qty:0},after:{qty:1}}]}],
 material_moves:[{id:'m',company_id:'c',material:'패치',kind:'받음',qty:0,work_qty:0,per_unit:1,quote_id:null,memo:'',void_at:null}],
 settings:{schema:3,name:'공급자',memo:'',bank:null,zero:0,negative:-1}
};
module.exports={harness,fixtures,source,plain};
if(require.main===module)(async()=>{
 const baseline=execFileSync('git',['show','91184412a9abb8a45ab1104661f94652ddc83e1d:index.html'],{cwd:path.join(__dirname,'..'),encoding:'utf8'}).match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/, '');
 const bug=harness(baseline);bug.run('db.settings={schema:3};db.quotes=[{id:"q",status:"수주",date:"2026-09-20",lines:[],deliveries:[]}];');
 await bug.run('saveSettings()');assert.equal(JSON.parse(bug.files.get(bug.root+'/settings.json')).schema,undefined);
 await bug.run('runMigrations()');assert.equal(bug.run('db.quotes[0].delivered_at'),'2026-09-20');
 console.log('PASS: production baseline schema-loss bug reproduced without network');
 const h=harness();
 for(const [name,value] of Object.entries(fixtures)){
  h.ctx.value=value;h.ctx.name=name;
  const load=name==='settings'?'Table.loadObj(name)':'Table.load(name)';
  await h.run('Table.save(name,value)');assert.deepEqual(plain(await h.run(load)),value,name+' round trip');
  const created=Array.isArray(value)?[...value,{id:'new',memo:'',nullable:null,qty:0,price:-1}]:{...value,new_field:''};
  h.ctx.value=created;await h.run('Table.save(name,value)');assert.deepEqual(plain(await h.run(load)),created,name+' create');
  const updated=Array.isArray(created)?created.map(r=>({...r,memo:'changed'})):{...created,name:'changed'};
  h.ctx.value=updated;await h.run('Table.save(name,value)');assert.deepEqual(plain(await h.run(load)),updated,name+' update');
  const deleted=Array.isArray(updated)?updated.filter(r=>r.id!=='new'):{...value};
  h.ctx.value=deleted;await h.run('Table.save(name,value)');assert.deepEqual(plain(await h.run(load)),deleted,name+' delete snapshot');
 }
 const f=harness();f.files.set(f.legacy+'/items.json',JSON.stringify(fixtures.items));
 assert.deepEqual(plain(await f.run('Table.load("items")')),fixtures.items);
 await f.run('Table.save("items",[])');assert.deepEqual(plain(await f.run('Table.load("items")')),[]);
 assert.ok(f.files.has(f.legacy+'/items.json'),'legacy untouched');
 assert.deepEqual(plain(await f.run('Table.load("missing")')),[]);assert.deepEqual(plain(await f.run('Table.loadObj("missing")')),{});
 f.files.set(f.root+'/items.json','invalid');await assert.rejects(f.run('Table.load("items")'));
 f.ctx.failWrite=f.root+'/items.json';await assert.rejects(f.run('Table.save("items",[])'));
 console.log('PASS: seven JSON snapshot CRUD/shape contracts; legacy fallback, empty defaults, parse/write errors');

 const s=harness();s.run('db.settings={schema:3,name:"before"};db.quotes=[{id:"q",status:"수주",date:"2026-09-20",lines:[],deliveries:[]}];');
 s.document.getElementById('st_name').value='after';await s.run('saveSettings()');
 const saved=JSON.parse(s.files.get(s.root+'/settings.json'));
 assert.equal(saved.schema,3);s.writes.length=0;await s.run('runMigrations()');
 assert.equal(s.run('db.quotes[0].delivered_at'),undefined);assert.equal(s.writes.length,0);
 console.log('PASS: settings.schema preserved; current order not migrated after supplier save');
 for(const schema of [0,null,'',4]){s.ctx.schemaValue=schema;s.run('db.settings={schema:schemaValue}');await s.run('saveSettings()');assert.equal(JSON.parse(s.files.get(s.root+'/settings.json')).schema,schema);}
 s.run('db.settings={}');await s.run('saveSettings()');assert.ok(!Object.hasOwn(JSON.parse(s.files.get(s.root+'/settings.json')),'schema'),'no new schema introduced');
 const boundary=harness();boundary.run(`StorageRepository.loadCollection=async name=>['collection',name];StorageRepository.loadObject=async name=>({name});StorageRepository.saveSnapshot=async(name,data)=>{globalThis.savedSnapshot={name,data}};`);
 assert.deepEqual(plain(await boundary.run('Table.load("items")')),['collection','items']);
 assert.deepEqual(plain(await boundary.run('Table.loadObj("settings")')),{name:'settings'});
 await boundary.run('Table.save("payments",[{id:"p",amount:0}])');assert.deepEqual(plain(boundary.run('savedSnapshot')),{name:'payments',data:[{id:'p',amount:0}]});
 console.log('PASS: Table delegates all three contracts to the neutral snapshot boundary');

 function seeded(schema){const t=harness();for(const [n,v] of Object.entries(fixtures))t.files.set(t.root+'/'+n+'.json',JSON.stringify(n==='settings'?{schema}:v));return t;}
 const current=seeded(3);await current.run('loadAll()');assert.equal(current.writes.length,0);
 const old=seeded(2);await old.run('loadAll()');
 assert.deepEqual(old.writes.sort(),[old.root+'/quotes.json',old.root+'/settings.json'].sort());
 const first=old.files.get(old.root+'/quotes.json');old.writes.length=0;await old.run('loadAll()');
 assert.equal(old.writes.length,0);assert.equal(old.files.get(old.root+'/quotes.json'),first);
 const fail=seeded(2);fail.ctx.failRead=fail.root+'/items.json';await fail.run('loadAll()');assert.equal(fail.writes.length,0);
 const partial=seeded(2);partial.ctx.failWrite=partial.root+'/quotes.json';await partial.run('loadAll()');
 assert.equal(JSON.parse(partial.files.get(partial.root+'/settings.json')).schema,2);
 assert.equal(JSON.parse(partial.files.get(partial.root+'/quotes.json'))[0].delivered_at,null);
 partial.writes.length=0;partial.ctx.failWrite=null;await partial.run('loadAll()');assert.equal(partial.writes.length,2,'failed migration is retried');
 const reverse=seeded(2);reverse.ctx.failWrite=reverse.root+'/settings.json';await reverse.run('loadAll()');
 const migrated=reverse.files.get(reverse.root+'/quotes.json');reverse.ctx.failWrite=null;await reverse.run('loadAll()');
 assert.equal(reverse.files.get(reverse.root+'/quotes.json'),migrated,'retry preserves generated delivery IDs');
 console.log('PASS: latest/legacy/repeated load; read failure; ordered migration writes and retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
