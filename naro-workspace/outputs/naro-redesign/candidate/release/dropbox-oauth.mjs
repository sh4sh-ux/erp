import {fault} from './core.mjs';
export const scopes='files.metadata.read files.content.read files.content.write';
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function pkce(cryptoApi=crypto){
 const verifier=b64(cryptoApi.getRandomValues(new Uint8Array(32)));
 const state=b64(cryptoApi.getRandomValues(new Uint8Array(32)));
 const challenge=b64(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 return {verifier,state,challenge};
}
export function validCallback(event,{origin,popup,state}){
 return event.origin===origin&&event.source===popup&&event.data?.type==='NARO_DROPBOX_CALLBACK'&&event.data.state===state;
}
export function createDropboxOAuth({clientId,win=window,fetcher=fetch,cryptoApi=crypto,vault=null}){
 // vault(이 기기 기억하기, device-vault.mjs)가 있고 켜져 있으면 offline(다시 받기용 열쇠)으로 받아 이 기기에만 잠가 두고,
 // 다음 연결은 창 없이 그 열쇠로 새 4시간 열쇠를 받는다. vault가 없거나 꺼져 있으면 예전처럼 online(4시간, 메모리만).
 let popup=null,cancel=null,pendingUid=null,resumeUid=null,activeUid=null;
 const origin=win.location.origin;
 // Exact registered origins only. Never derive authorization from query input.
 const redirect=origin+'/oauth/dropbox/callback';
 async function refreshFor(uid,signal){
  const secret=await vault?.load(uid);if(!secret)return null;
  let response;
  try{response=await fetcher('https://api.dropboxapi.com/oauth2/token',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:secret,client_id:clientId})});}
  catch{throw fault(signal?.aborted?'CANCELLED':'NETWORK_ERROR');}
  if(response.status===429)throw fault('QUOTA_LIMIT');
  if(!response.ok){if(response.status===400||response.status===401)await vault.forget(uid);return null;}
  let data;try{data=await response.json();}catch{return null;}
  if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=60)return null;
  activeUid=uid;
  return {accessToken:data.access_token,expiresAt:Date.now()+data.expires_in*1000-30000};
 }
 function reserve(uid=null){
  if(!['http://localhost:4219','https://naro-biz.web.app'].includes(origin))throw fault('OAUTH_SETUP_REQUIRED');
  if(uid&&vault?.has(uid)){resumeUid=uid;pendingUid=null;return;}
  pendingUid=uid;
  if(popup&&!popup.closed)throw fault('BUSY');
  popup=win.open('/oauth/dropbox/waiting','_blank','popup,width=620,height=760');
  if(!popup)throw fault('POPUP_BLOCKED');
 }
 function close(){cancel?.();cancel=null;try{popup?.close();}catch{}popup=null;resumeUid=null;}
 async function authorize(signal){
  if(resumeUid){const uid=resumeUid;resumeUid=null;const result=await refreshFor(uid,signal);if(result)return result;throw fault('RECONNECT_REQUIRED');}
  if(!popup||popup.closed)throw fault('POPUP_BLOCKED');
  const offline=!!(vault&&pendingUid&&vault.enabled()),uid=pendingUid;
  const target=popup;
  let secret=await pkce(cryptoApi);
  if(signal?.aborted){close();throw fault('CANCELLED');}
  let code;
  try{
   code=await new Promise((resolve,reject)=>{
    let finished=false;
    const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(poll);win.removeEventListener('message',onMessage);signal?.removeEventListener('abort',onAbort);cancel=null;error?reject(error):resolve(value);};
    const onAbort=()=>done(fault('CANCELLED'));
    const onMessage=event=>{
     if(!validCallback(event,{origin,popup:target,state:secret.state}))return;
     if(event.data.error||typeof event.data.code!=='string'||!event.data.code||event.data.code.length>4096){done(fault('OAUTH_CANCELLED'));return;}
     done(null,event.data.code);
    };
    const timer=setTimeout(()=>done(fault('OAUTH_CANCELLED')),300000);
    const poll=setInterval(()=>{if(target.closed)done(fault('OAUTH_CANCELLED'));},500);
    win.addEventListener('message',onMessage);signal?.addEventListener('abort',onAbort,{once:true});cancel=onAbort;
    const url=new URL('https://www.dropbox.com/oauth2/authorize');
    url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect,code_challenge:secret.challenge,code_challenge_method:'S256',state:secret.state,token_access_type:offline?'offline':'online',scope:scopes}).toString();
    try{target.location.replace(url.href);}catch{done(fault('OAUTH_CANCELLED'));}
   });
   if(signal?.aborted)throw fault('CANCELLED');
   let response;
   try{response=await fetcher('https://api.dropboxapi.com/oauth2/token',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,code_verifier:secret.verifier,redirect_uri:redirect})});}
   catch{throw fault(signal?.aborted?'CANCELLED':'NETWORK_ERROR');}
   if(!response.ok)throw fault(response.status===429?'QUOTA_LIMIT':'RECONNECT_REQUIRED');
   let data;try{data=await response.json();}catch{throw fault('RECONNECT_REQUIRED');}
   if(signal?.aborted)throw fault('CANCELLED');
   const granted=new Set((data.scope||'').split(' '));
   if(typeof data.access_token!=='string'||!data.access_token||(data.refresh_token&&!offline)||!Number.isFinite(data.expires_in)||data.expires_in<=60||!scopes.split(' ').every(s=>granted.has(s)))throw fault('RECONNECT_REQUIRED');
   if(offline&&typeof data.refresh_token==='string'&&data.refresh_token){try{await vault.save(uid,data.refresh_token);activeUid=uid;}catch{/* 기억 실패는 연결을 막지 않는다 */}}
   return {accessToken:data.access_token,expiresAt:Date.now()+data.expires_in*1000-30000};
  }finally{secret=null;code=null;close();}
 }
 // 4시간 열쇠가 끝나기 전에 창 없이 새로 받기(기억된 기기만). 못 받으면 null → 화면이 재연결을 안내한다.
 async function renew(signal){if(!activeUid||!vault?.has(activeUid))return null;return refreshFor(activeUid,signal);}
 async function forget(uid){if(uid)await vault?.forget(uid);if(!uid||uid===activeUid)activeUid=null;}
 return {reserve,authorize,close,renew,forget};
}
