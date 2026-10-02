import {Onboarding,message,tables} from './core.mjs';
import {GoogleDriveProvider,DropboxProvider} from './providers.mjs';
import {createRuntime} from './runtime.mjs';
// LOCAL-only application; preview.html is a static visual fixture, never an Auth mode.
const preview=document.documentElement.hasAttribute('data-ui-preview');
const {auth,cloud,blockedProviders={},prepareConnect=()=>{},cancelConnect=()=>{}}=await createRuntime();
const view=document.getElementById('view'),notice=document.getElementById('notice');
let previousScreen='',selectedProvider=null;
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
const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=preview?()=>{}:fn;};
function render(state){
 document.body.dataset.screen=state.screen;
 if(previousScreen!==state.screen){
  previousScreen=state.screen;view.replaceChildren();
  const screen=state.screen;
  if(screen==='login'||screen==='signup'){
   const signup=screen==='signup';
   view.innerHTML=heading(signup?'NARO와<br>함께 시작하세요.':'NARO에<br>오신 것을 환영합니다.',signup?'내 업무 공간을 만들어보세요.':'지금, 더 효율적인 운영을 시작하세요.')+
    `<form class="form">${email()}${field('password','비밀번호','비밀번호를 입력하세요')}${signup?field('confirmation','비밀번호 확인','비밀번호를 한 번 더 입력하세요'):`<div class="master-options"><label class="remember" title="현재 메모리 전용 세션으로 로그인 유지 기능은 비활성화되어 있습니다."><input type="checkbox" data-visual-disabled disabled><span>로그인 상태 유지</span></label>${button('reset','비밀번호 찾기','text-button')}</div>`}<button class="primary" type="submit">${signup?'회원가입':'로그인'}</button></form><div class="row">${signup?'이미 계정이 있으신가요?':'아직 계정이 없으신가요?'}${button('switch',signup?'로그인':'회원가입하기 <span aria-hidden="true">›</span>','text-button')}</div>`;
   view.querySelector('form').onsubmit=async e=>{
    e.preventDefault();if(preview)return;const form=e.currentTarget;
    const address=form.elements.email.value.trim(),secret=form.elements.password.value,confirm=form.elements.confirmation?.value;
    form.elements.password.value='';if(form.elements.confirmation)form.elements.confirmation.value='';
    await flow.authenticate(screen,address,secret,confirm);
   };
   bind('switch',()=>flow.show(signup?'login':'signup'));
   bind('reset',()=>flow.show('reset'));
  }else if(screen==='verify'){
   view.innerHTML=heading('이메일을<br>확인해 주세요.','가입한 이메일로<br>인증 링크를 보냈습니다.')+
    button('verify','인증 확인하기')+button('resend','인증 메일 다시 보내기','secondary')+
    '<div class="support-link">'+button('logout','이메일 주소 변경 또는 로그인으로 돌아가기','text-button')+'</div>';
   bind('verify',()=>flow.verify());bind('resend',()=>flow.resend());
  }else if(screen==='storage'){
   selectedProvider=preview?'drive':null;
   view.innerHTML=heading('데이터를<br>어디에 저장할까요?','업무 데이터는 선택한<br>개인 클라우드에 저장됩니다.')+
    `<div class="providers">${['drive','dropbox'].map(kind=>`<button type="button" class="provider" data-provider="${kind}" aria-pressed="${selectedProvider===kind}">${providerIcon(kind)}<span><strong>${providerName(kind)}</strong><small>내 ${providerName(kind)}에 저장</small></span><i class="radio" aria-hidden="true"></i></button>`).join('')}</div>`+
    button('connect','연결하기')+'<div class="support-link">'+button('logout','로그아웃','text-button')+'</div>';
   view.querySelectorAll('[data-provider]').forEach(el=>el.onclick=()=>{
    if(blockedProviders[el.dataset.provider])return;
    selectedProvider=el.dataset.provider;
    view.querySelectorAll('[data-provider]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.provider===selectedProvider)));
    document.getElementById('connect').disabled=false;
   });
   bind('connect',async()=>{
    if(!selectedProvider)return;
    try{prepareConnect(selectedProvider);await flow.connect(selectedProvider);}
    catch(e){notice.textContent=e?.code==='POPUP_BLOCKED'?'팝업을 허용한 뒤 연결하기를 다시 눌러 주세요.':message(e);notice.setAttribute('role','alert');}
    finally{cancelConnect();}
   });
  }else if(screen==='connecting'||screen==='preparing'){
   view.innerHTML=`<div class="connecting-icon">${providerIcon(state.provider||selectedProvider)}</div>`+
    heading(providerName(state.provider||selectedProvider)+'를<br>연결하고 있습니다.','안전하게 계정을 연결하고 있어요.')+
    '<div class="progress" role="progressbar" aria-label="연결 중"></div>';
  }else if(screen==='ready'){
   view.innerHTML=heading('준비가<br>완료되었습니다.','나만의 NARO를 시작할 준비가 되었습니다.')+
    `<p class="location-caption">저장 위치</p><div class="location">${providerIcon(state.provider||selectedProvider)}<span><strong>${providerName(state.provider||selectedProvider)}</strong><small>NARO Biz</small></span></div>`+
    button('start','NARO 시작하기');
   bind('start',()=>render({...flow.state,screen:'workspace'}));
  }else if(screen==='workspace'){
   view.innerHTML=heading('나의 NARO','빈 업무 공간이 준비되었습니다.')+
    `<ul class="data-summary">${tables.map((k,i)=>`<li>${labels[i]}<strong>${state.db[k].length}</strong></li>`).join('')}</ul>`+button('logout','로그아웃','secondary');
  }else if(screen==='reset'){
   view.innerHTML=heading('비밀번호를<br>다시 설정하세요.','가입한 이메일로 재설정 안내를 보내드립니다.')+
    `<form class="form">${email()}<button class="primary" type="submit">재설정 메일 보내기</button></form><div class="support-link">${button('back','로그인으로 돌아가기','text-button')}</div>`;
   view.querySelector('form').onsubmit=e=>{e.preventDefault();if(!preview)flow.reset(e.currentTarget.elements.email.value.trim());};
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
 const mockButton=document.getElementById('mock-verify');
 if(mockButton){mockButton.hidden=state.screen!=='verify';mockButton.onclick=()=>{auth.confirmMockEmail();flow.verify();};}
 view.setAttribute('aria-busy',String(state.busy));
 view.querySelectorAll('button,input').forEach(el=>el.disabled=state.busy||el.hasAttribute('data-visual-disabled')||(el.id==='connect'&&!selectedProvider));
 view.querySelectorAll('[data-provider]').forEach(el=>{if(blockedProviders[el.dataset.provider]){el.disabled=true;el.title=blockedProviders[el.dataset.provider];}});
 notice.textContent=state.error?message(state.error):state.busy&&['login','signup','verify','reset'].includes(state.screen)?'처리 중입니다…':'';
 notice.setAttribute('role',state.error?'alert':'status');
 // 승인 전 안내는 오류가 아니라 기다림 — '승인 대기' 표시와 같은 주황(Dutch Pay --txn-amber).
 notice.classList.toggle('wait',state.error==='ACCESS_PENDING');
}
const flow=new Onboarding({auth,providerFactory:(kind,uid,signal)=>new (kind==='drive'?GoogleDriveProvider:DropboxProvider)(cloud(kind,uid,signal),{signal}),onChange:render});
if(preview){
 const screen=new URL(location.href).searchParams.get('screen');
 render({screen:['login','signup','verify','storage','connecting','ready','reset','reset-sent'].includes(screen)?screen:'login',busy:false,error:null,provider:'drive'});
}else render(flow.state);
window.addEventListener('pagehide',()=>{cancelConnect();flow.dispose();},{once:true});
