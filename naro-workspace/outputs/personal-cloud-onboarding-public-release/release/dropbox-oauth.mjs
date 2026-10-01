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
export function createDropboxOAuth({clientId,win=window,fetcher=fetch,cryptoApi=crypto}){
 let popup=null,cancel=null;
 const origin=win.location.origin;
 // This candidate's only registered callback. Public release is a separate gate.
 const redirect=origin+'/oauth/dropbox/callback';
 function reserve(){
  if(origin!=='http://localhost:4219')throw fault('OAUTH_SETUP_REQUIRED');
  if(popup&&!popup.closed)throw fault('BUSY');
  popup=win.open('/oauth/dropbox/waiting','_blank','popup,width=620,height=760');
  if(!popup)throw fault('POPUP_BLOCKED');
 }
 function close(){cancel?.();cancel=null;try{popup?.close();}catch{}popup=null;}
 async function authorize(signal){
  if(!popup||popup.closed)throw fault('POPUP_BLOCKED');
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
    url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect,code_challenge:secret.challenge,code_challenge_method:'S256',state:secret.state,token_access_type:'online',scope:scopes}).toString();
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
   if(typeof data.access_token!=='string'||!data.access_token||data.refresh_token||!Number.isFinite(data.expires_in)||data.expires_in<=60||!scopes.split(' ').every(s=>granted.has(s)))throw fault('RECONNECT_REQUIRED');
   return {accessToken:data.access_token,expiresAt:Date.now()+data.expires_in*1000-30000};
  }finally{secret=null;code=null;close();}
 }
 return {reserve,authorize,close};
}
