import test from 'node:test';import assert from 'node:assert/strict';
import {createDriveAccountBinding} from '../drive-account-binding.mjs';
import {createGoogleOAuth,driveScope} from '../google-oauth.mjs';
import {createGoogleBackend} from '../google-backend.mjs';
const locks={request:async(_key,_options,run)=>run()};
function fixture(){const values=new Map();const storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});return {values,storage,binding:options=>createDriveAccountBinding({uid:'naro-user-a',storage,locks,...options})};}
test('first selection stores only a UID-specific digest; known-account reconnect avoids forced selection',async()=>{
 const f=fixture(),first=f.binding();assert.equal(first.selectAccount,true);await first.verify('drive-user-a');first.assertCurrent();
 assert.equal(f.values.size,1);assert.match([...f.values.values()][0],/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify([...f.values]).includes('drive-user-a'));
 const next=f.binding();assert.equal(next.selectAccount,false);await next.verify('drive-user-a');next.assertCurrent();
 const other=f.binding({uid:'naro-user-b'});assert.equal(other.selectAccount,true);await other.verify('drive-user-a');assert.notEqual(...f.values.values());
});
test('unexpected Google account cannot change the binding',async()=>{
 const f=fixture();await f.binding().verify('drive-user-a');const before=[...f.values];
 await assert.rejects(f.binding().verify('drive-user-b'),{code:'DRIVE_ACCOUNT_MISMATCH'});assert.deepEqual([...f.values],before);
});
test('explicit account selection can change binding and fences the previous session',async()=>{
 const f=fixture(),old=f.binding();await old.verify('drive-user-a');
 const next=f.binding({selectAccount:true});assert.equal(next.selectAccount,true);await next.verify('drive-user-b');next.assertCurrent();
 assert.throws(()=>old.assertCurrent(),{code:'DRIVE_ACCOUNT_CHANGED'});
});
test('concurrent account selection cannot silently replace a newly committed binding',async()=>{
 const f=fixture(),a=f.binding(),b=f.binding({selectAccount:true});await a.verify('drive-user-a');
 await assert.rejects(b.verify('drive-user-b'),{code:'DRIVE_ACCOUNT_CHANGED'});a.assertCurrent();
});
test('logout, Firebase UID switch, abort and absent identity prevent account acceptance',async()=>{
 const f=fixture();let uid='naro-user-a';const b=f.binding({current:()=>uid});uid='naro-user-b';await assert.rejects(b.verify('drive-user-a'),{code:'SESSION_EXPIRED'});
 const c=new AbortController();c.abort();await assert.rejects(f.binding().verify('drive-user-a',c.signal),{code:'CANCELLED'});
 for(const id of [undefined,'',{},'x'.repeat(257)])await assert.rejects(f.binding().verify(id),{code:'DRIVE_ACCOUNT_UNVERIFIED'});
 assert.equal(f.values.size,0);
});
test('unavailable storage or Web Locks never enables a remembered fast reconnect',async()=>{
 const f=fixture();const noStorage={storage:()=>{throw Error('denied');}};await f.binding(noStorage).verify('drive-user-a');assert.equal(f.binding(noStorage).selectAccount,true);
 await f.binding({locks:null}).verify('drive-user-a');assert.equal(f.values.size,0);assert.equal(f.binding().selectAccount,true);
});
test('GIS keeps exact scope and uses empty prompt only with a known binding',async()=>{
 const f=fixture();let config;
 const oauth=createGoogleOAuth({origin:'http://localhost:4219',clientId:'synthetic',identity:{initTokenClient:c=>{config=c;return {requestAccessToken(){}};}},bindingFactory:opts=>f.binding(opts)});
 for(const [selectAccount,expected] of [[false,'select_account'],[false,''],[true,'select_account']]){
  oauth.reserve({uid:'naro-user-a',selectAccount});assert.equal(config.prompt,expected);assert.equal(config.scope,driveScope);assert.equal(config.include_granted_scopes,false);assert.equal(config.login_hint,undefined);
  config.callback({access_token:'synthetic',scope:driveScope,expires_in:3600});const result=await oauth.authorize();await result.accountBinding.verify('drive-user-a');
 }oauth.close();
});
test('backend rejects wrong-account token after one account read, before file discovery/bootstrap',async()=>{
 const f=fixture();await f.binding().verify('drive-user-a');const calls=[];
 const backend=createGoogleBackend({readOnly:true,initializeNew:true,oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000,accountBinding:f.binding()}),close(){}},fetcher:async(url,options)=>{calls.push({url,method:options.method});return new Response(JSON.stringify({user:{permissionId:'drive-user-b'}}));}});
 await assert.rejects(backend.connect(),{code:'DRIVE_ACCOUNT_MISMATCH'});await assert.rejects(backend.list(),{code:'RECONNECT_REQUIRED'});
 assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).pathname,'/drive/v3/about');assert.equal(new URL(calls[0].url).searchParams.get('fields'),'user(permissionId,emailAddress)');assert.equal(calls[0].method,'GET');assert.equal(backend.metrics().businessWriteRequests,0);await backend.disconnect();
});
test('backend verifies actual account before discovery and blocks stale session after explicit switch',async()=>{
 const f=fixture(),calls=[];const binding=f.binding();
 const backend=createGoogleBackend({oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000,accountBinding:binding}),close(){}},fetcher:async(url)=>{calls.push(url);return new Response(JSON.stringify(url.includes('/about?')?{user:{permissionId:'drive-user-a'}}:{files:[]}));}});
 await backend.connect();assert.equal(calls.length,1);assert.deepEqual(await backend.list(),[]);assert.equal(calls.length,3);
 await f.binding({selectAccount:true}).verify('drive-user-b');await assert.rejects(backend.list(),{code:'DRIVE_ACCOUNT_CHANGED'});assert.equal(calls.length,3);await backend.disconnect();
});

test('verified email hint is UID-scoped, digest-bound and ignored for explicit selection',async()=>{
 const f=fixture();await f.binding().verify('drive-user-a',undefined,'drive-a@example.test');
 assert.equal(f.binding().loginHint,'drive-a@example.test');
 assert.equal(f.binding({uid:'naro-user-b'}).loginHint,null);
 assert.equal(f.binding({selectAccount:true}).loginHint,null);
 const hint=JSON.parse(f.values.get('naro.drive-hint.v1:naro-user-a'));
 assert.deepEqual(Object.keys(hint).sort(),['digest','email']);
 assert.ok(!JSON.stringify([...f.values]).includes('drive-user-a'));
 f.values.set('naro.drive-hint.v1:naro-user-a',JSON.stringify({...hint,digest:'0'.repeat(64)}));
 assert.equal(f.binding().loginHint,null);
});
test('wrong account cannot replace remembered hint, explicit switch replaces it and fences old session',async()=>{
 const f=fixture(),old=f.binding();await old.verify('drive-user-a',undefined,'drive-a@example.test');const before=[...f.values];
 await assert.rejects(f.binding().verify('drive-user-b',undefined,'drive-b@example.test'),{code:'DRIVE_ACCOUNT_MISMATCH'});
 assert.deepEqual([...f.values],before);
 await f.binding({selectAccount:true}).verify('drive-user-b',undefined,'drive-b@example.test');
 assert.equal(f.binding().loginHint,'drive-b@example.test');assert.throws(()=>old.assertCurrent(),{code:'DRIVE_ACCOUNT_CHANGED'});
});
test('missing, malformed or unavailable email metadata falls back without an email hint',async()=>{
 const f=fixture();await f.binding().verify('drive-user-a',undefined,'drive-a@example.test');
 for(const value of [undefined,'','a@b\r\n.test','not-email',{},'x'.repeat(255)+'@example.test']){
  await f.binding().verify('drive-user-a',undefined,value);assert.equal(f.binding().loginHint,null);
 }
 f.values.set('naro.drive-hint.v1:naro-user-a','broken-json');assert.equal(f.binding().loginHint,null);
 const noStorage=f.binding({storage:()=>{throw Error('denied');}});assert.equal(noStorage.loginHint,null);
 await noStorage.verify('drive-user-a',undefined,'drive-a@example.test');noStorage.assertCurrent();
});
test('GIS supplies verified login_hint only for normal same-account reconnect; scope unchanged',async()=>{
 const f=fixture();await f.binding().verify('drive-user-a',undefined,'drive-a@example.test');let config;
 const oauth=createGoogleOAuth({origin:'http://localhost:4219',clientId:'synthetic',identity:{initTokenClient:c=>{config=c;return {requestAccessToken(){}};}},bindingFactory:opts=>f.binding(opts)});
 oauth.reserve({uid:'naro-user-a'});assert.equal(config.login_hint,'drive-a@example.test');assert.equal(config.prompt,'');assert.equal(config.scope,driveScope);assert.equal(config.include_granted_scopes,false);oauth.close();
 oauth.reserve({uid:'naro-user-a',selectAccount:true});assert.equal(config.login_hint,undefined);assert.equal(config.prompt,'select_account');oauth.close();
});
test('backend remembers email from the actual token-owner response without additional requests',async()=>{
 const f=fixture(),calls=[];const backend=createGoogleBackend({oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000,accountBinding:f.binding()}),close(){}},fetcher:async(url)=>{calls.push(url);return new Response(JSON.stringify({user:{permissionId:'drive-user-a',emailAddress:'drive-a@example.test'}}));}});
 await backend.connect();assert.equal(calls.length,1);assert.equal(f.binding().loginHint,'drive-a@example.test');assert.equal(backend.metrics().businessWriteRequests,0);await backend.disconnect();
});
