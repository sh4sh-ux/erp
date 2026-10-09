// 변경 기록 화면(10/9): 왼쪽 메뉴 '설정' 묶음에 한 줄 + 창 하나. 기록은 저장할 때 위 페이지가 저장소에 남기고(change-log.mjs),
// 이 창은 달마다 읽어 보여 준다(LOG_READ). 견적서 정보 탭의 '이 견적서의 변경 기록'은 같은 창을 그 견적서로 걸러 연다.
const TABS=[['','전체'],['quotes','견적서'],['companies','거래처'],['items','품목'],['payments','입금·출금'],['stock_moves','재고'],['material_moves','자재']];
const MSG={UNAVAILABLE:'Google Drive에서는 아직 변경 기록을 지원하지 않아요. Dropbox에서 쓸 수 있어요.',NETWORK_ERROR:'연결을 확인한 뒤 다시 시도해 주세요.',RECONNECT_REQUIRED:'저장소 연결이 끊겼어요. 다시 연결해 주세요.',RATE_LIMIT:'잠시 후 다시 시도해 주세요.'};
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l3 2"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><path d="M3 4v5h5"/></svg>';
export function installLogUI({port}){
 const wait=new Map();
 const ask=(type,body={})=>new Promise(resolve=>{const requestId=crypto.randomUUID();wait.set(requestId,resolve);port().postMessage({type,requestId,...body});setTimeout(()=>{if(wait.has(requestId)){wait.delete(requestId);resolve({type:'LOG_ERROR',code:'NETWORK_ERROR'});}},30000);});
 const onMessage=m=>{if(typeof m?.type!=='string'||!m.type.startsWith('LOG_'))return false;const f=wait.get(m.requestId);if(f){wait.delete(m.requestId);f(m);}return true;};
 const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const local=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
 const shift=(ym,n)=>{const [y,m]=ym.split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
 const entry=document.createElement('button');entry.type='button';entry.className='nd-nav-act nd-log-nav';entry.innerHTML=ICON+'<span>변경 기록</span>';
 const place=()=>{const nav=document.querySelector('#appView .rail-nav');if(!nav)return false;if(!entry.isConnected)nav.append(entry);return true;};
 if(!place())new MutationObserver((r,o)=>{if(place())o.disconnect();}).observe(document.body,{childList:true,subtree:true});
 let sheet=null,month=local(),tab='',ref=null,refTitle='',rows=[],error='',loading=false;
 const cache=new Map();
 async function load(ym){
  if(cache.has(ym))return cache.get(ym);
  const r=await ask('LOG_READ',{month:ym});
  if(r.type!=='LOG_ROWS')throw Object.assign(Error(),{code:r.code||'NETWORK_ERROR'});
  const list=(Array.isArray(r.rows)?r.rows:[]).filter(x=>x&&typeof x.at==='string');cache.set(ym,list);return list;
 }
 async function refresh(){
  loading=true;error='';paint();
  try{rows=ref?(await Promise.all([0,-1,-2,-3,-4,-5].map(n=>load(shift(local(),n))))).flat():await load(month);rows=rows.filter((r,i,all)=>all.findIndex(x=>x.id===r.id)===i);}
  catch(e){rows=[];error=MSG[e.code]||'기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';}
  loading=false;paint();
 }
 function paint(){
  if(!sheet)return;
  const list=rows.filter(r=>(!tab||r.key===tab)&&(!ref||r.ref===ref)).sort((a,b)=>b.at.localeCompare(a.at));
  const day=iso=>{const d=new Date(iso);return `${d.getMonth()+1}월 ${d.getDate()}일`;},time=iso=>{const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  let last='',body='';
  for(const r of list){const d=day(r.at);if(d!==last){body+=`<div class="nd-log-day">${esc(d)}</div>`;last=d;}
   body+=`<div class="nd-log-row"><span class="t">${esc(time(r.at))}</span><div class="m"><div class="l"><b class="a a-${esc(r.action)}">${esc(r.action)}</b><span>${esc(r.label)}</span></div>${(r.changes||[]).length?`<ul>${r.changes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:''}</div><span class="w" title="${esc(r.by)}">${esc((r.by||'').split('@')[0]||'—')}</span></div>`;}
  const [y,m]=month.split('-');
  sheet.innerHTML=`<div class="nd-ps-hd nd-log-hd"><div><b id="ndLogTtl">${ref?'이 견적서의 변경 기록':'변경 기록'}</b><span class="nd-log-sub">${ref?esc(refTitle)+' · 최근 6개월':'누가 · 언제 · 무엇을 바꿨는지'}</span></div>
    ${ref?'':`<div class="nd-log-month"><button type="button" data-m="-1" aria-label="이전 달">‹</button><span>${Number(y)}년 ${Number(m)}월</span><button type="button" data-m="1" aria-label="다음 달" ${month>=local()?'disabled':''}>›</button></div>`}</div>
   ${ref?'':`<div class="nd-log-tabs" role="group" aria-label="화면별">${TABS.map(([k,t])=>`<button type="button" data-tab="${k}" aria-pressed="${tab===k}">${t}</button>`).join('')}</div>`}
   <div class="nd-log-list">${loading?'<p class="nd-log-empty">불러오는 중…</p>':error?`<p class="nd-log-empty">${esc(error)}</p>`:body||`<p class="nd-log-empty">${ref?'이 견적서의 기록이 없어요.':'이 달에는 기록이 없어요.'}<br><small>기록은 이번 업데이트 이후 저장부터 남아요.</small></p>`}</div>
   <div class="nd-ps-act nd-ps-one"><button type="button" class="nd-ps-close" data-x>닫기</button></div>`;
  sheet.querySelector('[data-x]').onclick=()=>sheet.close();
  sheet.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{month=shift(month,Number(b.dataset.m));refresh();});
  sheet.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;paint();});
 }
 function open(opts={}){
  ref=opts.ref||null;refTitle=opts.title||'';tab='';if(!ref)month=local();
  cache.clear();
  if(!sheet){sheet=document.createElement('dialog');sheet.className='nd-pay-sheet nd-log-sheet';sheet.setAttribute('aria-labelledby','ndLogTtl');sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close();});(document.getElementById('appView')||document.body).append(sheet);}
  if(!sheet.open){sheet.tabIndex=-1;sheet.showModal();sheet.focus({preventScroll:true});}
  refresh();
 }
 entry.onclick=()=>{if(sheet?.open&&!ref){sheet.close();return;}open();};
 window.NaroChangeLog={open};
 return {onMessage};
}
