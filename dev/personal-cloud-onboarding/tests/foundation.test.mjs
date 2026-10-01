import test from 'node:test';
import assert from 'node:assert/strict';
import {Onboarding,emptyData,tables,folders,bootstrap,boundedRead,fault,safeCode,message} from '../core.mjs';
import {GoogleDriveProvider,DropboxProvider,providerContract,providerFailure} from '../providers.mjs';
import {mockAuth,mockCloud} from '../mock.mjs';
import {createFirebaseAuth} from '../firebase-auth.mjs';
import {readFile} from 'node:fs/promises';
const syntheticEmail='person@example.invalid',syntheticPassword='local-mock-only';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(overrides={}){const auth={...mockAuth(),...overrides},cloud=mockCloud();return {auth,cloud,flow:new Onboarding({auth,providerFactory:(kind,uid,signal)=>new (kind==='drive'?GoogleDriveProvider:DropboxProvider)(cloud(kind,uid),{signal})})};}
async function verified(s){await s.flow.authenticate('signup',syntheticEmail,syntheticPassword,syntheticPassword);s.auth.confirmMockEmail();await s.flow.verify();}

for(const kind of ['drive','dropbox'])test(`${kind}: signup → verification → login → bootstrap → cleanup → reconnect`,async()=>{
 const s=setup();await verified(s);assert.equal(s.flow.state.screen,'storage');
 await s.flow.logout();await s.flow.authenticate('login',syntheticEmail,syntheticPassword);
 await s.flow.connect(kind);assert.equal(s.flow.state.ready,true);assert.deepEqual(s.flow.state.db,emptyData());
 await s.flow.logout();assert.equal(s.flow.state.db,null);assert.equal(s.flow.state.ready,false);assert.equal(s.flow.state.provider,null);
 await s.flow.authenticate('login',syntheticEmail,syntheticPassword);await s.flow.connect(kind);assert.deepEqual(s.flow.state.db,emptyData());
});
test('unverified account cannot connect',async()=>{
 const s=setup();await s.flow.authenticate('signup',syntheticEmail,syntheticPassword,syntheticPassword);
 await s.flow.connect('drive');assert.equal(s.flow.state.error,'EMAIL_NOT_VERIFIED');assert.equal(s.flow.state.ready,false);
});
test('password mismatch does not create account',async()=>{
 let count=0;const s=setup({signup:async()=>{count++;}});await s.flow.authenticate('signup',syntheticEmail,'one','two');assert.equal(count,0);assert.equal(s.flow.state.error,'PASSWORD_MISMATCH');
});
test('mail failure after signup preserves verification recovery, no repeated signup',async()=>{
 const s=setup({sendVerification:async()=>{throw fault('auth/quota-exceeded');}});
 await s.flow.authenticate('signup',syntheticEmail,syntheticPassword,syntheticPassword);assert.equal(s.flow.state.screen,'verify');assert.equal(s.flow.state.error,'auth/quota-exceeded');
});
test('reset generic acknowledgement',async()=>{const s=setup();await s.flow.reset(syntheticEmail);assert.equal(s.flow.state.screen,'reset-sent');});
test('duplicate submit suppressed',async()=>{
 const wait=deferred();let calls=0;const s=setup({login:()=>{calls++;return wait.promise;}});
 const first=s.flow.authenticate('login',syntheticEmail,syntheticPassword);assert.equal(await s.flow.authenticate('login',syntheticEmail,syntheticPassword),false);
 wait.resolve({uid:'mock-only',emailVerified:true});await first;assert.equal(calls,1);
});
test('two mock accounts isolated; no old db/provider reused',async()=>{
 const s=setup();await verified(s);await s.flow.connect('drive');const first=s.flow.state.db;
 await s.flow.logout();await s.flow.authenticate('signup','second@example.invalid',syntheticPassword,syntheticPassword);s.auth.confirmMockEmail();await s.flow.verify();await s.flow.connect('drive');
 assert.notEqual(s.flow.state.db,first);assert.deepEqual(s.flow.state.db,emptyData());
});
test('dispose during late Auth success: no READY, final signout and reuse denied',async()=>{
 const wait=deferred();let signouts=0;const s=setup({login:()=>wait.promise,logout:async()=>{signouts++;}});
 const run=s.flow.authenticate('login',syntheticEmail,syntheticPassword);await s.flow.dispose();wait.resolve({uid:'mock-only',emailVerified:true});await run;
 assert.equal(signouts,2);assert.equal(s.flow.state.ready,false);assert.equal(s.flow.state.db,null);assert.equal(await s.flow.authenticate('login',syntheticEmail,syntheticPassword),false);
});
test('late load and late failure cannot resurrect disposed state',async()=>{
 for(const fail of [false,true]){
  const wait=deferred(),started=deferred();const s=setup();await verified(s);
  const flow=new Onboarding({auth:s.auth,providerFactory:()=>({connect:async()=>{},disconnect:async()=>{},list:async()=>{started.resolve();return wait.promise;}})});
  await flow.authenticate('login',syntheticEmail,syntheticPassword);const run=flow.connect('drive');await started.promise;await flow.dispose();
  if(fail)wait.reject(fault('NETWORK_ERROR'));else wait.resolve([]);await run;
  assert.equal(flow.state.ready,false);assert.equal(flow.state.db,null);assert.equal(flow.state.error,null);
 }
});
test('signout failure fails closed',async()=>{const s=setup({logout:async()=>{throw fault('NETWORK_ERROR');}});await verified(s);await s.flow.logout();assert.equal(s.flow.state.busy,true);assert.equal(await s.flow.authenticate('login',syntheticEmail,syntheticPassword),false);});
test('runtime identity change blocks provider connect',async()=>{const s=setup();await verified(s);s.auth.reload=async()=>({uid:'different-mock',emailVerified:true});await s.flow.connect('drive');assert.equal(s.flow.state.error,'SESSION_EXPIRED');});
test('provider interface + folders + no non-bootstrap writes/assets',async()=>{
 const p=new GoogleDriveProvider(mockCloud()('drive','mock-only'));providerContract.forEach(k=>assert.equal(typeof p[k],'function'));
 await p.connect();await bootstrap(p);assert.equal((await p.list()).length,7);assert.equal(folders.length,8);
 await assert.rejects(p.save('NARO Biz/Data/companies.json',[{}],{createOnly:true,bootstrap:true}),{code:'WRITE_BLOCKED'});
 await assert.rejects(p.uploadAsset(),{code:'WRITE_BLOCKED'});
 await assert.rejects(p.save('NARO Biz/Data/settings.json',{schema:3,private:'forbidden'},{createOnly:true,bootstrap:true}),{code:'WRITE_BLOCKED'});
 await assert.rejects(p.save('NARO Biz/Data/companies.json',[],{createOnly:true,bootstrap:true}),{code:'STORAGE_CONFLICT'});
 await p.disconnect();await assert.rejects(p.list(),{code:'RECONNECT_REQUIRED'});
});
test('unconfigured real providers stop before network',async()=>{for(const Type of [GoogleDriveProvider,DropboxProvider])await assert.rejects(new Type().connect(),{code:'OAUTH_SETUP_REQUIRED'});});
test('partial bootstrap or unexpected source never overwritten',async()=>{
 let writes=0;await assert.rejects(bootstrap({list:async()=>['NARO Biz/Data/companies.json'],save:async()=>writes++}),{code:'STORAGE_CONFLICT'});assert.equal(writes,0);
});
test('schema mismatch never READY',async()=>{
 const p={list:async()=>[...tables,'settings'].map(k=>`NARO Biz/Data/${k}.json`),load:async p=>p.endsWith('settings.json')?{schema:2}:[]};await assert.rejects(bootstrap(p),{code:'STORAGE_INVALID'});
});
test('partial/ambiguous create failure: no automatic mutation retry',async()=>{
 let calls=0;const p=new DropboxProvider({connect:async()=>{},disconnect:async()=>{},list:async()=>[],prepareFolders:async()=>{},createOnly:async()=>{calls++;throw fault('NETWORK_ERROR');}});
 await p.connect();await assert.rejects(bootstrap(p));assert.equal(calls,1);
});
test('rate limit bounded to 3 total attempts',async()=>{let calls=0;const delays=[];await assert.rejects(boundedRead(async()=>{calls++;throw fault('RATE_LIMIT');},{sleep:async ms=>delays.push(ms),random:()=>0}),{code:'QUOTA_LIMIT'});assert.equal(calls,3);assert.deepEqual(delays,[300,600]);});
test('quota failure is immediate; no paid fallback',async()=>{let calls=0;await assert.rejects(boundedRead(async()=>{calls++;throw fault('QUOTA_LIMIT');}),{code:'QUOTA_LIMIT'});assert.equal(calls,1);assert.match(message('QUOTA_LIMIT'),/무료 사용 한도/);});
test('abort during backoff prevents further request',async()=>{const a=new AbortController();let calls=0;await assert.rejects(boundedRead(async()=>{calls++;throw fault('RATE_LIMIT');},{signal:a.signal,sleep:async()=>a.abort()}),{code:'CANCELLED'});assert.equal(calls,1);});
test('provider safe mappings and raw error suppression',()=>{assert.equal(providerFailure(401).code,'RECONNECT_REQUIRED');assert.equal(providerFailure(403,'dailyLimitExceeded').code,'QUOTA_LIMIT');assert.equal(providerFailure(429).code,'RATE_LIMIT');assert.equal(safeCode({message:'private payload',code:'private content'}),'UNAVAILABLE');});
test('Firebase adapter uses memory-only Auth APIs, no business SDK',async()=>{
 const calls=[];const user={uid:'mock-sdk-identity',emailVerified:false};const auth={currentUser:user};
 const sdk={inMemoryPersistence:'memory',initializeAuth:(_app,options)=>{calls.push(options.persistence);return auth;},
  createUserWithEmailAndPassword:async()=>({user}),signInWithEmailAndPassword:async()=>({user}),
  sendEmailVerification:async()=>calls.push('verification'),reload:async()=>{user.emailVerified=true;},sendPasswordResetEmail:async()=>calls.push('reset'),signOut:async()=>{auth.currentUser=null;}};
 const api=createFirebaseAuth(sdk,{});assert.equal((await api.signup(syntheticEmail,syntheticPassword)).emailVerified,false);await api.sendVerification();assert.equal((await api.reload()).emailVerified,true);await api.reset(syntheticEmail);await api.logout();assert.deepEqual(calls,['memory','verification','reset']);assert.equal(await api.reload(),null);
});
test('served runtime has no legacy references or persistence calls',async()=>{
 for(const name of ['app.mjs','core.mjs','providers.mjs','mock.mjs','index.html']){
  const source=await readFile(new URL(`../${name}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|firebase\/firestore|tenant-migration|business-card-gownii|api\.dropboxapi|fetch\(/);
 }
});
test('storage progress order, no partial READY',async()=>{
 const auth=mockAuth(),cloud=mockCloud(),screens=[];
 const flow=new Onboarding({auth,providerFactory:(kind,uid,signal)=>new GoogleDriveProvider(cloud(kind,uid),{signal}),onChange:s=>screens.push({screen:s.screen,ready:s.ready,db:s.db})});
 await flow.authenticate('signup',syntheticEmail,syntheticPassword,syntheticPassword);auth.confirmMockEmail();await flow.verify();await flow.connect('drive');
 assert.ok(screens.findIndex(s=>s.screen==='connecting')<screens.findIndex(s=>s.screen==='preparing'));
 assert.ok(screens.filter(s=>!s.ready).every(s=>s.db===null));assert.equal(flow.state.ready,true);
});
test('schema 3 empty defaults accepted by existing adapter without modifying it',async()=>{
 const {prepareSnapshot}=await import('../../../firebase-login-shell/adapter.mjs');assert.deepEqual(prepareSnapshot(emptyData()),emptyData());
});
test('entry graph self-contained; all modules resolve locally',async()=>{
 const seen=new Set();async function visit(name){if(seen.has(name))return;seen.add(name);
  const src=await readFile(new URL(`../${name}`,import.meta.url),'utf8');
  for(const match of src.matchAll(/from ['"]([^'"]+)['"]/g)){assert.ok(match[1].startsWith('./'));assert.ok(!match[1].includes('..'));await visit(match[1].slice(2));}
 }await visit('app.mjs');assert.deepEqual([...seen].sort(),['app.mjs','core.mjs','mock.mjs','providers.mjs','runtime.mjs']);
});
