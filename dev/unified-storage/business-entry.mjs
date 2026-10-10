import {validateData} from '../core.mjs';
import {readImport} from './tabular-import.mjs';
import {installAssets} from './asset-ui.mjs';
import {installMailUI} from './mail-ui.mjs';
import {installAccessUI} from './access-ui.mjs';
import {installLogUI} from './log-ui.mjs';
import {installPurchaseUI} from './purchase-ui.mjs';
export function start(bridge,build){
 let mail=null,accessUI=null,logUI=null,purchaseUI=null;
 let snapshot=null,port=null,pending=null,locked=false,recovering=false,uncertainKey=null,lastFailure='',providerLabel='개인 클라우드';
 const messages={VALIDATION:'입력값과 연결된 거래처·품목을 확인해 주세요.',WRITE_BLOCKED:'이 작업은 아직 지원하지 않습니다.',BUSY:'저장이 진행 중입니다.',STORAGE_CONFLICT:'다른 변경이 발견되어 덮어쓰지 않았습니다.',CONCURRENCY_UNAVAILABLE:'안전한 저장 버전을 확인할 수 없습니다.',SAVE_UNCONFIRMED:'저장 결과를 확인하지 못했습니다. 다른 저장을 중단했습니다.',QUOTA_LIMIT:'무료 사용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',RECONNECT_REQUIRED:'저장소 연결이 만료되었습니다.'};
 const status=document.createElement('div');status.setAttribute('role','status');status.style.cssText='position:fixed;bottom:12px;left:24px;z-index:9999;background:white;padding:10px;border:1px solid #d6def0;border-radius:8px;max-width:85vw';status.hidden=true;document.body.append(status);
 // Success lines ("…저장·확인 완료") hide by themselves; errors, progress and anything with a button stay.
 let statusTimer=0;
 new MutationObserver(()=>{clearTimeout(statusTimer);if(status.hidden)return;const t=status.textContent||'';
  if(status.querySelector('button')||/중단|실패|않았|없습니다|확인해 주세요|중…|중\.\.\./.test(t))return;
  if(/완료|확인했습니다/.test(t))statusTimer=setTimeout(()=>{status.hidden=true;},/\[저장\]/.test(t)?10000:3000);
 }).observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 bridge.StorageRepository.loadCollection=k=>structuredClone(snapshot[k]);
 bridge.StorageRepository.loadObject=k=>{if(k!=='settings')throw Error('WRITE_BLOCKED');return structuredClone(snapshot.settings);};
 bridge.Table.save=(key,rows)=>new Promise((resolve,reject)=>{
  if(!port||pending||locked&&!recovering){reject(Error('저장 결과 확인이 필요합니다.'));return;}
  const requestId=crypto.randomUUID();pending={requestId,key,resolve,reject};
  status.hidden=false;status.textContent=providerLabel+'에 저장하고 있습니다…';
  port.postMessage({type:'SAVE_TABLE',requestId,key,rows});
 });
 bridge.StorageRepository.saveSnapshot=()=>{throw Error('WRITE_BLOCKED');};
 Object.freeze(bridge.Table);Object.freeze(bridge.StorageRepository);
 const denied=build?.extendedWrite?'#resetDbxBtn,[data-delivery-remove],[data-stock-edit],[data-stock-delete]':'#view-settings,#view-materials,#bkImportBtn,#bkExportBtn,#resetDbxBtn,#bizCardBtn,#bizCertBtn,#coDelBtn,#itDelBtn,#qtDelBtn,[data-delivery-remove],#payTbl .rm,[data-stock-edit],[data-stock-delete]';
 const restrict=()=>{
  for(const el of document.querySelectorAll(denied)){
   for(const control of el.matches('button,input,select,textarea')?[el]:el.querySelectorAll('button,input,select,textarea')){
    if(!control.disabled)control.disabled=true;control.title='이번 버전에서는 지원하지 않습니다.';
   }
  }
 };
 new MutationObserver(restrict).observe(document.getElementById('appView'),{childList:true,subtree:true});restrict();
 // Don't override the existing form's own disabled/validation states.
 document.addEventListener('click',e=>{
  const el=e.composedPath().find(n=>n?.matches?.('button,input,select,textarea,[role="button"]'));
  if(el&&!status.contains(el)&&!el.closest('.nd-theme,.rail-tools>summary,.nd-mail,.nd-photo-view')&&(pending||locked||recovering||el.closest(denied))){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 window.addEventListener('beforeunload',e=>{if(pending||locked){e.preventDefault();e.returnValue='';}});
 const reconcile=()=>new Promise((resolve,reject)=>{
  if(!uncertainKey){resolve();return;}
  const requestId=crypto.randomUUID();pending={requestId,key:uncertainKey,resolve,reject};
  port.postMessage({type:'SAVE_TABLE',key:uncertainKey,requestId,recover:true});
 });
 const stockRecovery=()=>{
  locked=true;status.hidden=false;status.textContent='납품은 저장되었지만 재고 반영이 완료되지 않았습니다. '+(lastFailure?'['+lastFailure+'] ':'');
  const button=document.createElement('button');button.textContent='재고 반영 복구';status.append(button);
  button.onclick=async()=>{
   if(pending||recovering)return;recovering=true;button.disabled=true;
   try{await reconcile();await bridge.recoverStock();locked=false;status.textContent='납품·재고 반영을 확인했습니다.';}
   catch{stockRecovery();}finally{recovering=false;}
  };
 };
 window.addEventListener('naro-incomplete-stock',stockRecovery);
 const uncertainRecovery=()=>{
  status.textContent=(lastFailure.startsWith('SAVE_NOT_OBSERVED')?'조회는 성공했지만 저장 전 내용이 확인되었습니다. 중복 저장 방지를 위해 잠금을 유지합니다. ':'저장 응답이 불확실합니다. 중복 저장하지 않고 결과만 다시 확인합니다. ')+(lastFailure?'['+lastFailure+'] ':'');
  const button=document.createElement('button');button.textContent='저장 결과 확인';status.append(button);
  button.onclick=async()=>{
   if(pending||recovering)return;recovering=true;
   try{await reconcile();bridge.clearDrafts();if(bridge.pendingStock())stockRecovery();else{locked=false;bridge.switchView('dash');status.textContent='기존 저장 결과를 확인했습니다.';}}
   catch{uncertainRecovery();}finally{recovering=false;}
  };
 };
 const mergeRequest=(type,backup)=>new Promise((resolve,reject)=>{
  if(pending||!port){reject(Error('저장이 진행 중입니다.'));return;}
  const requestId=crypto.randomUUID();pending={requestId,resolve,reject};port.postMessage({type,requestId,backup});
 });
 const mergeResume=()=>{
  locked=true;const button=document.createElement('button');button.textContent='가져오기 이어서 확인';status.append(button);
  button.onclick=async()=>{if(pending)return;button.disabled=true;try{await mergeRequest('MERGE_IMPORT');}catch{}};
 };
 window.addEventListener('message',function receive(e){
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='NARO_READ_SNAPSHOT'||!e.ports[0])return;
  window.removeEventListener('message',receive);
  try{
   if(!build?.personalBusinessWrite)throw Error();
   snapshot=validateData(e.data.data);Object.assign(bridge.db,structuredClone(snapshot));port=e.ports[0];providerLabel=e.data.provider==='dropbox'?'Dropbox':'Google Drive';
   // 사용자별 맞춤(관리자가 켠 기능·강조 색): <html data-nd-f="기능 …" data-nd-accent="색">, window.ndHas('기능').
   {const f=(Array.isArray(e.data.features)?e.data.features:[]).filter(k=>typeof k==='string'&&/^([a-z0-9-]{1,32}|\*)$/.test(k)).slice(0,50);
    const accent=typeof e.data.accent==='string'&&/^[a-z]{0,12}$/.test(e.data.accent)?e.data.accent:'';
    document.documentElement.dataset.ndF=f.join(' ');if(accent)document.documentElement.dataset.ndAccent=accent;else delete document.documentElement.dataset.ndAccent;
    window.ndHas=key=>f.includes('*')||f.includes(key);}
   port.onmessage=async e=>{
    const m=e.data;if(mail?.onMessage(m)||accessUI?.onMessage(m)||logUI?.onMessage(m)||purchaseUI?.onMessage(m))return;
    if(!pending||m?.requestId!==pending.requestId)return;
    // Each record is saved and read back one by one; show where it is so a long import doesn't look frozen.
    if(m.type==='MERGE_PROGRESS'){status.hidden=false;status.textContent=`가져오는 중… ${m.done} / ${m.total}건 저장 (창을 닫지 마세요)`;return;}
    const p=pending;pending=null;
    if(m.type==='ASSET_DONE'){p.resolve(m);return;}
    if(m.type==='ASSET_ERROR'){p.reject(Error(messages[m.code]||'이미지 작업을 완료하지 못했습니다.'));return;}
    if(m.type==='MERGE_PREVIEW'){p.resolve(m.count);return;}
    if(m.type==='MERGE_DONE'){
     snapshot=validateData(m.data);Object.assign(bridge.db,structuredClone(snapshot));locked=false;bridge.clearDrafts();bridge.switchView('settings');status.hidden=false;status.textContent=`${m.completed}건 병합 저장·다시 읽기 확인 완료`;p.resolve();return;
    }
    if(m.type==='MERGE_ERROR'){
     status.hidden=false;status.textContent=`가져오기 중단: ${Number(m.progress?.completed)||0}/${Number(m.progress?.total)||0}건 확인. ${messages[m.code]||'연결을 확인해 주세요.'}`;
     if(m.active)mergeResume();else locked=false;p.reject(Error('가져오기를 완료하지 못했습니다.'));return;
    }
    if(m.type==='TABLE_SAVED'){
     snapshot[m.key]=structuredClone(m.rows);bridge.db[m.key]=structuredClone(m.rows);uncertainKey=null;lastFailure='';status.textContent=providerLabel+' 저장·확인 완료';p.resolve();
    }else{
     lastFailure=['VALIDATION','WRITE_BLOCKED','BUSY','STORAGE_CONFLICT','CONCURRENCY_UNAVAILABLE','SAVE_UNCONFIRMED','SAVE_NOT_OBSERVED','QUOTA_LIMIT','RECONNECT_REQUIRED','RATE_LIMIT','NETWORK_ERROR','STORAGE_INVALID','CANCELLED','UNAVAILABLE','INTERNAL_ERROR'].includes(m.code)?m.code:'INTERNAL_ERROR';
     if(['IDENTITY_READ','CONTENT_READ','VALIDATOR_READ','CONDITIONAL_WRITE','READBACK_CONTENT','READBACK_IDENTITY'].includes(m.stage))lastFailure+=' / '+m.stage;
     if(['FETCH_REJECTED','HTTP_5XX','HTTP_REJECTED'].includes(m.transport))lastFailure+=' / '+m.transport;
     locked=!!uncertainKey||['SAVE_UNCONFIRMED','SAVE_NOT_OBSERVED','STORAGE_CONFLICT'].includes(m.code);
     status.textContent=messages[m.code]||'저장을 완료하지 못했습니다.';p.reject(Error(status.textContent));
     if(['SAVE_UNCONFIRMED','SAVE_NOT_OBSERVED'].includes(m.code)){uncertainKey=p.key;uncertainRecovery();}
    }
   };
   bridge.bindReadUI();bridge.bindBusinessUI();bridge.switchView('dash');
   if(build.extendedWrite){
    const assetRequest=(type,details)=>new Promise((resolve,reject)=>{if(pending||locked||recovering||!port){reject(Error('저장 결과 확인이 필요합니다.'));return;}const requestId=crypto.randomUUID();pending={requestId,resolve,reject};port.postMessage({type,requestId,...details});
     // 답이 끝내 오지 않아도 화면 전체가 잠긴 채 남지 않게(사진 요청은 읽기·추가 전용이라 다시 시도해도 안전).
     setTimeout(()=>{if(pending?.requestId===requestId){pending=null;reject(Error('응답이 늦어 중단했어요. 다시 눌러 주세요.'));}},40000);});
    installAssets({db:bridge.db,request:assetRequest,save:bridge.Table.save,notify:text=>{status.hidden=false;status.textContent=text;}});
    mail=installMailUI({port:()=>port,say:text=>typeof window.toast==='function'?window.toast(text):(status.hidden=false,status.textContent=text)});
    logUI=installLogUI({port:()=>port});
    // 매입(2단계): '매입' 권한이 있는 사람만 메뉴가 보인다(관리자는 모든 기능).
    purchaseUI=installPurchaseUI({port:()=>port,features:()=>typeof window.ndHas==='function'&&window.ndHas('purchases')});
    if(e.data.admin===true)accessUI=installAccessUI({port:()=>port,say:text=>typeof window.toast==='function'?window.toast(text):(status.hidden=false,status.textContent=text)});
    // 명함·사업자등록증 보내기: the image saved under 공급자 정보 → 개인 클라우드 이미지 (settings.assets).
    // Phone: share sheet. Desktop: copy the image, else download it. The file is kept after the first read,
    // so if the browser refuses to share after the network wait, the next tap shares instantly.
    const sent={};
    const say=text=>typeof window.toast==='function'?window.toast(text):(status.hidden=false,status.textContent=text);
    const sendAsset=async(kind,label,filename)=>{
     const path=bridge.db.settings?.assets?.[kind];
     if(!path){say(`${label} 이미지가 아직 없습니다 — 공급자 정보의 '개인 클라우드 이미지'에서 먼저 저장해 주세요.`);bridge.switchView('settings');return;}
     let file=sent[kind]?.path===path?sent[kind].file:null;
     if(!file){
      say(`${label} 이미지를 불러오는 중…`);
      try{const {bytes}=await assetRequest('ASSET_READ',{path});file=new File([bytes],filename,{type:'image/png'});sent[kind]={path,file};}
      catch(error){say(error.message||`${label} 이미지를 불러오지 못했습니다.`);return;}
     }
     if(navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file]});return;}
      catch(error){if(error?.name==='AbortError')return;if(error?.name==='NotAllowedError'){say(`${label} 이미지가 준비됐습니다 — 한 번 더 눌러 주세요.`);return;}}
     }
     try{if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'image/png':file})]);say(`${label} 이미지를 복사했습니다 — 메일·메신저에 붙여넣기로 보내세요.`);return;}}catch{}
     const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
     say(`${label} 이미지를 내려받았습니다.`);
    };
    // ASCII file names: some browsers drop non-ASCII download names.
    for(const [id,kind,label,filename] of [['bizCardBtn','card','명함','business-card.png'],['bizCertBtn','registration','사업자등록증','business-registration.png']]){const b=document.getElementById(id);if(b){b.disabled=false;b.title=label+' 보내기';b.onclick=()=>sendAsset(kind,label,filename);}}
    const input=document.getElementById('bkFile'),button=document.getElementById('bkImportBtn');input.accept='.json,.csv,.xlsx';button.textContent='JSON / CSV / Excel 가져오기';button.onclick=()=>input.click();
    const help=document.createElement('p');help.textContent='CSV: UTF-8, dataset와 id 열 필수. Excel: companies/items/quotes/payments/stock_moves/material_moves 시트와 id 열 필수. 날짜는 YYYY-MM-DD 텍스트, 수식은 값으로 변환해 주세요. 최대 5,000행·7MB. 기존 항목은 덮어쓰지 않습니다.';button.parentElement.append(help);
    const template=document.createElement('button');template.type='button';template.textContent='거래처 CSV 양식';button.parentElement.append(template);template.onclick=()=>{const url=URL.createObjectURL(new Blob(['\uFEFFdataset,id,name,type,contact,phone,email,memo\r\n'],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='naro-companies-template.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    input.onchange=async()=>{
     const file=input.files?.[0];input.value='';if(!file)return;
     try{
      if(file.size>7*1048576)throw Error('파일은 7MB 이하여야 합니다.');
      const backup=await readImport(file,window.JSZip),count=await mergeRequest('MERGE_PREVIEW',backup);
      if(!confirm(`새 항목 ${count}건을 병합할까요? 기존 항목과 공급자 설정은 유지합니다. 같은 ID의 내용이 다르면 중단합니다. 파일별로 저장하므로 중간 실패 시 완료된 항목은 남습니다.`))return;
      locked=true;status.hidden=false;status.textContent='기존 데이터를 보존하며 가져오는 중…';await mergeRequest('MERGE_IMPORT',backup);
      // Supplier settings are never written by an import. When this workspace has none yet, the
      // backup's values go into the supplier form for the user to check and save themselves.
      const s=backup?.settings,cur=bridge.db.settings||{};
      if(s&&typeof s==='object'&&!String(cur.name||'').trim()&&String(s.name||'').trim())setTimeout(()=>{
       const map={st_name:'name',st_ceo:'ceo',st_biz:'biz_no',st_phone:'phone',st_email:'email',st_address:'address',st_bank:'bank'};let n=0;
       for(const [id,k] of Object.entries(map)){const el=document.getElementById(id);if(el&&!el.value.trim()&&typeof s[k]==='string'&&s[k]){el.value=s[k];el.dispatchEvent(new Event('input',{bubbles:true}));n++;}}
       if(n){status.hidden=false;status.textContent=status.textContent+' · 백업의 공급자 정보를 칸에 채웠습니다. 확인 후 [저장]을 눌러 주세요.';}
      },300);
     }catch(error){if(!locked){status.hidden=false;status.textContent=error instanceof SyntaxError?'올바른 JSON 백업을 선택해 주세요.':error.message;}}
    };
   }
   for(const id of ['logoutBtn','brandBtn'])document.getElementById(id).onclick=()=>{if(!pending&&!locked)port.postMessage({type:'LOGOUT'});};
   document.getElementById('refreshBtn').onclick=()=>bridge.switchView('dash');
   document.getElementById('tbUser').textContent='NARO Biz · '+providerLabel;
   document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden');
   bridge.setSyncState('saved',providerLabel+' 연결');document.documentElement.dataset.storageRead='PASS';
   // Detect a previously interrupted quote→stock sequence before enabling work.
   const missing=bridge.pendingStock();
   if(missing)stockRecovery();
   requestAnimationFrame(()=>requestAnimationFrame(()=>port?.postMessage({type:'WORKSPACE_RENDERED'})));
  }catch{document.getElementById('loginView').textContent='저장공간을 확인할 수 없습니다.';}
 });
 parent.postMessage({type:'NARO_READ_READY'},location.origin);
}
