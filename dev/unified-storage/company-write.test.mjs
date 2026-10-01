import test from 'node:test';import assert from 'node:assert/strict';
import {createGoogleBackend} from '../personal-cloud-onboarding/google-backend.mjs';
import {folders} from '../personal-cloud-onboarding/core.mjs';
import {keys,datasetPath,GoogleDriveProvider,createStorageRepository} from './storage.mjs';
const record=()=>({id:'synthetic-company-1',name:'합성 검증 거래처',type:'매출',biz_no:'',contact:'',phone:'',email:'',address_base:'',address_detail:'',address:'',memo:'',quote_memo:'',prices:[],created_at:'2026-09-29T00:00:00.000Z'});
async function setup({etag='"revision-1"',conflict=false,lost=false,denied=false,validatorVersion='1',wrongId=false}={}){
 const paths=[...folders,...keys.map(datasetPath)],nodes=paths.map((path,i)=>({id:'synthetic-'+i,name:path.split('/').pop(),mimeType:folders.includes(path)?'application/vnd.google-apps.folder':'application/json',appProperties:{naroPersonalCloud:'1'},parents:[path.includes('/')?'synthetic-'+paths.indexOf(path.slice(0,path.lastIndexOf('/'))):'root'],version:'1',trashed:false}));
 const data=Object.fromEntries(keys.map(k=>[k,k==='settings'?{schema:3}:[]])),writes=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url);let body;
  if(u.pathname.endsWith('/files')){const q=u.searchParams.get('q');body={files:nodes.filter(n=>(!q.includes(' in parents')||q.includes("'"+n.parents[0]+"' in parents"))&&q.includes("name = '"+n.name+"'")&&!n.trashed)};}
  else {const node=nodes.find(n=>u.pathname.endsWith('/'+n.id));assert.ok(node);const key=node.name.replace('.json','');
   if(options.method==='PUT'){
    assert.ok(u.pathname.startsWith('/upload/drive/v2/files/'));
    writes.push({key,header:options.headers['If-Match']});assert.equal(key,'companies');assert.equal(options.headers['If-Match'],'"revision-1"');
    if(conflict)return new Response('{}',{status:412});if(denied)return new Response('{}',{status:403});
    data[key]=JSON.parse(options.body);node.version='2';if(lost)throw Error('synthetic response loss');body={id:node.id,version:node.version};
   }else if(u.pathname.startsWith('/drive/v2/')){
    assert.equal(key,'companies');assert.equal(u.searchParams.get('fields'),'id,version,etag');
    body={id:wrongId?'foreign':node.id,version:validatorVersion,etag:etag||undefined};
   }else body=u.searchParams.get('alt')==='media'?data[key]:node;
  }
  // Reproduce the actual browser failure: no ETag response header is exposed.
  return new Response(JSON.stringify(body));
 };
 const backend=createGoogleBackend({readOnly:true,companiesCreate:true,fetcher,locks:{request:async(_k,_o,fn)=>fn({})},oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000}),close(){}}});
 const provider=new GoogleDriveProvider(backend);await provider.connect();const repo=createStorageRepository(provider,{companiesCreate:true});await repo.loadAll();return {backend,repo,data,writes};
}
test('company conditional PUT uses JSON validator without HTTP ETag and verifies readback',async()=>{const f=await setup();const rows=await f.repo.createCompany(record());assert.deepEqual(rows,[record()]);assert.equal(f.writes.length,1);assert.equal(f.backend.metrics().datasetCreateRequests,0);assert.equal(f.data.items.length,0);assert.equal(f.data.settings.schema,3);assert.equal(f.repo.loadCollection('companies').length,1);});
test('same stable ID recovers without a second mutation',async()=>{const f=await setup();await f.repo.createCompany(record());await f.repo.createCompany(record(),{recoveryOnly:true});assert.equal(f.writes.length,1);});
test('response loss remains uncertain, next action only reads persisted result',async()=>{const f=await setup({lost:true});await assert.rejects(f.repo.createCompany(record()),{code:'SAVE_UNCONFIRMED'});assert.equal(f.repo.loadCollection('companies').length,0);await f.repo.createCompany(record(),{recoveryOnly:true});assert.equal(f.writes.length,1);assert.equal(f.repo.loadCollection('companies').length,1);});
test('missing validator blocks before network mutation',async()=>{const f=await setup({etag:false});await assert.rejects(f.repo.createCompany(record()),{code:'CONCURRENCY_UNAVAILABLE'});assert.equal(f.writes.length,0);});
test('412 prevents overwrite and leaves local snapshot unchanged',async()=>{const f=await setup({conflict:true});await assert.rejects(f.repo.createCompany(record()),{code:'STORAGE_CONFLICT'});assert.equal(f.data.companies.length,0);assert.equal(f.repo.loadCollection('companies').length,0);});
test('recovery without a saved record cannot send new write',async()=>{const f=await setup();await assert.rejects(f.repo.createCompany(record(),{recoveryOnly:true}),{code:'SAVE_UNCONFIRMED'});assert.equal(f.writes.length,0);});
test('malformed company denied before write',async()=>{const f=await setup();await assert.rejects(f.repo.createCompany({...record(),name:''}),{code:'VALIDATION'});assert.equal(f.writes.length,0);});
test('concurrent duplicate submit blocked; generic writes remain disabled',async()=>{const f=await setup();const first=f.repo.createCompany(record());await assert.rejects(f.repo.createCompany(record()),{code:'BUSY'});await first;assert.equal(f.writes.length,1);assert.throws(()=>f.repo.saveSnapshot('items',[]),{code:'WRITE_BLOCKED'});});
test('read-only preflight obtains JSON validator before enabling registration',async()=>{const f=await setup();assert.deepEqual(await f.repo.checkCompanyWrite(),{ready:true});assert.equal(f.writes.length,0);});
test('missing JSON validator fails preflight without mutation',async()=>{const f=await setup({etag:false});await assert.rejects(f.repo.checkCompanyWrite(),{code:'CONCURRENCY_UNAVAILABLE'});assert.equal(f.writes.length,0);});
for(const etag of ['W/"weak"','*','unquoted','"bad\r\nvalue"'])test('invalid validator is rejected: '+JSON.stringify(etag),async()=>{const f=await setup({etag});await assert.rejects(f.repo.createCompany(record()),{code:'CONCURRENCY_UNAVAILABLE'});assert.equal(f.writes.length,0);});
test('version changed before conditional update prevents any write',async()=>{const f=await setup({validatorVersion:'2'});await assert.rejects(f.repo.createCompany(record()),{code:'STORAGE_CONFLICT'});assert.equal(f.writes.length,0);});
test('validator for another file cannot authorize a write',async()=>{const f=await setup({wrongId:true});await assert.rejects(f.repo.createCompany(record()),{code:'STORAGE_CONFLICT'});assert.equal(f.writes.length,0);});
