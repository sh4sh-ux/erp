export const notices={
 invalid:'이메일 또는 비밀번호를 확인해 주세요.',
 network:'네트워크 연결을 확인한 후 다시 로그인해 주세요.',
 discovery:'회사 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
 authorization:'회사 접근 권한을 확인하지 못했습니다. 관리자에게 문의해 주세요.',
 load:'데이터를 불러오지 못했습니다. 다시 로그인해 주세요.',
 schema:'현재 지원하지 않는 데이터 형식입니다. 관리자에게 문의해 주세요.'
};
export function loginError(code,stage){
 if(['auth/network-request-failed','unavailable','deadline-exceeded'].includes(code))return 'network';
 if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email','auth/too-many-requests','auth/user-disabled'].includes(code))return 'invalid';
 if(['permission-denied','auth-changed'].includes(code))return 'authorization';
 if(code==='schema-invalid')return 'schema';
 return stage==='auth'?'invalid':stage==='discovery'?'discovery':'load';
}
export function installLoginUX(form,status){
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./login-ux.css',import.meta.url).href;document.head.append(css);
 document.getElementById('loginView').classList.add('firebase-login-ux');
 form.querySelector('h2').textContent='NARO Biz';
 form.querySelector('p').textContent='회사 계정으로 로그인해 주세요.';
 form.querySelector('label').firstChild.textContent='이메일';
 form.querySelectorAll('label')[1].firstChild.textContent='비밀번호';
 form.elements.email.autocomplete='username';form.elements.password.autocomplete='off';
 status.setAttribute('aria-live','polite');
 const title=document.createElement('h3'),help=document.createElement('p');title.hidden=true;help.hidden=true;status.before(title,help);
 const note=document.createElement('small');note.textContent='읽기 전용 · READ ONLY';form.append(note);
 return {
  message(text){status.textContent=text;},
  company(state){
   title.hidden=false;help.hidden=false;
   title.textContent=state==='NO_TENANT'?'사용 가능한 회사가 없습니다.':'사용할 회사를 선택해 주세요.';
   help.textContent=state==='NO_TENANT'?'관리자에게 초대를 요청하거나 새 회사를 등록해 주세요.':'회사 선택 기능은 준비 중입니다. 관리자에게 문의해 주세요.';
   for(const el of form.querySelectorAll('label,button[type="submit"],button:not([type])'))el.hidden=true;
   status.textContent='';
  }
 };
}
