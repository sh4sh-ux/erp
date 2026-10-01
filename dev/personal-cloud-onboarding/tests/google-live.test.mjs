import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGoogleOAuth,driveScope,driveOrigins} from '../google-oauth.mjs';
import {createGoogleBackend} from '../google-backend.mjs';
import {GoogleDriveProvider} from '../providers.mjs';
import {bootstrap,folders,emptyData} from '../core.mjs';
import {GoogleDriveProvider as UnifiedDrive,onboardingReadProvider} from '../../unified-storage/storage.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const grant={access_token:'synthetic-token',scope:driveScope,expires_in:3600};
function authFixture(){let config,started=0;const identity={initTokenClient(value){config=value;return {requestAccessToken(){started++;}};}};
 const oauth=createGoogleOAuth({identity,origin:'http://localhost:4219',clientId:'synthetic-public-client',timeout:1000});return {oauth,get config(){return config;},get started(){return started;}};}
function backendFixture({existing=false,foreign=false,quota=false,loss=false,...options}={}){
 const records=new Map(),calls=[],uploads=[];let counter=0;
 if(existing)records.set('existing',{id:'existing',name:'NARO Biz',mimeType:'application/vnd.google-apps.folder',parents:['root'],appProperties:foreign?{}:{naroPersonalCloud:'1'}});
 const locks={request:async(_name,_options,fn)=>fn({})};
 const fetcher=async(url,opts)=>{
  calls.push({url,method:opts.method});assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
  if(quota)return json({error:{errors:[{reason:'dailyLimitExceeded'}]}},403);
  const u=new URL(url);
  if(u.pathname.endsWith('/generateIds'))return json({ids:Array.from({length:15},()=>`synthetic-${++counter}`)});
  if(opts.method==='GET'&&u.searchParams.has('q')){
   const q=u.searchParams.get('q'),parent=q.match(/^'([^']+)'/)?.[1],names=[...q.matchAll(/name = '([^']+)'/g)].map(m=>m[1]);
   return json({files:[...records.values()].filter(r=>(!parent||r.parents.includes(parent))&&names.includes(r.name)&&!r.trashed)});
  }
  if(opts.method==='GET'&&u.searchParams.get('alt')==='media')return json(records.get(u.pathname.split('/').pop()).data);
  if(opts.method==='GET'&&u.searchParams.get('fields')?.includes('version'))return json({...records.get(u.pathname.split('/').pop()),version:'1'});
  if(opts.method==='POST'){
   const upload=u.pathname.startsWith('/upload/');
   const metadata=upload?JSON.parse(opts.body.split('\r\n\r\n')[1].split('\r\n--')[0]):JSON.parse(opts.body);
   assert.equal(records.has(metadata.id),false);assert.deepEqual(metadata.appProperties,{naroPersonalCloud:'1'});
   if(upload){uploads.push(metadata.name);metadata.data=JSON.parse(opts.body.split('\r\n\r\n')[2].split('\r\n--')[0]);}
   records.set(metadata.id,{...metadata,version:'1'});
   if(upload&&loss)throw Error('synthetic response loss');
   return json({id:metadata.id});
  }
  throw Error('unexpected request');
 };
 const oauth={authorize:async()=>({accessToken:'synthetic-token',expiresAt:Date.now()+600000}),close(){}};
 const backend=createGoogleBackend({oauth,fetcher,locks,...options});return {backend,records,calls,uploads,oauth,fetcher,locks};
}
test('unified public Google first user initializes, reconnect reads same files only',async()=>{
 const f=backendFixture({readOnly:true,businessWrite:true,extendedWrite:true,initializeNew:true});
 const p=onboardingReadProvider(new UnifiedDrive(f.backend),()=>{},{businessWrite:true,extendedWrite:true,initializeNew:true});
 await p.connect();try{
  await p.list();assert.equal(f.uploads.length,7);assert.equal(f.records.size,15);const ids=[...f.records.keys()];
  f.calls.length=0;await p.list();assert.deepEqual([...f.records.keys()],ids);assert.ok(f.calls.every(c=>c.method==='GET'));assert.equal(f.uploads.length,7);assert.equal(f.calls.length,10);assert.equal(f.calls.filter(c=>new URL(c.url).searchParams.has('q')).length,3);
 }finally{await p.disconnect();}
});
test('grouped discovery rejects duplicate and unmarked datasets without writing',async()=>{
 for(const duplicate of [true,false]){
  const f=backendFixture({readOnly:true,businessWrite:true,extendedWrite:true,initializeNew:true});
  const p=onboardingReadProvider(new UnifiedDrive(f.backend),()=>{},{initializeNew:true});await p.connect();
  try{
   await p.list();const node=[...f.records.values()].find(n=>n.name==='companies.json');
   if(duplicate)f.records.set('duplicate',{...node,id:'duplicate'});else node.appProperties={};
   f.calls.length=0;await assert.rejects(p.list(),{code:'STORAGE_CONFLICT'});assert.ok(f.calls.every(c=>c.method==='GET'));
  }finally{await p.disconnect();}
 }
});
test('batch identity recheck rejects changes during media reads and never publishes or writes',async()=>{
 for(const change of ['version','replacement','marker','duplicate','missing-version']){
  const f=backendFixture({readOnly:true,initializeNew:true});
  const init=onboardingReadProvider(new UnifiedDrive(f.backend),()=>{},{initializeNew:true});await init.connect();await init.list();await init.disconnect();
  let changed=false,published=false;
  const backend=createGoogleBackend({readOnly:true,oauth:f.oauth,fetcher:async(url,options)=>{
   const response=await f.fetcher(url,options);
   if(!changed&&new URL(url).searchParams.get('alt')==='media'){
    changed=true;const n=[...f.records.values()].find(n=>n.name==='companies.json');
    if(change==='version')n.version='2';
    if(change==='replacement')n.id='replacement';
    if(change==='marker')n.appProperties={};
    if(change==='duplicate')f.records.set('duplicate',{...n,id:'duplicate'});
    if(change==='missing-version')delete n.version;
   }return response;
  }});
  const p=onboardingReadProvider(new UnifiedDrive(backend),()=>{published=true;});
  f.calls.length=0;await p.connect();try{await assert.rejects(p.list(),{code:'STORAGE_CONFLICT'});assert.equal(published,false);assert.ok(f.calls.every(c=>c.method==='GET'));}finally{await p.disconnect();}
 }
});
test('unified public Google partial workspace never overwritten',async()=>{
 const f=backendFixture({existing:true,readOnly:true,initializeNew:true});const p=onboardingReadProvider(new UnifiedDrive(f.backend),()=>{},{initializeNew:true});
 await p.connect();try{await assert.rejects(p.list(),{code:'STORAGE_CONFLICT'});assert.ok(f.calls.every(c=>c.method==='GET'));}finally{await p.disconnect();}
});
test('GIS popup begins on reserve; exact single scope, no redirect or secret',async()=>{
 const f=authFixture();f.oauth.reserve();assert.equal(f.started,1);assert.equal(f.config.scope,driveScope);assert.equal(f.config.include_granted_scopes,false);
 assert.equal('redirect_uri' in f.config,false);assert.equal('client_secret' in f.config,false);
 f.config.callback(grant);const result=await f.oauth.authorize();assert.equal(result.accessToken,'synthetic-token');f.oauth.close();
 assert.deepEqual(driveOrigins,['https://naro-biz.web.app','http://localhost','http://localhost:4219']);
});
test('GIS rejects unapproved origin before opening',()=>{
 let calls=0;const oauth=createGoogleOAuth({origin:'http://127.0.0.1:4219',identity:{initTokenClient(){calls++;}}});
 assert.throws(()=>oauth.reserve(),{code:'OAUTH_SETUP_REQUIRED'});assert.equal(calls,0);
});
test('GIS denies extra or missing scopes and invalid lifetime',async()=>{
 for(const response of [{...grant,scope:driveScope+' other'},{...grant,scope:''},{...grant,expires_in:0}]){
  const f=authFixture();f.oauth.reserve();f.config.callback(response);await assert.rejects(f.oauth.authorize(),{code:'OAUTH_SETUP_REQUIRED'});
 }
});
test('GIS access denial, popup closed and blocked have safe codes',async()=>{
 for(const [kind,code] of [['access_denied','CANCELLED'],['popup_closed','CANCELLED'],['popup_failed_to_open','POPUP_BLOCKED']]){
  const f=authFixture();f.oauth.reserve();kind==='access_denied'?f.config.callback({error:kind,error_description:'not returned'}):f.config.error_callback({type:kind});
  await assert.rejects(f.oauth.authorize(),{code});
 }
});
test('GIS abort ignores a late callback',async()=>{
 const f=authFixture(),abort=new AbortController();f.oauth.reserve();const result=f.oauth.authorize(abort.signal);abort.abort();f.config.callback(grant);
 await assert.rejects(result,{code:'CANCELLED'});
});
test('Drive creates exactly eight folders and seven empty files with read-back',async()=>{
 const f=backendFixture(),provider=new GoogleDriveProvider(f.backend);await provider.connect();
 try{assert.deepEqual(await bootstrap(provider),emptyData());assert.equal(f.records.size,15);assert.equal(f.uploads.length,7);
  assert.equal(f.calls.filter(c=>c.url.includes('alt=media')).length,7);assert.ok(f.calls.every(c=>['GET','POST'].includes(c.method)));
  for(const r of f.records.values())if(r.data)assert.deepEqual(r.data,r.name==='settings.json'?{schema:3}:[]);
 }finally{await provider.disconnect();}
});
test('Drive existing valid structure reloads without writes',async()=>{
 const f=backendFixture(),provider=new GoogleDriveProvider(f.backend);await provider.connect();
 try{await bootstrap(provider);f.calls.length=0;assert.deepEqual(await bootstrap(provider),emptyData());assert.ok(f.calls.every(c=>c.method==='GET'));}
 finally{await provider.disconnect();}
});
test('Drive partial or foreign root cannot bootstrap or overwrite',async()=>{
 for(const foreign of [true,false]){const f=backendFixture({existing:true,foreign}),provider=new GoogleDriveProvider(f.backend);await provider.connect();
  try{await assert.rejects(bootstrap(provider),{code:'STORAGE_CONFLICT'});assert.ok(f.calls.every(c=>c.method==='GET'));}
  finally{await provider.disconnect();}
 }
});
test('Drive ambiguous mutation is not retried and cannot replay same file',async()=>{
 const f=backendFixture({loss:true}),provider=new GoogleDriveProvider(f.backend);await provider.connect();
 try{await assert.rejects(bootstrap(provider),{code:'NETWORK_ERROR'});assert.equal(f.uploads.length,1);
  await assert.rejects(f.backend.createOnly('NARO Biz/Data/companies.json',[]),{code:'WRITE_BLOCKED'});assert.equal(f.uploads.length,1);}
 finally{await provider.disconnect();}
});
test('Drive quota fails closed with no writes and no quota retry',async()=>{
 const f=backendFixture({quota:true}),provider=new GoogleDriveProvider(f.backend);await provider.connect();
 try{await assert.rejects(bootstrap(provider),{code:'QUOTA_LIMIT'});assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.method==='GET'));}
 finally{await provider.disconnect();}
});
test('Drive backend rejects non-empty business payloads and foreign paths',async()=>{
 const f=backendFixture();await f.backend.connect();try{
  await assert.rejects(f.backend.load('../other'),{code:'WRITE_BLOCKED'});
  await assert.rejects(f.backend.createOnly('NARO Biz/Data/companies.json',[]),{code:'WRITE_BLOCKED'});
  await f.backend.prepareFolders(folders);
  await assert.rejects(f.backend.createOnly('NARO Biz/Data/companies.json',[{synthetic:true}]),{code:'WRITE_BLOCKED'});
  await assert.rejects(f.backend.createOnly('NARO Biz/Data/settings.json',{schema:3,extra:true}),{code:'WRITE_BLOCKED'});
 }finally{await f.backend.disconnect();}
});
test('Drive expired token and disposed backend stop before requests',async()=>{
 const f=backendFixture();const backend=createGoogleBackend({...f,now:()=>Date.now()+1000000});
 await assert.rejects(backend.connect(),{code:'RECONNECT_REQUIRED'});assert.equal(f.calls.length,0);await backend.disconnect();
 await assert.rejects(backend.connect(),{code:'CANCELLED'});
});
test('Drive local concurrent bootstrap cannot write without lock',async()=>{
 const f=backendFixture();const backend=createGoogleBackend({...f,locks:{request:async(_n,_o,fn)=>fn(null)}});await backend.connect();
 try{await assert.rejects(backend.prepareFolders(folders),{code:'BUSY'});assert.equal(f.calls.length,0);}finally{await backend.disconnect();}
});
test('Drive adapters never persist credentials or log provider responses',async()=>{
 for(const file of ['google-oauth.mjs','google-backend.mjs']){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|console\.|client_secret|refresh_token/);
 }
});
