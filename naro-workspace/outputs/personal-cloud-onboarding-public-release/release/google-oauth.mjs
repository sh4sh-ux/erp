import {fault} from './core.mjs';
export const driveScope='https://www.googleapis.com/auth/drive.file';
export const driveOrigins=Object.freeze(['https://naro-biz.web.app','http://localhost','http://localhost:4219']);
// Public Web identifier, not an authentication secret.
export const driveClientId='519731535486-i2c8ov7694hbvqcv5gf6nf4o262ekojt.apps.googleusercontent.com';
export async function loadGoogleIdentity({win=window,doc=document}={}){
 if(!driveOrigins.includes(win.location.origin))throw fault('OAUTH_SETUP_REQUIRED');
 if(win.google?.accounts?.oauth2)return win.google.accounts.oauth2;
 return new Promise((resolve,reject)=>{
  const script=doc.createElement('script');let settled=false;
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;
   if(error){script.remove();reject(fault('OAUTH_SETUP_REQUIRED'));}else resolve(win.google.accounts.oauth2);};
  const timer=setTimeout(()=>finish(true),15000);
  script.src='https://accounts.google.com/gsi/client';script.async=true;script.referrerPolicy='no-referrer';
  script.onload=()=>finish(!win.google?.accounts?.oauth2);script.onerror=()=>finish(true);doc.head.append(script);
 });
}
export function createGoogleOAuth({identity,origin=window.location.origin,clientId=driveClientId,now=Date.now,timeout=300000}){
 let pending=null;
 function close(){const item=pending;pending=null;item?.finish(fault('CANCELLED'));}
 return {
  // Called synchronously in the user's Connect click, before Auth reload awaits.
  reserve(){
   if(!driveOrigins.includes(origin)||!identity?.initTokenClient)throw fault('OAUTH_SETUP_REQUIRED');
   if(pending)throw fault('BUSY');
   let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});
   const item={promise,settled:false,finish(error,value){if(item.settled)return;item.settled=true;clearTimeout(item.timer);error?reject(error):resolve(value);}};
   pending=item;item.timer=setTimeout(()=>item.finish(fault('CANCELLED')),timeout);
   const callback=response=>{
    if(pending!==item||item.settled)return;
    if(response?.error)return item.finish(fault(response.error==='access_denied'?'CANCELLED':'UNAVAILABLE'));
    const granted=(response?.scope||'').trim().split(/\s+/);
    const seconds=Number(response?.expires_in);
    if(granted.length!==1||granted[0]!==driveScope||typeof response?.access_token!=='string'||!response.access_token||!Number.isFinite(seconds)||seconds<=60)
     return item.finish(fault('OAUTH_SETUP_REQUIRED'));
    item.finish(null,{accessToken:response.access_token,expiresAt:now()+(Math.min(seconds,3600)-30)*1000});
   };
   try{identity.initTokenClient({client_id:clientId,scope:driveScope,include_granted_scopes:false,prompt:'select_account',callback,
    error_callback:error=>item.finish(fault(error?.type==='popup_failed_to_open'?'POPUP_BLOCKED':error?.type==='popup_closed'?'CANCELLED':'UNAVAILABLE'))}).requestAccessToken();}
   catch{item.finish(fault('UNAVAILABLE'));}
  },
  async authorize(signal){
   const item=pending;if(!item)throw fault('OAUTH_SETUP_REQUIRED');
   const abort=()=>close();signal?.addEventListener('abort',abort,{once:true});
   try{if(signal?.aborted)throw fault('CANCELLED');const value=await item.promise;if(signal?.aborted)throw fault('CANCELLED');return value;}
   finally{signal?.removeEventListener('abort',abort);if(pending===item)pending=null;clearTimeout(item.timer);}
  },close
 };
}
