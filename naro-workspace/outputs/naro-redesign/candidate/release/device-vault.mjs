// 이 기기 기억하기(10/8, 사용자 선택 A): Dropbox '다시 받기용 열쇠'(refresh token)를 이 기기에만 잠가 둔다.
// - 잠금 키는 WebCrypto AES-GCM 256, extractable:false → 브라우저 밖으로 꺼낼 수 없다(IndexedDB에 키 객체째 보관).
// - 사용자(Firebase uid)마다 따로 저장. 로그아웃하면 지운다. 끄면(기억 안 함) 저장하지 않고 있던 것도 지운다.
// - 저장소가 막힌 기기(사생활 보호 모드 등)에서는 조용히 '기억 안 됨'으로 동작한다(로그인은 그대로 된다).
const DB='naro-device',STORE='vault',KEY='lock',PREF='naro.rememberDevice';
function open(idb){
 return new Promise((resolve,reject)=>{const r=idb.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('blocked'));});
}
function tx(db,mode,fn){
 return new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode),s=t.objectStore(STORE);let out;const req=fn(s);if(req)req.onsuccess=()=>{out=req.result;};t.oncomplete=()=>resolve(out);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
}
const slot=uid=>'dropbox:'+uid;
export async function createDeviceVault({idb=globalThis.indexedDB,cryptoApi=globalThis.crypto,storage=globalThis.localStorage,timeout=1500}={}){
 if(!idb||!cryptoApi?.subtle)return null;
 const db=await Promise.race([open(idb),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),timeout))]);
 let key=await tx(db,'readonly',s=>s.get(KEY));
 if(!key){key=await cryptoApi.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await tx(db,'readwrite',s=>s.put(key,KEY));}
 const keys=await tx(db,'readonly',s=>s.getAllKeys());
 const present=new Set((keys||[]).filter(k=>typeof k==='string'&&k.startsWith('dropbox:')));
 const pref=()=>{try{return storage?.getItem(PREF)!=='0';}catch{return true;}};
 const vault={
  enabled:pref,
  setEnabled(on){try{storage?.setItem(PREF,on?'1':'0');}catch{}if(!on)for(const k of [...present])tx(db,'readwrite',s=>s.delete(k)).then(()=>present.delete(k),()=>{});},
  has:uid=>!!uid&&pref()&&present.has(slot(uid)),
  async save(uid,secret){
   if(!uid||!pref()||typeof secret!=='string'||!secret)return;
   const iv=cryptoApi.getRandomValues(new Uint8Array(12));
   const data=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(secret));
   await tx(db,'readwrite',s=>s.put({iv,data},slot(uid)));present.add(slot(uid));
  },
  async load(uid){
   if(!vault.has(uid))return null;
   const row=await tx(db,'readonly',s=>s.get(slot(uid)));if(!row)return null;
   try{return new TextDecoder().decode(await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:row.iv},key,row.data));}catch{await vault.forget(uid);return null;}
  },
  async forget(uid){if(!uid)return;await tx(db,'readwrite',s=>s.delete(slot(uid))).catch(()=>{});present.delete(slot(uid));}
 };
 return vault;
}
