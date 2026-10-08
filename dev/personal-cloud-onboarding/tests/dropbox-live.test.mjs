import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pkce,validCallback,createDropboxOAuth,scopes} from '../dropbox-oauth.mjs';
import {createDropboxBackend} from '../dropbox-backend.mjs';
import {DropboxProvider} from '../providers.mjs';
import {bootstrap,folders,emptyData} from '../core.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const missing=()=>json({error:{'.tag':'path',path:{'.tag':'not_found'}}},409);
function backendFixture({existing=false,failUpload=false,quota=false}={}){
 const calls=[],stored=new Map(),created=[];let connected=false;
 const oauth={authorize:async()=>{connected=true;return {accessToken:'synthetic-only',expiresAt:Date.now()+600000};},close(){connected=false;}};
 const fetcher=async(url,opts)=>{
  assert.ok(connected);const arg=opts.headers['Dropbox-API-Arg']?JSON.parse(opts.headers['Dropbox-API-Arg']):JSON.parse(opts.body);
  calls.push({route:url.split('/').pop(),arg});
  if(quota)return json({},429);
  if(url.endsWith('get_metadata'))return existing?json({'.tag':'folder'}):missing();
  if(url.endsWith('list_folder'))return json({entries:[],has_more:false});
  if(url.endsWith('create_folder_v2')){assert.equal(arg.autorename,false);created.push(arg.path);return json({metadata:{'.tag':'folder'}});}
  if(url.endsWith('upload')){
   assert.deepEqual({mode:arg.mode,autorename:arg.autorename,strict_conflict:arg.strict_conflict},{mode:'add',autorename:false,strict_conflict:true});
   if(failUpload)throw Error('synthetic response loss');
   assert.ok(!stored.has(arg.path));stored.set(arg.path,JSON.parse(opts.body));return json({'.tag':'file'});
  }
  if(url.endsWith('download'))return json(stored.get(arg.path));
  throw Error('unexpected route');
 };
 const backend=createDropboxBackend({oauth,fetcher});return {backend,calls,stored,created};
}
test('PKCE S256 uses unpredictable verifier/state; no secret required',async()=>{
 const a=await pkce(webcrypto),b=await pkce(webcrypto);
 assert.match(a.verifier,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a.verifier,b.verifier);assert.notEqual(a.state,b.state);
 assert.equal(a.challenge,createHash('sha256').update(a.verifier).digest('base64url'));
});
test('callback requires matching origin + source + state + type',()=>{
 const popup={},expected={origin:'http://localhost:4219',popup,state:'synthetic-state'};
 const event={origin:expected.origin,source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:expected.state}};
 assert.equal(validCallback(event,expected),true);
 for(const invalid of [{...event,origin:'https://other.invalid'},{...event,source:{}},{...event,data:{...event.data,state:'wrong'}},{...event,data:{...event.data,type:'other'}}])assert.equal(validCallback(invalid,expected),false);
});
test('first bootstrap creates exact eight folders + seven empty files and reads each back',async()=>{
 const {backend,calls,stored,created}=backendFixture();const provider=new DropboxProvider(backend);
 await provider.connect();assert.deepEqual(await bootstrap(provider),emptyData());
 assert.deepEqual(created,folders.map(p=>'/'+p));assert.equal(stored.size,7);
 assert.equal(calls.filter(x=>x.route==='download').length,7);
 for(const [path,value] of stored)assert.deepEqual(value,path.endsWith('settings.json')?{schema:3}:[]);
});
test('existing empty root fails closed without any writes',async()=>{
 const {backend,calls}=backendFixture({existing:true});const provider=new DropboxProvider(backend);await provider.connect();
 await assert.rejects(bootstrap(provider),{code:'STORAGE_CONFLICT'});
 assert.ok(calls.every(x=>['get_metadata','list_folder'].includes(x.route)));
});
test('ambiguous upload stops after one attempt; no delete/overwrite/replay',async()=>{
 const {backend,calls}=backendFixture({failUpload:true});const provider=new DropboxProvider(backend);await provider.connect();
 await assert.rejects(bootstrap(provider),{code:'NETWORK_ERROR'});
 assert.equal(calls.filter(x=>x.route==='upload').length,1);assert.ok(!calls.some(x=>/delete/.test(x.route)));
});
test('backend blocks foreign paths, non-empty records, non-bootstrap writes',async()=>{
 const {backend}=backendFixture();await backend.connect();
 await assert.rejects(backend.load('../other'),{code:'WRITE_BLOCKED'});
 await assert.rejects(backend.createOnly('NARO Biz/Data/companies.json',[]),{code:'WRITE_BLOCKED'});
 await backend.prepareFolders(folders);
 await assert.rejects(backend.createOnly('NARO Biz/Data/companies.json',[{synthetic:true}]),{code:'WRITE_BLOCKED'});
 await assert.rejects(backend.createOnly('NARO Biz/Data/settings.json',{schema:3,extra:true}),{code:'WRITE_BLOCKED'});
 await assert.rejects(backend.downloadAsset('NARO Biz/Images/a.png'),{code:'WRITE_BLOCKED'});
});
test('disconnect makes backend permanently unusable',async()=>{
 const {backend,calls}=backendFixture();await backend.connect();await backend.disconnect();
 await assert.rejects(backend.list(),{code:'CANCELLED'});await assert.rejects(backend.connect(),{code:'CANCELLED'});assert.equal(calls.length,0);
});
test('expired token stops before request',async()=>{
 let count=0;const backend=createDropboxBackend({oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:1}),close(){}},fetcher:async()=>{count++;},now:()=>2});
 await backend.connect();await assert.rejects(backend.list(),{code:'RECONNECT_REQUIRED'});assert.equal(count,0);
});
test('aborted generation cannot apply a late response',async()=>{
 const abort=new AbortController();const backend=createDropboxBackend({signal:abort.signal,oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+600000}),close(){}},fetcher:async()=>{abort.abort();return missing();}});
 await backend.connect();await assert.rejects(backend.list(),{code:'CANCELLED'});
});
test('OAuth denied and wrong origin do not exchange a token',async()=>{
 let listener,calls=0;
 const popup={closed:false,close(){this.closed=true;},location:{replace(url){const u=new URL(url);queueMicrotask(()=>{listener({origin:'https://other.invalid',source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:u.searchParams.get('state'),code:'wrong'}});listener({origin:'http://localhost:4219',source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:u.searchParams.get('state'),error:true}});});}}};
 const win={location:{origin:'http://localhost:4219'},open:()=>popup,addEventListener:(_n,fn)=>{listener=fn;},removeEventListener(){}};
 const oauth=createDropboxOAuth({clientId:'synthetic-public-key',win,cryptoApi:webcrypto,fetcher:async()=>{calls++;}});oauth.reserve();
 await assert.rejects(oauth.authorize(),{code:'OAUTH_CANCELLED'});assert.equal(calls,0);assert.equal(popup.closed,true);
});
test('successful OAuth is online PKCE, single exchange, no secret/refresh persistence',async()=>{
 let listener,calls=0;
 const popup={closed:false,close(){this.closed=true;},location:{replace(url){const u=new URL(url);assert.equal(u.searchParams.get('token_access_type'),'online');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('scope'),scopes);queueMicrotask(()=>listener({origin:'http://localhost:4219',source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:u.searchParams.get('state'),code:'synthetic-code'}}));}}};
 const win={location:{origin:'http://localhost:4219'},open:()=>popup,addEventListener:(_n,fn)=>{listener=fn;},removeEventListener(){}};
 const oauth=createDropboxOAuth({clientId:'synthetic-public-key',win,cryptoApi:webcrypto,fetcher:async(url,options)=>{calls++;assert.equal(url,'https://api.dropboxapi.com/oauth2/token');assert.equal(options.body.has('client_secret'),false);assert.equal(options.body.has('code_verifier'),true);return json({access_token:'synthetic-token',expires_in:3600,scope:scopes});}});
 oauth.reserve();const result=await oauth.authorize();assert.equal(result.accessToken,'synthetic-token');assert.equal(calls,1);assert.equal(popup.closed,true);
});
test('new adapters and callback have no credential storage or logging calls',async()=>{
 for(const name of ['dropbox-oauth.mjs','dropbox-backend.mjs','dropbox-callback.mjs','runtime-live.mjs']){
  const text=await readFile(new URL('../'+name,import.meta.url),'utf8');assert.doesNotMatch(text,/localStorage|sessionStorage|indexedDB|console\.|client_secret\s*:/);
 }
 const callback=await readFile(new URL('../dropbox-callback.mjs',import.meta.url),'utf8');assert.ok(callback.indexOf('history.replaceState')<callback.indexOf('postMessage'));
});
test('repeated success notifications exchange once and never force or restart Dropbox verification',async()=>{
 let listener,exchanges=0,navigations=0,opens=0;
 const origin='https://naro-biz.web.app';
 const popup={closed:false,close(){this.closed=true;},location:{replace(url){
  navigations++;const u=new URL(url);
  assert.equal(u.searchParams.has('force_reapprove'),false);
  assert.equal(u.searchParams.has('force_reauthentication'),false);
  queueMicrotask(()=>{const event={origin,source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:u.searchParams.get('state'),code:'synthetic-code'}};listener(event);listener(event);});
 }}};
 const win={location:{origin},open(){opens++;return popup;},addEventListener(_name,fn){listener=fn;},removeEventListener(){}};
 const oauth=createDropboxOAuth({clientId:'synthetic-public-key',win,cryptoApi:webcrypto,fetcher:async()=>{exchanges++;return json({access_token:'synthetic-token',expires_in:3600,scope:scopes});}});
 oauth.reserve();await oauth.authorize();
 assert.equal(opens,1);assert.equal(navigations,1);assert.equal(exchanges,1);assert.equal(popup.closed,true);
});
