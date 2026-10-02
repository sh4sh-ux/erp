import {createMergeImport} from './merge-import.mjs';
import {createGmailSender} from './gmail-send.mjs';
let gmail=null;
// Only fixed diagnostic labels cross into the UI; never forward provider messages.
export function safeStorageFailure(error){
 const codes=['VALIDATION','WRITE_BLOCKED','BUSY','STORAGE_CONFLICT','CONCURRENCY_UNAVAILABLE','SAVE_UNCONFIRMED','SAVE_NOT_OBSERVED','QUOTA_LIMIT','RECONNECT_REQUIRED','RATE_LIMIT','NETWORK_ERROR','STORAGE_INVALID','CANCELLED','UNAVAILABLE','DRIVE_ACCOUNT_MISMATCH','DRIVE_ACCOUNT_UNVERIFIED','DRIVE_ACCOUNT_CHANGED','SESSION_EXPIRED'];
 return codes.includes(error?.code)?error.code:'INTERNAL_ERROR';
}
export function safeStorageDiagnostic(error){
 const stages=['IDENTITY_READ','CONTENT_READ','VALIDATOR_READ','CONDITIONAL_WRITE','READBACK_CONTENT','READBACK_IDENTITY'];
 const transports=['FETCH_REJECTED','HTTP_5XX','HTTP_REJECTED'];
 return {code:safeStorageFailure(error),stage:stages.includes(error?.stage)?error.stage:'',transport:transports.includes(error?.transport)?error.transport:''};
}
let frame=null,port=null,ready=null;
let preparedFrame=null,preparedListener=null,preparedReady=false;
function detachPreparation(){if(preparedListener)window.removeEventListener('message',preparedListener);preparedListener=null;}
export function prepareWorkspace(){
 if(frame||preparedFrame)return;
 const target=document.createElement('iframe');preparedFrame=target;preparedReady=false;
 target.title='NARO 업무 화면 준비';target.hidden=true;target.setAttribute('aria-hidden','true');target.tabIndex=-1;
 preparedListener=e=>{if(e.origin!==location.origin||e.source!==target.contentWindow||e.data?.type!=='NARO_READ_READY')return;preparedReady=true;detachPreparation();};
 window.addEventListener('message',preparedListener);target.src='./erp/index.html';document.body.append(target);
}
export function closeWorkspace(){detachPreparation();preparedFrame?.remove();preparedFrame=null;preparedReady=false;if(ready)window.removeEventListener('message',ready);ready=null;port?.close();port=null;frame?.remove();frame=null;document.querySelector('main.onboarding').hidden=false;document.title='NARO Biz · 로그인';}
export function openWorkspace(data,logout,repository){
 const warmed=preparedFrame,wasReady=preparedReady;detachPreparation();preparedFrame=null;preparedReady=false;
 closeWorkspace();document.querySelector('main.onboarding').hidden=true;
 document.title='NARO Biz · 업무 관리';const workspaceStarted=performance.now();
 frame=warmed||document.createElement('iframe');frame.hidden=false;frame.removeAttribute('aria-hidden');frame.removeAttribute('tabindex');frame.title='NARO 업무 공간';frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;background:white;z-index:100';
 const target=frame;
 const deliver=()=>{
  if(frame!==target)return;
  window.removeEventListener('message',ready);ready=null;
  const channel=new MessageChannel();port=channel.port1;const current=port;let busy=false;
  const importer=createMergeImport(repository);
  port.onmessage=async e=>{
   const m=e.data;
   if(m?.type==='WORKSPACE_RENDERED'){document.documentElement.dataset.workspaceRenderMs=String(Math.round(performance.now()-workspaceStarted));return;}
   if(m?.type==='LOGOUT'&&!busy&&!importer.active()){closeWorkspace();void logout();return;}
   if(m?.type==='MERGE_PREVIEW'&&!busy&&!importer.active()){
    if(!repository?.capabilities?.merge)return;
    try{current.postMessage({type:'MERGE_PREVIEW',requestId:m.requestId,...importer.preview(m.backup)});}catch(error){current.postMessage({type:'TABLE_ERROR',requestId:m.requestId,...safeStorageDiagnostic(error)});}return;
   }
   if(m?.type==='MERGE_IMPORT'&&!busy){
    if(!repository?.capabilities?.merge)return;
    busy=true;
    try{const result=await importer.run(m.backup,(done,total)=>{if(port===current)current.postMessage({type:'MERGE_PROGRESS',requestId:m.requestId,done,total});});Object.assign(data,result.data);if(port===current)current.postMessage({type:'MERGE_DONE',requestId:m.requestId,...result});}
    catch(error){if(port===current)current.postMessage({type:'MERGE_ERROR',requestId:m.requestId,...safeStorageDiagnostic(error),progress:error.importProgress,active:importer.active()});}
    finally{busy=false;}return;
   }
   // 견적서 이메일 (Gmail): separate from storage writes, so it never waits on or blocks a save.
   if(typeof m?.type==='string'&&m.type.startsWith('MAIL_')){
    gmail??=createGmailSender();const reply=o=>{if(port===current)current.postMessage({requestId:m.requestId,...o});};
    const codes=['BAD_RECIPIENT','BAD_MESSAGE','CANCELLED','POPUP_BLOCKED','SCOPE_DENIED','GMAIL_NOT_ENABLED','OAUTH_SETUP_REQUIRED','RATE_LIMIT','AUTH_EXPIRED','UNAVAILABLE','MAIL_FAILED'];
    const fail=e=>reply({type:'MAIL_ERROR',code:codes.includes(e?.code)?e.code:'MAIL_FAILED'});
    if(m.type==='MAIL_PREPARE'){gmail.prepare().then(()=>reply({type:'MAIL_STATUS',...gmail.status()}),()=>reply({type:'MAIL_STATUS',...gmail.status(),unavailable:true}));return;}
    if(m.type==='MAIL_STATUS'){reply({type:'MAIL_STATUS',...gmail.status()});return;}
    if(m.type==='MAIL_DISCONNECT'){gmail.disconnect();reply({type:'MAIL_STATUS',...gmail.status()});return;}
    if(m.type==='MAIL_SEND'){gmail.send({to:m.to,subject:m.subject,body:m.body,filename:m.filename,bytes:m.bytes instanceof Uint8Array?m.bytes:null}).then(r=>reply({type:'MAIL_DONE',...r}),fail);return;}
    return;
   }
   // 사진 요청은 버리지 않는다: 저장·가져오기 중이면 바로 BUSY로 답해 화면이 기다리며 멈추지 않게 한다.
   if(['ASSET_UPLOAD','ASSET_READ'].includes(m?.type)&&(busy||importer.active())){if(port===current)current.postMessage({type:'ASSET_ERROR',requestId:m.requestId,code:'BUSY'});return;}
   if(importer.active())return;
   if(['ASSET_UPLOAD','ASSET_READ'].includes(m?.type)&&!busy){
    busy=true;
    try{const result=m.type==='ASSET_UPLOAD'?await repository.uploadAsset(m.kind,m.bytes):{bytes:await repository.downloadAsset(m.path)};if(port===current)current.postMessage({type:'ASSET_DONE',requestId:m.requestId,...result});}
    catch(error){if(port===current)current.postMessage({type:'ASSET_ERROR',requestId:m.requestId,...safeStorageDiagnostic(error)});}
    finally{busy=false;}return;
   }
   if(m?.type!=='SAVE_TABLE'||busy||!repository)return;
   busy=true;
   try{
    let result;
    try{result=await repository.saveTable(m.key,m.rows,{recover:m.recover===true});}
    catch(error){
     // A lost response gets one READ-only reconciliation, never a second PUT.
     if(error.code!=='SAVE_UNCONFIRMED'||m.recover)throw error;
     result=await repository.saveTable(m.key,null,{recover:true});
    }
    data[result.key]=structuredClone(result.rows);
    if(port===current)current.postMessage({type:'TABLE_SAVED',requestId:m.requestId,...result});
   }catch(error){if(port===current)current.postMessage({type:'TABLE_ERROR',requestId:m.requestId,...safeStorageDiagnostic(error)});}
   finally{busy=false;}
  };
  const provider=repository.identities()[0]?.provider;
  target.contentWindow.postMessage({type:'NARO_READ_SNAPSHOT',data,provider},location.origin,[channel.port2]);
 };
 ready=e=>{if(e.origin===location.origin&&e.source===target.contentWindow&&e.data?.type==='NARO_READ_READY')deliver();};
 window.addEventListener('message',ready);
 if(wasReady)deliver();
 if(!warmed){frame.src='./erp/index.html';document.body.append(frame);}
}
