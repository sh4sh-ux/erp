import {Onboarding,message,tables} from './core.mjs';
import {GoogleDriveProvider,DropboxProvider,onboardingReadProvider} from './storage.mjs';
import {openWorkspace,closeWorkspace,prepareWorkspace} from './workspace.mjs';
let priorIdentity=null,activeRepository=null;
async function recordRead(repository,backend,timing={}){activeRepository=repository;
 const identities=repository.identities();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(identities.map(({provider,logicalKey,fileId,path})=>({provider,logicalKey,fileId,path}))))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 document.documentElement.dataset.fileReuse=priorIdentity===null?'BASELINE':priorIdentity===digest?'PASS':'MISMATCH';priorIdentity=digest;
 const metrics=backend.metrics();document.documentElement.dataset.datasetCreates=String(metrics.datasetCreateRequests);document.documentElement.dataset.businessWrites=String(metrics.businessWriteRequests);document.documentElement.dataset.datasetsRead='7';document.documentElement.dataset.driveReadRequests=String(metrics.readRequests);document.documentElement.dataset.storageReadMs=String(timing.readMs??'');
}

import {createRuntime} from './runtime.mjs';

const {auth,cloud,blockedProviders={},prepareConnect=()=>{},cancelConnect=()=>{}}=await createRuntime();
const view=document.getElementById('view'),notice=document.getElementById('notice');
let previousScreen='',selectedProvider=null,chooseStorage=false,connectStarted=0,phaseStarted=0;
const labels=['거래처','품목','견적서','입금·출금','재고 기록','업체 제공 자재'];
const button=(id,text,style='primary')=>`<button id="${id}" class="${style}" type="button">${text}</button>`;
const providerName=kind=>kind==='dropbox'?'Dropbox':'Google Drive';
const providerIcon=kind=>`<img class="provider-icon" src="./${kind==='dropbox'?'dropbox':'drive'}-icon.png" alt="">`;
const svg=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${path}</svg>`;
const mail=svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>');
const lock=svg('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>');
const eye=svg('<path d="M3 3 21 21M10 5c5-1 9 4 11 7l-3 4M14 19C9 20 5 17 2 12l3-4"/><path d="M9 9a4 4 0 0 0 6 6"/>');
const field=(name,label,placeholder)=>`<div class="master-field"><label class="sr-only" for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${name==='email'?'email':'password'}" autocomplete="off" ${name==='email'?'':'minlength="8"'} required placeholder="${placeholder}"><span class="field-icon" aria-hidden="true">${name==='email'?mail:lock}</span>${name==='email'?'':`<button class="visibility" type="button" data-password="${name}" aria-label="${label} 표시" aria-pressed="false">${eye}</button>`}</div>`;
const email=()=>field('email','이메일','이메일을 입력하세요');
const heading=(title,copy)=>`<h2>${title}</h2><p class="intro">${copy}</p>`;
const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
function render(state){
 if(state.screen==='login'){closeWorkspace();chooseStorage=false;}
 document.body.dataset.screen=state.screen;
 document.title=document.querySelector('iframe[title="NARO 업무 공간"]')?'NARO Biz · 업무 관리':'NARO Biz · '+({login:'로그인',signup:'회원가입',verify:'이메일 인증',storage:'저장소 연결',connecting:'연결 중',preparing:'불러오는 중',ready:'준비 완료',reset:'비밀번호 재설정','reset-sent':'비밀번호 재설정'}[state.screen]||'업무 관리');
 if(previousScreen!==state.screen){
  if(phaseStarted){const now=performance.now(),key={connecting:'authCheckMs',preparing:'oauthMs',ready:'storagePhaseMs'}[state.screen];if(key)document.documentElement.dataset[key]=String(Math.round(now-phaseStarted));phaseStarted=now;if(state.screen==='ready')document.documentElement.dataset.connectionTotalMs=String(Math.round(now-connectStarted));}
  previousScreen=state.screen;view.replaceChildren();
  const screen=state.screen;
  if(screen==='login'||screen==='signup'){
   const signup=screen==='signup';
   view.innerHTML=heading(signup?'NARO와<br>함께 시작하세요.':'NARO-biz에<br>오신 것을 환영합니다.',signup?'내 업무 공간을 만들어보세요.':'지금, 더 효율적인 운영을 시작하세요.')+
    `<form class="form">${email()}${field('password','비밀번호','비밀번호를 입력하세요')}${signup?field('confirmation','비밀번호 확인','비밀번호를 한 번 더 입력하세요'):`<div class="master-options"><label class="remember" title="개인 기기에서만 선택하세요. NARO 로그인만 유지하며 저장소는 별도로 재연결합니다."><input type="checkbox" name="remember"><span>로그인 상태 유지</span></label>${button('reset','비밀번호 찾기','text-button')}</div>`}<button class="primary" type="submit">${signup?'회원가입':'로그인'}</button></form><div class="row">${signup?'이미 계정이 있으신가요?':'아직 계정이 없으신가요?'}${button('switch',signup?'로그인':'회원가입하기 <span aria-hidden="true">›</span>','text-button')}</div>`;
   view.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;
    const address=form.elements.email.value.trim(),secret=form.elements.password.value,confirm=form.elements.confirmation?.value;
    form.elements.password.value='';if(form.elements.confirmation)form.elements.confirmation.value='';
    await flow.authenticate(screen,address,secret,confirm,{remember:form.elements.remember?.checked===true});
   };
   bind('switch',()=>flow.show(signup?'login':'signup'));
   bind('reset',()=>flow.show('reset'));
  }else if(screen==='verify'){
   view.innerHTML=heading('이메일을<br>확인해 주세요.','가입한 이메일로<br>인증 링크를 보냈습니다.')+
    button('verify','인증 확인하기')+button('resend','인증 메일 다시 보내기','secondary')+
    '<div class="support-link">'+button('logout','이메일 주소 변경 또는 로그인으로 돌아가기','text-button')+'</div>';
   bind('verify',()=>flow.verify());bind('resend',()=>flow.resend());
  }else if(screen==='storage'){
   prepareWorkspace();
   const preferred=chooseStorage?null:auth.preferredProvider();
   selectedProvider=preferred&&!blockedProviders[preferred]?preferred:null;
   const reconnect=Boolean(selectedProvider);
   view.innerHTML=reconnect?heading('내 저장공간에<br>다시 연결하세요.','이전에 사용한 저장소입니다. Google Drive는 이 기기에 기억한 연결 계정을 확인한 뒤 파일을 엽니다.')+`<div class="location">${providerIcon(selectedProvider)}<span><strong>${providerName(selectedProvider)}</strong><small>NARO Biz</small></span></div>`+button('connect',providerName(selectedProvider)+' 재연결')+'<div class="support-link">'+button('change-storage','다른 저장소 선택','text-button')+button('logout','로그아웃','text-button')+'</div>':heading('데이터를<br>어디에 저장할까요?','업무 데이터는 선택한<br>개인 클라우드에 저장됩니다.')+
    `<div class="providers">${['drive','dropbox'].map(kind=>`<button type="button" class="provider" data-provider="${kind}" aria-pressed="${selectedProvider===kind}">${providerIcon(kind)}<span><strong>${providerName(kind)}</strong><small>내 ${providerName(kind)}에 저장</small></span><i class="radio" aria-hidden="true"></i></button>`).join('')}</div>`+
    button('connect','연결하기')+'<div class="support-link">'+button('logout','로그아웃','text-button')+'</div>';
   const accountChoice=document.createElement('label');accountChoice.className='remember';accountChoice.hidden=selectedProvider!=='drive';accountChoice.innerHTML='<input id="drive-select-account" type="checkbox"><span>다른 Google 계정 선택 · 기존 파일 이동 없음</span>';document.getElementById('connect').before(accountChoice);
   bind('change-storage',()=>{chooseStorage=true;previousScreen='';render(flow.state);});
   view.querySelectorAll('[data-provider]').forEach(el=>el.onclick=()=>{
    if(blockedProviders[el.dataset.provider])return;
    selectedProvider=el.dataset.provider;accountChoice.hidden=selectedProvider!=='drive';accountChoice.querySelector('input').checked=false;
    view.querySelectorAll('[data-provider]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.provider===selectedProvider)));
    document.getElementById('connect').disabled=false;
   });
   bind('connect',async()=>{
    if(!selectedProvider)return;
    connectStarted=phaseStarted=performance.now();
    for(const key of ['authCheckMs','oauthMs','storagePhaseMs','connectionTotalMs'])delete document.documentElement.dataset[key];
    try{prepareConnect(selectedProvider,{selectAccount:selectedProvider==='drive'&&document.getElementById('drive-select-account')?.checked===true});await flow.connect(selectedProvider);}
    catch(e){notice.textContent=e?.code==='POPUP_BLOCKED'?'팝업을 허용한 뒤 연결하기를 다시 눌러 주세요.':message(e);notice.setAttribute('role','alert');}
    finally{cancelConnect();}
   });
  }else if(screen==='connecting'||screen==='preparing'){
   view.innerHTML=`<div class="connecting-icon">${providerIcon(state.provider||selectedProvider)}</div>`+
    heading(providerName(state.provider||selectedProvider)+'를<br>연결하고 있습니다.','안전하게 계정을 연결하고 있어요.')+
    '<div class="progress" role="progressbar" aria-label="연결 중"></div>';
  }else if(screen==='ready'){
   auth.rememberProvider(state.provider||selectedProvider);chooseStorage=false;
   view.innerHTML=heading('업무 화면을<br>열고 있습니다.','저장공간 확인이 완료되었습니다.');
   const verifiedData=state.db,verifiedRepository=activeRepository;
   queueMicrotask(()=>{if(flow.state.screen==='ready'&&flow.state.db===verifiedData&&activeRepository===verifiedRepository)openWorkspace(verifiedData,()=>flow.logout(),verifiedRepository);});
  }else if(screen==='workspace'){
   view.innerHTML=heading('나의 NARO','빈 업무 공간이 준비되었습니다.')+
    `<ul class="data-summary">${tables.map((k,i)=>`<li>${labels[i]}<strong>${state.db[k].length}</strong></li>`).join('')}</ul>`+button('logout','로그아웃','secondary');
  }else if(screen==='reset'){
   view.innerHTML=heading('비밀번호를<br>다시 설정하세요.','가입한 이메일로 재설정 안내를 보내드립니다.')+
    `<form class="form">${email()}<button class="primary" type="submit">재설정 메일 보내기</button></form><div class="support-link">${button('back','로그인으로 돌아가기','text-button')}</div>`;
   view.querySelector('form').onsubmit=e=>{e.preventDefault();flow.reset(e.currentTarget.elements.email.value.trim());};
   bind('back',()=>flow.show('login'));
  }else if(screen==='reset-sent'){
   view.innerHTML=heading('재설정 메일을<br>보냈습니다.','메일함에서 비밀번호 재설정 안내를 확인해 주세요.')+button('back','로그인으로 돌아가기');
   bind('back',()=>flow.show('login'));
  }
  bind('logout',()=>flow.logout());
  view.querySelectorAll('[data-password]').forEach(toggle=>toggle.onclick=()=>{
   const input=view.querySelector(`[name="${toggle.dataset.password}"]`),visible=input.type==='password';
   input.type=visible?'text':'password';toggle.setAttribute('aria-pressed',String(visible));
   toggle.setAttribute('aria-label',toggle.dataset.password==='confirmation'?'비밀번호 확인 '+(visible?'숨기기':'표시'):'비밀번호 '+(visible?'숨기기':'표시'));
  });
 }
 view.setAttribute('aria-busy',String(state.busy));
 view.querySelectorAll('button,input').forEach(el=>el.disabled=state.busy||el.hasAttribute('data-visual-disabled')||(el.id==='connect'&&!selectedProvider));
 view.querySelectorAll('[data-provider]').forEach(el=>{if(blockedProviders[el.dataset.provider]){el.disabled=true;el.title=blockedProviders[el.dataset.provider];}});
 notice.textContent=state.error?message(state.error):state.busy&&['login','signup','verify','reset'].includes(state.screen)?'처리 중입니다…':'';
 notice.setAttribute('role',state.error?'alert':'status');
}
const flow=new Onboarding({auth,providerFactory:(kind,uid,signal)=>(()=>{const backend=cloud(kind,uid,signal);return onboardingReadProvider(new (kind==='drive'?GoogleDriveProvider:DropboxProvider)(backend,{signal}),(repository,timing)=>recordRead(repository,backend,timing),{businessWrite:true,extendedWrite:true,initializeNew:true});})(),onChange:render});
render(flow.state);
const restoreStarted=performance.now();
await flow.restore();
document.documentElement.dataset.authRestoreMs=String(Math.round(performance.now()-restoreStarted));
auth.watch(user=>flow.sessionChanged(user));
window.addEventListener("pageshow",event=>{if(event.persisted)location.reload();});
window.addEventListener('pagehide',()=>{cancelConnect();flow.dispose({preserveAuth:true});},{once:true});
