import test from 'node:test';import assert from 'node:assert/strict';
import {createGoogleBackend} from '../personal-cloud-onboarding/google-backend.mjs';
import {emptyData,folders} from '../personal-cloud-onboarding/core.mjs';
import {validateBusinessChange} from '../personal-cloud-onboarding/business-contract.mjs';
import {keys,datasetPath,GoogleDriveProvider,createStorageRepository} from './storage.mjs';
const company={id:'c1',name:'합성 거래처',type:'매출',prices:[]};
const item={id:'i1',name:'합성 품목',code:'SYN-1',type:'단품',components:[],variants:[]};
const quote={id:'q1',company_id:'c1',lines:[{id:'l1',item_id:'i1',name:'합성 품목',qty:2,price:100}],deliveries:[],status:'수주'};
async function setup({loss=false,lossBeforeWrite=false,rejectWrite=0,conflict=false,missing=false,disabled=false,transientValidator=false,extendedWrite=false}={}){
 const data=emptyData(),paths=[...folders,...keys.map(datasetPath)],writes=[];
 const nodes=paths.map((path,i)=>({id:'synthetic-'+i,name:path.split('/').pop(),mimeType:folders.includes(path)?'application/vnd.google-apps.folder':'application/json',appProperties:{naroPersonalCloud:'1'},parents:[path.includes('/')?'synthetic-'+paths.indexOf(path.slice(0,path.lastIndexOf('/'))):'root'],version:'1',trashed:false}));
 const fetcher=async(url,o)=>{
  const u=new URL(url);let body;
  if(u.pathname.endsWith('/files')){const q=u.searchParams.get('q');body={files:nodes.filter(n=>(!q.includes(' in parents')||q.includes("'"+n.parents[0]+"' in parents"))&&q.includes("name = '"+n.name+"'")&&!n.trashed)};}
  else{
   const n=nodes.find(n=>u.pathname.endsWith('/'+n.id));assert.ok(n);const key=n.name.replace('.json','');
   if(o.method==='PUT'){
    writes.push(key);assert.equal(o.headers['If-Match'],'"'+n.version+'"');assert.ok(u.pathname.startsWith('/upload/drive/v2/'));
    if(rejectWrite)return new Response('{}',{status:rejectWrite});
    if(conflict)return new Response('{}',{status:412});
    if(lossBeforeWrite)throw Error('synthetic transport failure before persistence');
    data[key]=JSON.parse(o.body);n.version=String(Number(n.version)+1);
    if(loss)throw Error('synthetic lost reply');body={id:n.id};
   }else if(u.pathname.startsWith('/drive/v2/')){
    if(transientValidator){transientValidator=false;throw Error('synthetic read network failure');}
    body={id:n.id,version:n.version,etag:missing?undefined:'"'+n.version+'"'};
   }
   else body=u.searchParams.get('alt')==='media'?data[key]:n;
  }
  return new Response(JSON.stringify(body));
 };
 const backend=createGoogleBackend({readOnly:true,businessWrite:!disabled,extendedWrite,fetcher,locks:{request:async(_k,_o,fn)=>fn({})},oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000}),close(){}}});
 const provider=new GoogleDriveProvider(backend);await provider.connect();const repo=createStorageRepository(provider,{businessWrite:true,extendedWrite});await repo.loadAll();return{repo,data,writes,backend};
}
test('extended Google settings and material saves retain file identity and survive reload',async()=>{
 const f=await setup({extendedWrite:true});const ids=f.repo.identities().map(i=>i.fileId);
 await f.repo.saveTable('settings',{schema:3,name:'합성 공급자'});
 await f.repo.saveTable('companies',[company]);
 const material={id:'m',company_id:company.id,kind:'받음',material:'합성 자재',qty:5,date:'2026-09-29',created_at:'2026-09-29T00:00:00Z'};
 await f.repo.saveTable('material_moves',[material]);
 await assert.rejects(f.repo.saveTable('companies',[]),{code:'VALIDATION'});
 await f.repo.loadAll();assert.equal(f.repo.loadObject('settings').name,'합성 공급자');
 assert.equal(f.repo.loadCollection('material_moves')[0].qty,5);
 assert.deepEqual(f.repo.identities().map(i=>i.fileId),ids);assert.deepEqual(f.writes,['settings','companies','material_moves']);
 assert.equal(f.backend.metrics().datasetCreateRequests,0);
});
test('business boundary: company create/edit, item, quote, delivery, receipt and stock use same files',async()=>{
 const f=await setup();
 await f.repo.saveTable('companies',[company]);await f.repo.saveTable('companies',[{...company,name:'합성 수정'}]);
 await f.repo.saveTable('items',[item]);await f.repo.saveTable('quotes',[quote]);
 const delivered={...quote,status:'납품',deliveries:[{id:'d1',lines:[{line_id:'l1',qty:2}]}]};
 await f.repo.saveTable('quotes',[delivered]);
 await f.repo.saveTable('stock_moves',[{id:'s1',item_id:'i1',quote_id:'q1',kind:'출고',qty:2}]);
 await f.repo.saveTable('payments',[{id:'p1',company_id:'c1',quote_id:'q1',kind:'수금',amount:220}]);
 assert.equal(f.writes.length,7);assert.equal(f.backend.metrics().datasetCreateRequests,0);
 const ids=f.repo.identities().map(i=>i.fileId);await f.repo.loadAll();assert.deepEqual(f.repo.identities().map(i=>i.fileId),ids);assert.equal(f.repo.loadCollection('payments')[0].amount,220);assert.equal(f.data.settings.schema,3);
});
test('business response loss: explicit recovery reads only, no duplicate PUT',async()=>{const f=await setup({loss:true});await assert.rejects(f.repo.saveTable('companies',[company]),{code:'SAVE_UNCONFIRMED'});await assert.rejects(f.repo.saveTable('items',[item]),{code:'SAVE_UNCONFIRMED'});await f.repo.saveTable('companies',null,{recover:true});assert.equal(f.writes.length,1);assert.equal(f.repo.loadCollection('companies').length,1);});
test('transient validator GET retries without repeating the write',async()=>{
 const f=await setup({transientValidator:true});await f.repo.saveTable('companies',[company]);
 assert.deepEqual(f.writes,['companies']);assert.equal(f.repo.loadCollection('companies').length,1);
});
test('unchanged read-back reports observation without unlocking or replaying a write',async()=>{
 const f=await setup({lossBeforeWrite:true});
 await assert.rejects(f.repo.saveTable('companies',[company]),{code:'SAVE_UNCONFIRMED'});
 await assert.rejects(f.repo.saveTable('companies',null,{recover:true}),{code:'SAVE_NOT_OBSERVED'});
 await assert.rejects(f.repo.saveTable('companies',[company]),{code:'SAVE_UNCONFIRMED'});
 assert.equal(f.writes.length,1);assert.equal(f.repo.loadCollection('companies').length,0);
});
for(const [status,code] of [[400,'UNAVAILABLE'],[401,'RECONNECT_REQUIRED'],[403,'UNAVAILABLE'],[429,'RATE_LIMIT']])test('explicit HTTP '+status+' rejection is not an ambiguous persisted write',async()=>{
 const f=await setup({rejectWrite:status});
 await assert.rejects(f.repo.saveTable('companies',[company]),{code,stage:'CONDITIONAL_WRITE'});
 assert.deepEqual(f.data.companies,[]);assert.equal(f.writes.length,1);
 await assert.rejects(f.repo.saveTable('companies',null,{recover:true}),{code:'STORAGE_INVALID'});
 assert.equal(f.writes.length,1);
});
test('HTTP 503 remains ambiguous and is never automatically replayed',async()=>{
 const f=await setup({rejectWrite:503});
 await assert.rejects(f.repo.saveTable('companies',[company]),{code:'SAVE_UNCONFIRMED'});
 await assert.rejects(f.repo.saveTable('companies',[company]),{code:'SAVE_UNCONFIRMED'});
 assert.equal(f.writes.length,1);
});
test('local quota rejection before PUT keeps zero network writes and no pending intent',async()=>{
 const f=await setup();
 while(f.backend.metrics().readRequests<117)await f.backend.identity(datasetPath('companies'));
 await assert.rejects(f.repo.saveTable('companies',[company]),{code:'QUOTA_LIMIT',stage:'CONDITIONAL_WRITE'});
 assert.equal(f.writes.length,0);
 await assert.rejects(f.repo.saveTable('companies',null,{recover:true}),{code:'STORAGE_INVALID'});
});
for(const [option,code] of [['conflict','STORAGE_CONFLICT'],['missing','CONCURRENCY_UNAVAILABLE'],['disabled','WRITE_BLOCKED']])test('business fails closed: '+option,async()=>{const f=await setup({[option]:true});await assert.rejects(f.repo.saveTable('companies',[company]),{code});assert.equal(f.repo.loadCollection('companies').length,0);});
test('business denies settings, materials, delete and malformed linked records before PUT',async()=>{
 const f=await setup();await f.repo.saveTable('companies',[company]);
 for(const key of ['settings','material_moves'])await assert.rejects(f.repo.saveTable(key,[]),{code:'WRITE_BLOCKED'});
 await assert.rejects(f.repo.saveTable('companies',[]),{code:'WRITE_BLOCKED'});
 await assert.rejects(f.repo.saveTable('payments',[{id:'p',company_id:'foreign',kind:'수금',amount:10}]),{code:'VALIDATION'});
 assert.equal(f.writes.length,1);
});
test('business double submission cannot enter backend twice',async()=>{const f=await setup();const saving=f.repo.saveTable('companies',[company]);await assert.rejects(f.repo.saveTable('companies',[company]),{code:'BUSY'});await saving;assert.equal(f.writes.length,1);});
test('manual stock receipt with audit is preserved when delivery appends an issue',async()=>{
 const f=await setup();await f.repo.saveTable('companies',[company]);await f.repo.saveTable('items',[item]);await f.repo.saveTable('quotes',[quote]);
 const receipt={id:'manual-1',item_id:'i1',kind:'입고',qty:1,quote_id:null,color:'',spec:'',date:'2026-09-29',memo:'합성 입고',audit:[{action:'add',before:null,after:[{qty:1,memo:'합성 입고'}]}]};
 await f.repo.saveTable('stock_moves',[receipt]);
 const delivered={...quote,deliveries:[{id:'delivery-1',lines:[{line_id:'l1',qty:1}]}]};await f.repo.saveTable('quotes',[delivered]);
 const issue={id:'issue-1',item_id:'i1',kind:'출고',qty:1,quote_id:'q1',color:'',spec:'',date:'2026-09-29',memo:'합성 출고'};
 await f.repo.saveTable('stock_moves',[receipt,issue]);await f.repo.loadAll();
 assert.deepEqual(f.repo.loadCollection('stock_moves'),[receipt,issue]);assert.equal(f.backend.metrics().datasetCreateRequests,0);
});
test('existing deliveries and ledger entries cannot be silently edited/deleted',()=>{
 const data={...emptyData(),companies:[company],items:[item],quotes:[quote]};
 const delivered={...quote,deliveries:[{id:'d1',lines:[{line_id:'l1',qty:1}]}]};
 assert.throws(()=>validateBusinessChange('quotes',[delivered],[quote],data),{code:'VALIDATION'});
 const stock={id:'s1',item_id:'i1',kind:'입고',qty:1};assert.throws(()=>validateBusinessChange('stock_moves',[stock],[{...stock,qty:2}],data),{code:'WRITE_BLOCKED'});
});
