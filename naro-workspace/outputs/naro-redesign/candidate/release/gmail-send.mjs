// 견적서 이메일 — send from the user's own Gmail (free; no server).
// Runs in the top page, which already loads Google Identity Services and may reach www.googleapis.com
// under its CSP. Uses the existing public Web client ID with a separate, send-only scope; the Drive
// sign-in (google-oauth.mjs) is not touched. Tokens live in memory only (≤1h); localStorage keeps just
// the connected address for the account hint and the UI.
import {driveClientId,driveOrigins,loadGoogleIdentity} from './google-oauth.mjs';
export const gmailScope='https://www.googleapis.com/auth/gmail.send';
const scopes=gmailScope+' email';
const KEY='naroGmail';
const fault=code=>Object.assign(Error(code),{code});

const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);};
const utf8=text=>new TextEncoder().encode(text);
const wrap=s=>s.replace(/.{1,76}/g,'$&\r\n');
const word=text=>'=?UTF-8?B?'+b64(utf8(text))+'?=';
const oneLine=v=>String(v??'').replace(/[\r\n]+/g,' ').trim();
const emailRe=/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/;
export function recipients(value){
 const list=oneLine(value).split(/[,;]\s*/).map(s=>s.trim()).filter(Boolean);
 if(!list.length||list.length>20||!list.every(a=>emailRe.test(a)))throw fault('BAD_RECIPIENT');
 return list;
}
// RFC 2822 message, multipart/mixed: UTF-8 text body + one PNG attachment. Returns base64url for users.messages.send.
export function buildMime({to,subject,body,filename,bytes,boundary='naro_'+Math.random().toString(36).slice(2)}){
 const rcpt=recipients(to).join(', ');
 const name=oneLine(filename||'quote.png').replace(/[\\/"]/g,'_')||'quote.png';
 const parts=[
  'To: '+rcpt,'Subject: '+word(oneLine(subject)),'MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="'+boundary+'"','',
  '--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(b64(utf8(String(body??'')))),
 ];
 if(bytes?.length)parts.push('--'+boundary,'Content-Type: image/png; name="'+word(name)+'"','Content-Disposition: attachment; filename="'+word(name)+'"','Content-Transfer-Encoding: base64','',wrap(b64(bytes)));
 parts.push('--'+boundary+'--','');
 return b64(utf8(parts.join('\r\n'))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function createGmailSender({win=window,fetcher=(...a)=>win.fetch(...a),storage=win.localStorage,loadIdentity=()=>loadGoogleIdentity({win,doc:win.document}),now=()=>Date.now()}={}){
 let identity=null,token=null,expires=0,email='';
 try{email=storage?.getItem(KEY)||'';}catch{}
 const remember=v=>{email=v||'';try{v?storage.setItem(KEY,v):storage.removeItem(KEY);}catch{}};
 async function prepare(){if(!driveOrigins.includes(win.location.origin))throw fault('OAUTH_SETUP_REQUIRED');identity??=await loadIdentity();return identity;}
 // Must run inside the user's click (popup). With an earlier consent Google shows only a brief window.
 function authorize(){
  if(!identity?.initTokenClient)return Promise.reject(fault('OAUTH_SETUP_REQUIRED'));
  return new Promise((resolve,reject)=>{
   const client=identity.initTokenClient({client_id:driveClientId,scope:scopes,include_granted_scopes:false,prompt:email?'':'select_account',...(email?{login_hint:email}:{}),
    callback:r=>{
     if(r?.error)return reject(fault(r.error==='access_denied'?'CANCELLED':'UNAVAILABLE'));
     const granted=String(r?.scope||'').split(/\s+/);
     if(!granted.includes(gmailScope)||typeof r?.access_token!=='string')return reject(fault('SCOPE_DENIED'));
     token=r.access_token;expires=now()+(Math.min(Number(r.expires_in)||0,3600)-60)*1000;resolve(token);},
    error_callback:e=>reject(fault(e?.type==='popup_failed_to_open'?'POPUP_BLOCKED':e?.type==='popup_closed'?'CANCELLED':'UNAVAILABLE'))});
   client.requestAccessToken();
  });
 }
 async function whoami(){
  try{const r=await fetcher('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store'});if(r.ok){const j=await r.json();if(typeof j.email==='string')remember(j.email);}}catch{}
 }
 async function post(raw){
  const r=await fetcher('https://www.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw})});
  if(r.ok)return r.json();
  let reason='';try{const j=await r.json();reason=JSON.stringify(j?.error||'');}catch{}
  if(r.status===401)throw fault('AUTH_EXPIRED');
  if(r.status===403&&/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(reason))throw fault('GMAIL_NOT_ENABLED');
  if(r.status===403&&/insufficient/i.test(reason))throw fault('SCOPE_DENIED');
  if(r.status===429||/rateLimit|quota/i.test(reason))throw fault('RATE_LIMIT');
  if(r.status===400)throw fault('BAD_MESSAGE');
  throw fault('MAIL_FAILED');
 }
 return {
  status:()=>({email}),
  prepare,
  async send(message){
   const raw=buildMime(message);                       // validates recipients before any popup
   if(!identity)await prepare();
   if(!token||now()>=expires)await authorize();
   try{await post(raw);}
   catch(e){if(e.code!=='AUTH_EXPIRED')throw e;token=null;await authorize();await post(raw);}
   if(!email)await whoami();
   return {from:email};
  },
  disconnect(){const t=token;token=null;expires=0;remember('');try{if(t)identity?.revoke?.(t,()=>{});}catch{}}
 };
}
