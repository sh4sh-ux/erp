import test from 'node:test';
import assert from 'node:assert/strict';
import {folders,emptyData} from '../personal-cloud-onboarding/core.mjs';
import {createGoogleBackend} from '../personal-cloud-onboarding/google-backend.mjs';
import {keys,datasetPath,GoogleDriveProvider,createStorageRepository} from './storage.mjs';
const paths=[...folders,...keys.map(datasetPath)];
function fixture({prefix='a',mutate=()=>{},response=body=>body,gate}={}){
 const nodes=paths.map((path,i)=>({id:prefix+i,name:path.split('/').pop(),mimeType:folders.includes(path)?'application/vnd.google-apps.folder':'application/json',appProperties:{naroPersonalCloud:'1'},parents:[path.includes('/')?prefix+paths.indexOf(path.slice(0,path.lastIndexOf('/'))):'root'],version:'1',trashed:false}));
 mutate(nodes);const calls=[];
 const backend=createGoogleBackend({readOnly:true,oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000}),close(){}},fetcher:async(url,options)=>{
  const u=new URL(url),q=u.searchParams.get('q');calls.push({q,method:options.method});assert.equal(options.method,'GET');
  if(q){
   const parent=q.match(/^'([^']+)'/)?.[1],names=[...q.matchAll(/name = '([^']+)'/g)].map(m=>m[1]);
   if(gate)await gate(q);
   return new Response(JSON.stringify(response({files:nodes.filter(n=>(!parent||n.parents?.includes(parent))&&names.includes(n.name)&&!n.trashed)},q)));
  }
  const n=nodes.find(n=>u.pathname.endsWith('/'+n.id));assert.ok(n);assert.equal(u.searchParams.get('alt'),'media');
  return new Response(JSON.stringify(n.name==='settings.json'?{schema:3}:[]));
 }});
 const provider=new GoogleDriveProvider(backend),repo=createStorageRepository(provider);
 return{nodes,calls,backend,provider,repo};
}
async function withFixture(options,run){const f=fixture(options);await f.provider.connect();try{await run(f);}finally{await f.provider.disconnect();}}
test('root and candidate searches overlap; seven media reads and fresh final validation remain',async()=>{
 let release;const bothStarted=new Promise(r=>release=r);let started=0;
 await withFixture({gate:async()=>{if(++started<=2){if(started===2)release();await bothStarted;}}},async f=>{
  assert.deepEqual(await f.repo.loadAll(),emptyData());assert.equal(f.calls.length,10);
  assert.equal(f.calls.filter(c=>c.q).length,3);assert.match(f.calls.at(-1).q,/ in parents/);
  assert.equal(f.backend.metrics().businessWriteRequests,0);
 });
});
test('same-name foreign metadata never enters workspace or media reads',async()=>{
 await withFixture({mutate:nodes=>{nodes.push(...structuredClone(nodes.slice(1)).map(n=>({...n,id:'other-'+n.id,parents:['unrelated']})));}},async f=>{
  assert.deepEqual(await f.repo.loadAll(),emptyData());assert.ok(f.repo.identities().every(i=>i.fileId.startsWith('a')));assert.equal(f.calls.length,10);
 });
});
test('missing, moved, unmarked, duplicate and wrong-type nodes block before media reads',async()=>{
 for(const change of ['missing','moved','marker','duplicate','type','version','duplicate-root'])await withFixture({mutate:nodes=>{
  const n=nodes.find(n=>n.name==='companies.json');
  if(change==='missing')nodes.splice(nodes.indexOf(n),1);
  if(change==='moved')n.parents=['unrelated'];
  if(change==='marker')n.appProperties={};
  if(change==='duplicate')nodes.push({...n,id:'copy',appProperties:{}});
  if(change==='type')n.mimeType='application/vnd.google-apps.shortcut';
  if(change==='version')delete n.version;
  if(change==='duplicate-root')nodes.push({...nodes[0],id:'second-root'});
 }},async f=>{await assert.rejects(f.repo.loadAll(),{code:'STORAGE_CONFLICT'});assert.ok(f.calls.every(c=>c.q));assert.throws(()=>f.repo.loadCollection('companies'));});
});
test('candidate pagination falls back to scoped discovery and never infers missing data',async()=>{
 await withFixture({response:(body,q)=>q.startsWith('(')?{files:[],nextPageToken:'synthetic-page'}:body},async f=>{
  assert.deepEqual(await f.repo.loadAll(),emptyData());assert.equal(f.calls.length,14);assert.equal(f.backend.metrics().datasetCreateRequests,0);
 });
});
test('incomplete search fails closed in root, candidates or final identity validation',async()=>{
 for(const stage of ['root','candidates','final'])await withFixture({response:(body,q)=>{
  const target=stage==='root'?q.startsWith("'root'"):stage==='candidates'?q.startsWith('('):q.includes("'a1' in parents");
  return target?{...body,incompleteSearch:true}:body;
 }},async f=>{await assert.rejects(f.repo.loadAll(),{code:'STORAGE_CONFLICT'});assert.throws(()=>f.repo.loadCollection('companies'));assert.equal(f.backend.metrics().businessWriteRequests,0);});
});
test('separate sessions do not reuse another provider file identity',async()=>{
 const sessions=[];for(const prefix of ['a','b'])await withFixture({prefix},async f=>{await f.repo.loadAll();sessions.push(f.repo.identities().map(i=>i.fileId));});
 assert.ok(sessions[0].every(id=>!sessions[1].includes(id)));
});
test('disconnect drains discovery and cannot publish late data',async()=>{
 let release,started;const hold=new Promise(r=>release=r),begun=new Promise(r=>started=r);
 const f=fixture({gate:async()=>{started();await hold;}});await f.provider.connect();const pending=f.repo.loadAll();await begun;await f.provider.disconnect();release();
 await assert.rejects(pending,{code:'CANCELLED'});assert.throws(()=>f.repo.loadCollection('companies'));assert.equal(f.calls.length,2);
});
