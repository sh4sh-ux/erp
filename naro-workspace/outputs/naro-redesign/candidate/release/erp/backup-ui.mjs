// 처음 쓰는 분 안전망(10/22, 5단계): 설정 → 데이터 백업 아래에 두 칸.
//  ① 클라우드 자동 백업 — 매일 처음 열 때 위 페이지가 NARO Biz/Backups/YYYY-MM-DD.json을 만든다(지우거나 덮지 않음). 여기서는 목록·받기·되살리기.
//     되살리기 = 지금 데이터는 그대로 두고 백업에만 있는(없어진) 항목만 다시 넣는다(가져오기와 같은 길, keep).
//  ② 다른 클라우드로 옮기기 — 전체 백업(매입 포함) 받기 → 다른 클라우드로 연결 → 가져오기. 원래 클라우드의 파일은 그대로 남는다.
const MSG={VALIDATION:'데이터가 커서 클라우드 자동 백업(최대 7MB)을 만들 수 없어요. [전체 백업 받기]로 이 기기에 보관해 주세요.',UNAVAILABLE:'지금 연결된 클라우드에서는 자동 백업을 쓸 수 없어요.',NETWORK_ERROR:'연결을 확인한 뒤 다시 시도해 주세요.',RECONNECT_REQUIRED:'저장소 연결이 끝났어요. 다시 연결한 뒤 눌러 주세요.',RATE_LIMIT:'잠시 후 다시 시도해 주세요.',BUSY:'저장이 끝난 뒤 다시 눌러 주세요.',STORAGE_INVALID:'백업 파일을 읽지 못했어요.',QUOTA_LIMIT:'클라우드 저장 공간이 부족해요.'};
export function installBackupUI({port,restore,say}){
 const wait=new Map();
 const ask=(type,body={})=>new Promise(resolve=>{const requestId=crypto.randomUUID();wait.set(requestId,resolve);port().postMessage({type,requestId,...body});setTimeout(()=>{if(wait.has(requestId)){wait.delete(requestId);resolve({type:'BACKUP_ERROR',code:'NETWORK_ERROR'});}},60000);});
 const onMessage=m=>{if(typeof m?.type!=='string'||!m.type.startsWith('BACKUP_'))return false;const f=wait.get(m.requestId);if(f){wait.delete(m.requestId);f(m);}return true;};
 const style=document.createElement('style');
 style.textContent=`#view-settings .nd-bk-list{margin:0 0 14px;border-top:1px solid var(--nd-line,var(--border-default))}
#view-settings .nd-bk-row{display:flex;align-items:center;gap:10px;min-height:48px;border-bottom:1px solid var(--nd-line,var(--border-default));font-size:13.5px}
#view-settings .nd-bk-row .d{font-weight:600;color:var(--nd-ink,var(--text-primary))}
#view-settings .nd-bk-row .s{color:var(--nd-ink-3,var(--text-secondary));font-size:12.5px}
#view-settings .nd-bk-row .sp{flex:1}
#view-settings .nd-bk-row button{height:30px;padding:0 10px;font-size:12.5px}
#view-settings .nd-bk-empty{padding:14px 0;color:var(--nd-ink-3,var(--text-secondary));font-size:13px;border-bottom:1px solid var(--nd-line,var(--border-default))}
#view-settings .nd-bk-steps{margin:0 0 14px;padding-left:20px;font-size:13px;line-height:1.7;color:var(--nd-ink-2,var(--text-secondary))}
#view-settings .nd-bk-steps b{color:var(--nd-ink,var(--text-primary));font-weight:600}
#view-settings .nd-bk-block{border-top:1px solid var(--nd-line,var(--border-default));margin-top:18px;padding-top:16px}
#view-settings .nd-bk-h{margin:0 0 6px;font-size:14px;font-weight:700;color:var(--nd-ink,var(--text-primary))}`;
 document.head.append(style);
 // '데이터 백업' 칸 안에 이어 붙인다(설정 화면 배치가 이 칸을 오른쪽으로 옮기므로 함께 따라간다).
 const card=(cls,title,desc)=>{const c=document.createElement('div');c.className='nd-bk-block '+cls;c.innerHTML=`<h4 class="nd-bk-h"></h4><p class="settings-util-desc"></p>`;c.querySelector('h4').textContent=title;c.querySelector('p').textContent=desc;return c;};
 const button=(label,onclick)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.onclick=onclick;return b;};
 const auto=card('nd-bk-auto','클라우드 자동 백업','매일 처음 열 때 연결한 클라우드의 NARO Biz/Backups 폴더에 그날의 백업을 하나 만들어요. 백업은 지우거나 덮어쓰지 않아요. [되살리기]는 지금 데이터는 그대로 두고, 백업에만 있는(실수로 없어진) 항목만 다시 넣어요.');
 const list=document.createElement('div');list.className='nd-bk-list';list.innerHTML='<div class="nd-bk-empty">백업 목록을 불러오는 중…</div>';
 const actions=document.createElement('div');actions.className='form-actions settings-util-actions';
 auto.append(list,actions);
 const move=card('nd-bk-move','다른 클라우드로 옮기기','Google Drive ↔ Dropbox로 옮길 수 있어요. 원래 클라우드의 파일은 지우지 않고 그대로 남아요.');
 const steps=document.createElement('ol');steps.className='nd-bk-steps';
 steps.innerHTML='<li>아래 <b>[전체 백업 받기]</b>로 파일을 이 기기에 받아요(매입 포함).</li><li>메뉴에서 <b>로그아웃</b>한 뒤 다시 로그인하고, 저장소 고르기에서 <b>다른 클라우드</b>를 연결해요(새 저장공간이 만들어져요).</li><li>새 클라우드에서 <b>설정 → 백업·가져오기 → [JSON / CSV / Excel 가져오기]</b>로 받은 파일을 골라요.</li>';
 const moveActions=document.createElement('div');moveActions.className='form-actions settings-util-actions';
 move.append(steps,moveActions);
 // 화면 배치(폰·PC)가 이 칸을 다시 그려도 두 묶음이 따라 붙도록 다시 확인한다.
 const ensure=()=>{const card=document.querySelector('#view-settings .settings-util-backup'),host=card?.querySelector(':scope>.detail')||card;if(host&&(auto.parentElement!==host||move.parentElement!==host))host.append(auto,move);};
 ensure();new MutationObserver(ensure).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
 const kb=n=>n>=1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';
 const save=(backup,name)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const fail=r=>say(MSG[r.code]||'백업 작업을 마치지 못했어요. 다시 눌러 주세요.');
 async function read(day){const r=await ask('BACKUP_READ',{day});if(r.type!=='BACKUP_DATA'){fail(r);return null;}return r.backup;}
 async function load(){
  const r=await ask('BACKUP_LIST');list.textContent='';
  if(r.type!=='BACKUP_LIST'){const e=document.createElement('div');e.className='nd-bk-empty';e.textContent=MSG[r.code]||'백업 목록을 불러오지 못했어요.';list.append(e);return;}
  if(!r.backups.length){const e=document.createElement('div');e.className='nd-bk-empty';e.textContent='아직 백업이 없어요. 오늘 처음 연 뒤 잠시 지나면 첫 백업이 만들어져요.';list.append(e);return;}
  for(const b of r.backups.slice(0,14)){
   const row=document.createElement('div');row.className='nd-bk-row';
   const d=document.createElement('span');d.className='d';d.textContent=b.day+(b.day===r.today?' (오늘)':'');
   const s=document.createElement('span');s.className='s';s.textContent=b.size?kb(b.size):'';
   const sp=document.createElement('span');sp.className='sp';
   row.append(d,s,sp,
    button('받기',async()=>{const backup=await read(b.day);if(backup)save(backup,`naro-backup-${b.day}.json`);}),
    button('되살리기',async()=>{const backup=await read(b.day);if(backup)await restore(backup,b.day);}));
   list.append(row);
  }
 }
 actions.append(button('지금 백업',async e=>{e.currentTarget.disabled=true;const btn=e.currentTarget;const r=await ask('BACKUP_NOW');btn.disabled=false;if(r.type!=='BACKUP_DONE'){fail(r);return;}say(r.created?`오늘(${r.day}) 백업을 만들었어요.`:`오늘(${r.day}) 백업은 이미 있어요 — 덮어쓰지 않았어요.`);load();}),button('목록 새로고침',()=>load()));
 moveActions.append(button('전체 백업 받기 (매입 포함)',async()=>{const r=await ask('BACKUP_EXPORT');if(r.type!=='BACKUP_DATA'){fail(r);return;}const d=new Date(),day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;save(r.backup,`naro-full-backup-${day}.json`);say('전체 백업 파일을 받았어요. 다른 클라우드에서 [가져오기]로 넣으면 돼요.');}));
 // 설정 화면을 열 때 목록을 읽는다(처음 한 번 + 다시 열 때마다).
 let shown=false;
 new IntersectionObserver(entries=>{const v=entries.some(e=>e.isIntersecting);if(v&&!shown)load();shown=v;}).observe(auto);
 return {onMessage,reload:load};
}
