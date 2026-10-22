// 로그인 유지(10/22, 3단계): Google 1시간 열쇠를 같은 계정으로만 새로 받고, 안 되면 [다시 연결] 띠를 띄운다(시험용 계정·가짜 Google).
import test from 'node:test';import assert from 'node:assert/strict';
import {createGoogleOAuth,driveScope} from '../personal-cloud-onboarding/google-oauth.mjs';
import {createGoogleBackend} from '../personal-cloud-onboarding/google-backend.mjs';
import {installSessionKeeper,sessionState,SOON_MS} from './session-keeper.mjs';

function identity(reply){const seen=[];return {seen,initTokenClient(cfg){seen.push(cfg);return {requestAccessToken(){reply(cfg);}};}};}
const ok=(token='t2')=>cfg=>cfg.callback({access_token:token,expires_in:3599,scope:driveScope});

test('oauth.refresh: 같은 계정 힌트로 창 없이(prompt 빈 값) 새 열쇠, 팝업이 막히면 POPUP_BLOCKED',async()=>{
 const id=identity(ok());const o=createGoogleOAuth({identity:id,origin:'http://localhost:4219',now:()=>1000});
 const r=await o.refresh({loginHint:'tester@example.test'});
 assert.equal(r.accessToken,'t2');assert.equal(r.expiresAt,1000+(3599-30)*1000);
 assert.equal(id.seen[0].prompt,'');assert.equal(id.seen[0].login_hint,'tester@example.test');assert.equal(id.seen[0].scope,driveScope);
 const blocked=createGoogleOAuth({identity:identity(cfg=>cfg.error_callback({type:'popup_failed_to_open'})),origin:'http://localhost:4219'});
 await assert.rejects(blocked.refresh({}),e=>e.code==='POPUP_BLOCKED');
 const wide=createGoogleOAuth({identity:identity(cfg=>cfg.callback({access_token:'x',expires_in:3599,scope:driveScope+' email'})),origin:'http://localhost:4219'});
 await assert.rejects(wide.refresh({}),e=>e.code==='OAUTH_SETUP_REQUIRED');
 await assert.rejects(createGoogleOAuth({identity:id,origin:'https://evil.test'}).refresh({}),e=>e.code==='OAUTH_SETUP_REQUIRED');
});

function backendWith({refreshPermission='perm-1',refreshError=null}={}){
 let clock=0;const tokens=[];
 const fetcher=async(url,o)=>{const t=o.headers.Authorization.slice(7);tokens.push(t);
  if(url.includes('about'))return Response.json({user:{permissionId:t==='t1'?'perm-1':refreshPermission,emailAddress:'tester@example.test'}});
  return Response.json({files:[]});};
 const binding={verify:async()=>{},assertCurrent(){}};
 const oauth={authorize:async()=>({accessToken:'t1',expiresAt:3600000,accountBinding:binding}),close(){},
  refresh:({loginHint})=>{oauth.hint=loginHint;return refreshError?Promise.reject(Object.assign(Error(refreshError),{code:refreshError})):Promise.resolve({accessToken:'t2',expiresAt:clock+3570000});}};
 const backend=createGoogleBackend({oauth,fetcher,now:()=>clock,readOnly:true,locks:{request:async(_k,_o,fn)=>fn({})}});
 return {backend,oauth,tokens,set:v=>{clock=v;}};
}

test('Drive renew: 같은 계정이면 열쇠·남은 시간이 바뀌고, 끝난 뒤에도 다시 이어진다',async()=>{
 const f=backendWith();await f.backend.connect();
 assert.deepEqual(f.backend.session(),{provider:'drive',expiresAt:3600000,renewable:true});
 f.set(3700000);await assert.rejects(f.backend.exists('NARO Biz'),e=>e.code==='RECONNECT_REQUIRED');
 const r=await f.backend.renew();assert.equal(r.expiresAt,3700000+3570000);assert.equal(f.oauth.hint,'tester@example.test');
 assert.equal(f.backend.session().expiresAt,7270000);assert.equal(await f.backend.exists('NARO Biz'),false);
 assert.equal(f.tokens.at(-1),'t2','새 열쇠로 계정 확인');
});

test('Drive renew: 다른 Google 계정이 골라지면 받지 않고 지금 열쇠를 그대로 둔다',async()=>{
 const f=backendWith({refreshPermission:'perm-OTHER'});await f.backend.connect();
 await assert.rejects(f.backend.renew(),e=>e.code==='DRIVE_ACCOUNT_MISMATCH');
 assert.equal(f.backend.session().expiresAt,3600000);
 const g=backendWith({refreshError:'POPUP_BLOCKED'});await g.backend.connect();
 await assert.rejects(g.backend.renew(),e=>e.code==='POPUP_BLOCKED');assert.equal(g.backend.session().expiresAt,3600000);
 await g.backend.disconnect();assert.equal(g.backend.session().renewable,false);
});

// 가짜 DOM(띠 하나 · 버튼 하나)
function fakeDoc(){
 const make=tag=>{const el={tag,style:{},hidden:false,textContent:'',children:[],handlers:{},attrs:{},
  setAttribute(k,v){el.attrs[k]=v;},append(...c){el.children.push(...c);},addEventListener(t,f){el.handlers[t]=f;},remove(){el.removed=true;}};
  Object.defineProperty(el.style,'cssText',{set(){},get(){return '';}});return el;};
 return {body:make('body'),createElement:make};
}
test('연결 유지 띠: 10분 전부터 [연결 유지], 끝나면 [다시 연결] · 버튼 누름은 조용한 갱신 1번(5분 간격)',async()=>{
 assert.equal(sessionState(null,0),'none');assert.equal(sessionState({expiresAt:100},100),'expired');
 assert.equal(sessionState({expiresAt:SOON_MS+1},0),'ok');assert.equal(sessionState({expiresAt:SOON_MS},0),'soon');
 let clock=0,expiresAt=60*60*1000,calls=0,fail=null;const doc=fakeDoc();
 const repository={session:()=>({provider:'drive',expiresAt,renewable:true}),renew(){calls++;return fail?Promise.reject(Object.assign(Error(fail),{code:fail})):Promise.resolve((expiresAt=clock+3570000,{expiresAt}));}};
 const k=installSessionKeeper({repository,doc,now:()=>clock,every:1e9});
 const bar=k.element,[text,button]=bar.children;
 assert.equal(bar.hidden,true);
 k.activity();assert.equal(calls,0,'아직 여유가 있으면 갱신하지 않는다');
 clock=expiresAt-5*60*1000;k.tick();assert.equal(bar.hidden,false);assert.equal(button.textContent,'연결 유지');
 fail='POPUP_BLOCKED';k.activity();await new Promise(r=>setTimeout(r));assert.equal(calls,1);
 assert.equal(bar.hidden,false,'조용한 갱신이 막히면 띠는 그대로');assert.match(text.textContent,/곧 끝나요/);
 k.activity();assert.equal(calls,1,'5분 안에는 다시 시도하지 않는다');
 button.handlers.click();await new Promise(r=>setTimeout(r));assert.equal(calls,2);assert.match(text.textContent,/팝업이 막혔어요/);
 clock=expiresAt+1;fail=null;k.tick();assert.equal(button.textContent,'다시 연결');
 button.handlers.click();await new Promise(r=>setTimeout(r));assert.equal(calls,3);assert.equal(bar.hidden,true,'이어지면 띠가 사라진다');
 k.stop();assert.equal(bar.removed,true);
});

test('연결 유지 띠: Dropbox(스스로 갱신)는 평소 띠가 없고, 끝났을 때만 [다시 로그인]',()=>{
 let clock=0;const doc=fakeDoc();let reloaded=0;
 const k=installSessionKeeper({repository:{session:()=>({provider:'dropbox',expiresAt:1000,renewable:false}),renew:()=>Promise.reject(Error('no'))},doc,now:()=>clock,every:1e9,reload:()=>reloaded++});
 assert.equal(k.element.hidden,true);k.activity();
 clock=999;k.tick();assert.equal(k.element.hidden,true);
 clock=1001;k.tick();assert.equal(k.element.children[1].textContent,'다시 로그인');k.element.children[1].handlers.click();assert.equal(reloaded,1);k.stop();
});
