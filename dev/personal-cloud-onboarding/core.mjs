// Isolated foundation. No Firestore, tenant discovery, legacy tokens or persistence.
export const tables = Object.freeze(['companies','items','quotes','payments','stock_moves','material_moves']);
export const folders = Object.freeze(['NARO Biz','NARO Biz/Data','NARO Biz/Images','NARO Biz/Images/Products','NARO Biz/Documents','NARO Biz/Documents/Business Cards','NARO Biz/Documents/Business Registration','NARO Biz/Backup']);
export const emptyData = () => ({...Object.fromEntries(tables.map(k => [k, []])), settings:{schema:3}});
export const fault = code => Object.assign(new Error(code), {code});
const codes = new Set(['QUOTA_LIMIT','NETWORK_ERROR','RECONNECT_REQUIRED','CANCELLED','STORAGE_CONFLICT','STORAGE_INVALID','WRITE_BLOCKED','OAUTH_SETUP_REQUIRED','EMAIL_NOT_VERIFIED','PASSWORD_MISMATCH','BUSY','SESSION_EXPIRED','auth/invalid-credential','auth/invalid-email','auth/weak-password','auth/email-already-in-use','auth/too-many-requests','auth/quota-exceeded','auth/network-request-failed']);
for(const code of ['DRIVE_ACCOUNT_MISMATCH','DRIVE_ACCOUNT_UNVERIFIED','DRIVE_ACCOUNT_CHANGED'])codes.add(code);
export function safeCode(error) { return codes.has(error?.code) ? error.code : 'UNAVAILABLE'; }
export function message(error) {
 const code = typeof error === 'string' ? error : safeCode(error);
 if(['QUOTA_LIMIT','auth/too-many-requests','auth/quota-exceeded'].includes(code)) return '무료 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
 if(['NETWORK_ERROR','auth/network-request-failed'].includes(code)) return '연결을 확인한 후 다시 시도해 주세요.';
 if(code === 'auth/invalid-credential') return '이메일과 비밀번호를 확인해 주세요.';
 if(code === 'auth/invalid-email') return '이메일 형식을 확인해 주세요.';
 if(code === 'auth/weak-password') return '더 안전한 비밀번호를 사용해 주세요.';
 if(code === 'auth/email-already-in-use') return '가입을 완료할 수 없습니다. 로그인 또는 비밀번호 찾기를 이용해 주세요.';
 if(code === 'EMAIL_NOT_VERIFIED') return '인증메일을 확인한 뒤 다시 눌러 주세요.';
 if(code === 'PASSWORD_MISMATCH') return '비밀번호가 서로 다릅니다.';
 if(code === 'RECONNECT_REQUIRED') return '저장소 연결이 만료되었습니다. 다시 연결해 주세요.';
 if(code === 'STORAGE_CONFLICT') return '기존 저장공간을 덮어쓰지 않았습니다. 연결한 계정을 확인해 주세요.';
 if(code === 'DRIVE_ACCOUNT_MISMATCH') return '이전에 연결한 Google 계정과 달라 파일을 열지 않았습니다. 다른 Google 계정 선택을 체크해 사용할 계정을 직접 선택해 주세요.';
 if(code === 'DRIVE_ACCOUNT_UNVERIFIED') return 'Google 계정을 확인할 수 없어 파일을 열지 않았습니다. 다시 연결해 주세요.';
 if(code === 'DRIVE_ACCOUNT_CHANGED') return '다른 창에서 연결 계정이 변경되어 작업을 중단했습니다. 다시 연결해 주세요.';
 if(code === 'OAUTH_SETUP_REQUIRED') return '저장소 연결 설정 승인 후 사용할 수 있습니다.';
 return '지금은 작업을 완료할 수 없습니다. 잠시 후 다시 시도해 주세요.';
}

// Only explicitly retryable reads. Never automatically retry writes or quota exhaustion.
export async function boundedRead(operation, {signal, sleep = ms => new Promise(r => setTimeout(r,ms)), random = Math.random} = {}) {
 for(let attempt=0; attempt<3; attempt++) {
  if(signal?.aborted) throw fault('CANCELLED');
  try { const value=await operation(); if(signal?.aborted) throw fault('CANCELLED'); return value; }
  catch(e) {
   if(signal?.aborted) throw fault('CANCELLED');
   if(!['RATE_LIMIT','NETWORK_ERROR'].includes(e.code) || attempt===2) throw fault(e.code==='RATE_LIMIT'?'QUOTA_LIMIT':safeCode(e));
   await sleep(Math.min(4000, 300*2**attempt+Math.floor(random()*100)));
  }
 }
}

export function validateData(data) {
 if(data?.settings?.schema!==3 || tables.some(k=>!Array.isArray(data[k]))) throw fault('STORAGE_INVALID');
 return structuredClone(data);
}

// Read-only work, bounded concurrency. Drain in-flight reads before failure so
// retries cannot overlap a previous discovery or publish a partial snapshot.
export async function parallelRead(values,read,limit=3){
 let next=0,failure;const results=new Array(values.length);
 await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{
  while(!failure&&next<values.length){const i=next++;try{results[i]=await read(values[i],i);}catch(e){failure=e;}}
 }));
 if(failure)throw failure;return results;
}

// Backend must provide create-only semantics; no emulation by blind overwrite.
// Bootstrap never deletes/repairs foreign files. Existing partial layouts stop for recovery.
export async function bootstrap(provider, {signal}={}) {
 const check=()=>{if(signal?.aborted)throw fault('CANCELLED');};
 check();
 const existing=await provider.list(); check();
 const paths=[...tables,'settings'].map(k=>`NARO Biz/Data/${k}.json`);
 if(existing.length) {
  if(!paths.every(p=>existing.includes(p))) throw fault('STORAGE_CONFLICT');
  const loaded={};
  for(const k of [...tables,'settings']) { loaded[k]=await provider.load(`NARO Biz/Data/${k}.json`); check(); }
  return validateData(loaded);
 }
 const data=emptyData();
 await provider.prepareFolders(folders); check();
 for(const k of [...tables,'settings']) {
  await provider.save(`NARO Biz/Data/${k}.json`,data[k],{createOnly:true,bootstrap:true}); check();
 }
 return data;
}

export class Onboarding {
 #generation=0; #auth; #factory; #provider=null; #abort=null; #user=null; #busy=false; #preserveAuth=false;
 state={screen:'login',busy:false,ready:false,db:null,error:null,provider:null};
 constructor({auth,providerFactory,onChange=()=>{}}) {this.#auth=auth;this.#factory=providerFactory;this.onChange=onChange;}
 #emit(patch) {this.state={...this.state,...patch};this.onChange(this.state);}
 #current(g) {if(g!==this.#generation)throw fault('CANCELLED');}
 async #run(screen, work) {
  if(this.#busy) return false;
  this.#busy=true; const g=this.#generation;
  this.#emit({busy:true,error:null});
  try {await work(g);return true;}
  catch(e) {if(g===this.#generation)this.#emit({screen,error:safeCode(e),ready:false,db:null});return false;}
  finally {if(g===this.#generation){this.#busy=false;this.#emit({busy:false});}
   else if(!this.#preserveAuth){try{await this.#auth.logout();}catch{/* Disposed controller stays permanently closed. */}}}
 }
 show(screen) {if(!this.#busy && !this.#user && ['login','signup','reset'].includes(screen))this.#emit({screen,error:null});}
 async restore() {if(!this.#auth.restore)return;return this.#run('login',async g=>{const user=await this.#auth.restore();this.#current(g);this.#user=user;if(user)this.#emit({screen:user.emailVerified?'storage':'verify'});});}
 sessionChanged(user) {if(this.#user&&this.#user.uid!==user?.uid){this.#preserveAuth=true;this.#generation++;this.#abort?.abort();const p=this.#provider;this.#provider=null;this.#user=null;this.#busy=false;this.#emit({screen:'login',busy:false,ready:false,db:null,provider:null,error:'SESSION_EXPIRED'});Promise.resolve(p?.disconnect()).catch(()=>{});}}
 async authenticate(mode,email,password,confirmation,options={}) {
  if(this.#user)return false;
  return this.#run(mode,async g=>{
   if(mode==='signup' && password!==confirmation)throw fault('PASSWORD_MISMATCH');
   const user=await this.#auth[mode](email,password,options); this.#current(g);this.#user=user;
   this.#emit({screen:user.emailVerified?'storage':'verify'});
   if(mode==='signup') {
    // Account already exists even if mail delivery fails: keep verification recovery screen.
    try{await this.#auth.sendVerification();this.#current(g);}
    catch(e){this.#current(g);this.#emit({screen:'verify',error:safeCode(e)});}
   }
  });
 }
 async verify() {return this.#run('verify',async g=>{
  const user=await this.#auth.reload();this.#current(g);
  if(!user?.emailVerified)throw fault('EMAIL_NOT_VERIFIED');
  this.#user=user;this.#emit({screen:'storage'});
 });}
 async resend() {return this.#run('verify',async()=>{await this.#auth.sendVerification();});}
 async reset(email) {return this.#run('reset',async g=>{
  await this.#auth.reset(email);this.#current(g);this.#emit({screen:'reset-sent'});
 });}
 async connect(kind) {return this.#run('storage',async g=>{
  if(!this.#user?.emailVerified)throw fault('EMAIL_NOT_VERIFIED');
  if(!['drive','dropbox'].includes(kind))throw fault('OAUTH_SETUP_REQUIRED');
  const current=await this.#auth.reload();this.#current(g);
  if(!current?.emailVerified || current.uid!==this.#user.uid)throw fault('SESSION_EXPIRED');
  this.#abort=new AbortController();
  const provider=this.#factory(kind,this.#user.uid,this.#abort.signal);this.#provider=provider;
  try{
   this.#emit({screen:'connecting',provider:kind});
   await provider.connect();this.#current(g);
   this.#emit({screen:'preparing'});
   const db=await bootstrap(provider,{signal:this.#abort.signal});this.#current(g);
   this.#emit({screen:'ready',ready:true,db:validateData(db)});
  }catch(e){await provider.disconnect();if(this.#provider===provider)this.#provider=null;throw e;}
 });}
 async logout() {
  // Don't start a new Auth request until an old request/signOut finishes.
  if(this.#busy)return false;
  this.#generation++;this.#busy=true;this.#abort?.abort();
  const provider=this.#provider;this.#provider=null;this.#user=null;
  this.#emit({screen:'login',busy:true,ready:false,db:null,provider:null,error:null});
  let failure=false;
  try{await provider?.disconnect();}catch{failure=true;}
  try{await this.#auth.logout();}catch{failure=true;}
  this.#busy=failure;this.#emit({busy:failure,error:failure?'UNAVAILABLE':null});return !failure;
 }
 // Page teardown: invalidate immediately, prohibit reuse. No old promise can publish state.
 dispose({preserveAuth=false}={}) {this.#preserveAuth=preserveAuth;this.#generation++;this.#busy=true;this.#abort?.abort();this.#user=null;const p=this.#provider;this.#provider=null;
  this.#emit({screen:'login',busy:true,ready:false,db:null,provider:null,error:null});
  return Promise.allSettled([p?.disconnect(),preserveAuth?undefined:this.#auth.logout()]);
 }
}
