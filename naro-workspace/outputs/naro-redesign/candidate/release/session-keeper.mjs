// 로그인 유지(10/22, 3단계): Google Drive 열쇠는 1시간이면 끝난다. 서버 없이 이어 쓰려면 사용자의 누름 안에서 같은 계정으로 새로 받아야 한다.
//  - 끝나기 10분 전부터: 업무 화면에서 버튼을 누르면(ACTIVITY) 조용히 한 번 새로 받는다(이미 허락한 계정이라 Google 창이 잠깐 떴다 닫힌다).
//  - 그게 안 되면(팝업 막힘 등) 화면 위에 [연결 유지]/[다시 연결] 띠 — 이 누름은 이 페이지의 누름이라 확실히 창을 열 수 있다.
// 열쇠는 이 모듈에도 오지 않는다. 남은 시간(session)과 새로 받기(renew)만 쓴다.
export const SOON_MS=10*60*1000;
const QUIET_RETRY_MS=5*60*1000;
export function sessionState(session,now){
 if(!session||!session.expiresAt)return 'none';
 if(session.expiresAt<=now)return 'expired';
 return session.expiresAt-now<=SOON_MS?'soon':'ok';
}
const MSG={
 POPUP_BLOCKED:'팝업이 막혔어요. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.',
 DRIVE_ACCOUNT_MISMATCH:'처음 연결한 것과 다른 Google 계정이 선택됐어요. 같은 계정으로 다시 눌러 주세요.',
 CANCELLED:'Google 창이 닫혔어요. 다시 눌러 주세요.',
 NETWORK_ERROR:'인터넷 연결을 확인한 뒤 다시 눌러 주세요.'
};
export function installSessionKeeper({repository,doc=globalThis.document,now=()=>Date.now(),every=30000,reload=()=>globalThis.location?.reload()}={}){
 if(!repository?.session)return {tick(){},activity(){},stop(){},element:null};
 const bar=doc.createElement('div');bar.id='naroSessionBar';bar.setAttribute('role','status');bar.hidden=true;
 bar.style.cssText='position:fixed;z-index:101;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 10px);width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:10px 10px 10px 16px;border-radius:12px;background:#16181D;color:#fff;font:500 13.5px/1.4 system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.18)';
 const text=doc.createElement('span');const button=doc.createElement('button');button.type='button';
 button.style.cssText='flex:none;height:32px;padding:0 14px;border:0;border-radius:9px;background:#4355E8;color:#fff;font:600 13px/1 inherit;font-family:inherit;cursor:pointer';
 bar.append(text,button);doc.body.append(bar);
 let renewing=false,lastQuiet=0,note='',timer=null,stopped=false;
 const show=(message,label)=>{text.textContent=message;button.textContent=label;button.hidden=!label;button.disabled=renewing;bar.hidden=false;};
 function tick(){
  if(stopped)return;
  const s=repository.session(),state=sessionState(s,now());
  if(state==='none'||state==='ok'){if(!renewing){bar.hidden=true;note='';}return;}
  if(!s.renewable){if(state==='expired')show('저장소 연결 시간이 끝났어요. 다시 로그인하면 이어서 저장할 수 있어요.','다시 로그인');else bar.hidden=true;return;}
  if(renewing)return;
  if(state==='soon')show(note||'Google Drive 연결 시간이 곧 끝나요. 이어서 쓰려면 눌러 주세요.','연결 유지');
  else show(note||'Google Drive 연결 시간이 끝나 저장이 멈췄어요. 다시 연결해 주세요.','다시 연결');
 }
 // 반드시 누름 처리 안에서 바로 부른다(await 전에 repository.renew까지).
 function renew(quiet){
  if(renewing)return Promise.resolve(false);
  let pending;try{pending=repository.renew();}catch(e){pending=Promise.reject(e);}
  renewing=true;if(!quiet)show('Google 창에서 계정을 확인하고 있어요…','');
  return pending.then(()=>{renewing=false;note='';bar.hidden=true;return true;},error=>{renewing=false;if(!quiet)note=MSG[error?.code]||'연결하지 못했어요. 다시 눌러 주세요.';tick();return false;});
 }
 button.addEventListener('click',()=>{
  const s=repository.session();
  if(s&&!s.renewable){reload();return;}
  void renew(false);
 });
 function activity(){
  if(stopped||renewing)return;
  const s=repository.session(),state=sessionState(s,now());
  if(!s?.renewable||(state!=='soon'&&state!=='expired'))return;
  if(now()-lastQuiet<QUIET_RETRY_MS)return;
  lastQuiet=now();void renew(true);
 }
 timer=setInterval(tick,every);timer?.unref?.();tick();
 return {tick,activity,element:bar,stop(){stopped=true;clearInterval(timer);bar.remove();}};
}
