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
const onboardingHtml=(await readFile(resolve(original,'index.html'),'utf8')).replaceAll('Next-generation Apps<br>for Real Operations','Next-generation Apps for Real Operation').replace('<title>NARO · 시작하기</title>','<title>NARO Biz · 로그인</title><link rel="icon" type="image/png" href="./naro-symbol.png">')
 // Same theme preference as /erp/ ('naroTheme': light | dark | system), applied before first paint.
 .replace('</head>',`<script>(()=>{const m=matchMedia('(prefers-color-scheme: dark)'),a=()=>{let p=null;try{p=localStorage.getItem('naroTheme')}catch{}document.documentElement.dataset.theme=p==='light'||p==='dark'?p:(m.matches?'dark':'light')};a();m.addEventListener?.('change',a);addEventListener('storage',e=>{if(e.key==='naroTheme'||e.key===null)a()})})()</script></head>`);
await writeFile(resolve(release,'index.html'),onboardingHtml);
await copyFile(resolve(onboarding,'google-backend.mjs'),resolve(release,'google-backend.mjs'));
await copyFile(resolve(onboarding,'company-contract.mjs'),resolve(release,'company-contract.mjs'));
await copyFile(resolve(onboarding,'business-contract.mjs'),resolve(release,'business-contract.mjs'));
await copyFile(resolve(onboarding,'extended-contract.mjs'),resolve(release,'extended-contract.mjs'));
await copyFile(resolve(onboarding,'asset-store.mjs'),resolve(release,'asset-store.mjs'));
for(const name of ['workspace.mjs'])await copyFile(resolve(here,name),resolve(release,name));
await writeFile(resolve(release,'merge-import.mjs'),(await readFile(resolve(here,'merge-import.mjs'),'utf8')).replaceAll('../personal-cloud-onboarding/','./'));
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
await writeFile(resolve(release,'app.mjs'),app);
if(business)await copyFile(resolve(here,'business-workspace.mjs'),resolve(release,'workspace.mjs'));
// Reuse sanitized v1.186 renderers, not the original private-data artifact.
const erp=resolve(root,'outputs/privacy-safe-companies-pilot/source/app');
for(const name of await readdir(erp))if(/\.(css|js|png|webmanifest)$/.test(name))await copyFile(resolve(erp,name),resolve(release,'erp',name));
await mkdir(resolve(release,'erp/icons'),{recursive:true});
for(const name of await readdir(resolve(erp,'icons')))await copyFile(resolve(erp,'icons',name),resolve(release,'erp/icons',name));
let html=await readFile(resolve(erp,'index.html'),'utf8');
html=html.replace('<title>ERP · 업무 관리</title>','<title>NARO Biz · 업무 관리</title>').replace('href="favicon.png"','href="../naro-symbol.png"');
// Personal-cloud rail branding only; keep the legacy production source untouched.
const railMark=/<span class="rail-mark"><svg[\s\S]*?<\/svg><\/span>/;
if(!railMark.test(html))throw Error('RAIL_BRAND_BOUNDARY_CHANGED');
html=html.replace(railMark,'<span class="rail-mark"><img src="../naro-symbol.png" width="36" height="32" alt="" aria-hidden="true"></span>');
html=html.replace('</head>','<style id="personal-rail-brand">#appView .shell .rail-logo>.rail-mark{background:transparent;box-shadow:none;}#appView .shell .rail-logo>.rail-mark>img{display:block;width:36px;height:32px;object-fit:contain;mix-blend-mode:multiply;}</style></head>');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,'');
// Personal B layout replaces only the isolated inventory presentation, not its
// native renderer, controls or calculations. Legacy /erp/ remains untouched.
if(business){
 html=html.replace('<link rel="stylesheet" href="./inventory-presentation.css">','').replace('<script src="./inventory-presentation.js"></script>','');
 html=html.replace('</body>',`<style id="naro-panel-system-b">${await readFile(resolve(here,'panel-layout-b.css'),'utf8')}</style><script>${await readFile(resolve(here,'panel-layout-b.js'),'utf8')}</script></body>`);
}
// NARO design layer (theme tokens, wide rail, panels) loads last; theme is set before first paint.
html=html.replace('</head>',`<script>try{const p=localStorage.getItem('naroTheme');document.documentElement.dataset.theme=p==='light'||p==='dark'?p:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}</script><style>html[data-theme="dark"]{background:#0B0C0E;color-scheme:dark}</style></head>`);
html=html.replace('</body>',`<style id="naro-design">${await readFile(resolve(here,'naro-design.css'),'utf8')}</style><script>${await readFile(resolve(here,'naro-design.js'),'utf8')}</script></body>`);
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
await writeFile(resolve(release,'erp/index.html'),html);
let stock=await readFile(resolve(erp,'stock-entry.js'),'utf8');
const s=stock.indexOf('async function saveStockChecked('),e=stock.indexOf('\nasync function ',s+10);
if(s<0||e<0)throw Error('STOCK_BOUNDARY_CHANGED');
stock=stock.slice(0,s)+(business?"async function saveStockChecked(expected,next){if(stockFingerprint(db.stock_moves)!==expected)throw Error('재고 변경 충돌');await Table.save('stock_moves',next);}\n":"async function saveStockChecked(){throw Error('WRITE_BLOCKED');}\n")+stock.slice(e);
await writeFile(resolve(release,'erp/stock-entry.js'),stock);
await copyFile(resolve(here,business?'business-entry.mjs':'erp-entry.mjs'),resolve(release,'erp/entry.mjs'));
if(business){
 await copyFile(resolve(here,'tabular-import.mjs'),resolve(release,'erp/tabular-import.mjs'));
 await copyFile(resolve(here,'asset-ui.mjs'),resolve(release,'erp/asset-ui.mjs'));
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
