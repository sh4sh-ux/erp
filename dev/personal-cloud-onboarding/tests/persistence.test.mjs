import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseAuth} from '../firebase-auth.mjs';
import {Onboarding} from '../core.mjs';
test('provider preference stores only an allowlisted provider and is account scoped',()=>{
 const state={currentUser:{uid:'synthetic-a'}},values=new Map();
 const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const api=createFirebaseAuth({initializeAuth:()=>state},{},()=>storage);
 assert.equal(api.preferredProvider(),null);api.rememberProvider('drive');
 assert.equal(api.preferredProvider(),'drive');assert.deepEqual([...values.values()],['drive']);
 state.currentUser={uid:'synthetic-b'};assert.equal(api.preferredProvider(),null);
 api.rememberProvider('dropbox');assert.equal(api.preferredProvider(),'dropbox');
 state.currentUser={uid:'synthetic-a'};assert.equal(api.preferredProvider(),'drive');
 api.rememberProvider('token-not-allowed');assert.equal(api.preferredProvider(),'drive');
 state.currentUser=null;api.rememberProvider('drive');assert.equal(api.preferredProvider(),null);assert.equal(values.size,2);
});
test('blocked browser preference storage is optional and invalid saved values are ignored',()=>{
 const sdk={initializeAuth:()=>({currentUser:{uid:'synthetic'}})};
 const api=createFirebaseAuth(sdk,{},()=>{throw Error('blocked');});
 assert.doesNotThrow(()=>api.rememberProvider('drive'));assert.equal(api.preferredProvider(),null);
 assert.equal(createFirebaseAuth(sdk,{},()=>({getItem:()=>'<invalid>'})).preferredProvider(),null);
});
function fixture(){
 const disk={user:null},calls=[];let fail=false;
 const sdk={inMemoryPersistence:'memory',browserLocalPersistence:'local',
 initializeAuth(){return {mode:'local',currentUser:disk.user,async authStateReady(){}};},
 async setPersistence(a,mode){calls.push(mode);if(fail)throw Error('storage unavailable');a.mode=mode;if(mode==='memory')disk.user=null;},
 async signInWithEmailAndPassword(a){calls.push('login');a.currentUser={uid:'synthetic',emailVerified:true};if(a.mode==='local')disk.user=a.currentUser;return {user:a.currentUser};},
 async createUserWithEmailAndPassword(a){calls.push('signup');a.currentUser={uid:'synthetic',emailVerified:false};return {user:a.currentUser};},
 async reload(){},async signOut(a){calls.push('logout');a.currentUser=null;disk.user=null;},onAuthStateChanged(a,fn){fn(a.currentUser);return ()=>{};}};
 return {sdk,calls,disk,deny(){fail=true;},api:()=>createFirebaseAuth(sdk,{})};
}
test('remember opt-in survives a new adapter, explicit logout clears stored Auth',async()=>{const f=fixture(),a=f.api();await a.login('synthetic@example.invalid','not-a-real-password',{remember:true});assert.deepEqual(f.calls,['local','login']);assert.equal((await f.api().restore()).uid,'synthetic');await a.logout();assert.equal(await f.api().restore(),null);});
test('unchecked login never survives a new adapter',async()=>{const f=fixture();await f.api().login('synthetic@example.invalid','not-a-real-password');assert.deepEqual(f.calls,['memory','login']);assert.equal(await f.api().restore(),null);});
test('signup does not opt in to persistence',async()=>{const f=fixture();await f.api().signup('synthetic@example.invalid','not-a-real-password');assert.deepEqual(f.calls,['memory','signup']);assert.equal(f.disk.user,null);});
test('unavailable persistence stops sign-in rather than silently ignoring choice',async()=>{const f=fixture();f.deny();await assert.rejects(f.api().login('synthetic@example.invalid','not-a-real-password',{remember:true}));assert.deepEqual(f.calls,['local']);});
test('restored verified user reaches storage without creating provider; page teardown retains Auth',async()=>{const f=fixture(),auth=f.api();await auth.login('synthetic@example.invalid','not-a-real-password',{remember:true});let providers=0;const flow=new Onboarding({auth,providerFactory(){providers++;}});await flow.restore();assert.equal(flow.state.screen,'storage');assert.equal(providers,0);await flow.dispose({preserveAuth:true});assert.equal((await f.api().restore()).uid,'synthetic');});
test('restored unverified user cannot bypass verification',async()=>{const flow=new Onboarding({auth:{restore:async()=>({uid:'synthetic',emailVerified:false})},providerFactory(){throw Error('must not connect');}});await flow.restore();assert.equal(flow.state.screen,'verify');assert.equal(await flow.connect('drive'),false);});
test('other-tab account change clears workspace state immediately',async()=>{const f=fixture(),auth=f.api();await auth.login('synthetic@example.invalid','not-a-real-password',{remember:true});const flow=new Onboarding({auth});await flow.restore();flow.sessionChanged(null);assert.equal(flow.state.screen,'login');assert.equal(flow.state.db,null);assert.equal(flow.state.ready,false);});
