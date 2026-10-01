import {fault} from './core.mjs';
// A local safety preference, not an authorization credential or server ACL.
// Remember a UID-salted identity digest and the verified email as a login hint.
// The hint is never authorization: always verify the returned token's identity.
// Never store permissionId, passwords, OAuth tokens or business data.
const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>"\\]+@[^\s@<>"\\]+\.[^\s@<>"\\]+$/.test(value);
export function createDriveAccountBinding({uid,selectAccount=false,storage=()=>globalThis.localStorage,locks=globalThis.navigator?.locks,current=()=>uid}={}){
 if(typeof uid!=='string'||!uid||uid.length>256)throw fault('SESSION_EXPIRED');
 const key='naro.drive-account.v1:'+uid;
 const read=()=>{try{const value=storage()?.getItem(key);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}catch{return null;}};
 const expected=read();let accepted=null,persisted=false;
 const hintKey='naro.drive-hint.v1:'+uid;
 const readHint=()=>{try{const hint=JSON.parse(storage()?.getItem(hintKey)||'null');return expected&&hint?.digest===expected&&validEmail(hint.email)?hint.email:null;}catch{return null;}};
 const session=signal=>{if(signal?.aborted)throw fault('CANCELLED');if(current()!==uid)throw fault('SESSION_EXPIRED');};
 return {
  selectAccount:selectAccount||!expected,
  loginHint:selectAccount?null:readHint(),
  async verify(permissionId,signal,email){
   session(signal);
   if(typeof permissionId!=='string'||!permissionId||permissionId.length>256)throw fault('DRIVE_ACCOUNT_UNVERIFIED');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([uid,permissionId]))))).map(n=>n.toString(16).padStart(2,'0')).join('');
   session(signal);
   const commit=()=>{
    session(signal);
    if(read()!==expected)throw fault('DRIVE_ACCOUNT_CHANGED');
    if(expected&&!selectAccount&&digest!==expected)throw fault('DRIVE_ACCOUNT_MISMATCH');
    // Without cross-tab locking, keep forced account selection on future visits.
    // A remembered binding may still be checked, but must not be replaced.
    if(!locks?.request&&expected&&digest!==expected)throw fault('DRIVE_ACCOUNT_CHANGED');
    if(locks?.request){try{
     storage()?.setItem(key,digest);
     // Only token-owner metadata reaches here, after account/session checks.
     // Clear unusable metadata instead of retaining a previous account's email.
     if(validEmail(email))storage()?.setItem(hintKey,JSON.stringify({digest,email}));
     else if(storage()?.getItem(hintKey))storage()?.setItem(hintKey,'null');
    }catch{/* Storage failure cannot weaken actual identity verification. */}}
    persisted=read()===digest;
    accepted=digest;
   };
   if(locks?.request)await locks.request(key,{mode:'exclusive'},commit);else commit();
  },
  assertCurrent(){
   session();if(!accepted)throw fault('DRIVE_ACCOUNT_UNVERIFIED');
   if(persisted&&read()!==accepted)throw fault('DRIVE_ACCOUNT_CHANGED');
  }
 };
}
