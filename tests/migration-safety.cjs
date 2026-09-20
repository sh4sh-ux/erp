const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {harness,fixtures,plain}=require('./storage-contract.cjs');
const step1=cp.execFileSync('git',['show','0b5e4090e6331733d90cc5ae99965e0cfb20dbd7:index.html'],{cwd:path.join(__dirname,'..'),encoding:'utf8'}).match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/, '');
function seeded(script){
 const h=harness(script);h.events=[];
 for(const [n,v] of Object.entries(fixtures))h.files.set(h.root+'/'+n+'.json',JSON.stringify(n==='settings'?{schema:2,name:'supplier'}:v));
 h.files.set(h.root+'/quotes.json',JSON.stringify([{id:'legacy',no:'Q-old',status:'수주',date:'2020-01-02',memo:'keep',lines:[{item_id:'i',name:'품목',qty:3,price:100,color:'WH',spec:'S',auto_qty:false}]}]));
 h.ctx.record=(...args)=>h.events.push(args);h.run('toast=(...args)=>record("toast",...args);setSyncState=(...args)=>record("sync",...args);renderCurrentView=()=>record("render");offerImportIfEmpty=()=>record("import");');
 return h;
}
function failing(h,q,s){h.ctx.mockWrite=async(p,data)=>{h.writes.push(p);if((q&&p.endsWith('/quotes.json'))||(s&&p.endsWith('/settings.json')))throw Error('synthetic migration failure');h.files.set(p,data);};h.run('dbxUpload=mockWrite');}
const schema=h=>JSON.parse(h.files.get(h.root+'/settings.json')).schema;
(async()=>{
 for(const [label,q,s] of [['A',true,false],['B',false,true],['C',false,false],['D',true,true]]){
  const old=seeded(step1);failing(old,q,s);await old.run('loadAll()');
  assert.equal(old.writes.length,2);assert.equal(schema(old),s?2:3);
  assert.ok(old.events.some(e=>e[0]==='sync'&&e[1]==='saved'),'baseline hides failure '+label);
  const h=seeded();failing(h,q,s);const previous=plain(h.run('db'));
  const result=await h.run('loadAll()');assert.equal(schema(h),q||s?2:3);
  assert.deepEqual(h.writes,q?[h.root+'/quotes.json']:[h.root+'/quotes.json',h.root+'/settings.json']);
  if(q||s){
   assert.equal(result,false);assert.deepEqual(plain(h.run('db')),previous,'no partially loaded db published');
   assert.equal(h.document.getElementById('appView').inert,true);
   assert.ok(h.events.some(e=>e[0]==='sync'&&e[1]==='error'));
   assert.ok(!h.events.some(e=>e[0]==='render'||e[0]==='import'||(e[0]==='sync'&&e[1]==='saved')));
  }else assert.equal(h.document.getElementById('appView').inert,false);
  const persisted=q?null:h.files.get(h.root+'/quotes.json');
  failing(h,false,false);await h.run('loadAll()');
  if(persisted)assert.equal(h.files.get(h.root+'/quotes.json'),persisted,'persisted IDs/values stable on retry');
  const first=plain(h.run('db.quotes'));const writes=h.writes.length;
  for(let n=2;n<=3;n++){await h.run('loadAll()');assert.deepEqual(plain(h.run('db.quotes')),first);assert.equal(schema(h),3);}
  assert.equal(h.writes.length,writes);assert.equal(first[0].deliveries.length,1);assert.equal(first[0].legacy_stock,true);
  assert.equal(first[0].deliveries[0].date,'2020-01-02');assert.equal(first[0].lines[0].qty,3);assert.equal(first[0].lines[0].price,100);
  assert.equal(first[0].lines[0].auto_qty,false);assert.equal(h.run('quoteTotals(db.quotes[0]).total'),330);
  assert.equal(h.document.getElementById('appView').inert,false);
  console.log('PASS: CASE '+label+' baseline vs ordered writes, failure reporting, recovery and 3-load stability');
 }
 // Direct caller receives failure; after a persisted quote, retry retains generated IDs.
 const direct=seeded();direct.run('db.quotes='+direct.files.get(direct.root+'/quotes.json')+';db.settings={schema:2}');
 failing(direct,false,true);await assert.rejects(direct.run('runMigrations()'),/synthetic/);
 const persisted=direct.files.get(direct.root+'/quotes.json');assert.equal(direct.run('db.settings.schema'),2);
 failing(direct,false,false);await direct.run('runMigrations()');assert.equal(direct.files.get(direct.root+'/quotes.json'),persisted);
 const once=plain(direct.run('db'));await direct.run('runMigrations()');await direct.run('runMigrations()');assert.deepEqual(plain(direct.run('db')),once);
 // Hold quote write pending: settings must not start before successful resolution.
 const pending=seeded();pending.run('db.quotes='+pending.files.get(pending.root+'/quotes.json')+';db.settings={schema:2}');let release;
 pending.ctx.mockWrite=(p,data)=>{pending.writes.push(p);if(p.endsWith('/quotes.json'))return new Promise(resolve=>{release=()=>{pending.files.set(p,data);resolve();};});pending.files.set(p,data);return Promise.resolve();};
 pending.run('dbxUpload=mockWrite');
 const task=pending.run('runMigrations()');assert.deepEqual(pending.writes,[pending.root+'/quotes.json']);assert.equal(pending.run('db.settings.schema'),2);release();await task;
 assert.equal(pending.writes.length,2);assert.equal(pending.run('db.settings.schema'),3);
 console.log('PASS: direct throw, in-memory retry, triple idempotency and awaited data-before-schema ordering');
})().catch(e=>{console.error(e);process.exitCode=1;});
