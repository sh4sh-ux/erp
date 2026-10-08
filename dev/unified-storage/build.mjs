// Local-only deterministic derivation. Original production/public artifacts untouched.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const companies=process.argv.includes('--companies');
const business=process.argv.includes('--business');
const extended=process.argv.includes('--extended');
if(extended&&!business)throw Error('EXTENDED_REQUIRES_BUSINESS');
const publicRelease=process.argv.includes('--public');
if(business&&(companies||publicRelease))throw Error('BUSINESS_CANDIDATE_LOCAL_ONLY');
if(publicRelease&&!companies)throw Error('PUBLIC_MODE_REQUIRES_COMPANIES');
const out=resolve(root,extended?'outputs/personal-business-extended-candidate':business?'outputs/personal-business-candidate':publicRelease?'outputs/personal-companies-public-release':companies?'outputs/personal-companies-create':'outputs/unified-storage-read'),release=resolve(out,'release');
await mkdir(resolve(release,'erp'),{recursive:true});
const original=resolve(root,'outputs/personal-cloud-onboarding-public-release/release');
for(const name of await readdir(original)){if(!name.startsWith('dropbox-')||name==='dropbox-icon.png')await copyFile(resolve(original,name),resolve(release,name));}
const onboarding=resolve(here,'../personal-cloud-onboarding');
for(const name of ['core.mjs','firebase-auth.mjs','google-oauth.mjs','drive-account-binding.mjs'])await copyFile(resolve(onboarding,name),resolve(release,name));
// Icons at display size (the originals were up to 2400px for a 35px icon).
for(const name of ['drive-icon.png','dropbox-icon.png'])await copyFile(resolve(onboarding,name),resolve(release,name));
const {build:bundleAuth}=await import('/private/tmp/naro-onboarding-build-tools/node_modules/esbuild/lib/main.js');
await bundleAuth({stdin:{contents:"export {initializeApp} from 'firebase/app'; export {initializeAuth,inMemoryPersistence,browserLocalPersistence,setPersistence,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendEmailVerification,reload,sendPasswordResetEmail,signOut} from 'firebase/auth';",resolveDir:resolve(root,'work/erp/dev/firebase'),sourcefile:'auth-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:resolve(release,'sdk.mjs'),logLevel:'silent'});
// UI-only assets use current editable source; auth/bootstrap stay pinned below.
for(const name of ['style.css','office-polish-v2.png','naro-symbol.png','naro-wordmark.png'])await copyFile(resolve(onboarding,name),resolve(release,name));
await copyFile(resolve(onboarding,'office-silver-v3.png'),resolve(release,'office-polish-v2.png'));
await copyFile(resolve(onboarding,'office-silver-v3.jpg'),resolve(release,'office-polish-v2.jpg'));
const onboardingHtml=(await readFile(resolve(original,'index.html'),'utf8')).replaceAll('Next-generation Apps<br>for Real Operations','Next-generation Apps for Real Operation').replace('<title>NARO · 시작하기</title>','<title>NARO Biz · 로그인</title><link rel="icon" type="image/png" href="./naro-symbol.png"><link rel="apple-touch-icon" href="./erp/icons/icon-180.png"><meta name="apple-mobile-web-app-title" content="NARO Biz"><link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#FFFFFF">')
 // Same theme preference as /erp/ ('naroTheme': light | dark | system), applied before first paint.
 // External file: the page CSP allows 'self' scripts only (no inline).
 .replace('</head>','<script src="./theme.js"></script></head>');
await writeFile(resolve(release,'index.html'),onboardingHtml);
// 안드로이드 '설치하기' 아이콘·이름 = 첫 화면의 앱 정보 파일. (사이트 보안 설정에 manifest-src 'self' 필요)
// display는 'browser'(독립 앱 창 금지): 독립 앱 창에서는 Dropbox·Google 연결 창이 따로 떠 로그인을 기억 못 하고 결과도 앱으로 못 돌아와 인증을 계속 다시 묻는다(10/2 minimal-ui 때 생긴 문제).
await writeFile(resolve(release,'manifest.webmanifest'),JSON.stringify({name:'NARO Biz',short_name:'NARO Biz',start_url:'./',scope:'./',display:'browser',background_color:'#FFFFFF',theme_color:'#FFFFFF',icons:[{src:'erp/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'erp/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]},null,2)+'\n');
await copyFile(resolve(onboarding,'theme.js'),resolve(release,'theme.js'));
await copyFile(resolve(onboarding,'google-backend.mjs'),resolve(release,'google-backend.mjs'));
await copyFile(resolve(onboarding,'company-contract.mjs'),resolve(release,'company-contract.mjs'));
await copyFile(resolve(onboarding,'business-contract.mjs'),resolve(release,'business-contract.mjs'));
await copyFile(resolve(onboarding,'extended-contract.mjs'),resolve(release,'extended-contract.mjs'));
await copyFile(resolve(onboarding,'asset-store.mjs'),resolve(release,'asset-store.mjs'));
for(const name of ['workspace.mjs'])await copyFile(resolve(here,name),resolve(release,name));
await writeFile(resolve(release,'merge-import.mjs'),(await readFile(resolve(here,'merge-import.mjs'),'utf8')).replaceAll('../personal-cloud-onboarding/','./'));
await writeFile(resolve(release,'gmail-send.mjs'),(await readFile(resolve(here,'gmail-send.mjs'),'utf8')).replaceAll('../personal-cloud-onboarding/','./'));
await writeFile(resolve(release,'storage.mjs'),(await readFile(resolve(here,'storage.mjs'),'utf8')).replaceAll('../personal-cloud-onboarding/','./'));
let runtime=await readFile(resolve(onboarding,'runtime-live.mjs'),'utf8');
runtime=runtime.replace(/^import .*Dropbox.*\n/gm,'').replace("const oauth=createDropboxOAuth({clientId:'ehmn2pd14wm98im'});",'const oauth={close(){}};');
runtime=runtime.replace("kind==='dropbox'?oauth:kind==='drive'&&drive?drive:null","kind==='drive'&&drive?drive:null");
runtime=runtime.replace('createGoogleBackend({oauth:drive,signal})','createGoogleBackend({oauth:drive,signal,readOnly:true})').replace("if(kind==='dropbox')return createDropboxBackend({oauth,signal});",'');
if(companies)runtime=runtime.replace('signal,readOnly:true','signal,readOnly:true,companiesCreate:true');
if(business)runtime=runtime.replace('signal,readOnly:true','signal,readOnly:true,businessWrite:true');
if(extended)runtime=runtime.replace('businessWrite:true','businessWrite:true,extendedWrite:true');
runtime=runtime.replace("blockedProviders:blocked}","blockedProviders:Object.assign(blocked,{dropbox:'READ FOUNDATION — NOT CONNECTED'})}");
if(extended){
 runtime=(await readFile(resolve(onboarding,'runtime-live.mjs'),'utf8')).replace('createGoogleBackend({oauth:drive,signal})','createGoogleBackend({oauth:drive,signal,readOnly:true,businessWrite:true,extendedWrite:true,initializeNew:true})').replace('createDropboxBackend({oauth,signal})','createDropboxBackend({oauth,signal,businessWrite:true})');
 for(const name of ['dropbox-oauth.mjs','dropbox-backend.mjs','dropbox-callback.html','dropbox-callback.mjs','dropbox-waiting.html'])await copyFile(resolve(onboarding,name),resolve(release,name));
}
await writeFile(resolve(release,'runtime.mjs'),runtime);
let app=await readFile(resolve(original,'app.mjs'),'utf8');
app=app.replace('NARO에<br>오신 것을 환영합니다.','NARO-biz에<br>오신 것을 환영합니다.');
app=app.replace('현재 메모리 전용 세션으로 로그인 유지 기능은 비활성화되어 있습니다.','개인 기기에서만 선택하세요. NARO 로그인만 유지하며 저장소는 별도로 재연결합니다.').replace('type="checkbox" data-visual-disabled disabled','type="checkbox" name="remember"');
app=app.replace('flow.authenticate(screen,address,secret,confirm)','flow.authenticate(screen,address,secret,confirm,{remember:form.elements.remember?.checked===true})');
app=app.replace('flow.dispose();','flow.dispose({preserveAuth:true});');
app=app.replace("import {GoogleDriveProvider,DropboxProvider} from './providers.mjs';","import {GoogleDriveProvider,onboardingReadProvider} from './storage.mjs';\nimport {openWorkspace,closeWorkspace} from './workspace.mjs';\nlet priorIdentity=null;\nasync function recordRead(repository,backend){\n const identities=repository.identities();\n const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(identities.map(({provider,logicalKey,fileId,path})=>({provider,logicalKey,fileId,path}))))))).map(n=>n.toString(16).padStart(2,'0')).join('');\n document.documentElement.dataset.fileReuse=priorIdentity===null?'BASELINE':priorIdentity===digest?'PASS':'MISMATCH';priorIdentity=digest;\n const metrics=backend.metrics();document.documentElement.dataset.datasetCreates=String(metrics.datasetCreateRequests);document.documentElement.dataset.businessWrites=String(metrics.businessWriteRequests);document.documentElement.dataset.datasetsRead='7';\n}\n");
app=app.replace("bind('start',()=>render({...flow.state,screen:'workspace'}));","bind('start',()=>openWorkspace(flow.state.db,()=>flow.logout()));");
app=app.replace("new (kind==='drive'?GoogleDriveProvider:DropboxProvider)(cloud(kind,uid,signal),{signal})","(()=>{const backend=cloud(kind,uid,signal);return onboardingReadProvider(new GoogleDriveProvider(backend,{signal}),repository=>recordRead(repository,backend));})()");
app=app.replace("function render(state){","function render(state){\n if(state.screen==='login')closeWorkspace();");
// 승인 전 안내(ACCESS_PENDING)는 오류가 아니라 기다림 — 빨강 대신 '승인 대기'와 같은 Dutch Pay 주황(style.css #notice.wait).
if(!app.includes("notice.setAttribute('role',state.error?'alert':'status');"))throw Error('notice patch anchor');
app=app.replace("notice.setAttribute('role',state.error?'alert':'status');","notice.setAttribute('role',state.error?'alert':'status');notice.classList.toggle('wait',state.error==='ACCESS_PENDING');");
if(companies||business){
 app=app.replace('let priorIdentity=null;','let priorIdentity=null,activeRepository=null;');
 app=app.replace('async function recordRead(repository,backend){','async function recordRead(repository,backend){activeRepository=repository;');
 app=app.replace('openWorkspace(flow.state.db,()=>flow.logout())','openWorkspace(flow.state.db,()=>flow.logout(),activeRepository)');
 app=app.replace('repository=>recordRead(repository,backend))','repository=>recordRead(repository,backend),{companiesCreate:true})');
 if(business)app=app.replace('{companiesCreate:true}','{businessWrite:true}');
 if(extended)app=app.replace('{businessWrite:true}','{businessWrite:true,extendedWrite:true}');
}
if(extended){
 app=app.replace('import {GoogleDriveProvider,onboardingReadProvider}', 'import {GoogleDriveProvider,DropboxProvider,onboardingReadProvider}');
 app=app.replace('new GoogleDriveProvider(backend,{signal})',"new (kind==='drive'?GoogleDriveProvider:DropboxProvider)(backend,{signal})");
 app=app.replace('{businessWrite:true,extendedWrite:true}',"{businessWrite:true,extendedWrite:true,initializeNew:true}");
}
if(publicRelease||business){
 app=app.replace(/\/\/ LOCAL-only application;[^\n]*\n/,'');
 app=app.replace("const preview=document.documentElement.hasAttribute('data-ui-preview');",'');
 app=app.replace('el.onclick=preview?()=>{}:fn','el.onclick=fn').replace('if(preview)return;','').replace("selectedProvider=preview?'drive':null;",'selectedProvider=null;').replace('if(!preview)flow.reset','flow.reset');
 app=app.replace(/ const mockButton=[\s\S]*?\n view.setAttribute/, ' view.setAttribute');
 app=app.replace(/if\(preview\)\{[\s\S]*?\}else render\(flow.state\);/,'render(flow.state);');
 if(/\bpreview\b|confirmMockEmail|mock-verify/.test(app))throw Error('DEV_BRANCH_REMAINS');
}
app=app.replace('render(flow.state);','render(flow.state);\nawait flow.restore();\nauth.watch(user=>flow.sessionChanged(user));\nwindow.addEventListener("pageshow",event=>{if(event.persisted)location.reload();});');
app=app.replace('async function recordRead(repository,backend){','async function recordRead(repository,backend,timing={}){').replaceAll('repository=>recordRead(repository,backend)','(repository,timing)=>recordRead(repository,backend,timing)').replace("document.documentElement.dataset.datasetsRead='7';","document.documentElement.dataset.datasetsRead='7';document.documentElement.dataset.driveReadRequests=String(metrics.readRequests);document.documentElement.dataset.storageReadMs=String(timing.readMs??'');");
app=app.replace("let previousScreen='',selectedProvider=null;","let previousScreen='',selectedProvider=null,chooseStorage=false;");
app=app.replace("if(state.screen==='login')closeWorkspace();","if(state.screen==='login'){closeWorkspace();chooseStorage=false;}");
app=app.replace("   selectedProvider=null;", "   const preferred=chooseStorage?null:auth.preferredProvider();\n   selectedProvider=preferred&&!blockedProviders[preferred]?preferred:null;\n   const reconnect=Boolean(selectedProvider);");
app=app.replace("view.innerHTML=heading('데이터를<br>어디에 저장할까요?'", "view.innerHTML=reconnect?heading('내 저장공간에<br>다시 연결하세요.','이전에 사용한 저장소입니다. 연결할 계정은 Google 또는 Dropbox 창에서 확인해 주세요.')+`<div class=\"location\">${providerIcon(selectedProvider)}<span><strong>${providerName(selectedProvider)}</strong><small>NARO Biz</small></span></div>`+button('connect',providerName(selectedProvider)+' 재연결')+'<div class=\"support-link\">'+button('change-storage','다른 저장소 선택','text-button')+button('logout','로그아웃','text-button')+'</div>':heading('데이터를<br>어디에 저장할까요?'");
app=app.replace("   view.querySelectorAll('[data-provider]').forEach(el=>el.onclick=()=>{", "   bind('change-storage',()=>{chooseStorage=true;previousScreen='';render(flow.state);});\n   view.querySelectorAll('[data-provider]').forEach(el=>el.onclick=()=>{");
app=app.replace("  }else if(screen==='ready'){", "  }else if(screen==='ready'){\n   auth.rememberProvider(state.provider||selectedProvider);chooseStorage=false;");
app=app.replace("document.body.dataset.screen=state.screen;", "document.body.dataset.screen=state.screen;\n document.title='NARO Biz · '+({login:'로그인',signup:'회원가입',verify:'이메일 인증',storage:'저장소 연결',connecting:'연결 중',preparing:'불러오는 중',ready:'준비 완료',reset:'비밀번호 재설정','reset-sent':'비밀번호 재설정'}[state.screen]||'업무 관리');");
app=app.replace("let previousScreen='',selectedProvider=null,chooseStorage=false;", "let previousScreen='',selectedProvider=null,chooseStorage=false,connectStarted=0,phaseStarted=0;");
app=app.replace("  previousScreen=state.screen;view.replaceChildren();", "  if(phaseStarted){const now=performance.now(),key={connecting:'authCheckMs',preparing:'oauthMs',ready:'storagePhaseMs'}[state.screen];if(key)document.documentElement.dataset[key]=String(Math.round(now-phaseStarted));phaseStarted=now;if(state.screen==='ready')document.documentElement.dataset.connectionTotalMs=String(Math.round(now-connectStarted));}\n  previousScreen=state.screen;view.replaceChildren();");
app=app.replace("    try{prepareConnect(selectedProvider);", "    connectStarted=phaseStarted=performance.now();\n    for(const key of ['authCheckMs','oauthMs','storagePhaseMs','connectionTotalMs'])delete document.documentElement.dataset[key];\n    try{prepareConnect(selectedProvider);");
app=app.replace('await flow.restore();','const restoreStarted=performance.now();\nawait flow.restore();\ndocument.documentElement.dataset.authRestoreMs=String(Math.round(performance.now()-restoreStarted));');
if(business){
 app=app.replace('import {openWorkspace,closeWorkspace}', 'import {openWorkspace,closeWorkspace,prepareWorkspace}');
 app=app.replace("document.title='NARO Biz · '+", "document.title=document.querySelector('iframe[title=\"NARO 업무 공간\"]')?'NARO Biz · 업무 관리':'NARO Biz · '+");
 app=app.replace("  }else if(screen==='storage'){", "  }else if(screen==='storage'){\n   prepareWorkspace();");
 const readyStart=app.indexOf("  }else if(screen==='ready'){");
 const readyEnd=app.indexOf("  }else if(screen==='workspace'){",readyStart);
 if(readyStart<0||readyEnd<0)throw Error('READY_UI_BOUNDARY_CHANGED');
 app=app.slice(0,readyStart)+`  }else if(screen==='ready'){
   auth.rememberProvider(state.provider||selectedProvider);chooseStorage=false;
   view.innerHTML=heading('업무 화면을<br>열고 있습니다.','저장공간 확인이 완료되었습니다.');
   const verifiedData=state.db,verifiedRepository=activeRepository;
   queueMicrotask(()=>{if(flow.state.screen==='ready'&&flow.state.db===verifiedData&&activeRepository===verifiedRepository)openWorkspace(verifiedData,()=>flow.logout(),verifiedRepository);});
`+app.slice(readyEnd);
}
if(business){
 app=app.replace("   bind('change-storage',",`   const accountChoice=document.createElement('label');accountChoice.className='remember';accountChoice.hidden=selectedProvider!=='drive';accountChoice.innerHTML='<input id="drive-select-account" type="checkbox"><span>다른 Google 계정 선택 · 기존 파일 이동 없음</span>';document.getElementById('connect').before(accountChoice);
   bind('change-storage',`);
 app=app.replace('selectedProvider=el.dataset.provider;',"selectedProvider=el.dataset.provider;accountChoice.hidden=selectedProvider!=='drive';accountChoice.querySelector('input').checked=false;");
 app=app.replace('prepareConnect(selectedProvider);',"prepareConnect(selectedProvider,{selectAccount:selectedProvider==='drive'&&document.getElementById('drive-select-account')?.checked===true});");
 app=app.replace('이전에 사용한 저장소입니다. 연결할 계정은 Google 또는 Dropbox 창에서 확인해 주세요.','이전에 사용한 저장소입니다. Google Drive는 이 기기에 기억한 연결 계정을 확인한 뒤 파일을 엽니다.');
}
// Returning user: one obvious action. Primary button right under the heading (icon + name, focused),
// a line on what will happen, then the secondary choices. Same flow, no auth/token change.
{
 const reconnect="heading('내 저장공간에<br>다시 연결하세요.','이전에 사용한 저장소입니다. Google Drive는 이 기기에 기억한 연결 계정을 확인한 뒤 파일을 엽니다.')+`<div class=\"location\">${providerIcon(selectedProvider)}<span><strong>${providerName(selectedProvider)}</strong><small>NARO Biz</small></span></div>`+button('connect',providerName(selectedProvider)+' 재연결')+'<div class=\"support-link\">'+button('change-storage','다른 저장소 선택','text-button')+button('logout','로그아웃','text-button')+'</div>'";
 if(app.includes(reconnect)){
  app=app.replace(reconnect,"heading('저장공간을<br>다시 연결해 주세요.','보안을 위해 로그인할 때마다 한 번 연결합니다. 연결하면 바로 업무 화면이 열려요.')+`<button id=\"connect\" class=\"primary connect-hero\" type=\"button\">${providerIcon(selectedProvider)}<span>${providerName(selectedProvider)}로 계속하기</span></button><p class=\"connect-note\">${selectedProvider==='drive'?'Google':'Dropbox'} 창이 잠깐 열렸다 닫힙니다.</p>`+'<div class=\"support-link reconnect-links\">'+button('change-storage','다른 저장소 선택','text-button')+'<span aria-hidden=\"true\">·</span>'+button('logout','로그아웃','text-button')+'</div>'");
  const place="document.getElementById('connect').before(accountChoice);";
  if(!app.includes(place))throw Error('ACCOUNT_CHOICE_BOUNDARY_CHANGED');
  app=app.replace(place,"if(reconnect){view.querySelector('.connect-note').after(accountChoice);requestAnimationFrame(()=>document.getElementById('connect')?.focus({preventScroll:true}));}else document.getElementById('connect').before(accountChoice);");
 }else if(business)throw Error('RECONNECT_UI_BOUNDARY_CHANGED');
}
// Progress that says what is happening: account (1/3) → data (2/3) → workspace (3/3).
{
 const connecting="heading(providerName(state.provider||selectedProvider)+'를<br>연결하고 있습니다.','안전하게 계정을 연결하고 있어요.')+\n    '<div class=\"progress\" role=\"progressbar\" aria-label=\"연결 중\"></div>';";
 if(!app.includes(connecting))throw Error('CONNECTING_UI_BOUNDARY_CHANGED');
 app=app.replace(connecting,"(state.screen==='preparing'?heading('업무 데이터를<br>불러오고 있습니다.','저장공간에서 최신 자료를 가져오고 있어요.'):heading(providerName(state.provider||selectedProvider)+'에<br>연결하고 있습니다.','계정 확인 창이 열리면 승인해 주세요.'))+\n    `<div class=\"progress\" role=\"progressbar\" aria-label=\"${state.screen==='preparing'?'데이터 불러오는 중':'연결 중'}\" data-step=\"${state.screen==='preparing'?2:1}\"></div>`;");
 const ready="view.innerHTML=heading('업무 화면을<br>열고 있습니다.','저장공간 확인이 완료되었습니다.');";
 if(app.includes(ready))app=app.replace(ready,"view.innerHTML=heading('업무 화면을<br>열고 있습니다.','저장공간 확인이 완료되었습니다.')+'<div class=\"progress\" role=\"progressbar\" aria-label=\"화면 여는 중\" data-step=\"3\"></div>';");
}
// 회원 승인제: 이메일 인증 → 승인 대기(관리자 승인) → 저장소 연결. 관리자 화면은 업무 화면 안(access-ui.mjs).
{
 const anchors=["const flow=new Onboarding({auth,","  }else if(screen==='reset'){","verify:'이메일 인증',","['login','signup','verify','reset'].includes(state.screen)?'처리 중입니다…'"];
 for(const a of anchors)if(!app.includes(a))throw Error('ACCESS_UI_BOUNDARY_CHANGED '+a);
 app="import {createAccess,setActiveAccess} from './access-control.mjs';\n"+app;
 app=app.replace("const flow=new Onboarding({auth,","const access=createAccess({auth});setActiveAccess(access);\nconst flow=new Onboarding({auth,access,");
 app=app.replace("verify:'이메일 인증',","verify:'이메일 인증',pending:'승인 대기',rejected:'승인 안 됨',");
 app=app.replace("['login','signup','verify','reset'].includes(state.screen)?'처리 중입니다…'","['login','signup','verify','reset','pending','rejected'].includes(state.screen)?'처리 중입니다…'");
 app=app.replace("  }else if(screen==='reset'){",`  }else if(screen==='pending'||screen==='rejected'){
   const a=state.access||{},no=screen==='rejected',safe=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
   const day=a.requestedAt&&!isNaN(new Date(a.requestedAt))?new Date(a.requestedAt).toLocaleDateString('ko-KR'):'';
   view.innerHTML='<div class="access-badge'+(no?' no':'')+'">'+svg(no?'<circle cx="12" cy="12" r="9"/><path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+'</div>'+
    heading(no?'사용 승인이<br>되지 않았어요.':'승인을<br>기다리고 있어요.',no?'이 계정은 아직 사용할 수 없어요.<br>관리자에게 문의해 주세요.':'관리자가 가입을 확인하고 있어요.<br>승인되면 바로 사용할 수 있어요.')+
    '<dl class="access-info"><dt>가입 이메일</dt><dd>'+safe(a.email||auth.email())+'</dd>'+(day?'<dt>신청일</dt><dd>'+day+'</dd>':'')+'<dt>상태</dt><dd><span class="access-state'+(no?' no':'')+'">'+(no?'승인 안 됨':'승인 대기')+'</span></dd></dl>'+
    button('recheck','승인 확인하기')+'<div class="support-link">'+button('logout','로그아웃','text-button')+'</div>';
   bind('recheck',()=>flow.recheck());
  }else if(screen==='reset'){`);
}
await writeFile(resolve(release,'app.mjs'),app);
await copyFile(resolve(here,'access-control.mjs'),resolve(release,'access-control.mjs'));
if(business)await copyFile(resolve(here,'business-workspace.mjs'),resolve(release,'workspace.mjs'));
// Reuse sanitized v1.186 renderers, not the original private-data artifact.
const erp=resolve(root,'outputs/privacy-safe-companies-pilot/source/app');
for(const name of await readdir(erp))if(/\.(css|js|png|webmanifest)$/.test(name))await copyFile(resolve(erp,name),resolve(release,'erp',name));
// 폰 견적서 품목 카드: 품번은 품명 뒤에 얇은 회색 글자로(같은 굵기로 붙어 있어 품명처럼 보였다).
{
 const qpPath=resolve(release,'erp/quote-presentation.js');let qp=await readFile(qpPath,'utf8');
 const from="const name = item ? `${item.name || ''} ${item.code || ''}` : line.name || '품목 선택';\n        edit.append(el('strong', '', name), el('span', 'qp-muted', '편집 ›'));";
 const to="const title = el('strong', '', item ? item.name || '' : line.name || '품목 선택');\n        if (item && item.code) title.append(' ', el('small', 'qp-code', item.code));\n        edit.append(title, el('span', 'qp-muted', '편집 ›'));";
 if(!qp.includes(from))throw Error('QP_CARD_NAME_BOUNDARY');
 await writeFile(qpPath,qp.replace(from,to));
}
await mkdir(resolve(release,'erp/icons'),{recursive:true});
for(const name of await readdir(resolve(erp,'icons')))await copyFile(resolve(erp,'icons',name),resolve(release,'erp/icons',name));
// 홈 화면 아이콘 = NARO 심볼 (legacy 파란 ERP 아이콘을 같은 경로에 덮어씀 — 파일 수 그대로).
for(const name of await readdir(resolve(here,'naro-icons')))await copyFile(resolve(here,'naro-icons',name),resolve(release,'erp/icons',name));
await writeFile(resolve(release,'erp/manifest.webmanifest'),(await readFile(resolve(release,'erp/manifest.webmanifest'),'utf8')).replace('"ERP · 업무 관리"','"NARO Biz · 업무 관리"').replace('"short_name": "ERP"','"short_name": "NARO Biz"').replace('"#0A84FF"','"#2F5BFF"'));
let html=await readFile(resolve(erp,'index.html'),'utf8');
// 부가세 포함 단가 줄(line.vat_inc, 10/8): 쇼핑몰 주문처럼 결제액이 정해진 줄은 단가를 결제액 그대로 두고
// 공급가 = 결제액÷1.1(반올림), 부가세 = 결제액 − 공급가로 거꾸로 나눈다 → 몇 건을 더해도 합계 = 결제액(1원 차이 없음).
// 표시가 없는 줄(일반 견적서)은 계산이 그대로다.
{
 const P=(from,to,code,all=false)=>{if(!html.includes(from))throw Error(code);html=all?html.split(from).join(to):html.replace(from,()=>to);};
 P(`function quoteTotals(q){
  const supply=q.lines.reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0);
  const qty=q.lines.reduce((s,l)=>s+((l.name||"").trim()?(Number(l.qty)||0):0),0);
  const vat=Math.round(supply*0.1);
  return { supply, vat, total:supply+vat, qty };
}`,`function quoteTotals(q){
  let ex=0,inc=0;
  q.lines.forEach(l=>{const g=(Number(l.qty)||0)*(Number(l.price)||0);if(l.vat_inc)inc+=g;else ex+=g;});
  inc=Math.round(inc*100)/100;
  const incSupply=Math.round(inc/1.1);
  const qty=q.lines.reduce((s,l)=>s+((l.name||"").trim()?(Number(l.qty)||0):0),0);
  const supply=ex+incSupply, vat=Math.round(ex*0.1)+(inc-incSupply);
  return { supply, vat, total:supply+vat, qty };
}
/* 한 줄의 공급가·세액(인쇄·이미지 표): 부가세 포함 줄은 결제액을 거꾸로 나눈다 */
function lineSupplyVat(l){const g=(Number(l.qty)||0)*(Number(l.price)||0);if(!l.vat_inc)return {supply:g,vat:Math.round(g*0.1),price:Number(l.price)||0};const s=Math.round(g/1.1);return {supply:s,vat:Math.round(g)-s,price:(Number(l.qty)||0)?Math.round(s/(Number(l.qty)||1)):0};}`,'VATINC_TOTALS');
 P(`    supply += qty*(Number(l.price)||0);
    cost   += qty*buy;`,`    supply += qty*(Number(l.price)||0)/(l.vat_inc?1.1:1);
    cost   += qty*buy;`,'VATINC_MARGIN');
 // 인쇄 표
 P(`    const supply=(Number(l.qty)||0)*(Number(l.price)||0);
    return \`
    <tr`,`    const lv=lineSupplyVat(l), supply=lv.supply;
    return \`
    <tr`,'VATINC_PRINT');
 P(`<td class="num">\${fmtb(l.price)}</td>
      <td class="num">\${fmtb(supply)}</td>
      <td class="num">\${fmtb(Math.round(supply*0.1))}</td>`,`<td class="num">\${fmtb(lv.price)}</td>
      <td class="num">\${fmtb(supply)}</td>
      <td class="num">\${fmtb(lv.vat)}</td>`,'VATINC_PRINT_CELLS');
 // 이미지 견적서
 P(`    const supply=(Number(l.qty)||0)*(Number(l.price)||0);
    const baseY=`,`    const lv=lineSupplyVat(l), supply=lv.supply;
    const baseY=`,'VATINC_CANVAS');
 P(`[fmtb(l.qty),fmtb(l.price),fmtb(supply),fmtb(Math.round(supply*0.1))]`,`[fmtb(l.qty),fmtb(lv.price),fmtb(supply),fmtb(lv.vat)]`,'VATINC_CANVAS_CELLS');
 // 매출 집계(옛 화면·CSV·친구 매출 분석이 쓰는 salesData): 부가세 포함 줄은 따로 묶고 표시를 넘긴다
 P(`      const key=[l.name,l.color||"",l.spec||"",Number(l.price)||0].join("|");`,`      const key=[l.name,l.color||"",l.spec||"",Number(l.price)||0,l.vat_inc?"inc":""].join("|");`,'VATINC_SALES_KEY');
 P(`price:Number(l.price)||0,qty:0});`,`price:Number(l.price)||0,qty:0,vat_inc:!!l.vat_inc});`,'VATINC_SALES_ROW');
 P(`const supply=r.qty*r.price, vat=Math.round(supply*0.1);`,`const g0=Math.round(r.qty*r.price*100)/100, supply=r.vat_inc?Math.round(g0/1.1):g0, vat=r.vat_inc?Math.round(g0)-supply:Math.round(supply*0.1);`,'VATINC_SALES_SUM',true);
 // 견적서 편집 줄: 부가세 포함 줄은 금액 옆에 표시
 P(`  return \`<div class="qline" data-idx="\${idx}">`,`  return \`<div class="qline" data-idx="\${idx}"\${l.vat_inc?' data-vinc':''}>`,'VATINC_QLINE');
}
// 계산서 발행 안 함(q.no_tax 또는 거래처 no_tax, 10/8): 쇼핑몰(카드·네이버페이)·개인 고객 판매는 세금계산서 대신
// 카드전표·현금영수증으로 처리되므로 '계산서 미발행'에서 뺀다. 발행일(tax_at)이 있는 건 그대로 '발행 완료'.
{
 const P=(from,to,code,all=false)=>{if(!html.includes(from))throw Error(code);html=all?html.split(from).join(to):html.replace(from,()=>to);};
 P(`function needsTax(q){ return isDelivered(q) && !isTaxed(q); }`,`function noTax(q){ return !!(q && (q.no_tax || (db.companies||[]).find(c=>c.id===q.company_id)?.no_tax)); }
function needsTax(q){ return isDelivered(q) && !isTaxed(q) && !noTax(q); }`,'NOTAX_NEEDS');
 P(`if(!isTaxed(q)){ r.untaxed+=deliveredAmount(q); r.untaxedCount++; }`,`if(!isTaxed(q)&&!noTax(q)){ r.untaxed+=deliveredAmount(q); r.untaxedCount++; }`,'NOTAX_AR',true);
 P(`\${isTaxed(r.q)?\`<span class="sub">\${escapeHtml(r.q.tax_at)}</span>\`:'<span class="pill tax-unissued">미발행</span>'}`,`\${isTaxed(r.q)?\`<span class="sub">\${escapeHtml(r.q.tax_at)}</span>\`:noTax(r.q)?'<span class="sub">발행 안 함</span>':'<span class="pill tax-unissued">미발행</span>'}`,'NOTAX_AR_CELL');
 P(`          <div class="hint">\${isTaxed(e)
            ? "발행 완료"
            : (isDelivered(e) ? '<b class="tax-unissued">납품했지만 아직 미발행</b>입니다'
                              : "납품 후 발행하면 날짜를 남겨 두세요")}</div>`,`          <div class="hint">\${isTaxed(e)
            ? "발행 완료"
            : noTax(e) ? "계산서를 발행하지 않는 판매예요 (카드·네이버페이·현금영수증 등)"
            : (isDelivered(e) ? '<b class="tax-unissued">납품했지만 아직 미발행</b>입니다'
                              : "납품 후 발행하면 날짜를 남겨 두세요")}</div>
          <label class="nd-notax"><input type="checkbox" id="fq_notax" \${noTax(e)?"checked":""} \${!e.no_tax&&noTax(e)?'disabled title="거래처 설정으로 발행 안 함"':""}> 계산서 발행 안 함</label>`,'NOTAX_FIELD');
 P(`  document.getElementById("fq_taxToday").onclick=()=>{ e.tax_at=localDate(); renderQtDetail(); };`,`  document.getElementById("fq_taxToday").onclick=()=>{ e.tax_at=localDate(); renderQtDetail(); };
  const fqNoTax=document.getElementById("fq_notax"); if(fqNoTax) fqNoTax.onchange=ev=>{ if(ev.target.checked) e.no_tax=true; else delete e.no_tax; renderQtDetail(); };`,'NOTAX_BIND');
}
// 견적서 오른쪽 패널 머리 금액 = 부가세 포함 합계(사용자 요청 10/8). 처음 그릴 때와 품목을 고칠 때 둘 다.
{
 const pairs=[['<div class="qs-amt-k">금액 (부가세 별도)</div>\n        <div class="qs-amt-v" id="fq_heroTotal">${won(t.supply)}</div>','<div class="qs-amt-k">금액 (부가세 포함)</div>\n        <div class="qs-amt-v" id="fq_heroTotal">${won(t.total)}</div>'],
  ['if(heroEl) heroEl.textContent=won(t.supply);','if(heroEl) heroEl.textContent=won(t.total);']];
 for(const [from,to] of pairs){if(!html.includes(from))throw Error('QT_HERO_TOTAL_BOUNDARY');html=html.replace(from,()=>to);}
}
html=html.replace('<title>ERP · 업무 관리</title>','<title>NARO Biz · 업무 관리</title>').replace('href="favicon.png"','href="../naro-symbol.png"');
// Personal-cloud rail branding only; keep the legacy production source untouched.
const railMark=/<span class="rail-mark"><svg[\s\S]*?<\/svg><\/span>/;
if(!railMark.test(html))throw Error('RAIL_BRAND_BOUNDARY_CHANGED');
html=html.replace(railMark,'<span class="rail-mark"><img src="../naro-symbol.png" width="36" height="32" alt="" aria-hidden="true"></span>');
html=html.replace('</head>','<style id="personal-rail-brand">#appView .shell .rail-logo>.rail-mark{background:transparent;box-shadow:none;}#appView .shell .rail-logo>.rail-mark>img{display:block;width:36px;height:32px;object-fit:contain;mix-blend-mode:multiply;}</style></head>');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,'');
// 견적서 품목 사진(시안 A): 사진이 등록된 품목은 품명 칸 왼쪽에 작은 사진. 같은 품목이 이어진 줄은 첫 줄에만 사진,
// 나머지는 같은 폭만큼 들여쓰고 묶음 안 구분선을 뺀다. 사진은 asset-ui.mjs가 미리 읽어 window.naroQuotePhoto(l,prev)로 준다.
// 사진이 없으면(또는 함수가 없으면) 원래 견적서와 한 글자도 다르지 않다.
const patchFn=(name,edits)=>{const start=html.indexOf('function '+name+'(');if(start<0)throw Error('QUOTE_PHOTO_BOUNDARY '+name);
 const end=html.indexOf('\n}\n',start);if(end<0)throw Error('QUOTE_PHOTO_BOUNDARY '+name);let body=html.slice(start,end);
 for(const [from,to] of edits){if(body.split(from).length!==2)throw Error('QUOTE_PHOTO_BOUNDARY '+name+': '+from.slice(0,40));body=body.replace(from,to);}
 html=html.slice(0,start)+body+html.slice(end);};
patchFn('drawQuoteCanvas',[
 ['const nameLs=qimgWrap(mc,l.name,COLS[0]-22);','const ph=window.naroQuotePhoto?.(l,lines[lines.indexOf(l)-1])||null;const sp=window.naroSplitName?window.naroSplitName(l):{name:l.name,code:""};const nameLs=(window.naroWrapWords||qimgWrap)(mc,sp.name,COLS[0]-22-(ph?66:0));if(sp.code)nameLs.push({code:sp.code});'],
 ['return { nameLs, colorLs, specLs, h:Math.max(42,n*18+24) };','return { nameLs, colorLs, specLs, ph, h:Math.max(ph&&ph.first?72:42,n*18+24) };'],
 ['const baseY=ty+12+13;','const baseY=ty+Math.max(12,(r.h-Math.max(r.nameLs.length,r.colorLs.length,r.specLs.length)*18)/2)+13;'],
 ['r.nameLs.forEach((ln,j)=>cell(ln,0,baseY+j*18));','if(r.ph&&r.ph.first&&r.ph.img){const S=56,ix=colX[0]+11,iy=ty+8,im=r.ph.img,k=Math.min((S-4)/im.width,(S-4)/im.height);ctx.save();ctx.fillStyle="#F4F5F7";qimgRR(ctx,ix,iy,S,S,10);ctx.fill();qimgRR(ctx,ix,iy,S,S,10);ctx.clip();ctx.drawImage(im,ix+(S-im.width*k)/2,iy+(S-im.height*k)/2,im.width*k,im.height*k);ctx.restore();ctx.fillStyle="#111";ctx.font=F(400,12.5);}{const x0=colX[0]+11+(r.ph?66:0);ctx.textAlign="left";r.nameLs.forEach((ln,j)=>{if(typeof ln==="object"){ctx.fillStyle="#8A8F98";ctx.font=F(400,11.5);ctx.fillText(ln.code,x0,baseY+j*18);ctx.fillStyle="#111";ctx.font=F(400,12.5);}else ctx.fillText(ln,x0,baseY+j*18);});}'],

 ['ctx.beginPath(); ctx.moveTo(MX,ty-.5); ctx.lineTo(MX+CW,ty-.5); ctx.stroke();','if(!(r.ph&&rowInfo[ri+1]?.ph&&!rowInfo[ri+1].ph.first)){ctx.beginPath(); ctx.moveTo(MX,ty-.5); ctx.lineTo(MX+CW,ty-.5); ctx.stroke();}'],
]);
// 비고 글자는 아래 상자 안 글자(자수 제품은…)·합계와 같은 왼쪽 선에 맞춘다.
patchFn('drawQuoteCanvas',[['ctx.fillText("비 고",MX,by);','ctx.fillText("비 고",MX+13,by);']]);
patchFn('printQuote',[
 ['const rows=lines.map(l=>{','const rows=lines.map((l,li)=>{const sp=window.naroSplitName?window.naroSplitName(l):{name:l.name,code:""},pn=`<span class="nd-pn"><b>${escapeHtml(sp.name)}</b>${sp.code?`<small>${escapeHtml(sp.code)}</small>`:""}</span>`;const ph=window.naroQuotePhoto?.(l,lines[li-1])||null,nx=lines[li+1]&&window.naroQuotePhoto?.(lines[li+1],l);'],
 ['<tr>\n      <td>${escapeHtml(l.name)}</td>','<tr${ph&&nx&&!nx.first?\' class="nd-pq-grp"\':\'\'}>\n      <td>${ph?`<div class="nd-pq">${ph.first&&ph.url?`<img src="${ph.url}" alt="">`:\'<i></i>\'}${pn}</div>`:pn}</td>'],
]);
// Personal B layout replaces only the isolated inventory presentation, not its
// native renderer, controls or calculations. Legacy /erp/ remains untouched.
if(business){
 html=html.replace('<link rel="stylesheet" href="./inventory-presentation.css">','').replace('<script src="./inventory-presentation.js"></script>','');
 html=html.replace('</body>',`<style id="naro-panel-system-b">${await readFile(resolve(here,'panel-layout-b.css'),'utf8')}</style><script>${await readFile(resolve(here,'panel-layout-b.js'),'utf8')}</script></body>`);
}
// NARO design layer (theme tokens, wide rail, panels) loads last; theme is set before first paint.
html=html.replace('</head>',`<script>try{const p=localStorage.getItem('naroTheme');document.documentElement.dataset.theme=p==='light'||p==='dark'?p:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}</script><style>html[data-theme="dark"]{background:#0B0C0E;color-scheme:dark}</style></head>`);
html=html.replace('</body>',`<style id="naro-design">${await readFile(resolve(here,'naro-design.css'),'utf8')}\n${await readFile(resolve(here,'sales-analysis.css'),'utf8')}\n${await readFile(resolve(here,'order-import.css'),'utf8')}</style><script>${await readFile(resolve(here,'naro-design.js'),'utf8')}\n${await readFile(resolve(here,'sales-analysis.js'),'utf8')}\n${await readFile(resolve(here,'order-import.js'),'utf8')}</script></body>`);
html=html.replace('</body>',`<style id="naro-dashboard-style">${await readFile(resolve(here,'dashboard-refined.css'),'utf8')}</style><script id="naro-dashboard-script">${await readFile(resolve(here,'dashboard-refined.js'),'utf8')}</script></body>`);
// Strip legacy OAuth/network transport and snapshot writes from the business bundle.
const begin=html.indexOf('/* ---------- PKCE 유틸'),end=html.indexOf('const db =',begin);
if(begin<0||end<0)throw Error('SOURCE_BOUNDARY_CHANGED');
html=html.slice(0,begin)+`const ERP_TABLES=['companies','items','quotes','payments','stock_moves','material_moves','settings'];
const blockStorage=()=>{throw Error('WRITE_BLOCKED');};
const StorageRepository={loadCollection:blockStorage,loadObject:blockStorage,saveSnapshot:blockStorage};
const Table={load:name=>StorageRepository.loadCollection(name),loadObj:name=>StorageRepository.loadObject(name),save:blockStorage};
const needToken=blockStorage,dbxDownload=blockStorage,dbxDownloadBlob=blockStorage,dbxUpload=blockStorage,dbxList=blockStorage;
`+html.slice(end);
const loadStart=html.indexOf('async function loadAll()'),loadEnd=html.indexOf('async function saveTable(',loadStart);
html=html.slice(0,loadStart)+'async function loadAll(){throw Error("READ_SESSION_REQUIRED");}\n'+html.slice(loadEnd);
html=html.replace(/function usesDefaultAppFolderKey\(\)\{[\s\S]*?\n\}/,"function usesDefaultAppFolderKey(){return false;}");
// Read UI binding is the previously verified STAGED branch; pilot branch removed.
html=html.replace("import('./firebase-login-shell/entry.mjs')","import('./entry.mjs')");
if(!companies)html=html.replace(/     isNewCompany:[\s\S]*?     clearDrafts\(\)/,'     clearDrafts()');
html=html.replace('Object.freeze({mode,companiesCreate:true})','Object.freeze({mode,companiesCreate:false})');
if(companies)html=html.replace('Object.freeze({mode,companiesCreate:false})','Object.freeze({mode,companiesCreate:false,personalCompaniesCreate:true})');
if(business){
 html=html.replace('Object.freeze({mode,companiesCreate:false})','Object.freeze({mode,companiesCreate:false,personalBusinessWrite:true})');
 const uiBegin=html.indexOf('  document.getElementById("coNewBtn").onclick=',html.indexOf('async function init(){'));
 const uiEnd=html.indexOf('  document.getElementById("stSaveBtn").onclick=',uiBegin);
 if(uiBegin<0||uiEnd<0)throw Error('BUSINESS_UI_BOUNDARY_CHANGED');
 const bindings=html.slice(uiBegin,uiEnd)+(extended?'\n document.getElementById("stSaveBtn").onclick=saveSettings;\n document.getElementById("bkExportBtn").onclick=exportBackup;':'');
 html=html.replace('     clearDrafts(){',`     bindBusinessUI(){${bindings}},
     pendingStock(){return db.quotes.some(q=>stockDeltaForQuote(q).moves.length>0);},
     async recoverStock(){for(const q of db.quotes){if(stockDeltaForQuote(q).moves.length&&!await syncStockForQuote(q,{ask:false}))throw Error('재고 반영 미완료');}renderStock();},
     clearDrafts(){`);
 // Stock work remains the v1.186 calculation, routed through the common provider.
 html=html.replace('  await syncStockForQuote(e);',"  if(stockDeltaForQuote(e).moves.length&&!await syncStockForQuote(e,{ask:false})){window.dispatchEvent(new Event('naro-incomplete-stock'));return;}\n  toast('견적과 재고 반영을 완료했습니다');");
}
if(extended){
 html=html.replace('personalBusinessWrite:true','personalBusinessWrite:true,extendedWrite:true');
 const legacyStart=html.indexOf('<div class="settings-utils">'),legacyEnd=html.indexOf('<div class="card settings-util-card settings-util-backup">',legacyStart);
 if(legacyStart<0||legacyEnd<0)throw Error('SETTINGS_UTILS_BOUNDARY_CHANGED');
 html=html.slice(0,legacyStart)+'<div class="settings-utils">\n'+html.slice(legacyEnd);
 html=html.replace(/불러오기를 하면[\s\S]*?덮어씁니다\./,'가져오기는 신규 항목만 병합합니다. 기존 항목과 공급자 설정은 유지하며, 같은 ID의 내용이 다르면 중단합니다.');
 const start=html.indexOf('async function saveSettings(){'),end=html.indexOf('\n/*',start);
 if(start<0||end<0)throw Error('SETTINGS_BOUNDARY_CHANGED');
 const settings=html.slice(start,end).replace('  db.settings={','  const next={\n    ...db.settings,').replace('  await saveTable("settings",db.settings);','  if(!await saveTable("settings",next))return;\n  db.settings=next;');
 html=html.slice(0,start)+settings+html.slice(end);
}
html=html.replace('Dropbox와 동기화 중','저장공간 읽는 중').replace('`Dropbox ${text}', '`NARO ${text}').replace('`마지막 Dropbox ${text}', '`마지막 NARO ${text}');
// Legacy initialization is not part of this candidate (no Dropbox session reads).
const initStart=html.indexOf('async function init(){'),initEnd=html.indexOf('// Build-time literal;',initStart);
if(initStart<0||initEnd<0)throw Error('INIT_BOUNDARY_CHANGED');
html=html.slice(0,initStart)+html.slice(initEnd);
html=html.replace('if(mode===\'OFF\') init();',"if(mode==='OFF') throw Error('UNSUPPORTED_MODE');");
if(!html.includes('<h2>품목 관리</h2>'))throw Error('ITEMS_TITLE_BOUNDARY');html=html.replace('<h2>품목 관리</h2>','<h2>품목</h2>'); // 다른 탭처럼 메뉴 이름 그대로
await writeFile(resolve(release,'erp/index.html'),html);
let stock=await readFile(resolve(erp,'stock-entry.js'),'utf8');
const s=stock.indexOf('async function saveStockChecked('),e=stock.indexOf('\nasync function ',s+10);
if(s<0||e<0)throw Error('STOCK_BOUNDARY_CHANGED');
stock=stock.slice(0,s)+(business?"async function saveStockChecked(expected,next){if(stockFingerprint(db.stock_moves)!==expected)throw Error('재고 변경 충돌');await Table.save('stock_moves',next);}\n":"async function saveStockChecked(){throw Error('WRITE_BLOCKED');}\n")+stock.slice(e);
await writeFile(resolve(release,'erp/stock-entry.js'),stock);
await copyFile(resolve(here,business?'business-entry.mjs':'erp-entry.mjs'),resolve(release,'erp/entry.mjs'));
// Address search window (own page + own CSP): the app page never loads the third-party postcode script.
for(const f of ['postcode.html','postcode.css','postcode.js'])await copyFile(resolve(here,f),resolve(release,f));
if(business){
 await copyFile(resolve(here,'tabular-import.mjs'),resolve(release,'erp/tabular-import.mjs'));
 await copyFile(resolve(here,'asset-ui.mjs'),resolve(release,'erp/asset-ui.mjs'));
 await copyFile(resolve(here,'mail-ui.mjs'),resolve(release,'erp/mail-ui.mjs'));
 await copyFile(resolve(here,'access-ui.mjs'),resolve(release,'erp/access-ui.mjs'));
}
if(extended){
 await copyFile(resolve(here,'vendor/jszip-3.10.1.min.js'),resolve(release,'erp/jszip.min.js'));
 await copyFile(resolve(here,'vendor/JSZIP-LICENSE.txt'),resolve(release,'erp/JSZIP-LICENSE.txt'));
 html=html.replace('</head>','<script src="./jszip.min.js"></script></head>');
 await writeFile(resolve(release,'erp/index.html'),html);
}
const guard=(await readFile(resolve(root,companies?'outputs/privacy-safe-companies-pilot/source/app/firebase-login-shell/readonly-guard.mjs':'work/erp-login-shell-v186-release/firebase-login-shell/readonly-guard.mjs'),'utf8')).replace('for(const key of Object.keys(Table))Table[key]=blocked;',"for(const key of Object.keys(Table))if(!['load','loadObj'].includes(key))Table[key]=blocked;").replace("if(typeof StorageRepository[key]==='function')", "if(!['loadCollection','loadObject'].includes(key)&&typeof StorageRepository[key]==='function')");
await writeFile(resolve(release,'erp/readonly-guard.mjs'),guard);
// Fetch the whole module graph in parallel (boot → app → runtime → sdk was a serial waterfall),
// and open the auth / Drive connections before they are needed.
{
 const modules=(await readdir(release)).filter(name=>name.endsWith('.mjs')&&!['boot.mjs','dropbox-callback.mjs'].includes(name)).sort();
 const hints=['https://accounts.google.com','https://identitytoolkit.googleapis.com','https://securetoken.googleapis.com','https://www.googleapis.com'].map(href=>`<link rel="preconnect" href="${href}" crossorigin>`).join('')+modules.map(name=>`<link rel="modulepreload" href="./${name}">`).join('');
 const index=await readFile(resolve(release,'index.html'),'utf8');if(!index.includes('</head>'))throw Error('INDEX_HEAD_MISSING');
 await writeFile(resolve(release,'index.html'),index.replace('</head>',hints+'</head>'));
}
const files=[];
async function walk(dir,prefix=''){for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=prefix+item.name;if(item.isDirectory())await walk(resolve(dir,item.name),name+'/');else files.push({path:name,sha256:createHash('sha256').update(await readFile(resolve(dir,item.name))).digest('hex')});}}
await walk(release);await writeFile(resolve(out,'manifest.json'),JSON.stringify({mode:business?'LOCAL_PERSONAL_BUSINESS_CANDIDATE':publicRelease?'PUBLIC_PERSONAL_COMPANIES_CREATE':companies?'LOCAL_PERSONAL_COMPANIES_CREATE':'LOCAL_UNIFIED_STORAGE_READ_ONLY',files,aggregate:createHash('sha256').update(JSON.stringify(files)).digest('hex')},null,2));
console.log(JSON.stringify({output:out,files:files.length}));
