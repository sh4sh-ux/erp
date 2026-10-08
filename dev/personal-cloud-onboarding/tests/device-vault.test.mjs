// 이 기기 기억하기: 열쇠는 잠가서만 저장, 기억된 기기는 창 없이 다시 연결, 거절된 열쇠는 지운다.
import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {createDeviceVault} from '../device-vault.mjs';
import {createDropboxOAuth,scopes} from '../dropbox-oauth.mjs';
function fakeIdb(){
 const data=new Map();
 const req=fn=>{const r={};queueMicrotask(()=>{r.result=fn();r.onsuccess?.();});return r;};
 const db={createObjectStore(){},transaction(){const t={objectStore:()=>({get:k=>req(()=>data.get(k)),put:(v,k)=>req(()=>{data.set(k,v);}),delete:k=>req(()=>{data.delete(k);}),getAllKeys:()=>req(()=>[...data.keys()])})};setTimeout(()=>t.oncomplete?.(),0);return t;}};
 return {data,open(){const r={result:db};queueMicrotask(()=>{r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
}
const json=body=>({ok:true,status:200,json:async()=>body});
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
test('열쇠는 암호화되어 저장되고 같은 기기에서만 풀린다',async()=>{
 const idb=fakeIdb(),vault=await createDeviceVault({idb,cryptoApi:webcrypto,storage:storage()});
 await vault.save('u1','refresh-secret-123');
 assert.equal(vault.has('u1'),true);assert.equal(vault.has('u2'),false);
 const row=idb.data.get('dropbox:u1');assert.ok(!Buffer.from(row.data).toString('latin1').includes('refresh-secret'));
 assert.equal(await vault.load('u1'),'refresh-secret-123');
 vault.setEnabled(false);assert.equal(vault.has('u1'),false);
});
test('기억 켬: offline으로 받아 저장 → 다음 연결은 창 없이 refresh',async()=>{
 const idb=fakeIdb(),vault=await createDeviceVault({idb,cryptoApi:webcrypto,storage:storage()});
 let listener,opens=0;const origin='https://naro-biz.web.app',calls=[];
 const popup={closed:false,close(){this.closed=true;},location:{replace(url){const u=new URL(url);assert.equal(u.searchParams.get('token_access_type'),'offline');queueMicrotask(()=>listener({origin,source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:u.searchParams.get('state'),code:'c'}}));}}};
 const win={location:{origin},open(){opens++;popup.closed=false;return popup;},addEventListener:(_n,fn)=>{listener=fn;},removeEventListener(){}};
 const fetcher=async(_u,o)=>{calls.push(o.body.get('grant_type'));return o.body.get('grant_type')==='refresh_token'?json({access_token:'t2',expires_in:14400}):json({access_token:'t1',refresh_token:'r1',expires_in:14400,scope:scopes});};
 const oauth=createDropboxOAuth({clientId:'k',win,cryptoApi:webcrypto,fetcher,vault});
 oauth.reserve('u1');assert.equal((await oauth.authorize()).accessToken,'t1');assert.equal(vault.has('u1'),true);
 const oauth2=createDropboxOAuth({clientId:'k',win,cryptoApi:webcrypto,fetcher,vault});
 oauth2.reserve('u1');assert.equal((await oauth2.authorize()).accessToken,'t2');
 assert.equal(opens,1);assert.deepEqual(calls,['authorization_code','refresh_token']);
 assert.equal((await oauth2.renew()).accessToken,'t2');
});
test('거절된 열쇠는 지우고 재연결을 요청한다 · 기억 끔이면 online',async()=>{
 const idb=fakeIdb(),st=storage(),vault=await createDeviceVault({idb,cryptoApi:webcrypto,storage:st});await vault.save('u1','old');
 const oauth=createDropboxOAuth({clientId:'k',win:{location:{origin:'https://naro-biz.web.app'},open(){throw Error('no popup');}},cryptoApi:webcrypto,fetcher:async()=>({ok:false,status:400}),vault});
 oauth.reserve('u1');await assert.rejects(oauth.authorize(),{code:'RECONNECT_REQUIRED'});assert.equal(vault.has('u1'),false);
 vault.setEnabled(false);let listener;const origin='https://naro-biz.web.app';
 const popup={closed:false,close(){this.closed=true;},location:{replace(url){const u=new URL(url);assert.equal(u.searchParams.get('token_access_type'),'online');queueMicrotask(()=>listener({origin,source:popup,data:{type:'NARO_DROPBOX_CALLBACK',state:u.searchParams.get('state'),code:'c'}}));}}};
 const o2=createDropboxOAuth({clientId:'k',win:{location:{origin},open:()=>popup,addEventListener:(_n,fn)=>{listener=fn;},removeEventListener(){}},cryptoApi:webcrypto,fetcher:async()=>json({access_token:'t',expires_in:14400,scope:scopes}),vault});
 o2.reserve('u1');assert.equal((await o2.authorize()).accessToken,'t');assert.equal(vault.has('u1'),false);
});
