import {prepareSnapshot,clearSnapshot} from './adapter.mjs';
import {installReadOnly} from './readonly-guard.mjs';
import {createSessionLifecycle} from './session-lifecycle.mjs';
import {createDiscoveredReadOnlySession} from './discovered-readonly-session.mjs';
import {installLoginUX,loginError,notices} from './login-ux.mjs';
import {connect} from './transport.mjs';
export async function start(bridge,build){
 if(build?.mode!=='STAGED')throw Object.assign(Error('Unsupported mode'),{code:'configuration'});
 const {db}=bridge,app=document.getElementById('appView'),login=document.getElementById('loginView');
 clearSnapshot(db);app.classList.add('hidden');login.classList.remove('hidden');
 const scan=installReadOnly(bridge);bridge.bindReadUI();
 login.innerHTML='<form id="foundationLogin"><h2>NARO Biz</h2><p>회사 계정으로 로그인해 주세요.</p><label>Email <input name="email" type="email" required></label><label>Password <input name="password" type="password" required></label><button type="submit">로그인</button><p id="foundationStatus" role="status"></p><button type="button" id="foundationLogout" hidden>로그아웃</button></form>';
 const form=document.getElementById('foundationLogin'),status=document.getElementById('foundationStatus'),ux=installLoginUX(form,status);
 let client,expectedUid=null,busy=false,stage='auth';
 function clearBusiness(){
  clearSnapshot(db);scan.dispose();bridge.clearDrafts();
  document.querySelectorAll('dialog,.ip-pop').forEach(n=>{n.replaceChildren();n.remove();});
  app.replaceChildren();app.classList.add('hidden');
 }
 const lifecycle=createSessionLifecycle({clear(){expectedUid=null;clearBusiness();form.reset();login.classList.remove('hidden');},signOut:async()=>{await client?.signOut();},exit(){location.reload();}});
 const logout=()=>lifecycle.teardown().catch(()=>{status.textContent='세션을 종료했습니다. 새로고침해 주세요.';});
 for(const id of ['logoutBtn','refreshBtn','brandBtn','foundationLogout'])document.getElementById(id).onclick=logout;
 try{client=await connect();}catch{ux.message('로그인 연결 준비가 필요합니다. · READ ONLY');form.querySelector('[type=submit]').disabled=true;return;}
 client.onAuthChanged(user=>{if(expectedUid&&user?.uid!==expectedUid)void logout();});
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
  let generation=lifecycle.begin(null);stage='auth';ux.message('로그인 중…');
  try{
   await client.signIn(form.elements.email.value,form.elements.password.value);form.elements.password.value='';if(!lifecycle.current(generation))return;
   expectedUid=client.auth.currentUser.uid;stage='discovery';ux.message('회사 확인 중…');document.getElementById('foundationLogout').hidden=false;
   const session=createDiscoveredReadOnlySession(client);generation=lifecycle.begin(session);
   const found=await session.discover();if(!lifecycle.current(generation))return;
   if(found.status==='DISCOVERY_ERROR')throw Object.assign(Error('discovery'),{code:found.code});
   if(found.status!=='SINGLE_TENANT'){lifecycle.reject(generation);expectedUid=null;await client.signOut();if(lifecycle.current(generation))ux.company(found.status);return;}
   stage='load';ux.message('데이터 불러오는 중…');const data=await session.load(found.tenants[0]);if(!lifecycle.current(generation)||!session.isReady())return;
   const prepared=prepareSnapshot(data);
   lifecycle.apply(generation,found.tenants[0],()=>{
    Object.assign(db,prepared);bridge.switchView('dash');scan();
    document.getElementById('tbUser').textContent='NARO Biz · READ ONLY';bridge.setSyncState('saved','READ ONLY');
    login.classList.add('hidden');app.classList.remove('hidden');
   });
  }catch(error){
   if(lifecycle.current(generation)){
    lifecycle.reject(generation);expectedUid=null;clearBusiness();
    await client.signOut();if(lifecycle.current(generation))ux.message(notices[loginError(error.code,stage)]+' 새로고침 후 다시 시도해 주세요.');
   }
  }finally{if(lifecycle.current(generation)){form.elements.password.value='';busy=false;button.disabled=false;}}
 };
}
