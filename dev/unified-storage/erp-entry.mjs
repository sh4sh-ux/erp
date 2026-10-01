import {installReadOnly} from './readonly-guard.mjs';
import {validateData} from '../core.mjs';
import {validateCompany} from '../company-contract.mjs';
export function start(bridge,build){
 const app=document.getElementById('appView'),login=document.getElementById('loginView');
 let snapshot=null;
 bridge.StorageRepository.loadCollection=key=>{if(!snapshot||!Array.isArray(snapshot[key]))throw Error('STORAGE_INVALID');return structuredClone(snapshot[key]);};
 bridge.StorageRepository.loadObject=key=>{if(!snapshot||key!=='settings')throw Error('STORAGE_INVALID');return structuredClone(snapshot.settings);};
 login.textContent='업무 데이터를 불러오는 중… · READ ONLY';
 let busy=false,pending=null,port=null;
 let writeEnabled=false;
 const inputs=new Set(['f_name','f_type','f_biz','f_contact','f_phone','f_email','f_address','f_address_detail','f_memo','f_qmemo']);
 const allowed=el=>writeEnabled&&!busy&&(el.id==='coNewBtn'&&!pending||bridge.isNewCompany?.()&&(el.id==='coSaveBtn'||!pending&&(inputs.has(el.id)||el.id==='coCancelBtn')));
 const scan=installReadOnly(bridge,allowed);bridge.bindReadUI();
 // No Firebase, OAuth, provider API or token exists in the business frame.
 window.addEventListener('message',async function receive(event){
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='NARO_READ_SNAPSHOT'||!event.ports[0])return;
  window.removeEventListener('message',receive);
  try{
   snapshot=validateData(event.data.data);port=event.ports[0];
   writeEnabled=build?.personalCompaniesCreate===true&&event.data.companyWriteReady===true;
   // Preserve Table/repository methods and existing db/renderers; no migrations or writes.
   const loaded={};for(const key of ['companies','items','quotes','payments','stock_moves','material_moves'])loaded[key]=await bridge.Table.load(key);
   loaded.settings=await bridge.Table.loadObj('settings');Object.assign(bridge.db,validateData(loaded));
   bridge.switchView('dash');scan();bridge.setSyncState('saved','READ ONLY');
   document.getElementById('tbUser').textContent='NARO Biz · Google Drive · READ ONLY';
   for(const id of ['logoutBtn','brandBtn'])document.getElementById(id).onclick=()=>port.postMessage({type:'LOGOUT'});
   document.getElementById('refreshBtn').onclick=()=>{bridge.switchView('dash');scan();};
   login.classList.add('hidden');app.classList.remove('hidden');
   document.documentElement.dataset.storageRead='PASS';
   document.documentElement.dataset.companyWritePreflight=writeEnabled?'PASS':'NOT_READY';
   if(build?.personalCompaniesCreate&&!writeEnabled){
    const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='저장 연결을 확인하지 못해 거래처 등록을 잠시 차단했습니다. 기존 데이터는 변경하지 않았습니다.';document.getElementById('view-companies').prepend(notice);
   }
   if(writeEnabled){
    document.getElementById('tbUser').textContent='NARO Biz · Google Drive · 거래처 등록';
    bridge.setSyncState('saved','거래처 등록 가능');
    const info=document.createElement('p');info.id='companySaveStatus';info.setAttribute('role','status');info.textContent='거래처 신규 등록만 가능합니다. 다른 업무는 읽기 전용입니다.';document.getElementById('view-companies').prepend(info);
    document.getElementById('coNewBtn').onclick=()=>{if(busy||pending)return;bridge.newCompany();scan();};
    bridge.installCompanyCreate(()=>{
     if(busy||!bridge.isNewCompany())return;
     try{
      const recoveryOnly=!!pending;
      if(!pending){const v=id=>document.getElementById(id).value.trim();pending=validateCompany({id:crypto.randomUUID(),created_at:new Date().toISOString(),name:v('f_name'),type:v('f_type'),biz_no:v('f_biz'),contact:v('f_contact'),phone:v('f_phone'),email:v('f_email'),address_base:v('f_address'),address_detail:v('f_address_detail'),address:[v('f_address'),v('f_address_detail')].filter(Boolean).join(' '),memo:v('f_memo'),quote_memo:v('f_qmemo'),prices:[]});}
      busy=true;info.textContent=recoveryOnly?'저장 결과를 확인하고 있습니다…':'Google Drive에 저장하고 있습니다…';scan();port.postMessage({type:'CREATE_COMPANY',record:pending,recoveryOnly});
     }catch{pending=null;info.textContent='상호와 입력 내용을 확인해 주세요.';scan();}
    });
    port.onmessage=e=>{
     if(e.data?.type==='COMPANY_SAVED'&&pending){
      const rows=e.data.companies,found=Array.isArray(rows)&&rows.find(x=>x.id===pending.id);
      if(!found){info.textContent='저장 결과를 확인할 수 없습니다.';return;}
      snapshot.companies=structuredClone(rows);bridge.db.companies=structuredClone(rows);bridge.confirmedCompany(found);pending=null;busy=false;info.textContent='Google Drive 저장 및 다시 읽기 확인을 완료했습니다.';bridge.setSyncState('saved','저장 완료');scan();
     }else if(e.data?.type==='COMPANY_SAVE_ERROR'){
      busy=false;const messages={CONCURRENCY_UNAVAILABLE:'안전한 저장 버전을 확인할 수 없어 저장하지 않았습니다.',STORAGE_CONFLICT:'다른 변경이 감지되어 덮어쓰지 않았습니다. 연결을 다시 확인해 주세요.',QUOTA_LIMIT:'무료 사용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',RECONNECT_REQUIRED:'저장소 연결이 만료되었습니다. 다시 연결해 주세요.'};
      info.textContent=messages[e.data.code]||'저장 결과가 불확실합니다. 다시 누르면 결과만 확인하며 중복 저장하지 않습니다.';
      const button=document.getElementById('coSaveBtn');if(button)button.textContent='저장 결과 확인';scan();
     }
    };scan();
   }
  }catch{login.textContent='저장공간을 확인할 수 없습니다. · READ ONLY';app.classList.add('hidden');}
 });
 parent.postMessage({type:'NARO_READ_READY'},location.origin);
}
