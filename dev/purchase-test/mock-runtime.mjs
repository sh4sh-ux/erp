// 시험용 '가짜 로그인' — 실제 runtime.mjs 대신 이 파일이 쓰인다(serve-test.mjs가 /runtime.mjs 자리에 보냄).
// Firebase 로그인·Dropbox OAuth를 하지 않고, 저장은 모두 시험 서버의 가짜 Dropbox(/__fake/call)로만 간다.
import {createDropboxBackend} from './dropbox-backend.mjs';
import {ADMIN_EMAIL} from './access-control.mjs';
// 가짜 Dropbox로 보내는 통로: 앱이 api.dropboxapi.com에 보내려던 요청을 그대로 시험 서버에 넘긴다.
const fetcher=async(url,o={})=>{
 const body=o.body==null?'':typeof o.body==='string'?o.body:new TextDecoder().decode(o.body instanceof ArrayBuffer?o.body:o.body.buffer?new Uint8Array(o.body.buffer,o.body.byteOffset,o.body.byteLength):await new Response(o.body).arrayBuffer());
 let r;try{r=await fetch('/__fake/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:String(url),headers:o.headers||{},body})});}catch{throw new TypeError('Failed to fetch');}
 const j=await r.json();
 if(j.throw)throw new TypeError('Failed to fetch'); // 시험 도구의 '연결 끊기'·'응답 잃기' = 실제 연결이 끊긴 것과 같게
 return new Response(j.body,{status:j.status,headers:j.headers||{}});
};
export async function createRuntime(){
 const user={uid:'naro-test-user',email:ADMIN_EMAIL,emailVerified:true,getIdToken:async()=>'test'};
 const auth={currentIdentity:()=>user,preferredProvider:()=>'dropbox',rememberProvider(){},async signup(){return user;},async login(){return user;},async restore(){return user;},
  watch(cb){setTimeout(()=>cb(user),30);return ()=>{};},async sendVerification(){},async reload(){return user;},async reset(){},async logout(){},idToken:async()=>'test',email:()=>ADMIN_EMAIL};
 const oauth={authorize:async()=>({accessToken:'fake',expiresAt:Date.now()+8*3600e3}),close(){}};
 return {auth,prepareConnect(){},cancelConnect(){},cloud(kind,uid,signal){return createDropboxBackend({oauth,signal,businessWrite:true,fetcher});},blockedProviders:{}};
}
