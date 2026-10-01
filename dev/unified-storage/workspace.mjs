let frame=null,channel=null,pendingReady=null;
export function closeWorkspace(){if(pendingReady)window.removeEventListener('message',pendingReady);pendingReady=null;channel?.close();channel=null;frame?.remove();frame=null;document.querySelector('main.onboarding').hidden=false;}
export function openWorkspace(data,logout,repository=null){
 closeWorkspace();
 document.querySelector('main.onboarding').hidden=true;
 frame=document.createElement('iframe');frame.title=repository?'NARO 업무 공간 · 거래처 등록':'NARO 업무 공간 · READ ONLY';
 frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;background:white;z-index:100';
 const expected=frame;
 const ready=async event=>{
  if(event.origin!==location.origin||event.source!==expected.contentWindow||event.data?.type!=='NARO_READ_READY')return;
  window.removeEventListener('message',ready);
  pendingReady=null;
  const ports=new MessageChannel();channel=ports.port1;
  const currentChannel=channel;let busy=false;
  channel.onmessage=async event=>{
   if(event.data?.type==='LOGOUT'){closeWorkspace();void logout();return;}
   if(event.data?.type!=='CREATE_COMPANY'||busy||!repository)return;
   busy=true;
   try{const companies=await repository.createCompany(event.data.record,{recoveryOnly:event.data.recoveryOnly===true});data.companies=structuredClone(companies);if(channel===currentChannel)currentChannel.postMessage({type:'COMPANY_SAVED',companies});}
   catch(e){if(channel===currentChannel)currentChannel.postMessage({type:'COMPANY_SAVE_ERROR',code:['VALIDATION','STORAGE_CONFLICT','CONCURRENCY_UNAVAILABLE','SAVE_UNCONFIRMED','QUOTA_LIMIT','RECONNECT_REQUIRED'].includes(e.code)?e.code:'SAVE_UNCONFIRMED'});}
   finally{busy=false;}
  };
  let companyWriteReady=false;
  if(repository){try{companyWriteReady=(await repository.checkCompanyWrite()).ready===true;}catch{}}
  if(frame!==expected||channel!==currentChannel){currentChannel.close();ports.port2.close();return;}
  expected.contentWindow.postMessage({type:'NARO_READ_SNAPSHOT',data,companyWriteReady},location.origin,[ports.port2]);
 };
 pendingReady=ready;window.addEventListener('message',ready);
 frame.src='./erp/index.html';document.body.append(frame);
}
