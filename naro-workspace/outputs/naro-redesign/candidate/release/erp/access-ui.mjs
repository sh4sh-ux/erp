// 사용자 승인 (관리자만): 왼쪽 메뉴 '설정' 묶음에 한 줄 + 창 하나. 목록·결정은 위 페이지가
// Firestore에 묻는다(access-control.mjs). 이 창은 저장소 작업과 따로 움직인다.
const MSG={
 ACCESS_NOT_SET_UP:'승인 기능이 아직 켜지지 않았어요. Firebase Firestore 규칙에 승인 블록을 더하면 여기서 승인할 수 있어요. 그 전까지는 관리자 계정 말고는 아무도 들어올 수 없어요.',
 ACCESS_DENIED:'관리자 계정만 승인할 수 있어요.',
 NETWORK_ERROR:'연결을 확인한 뒤 다시 시도해 주세요.',
 SESSION_EXPIRED:'로그인이 만료됐어요. 다시 로그인해 주세요.',
 QUOTA_LIMIT:'무료 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.',
 ACCESS_CHECK_FAILED:'승인 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
 ACCESS_RULES_OLD:'Firestore 규칙이 예전 것이라 기능·색을 저장하지 못했어요. access-block.rules의 새 블록으로 규칙을 바꿔 게시해 주세요(SETUP.md).',
 VALIDATION:'저장할 수 없는 값이에요. 창을 닫았다가 다시 열어 주세요.'
};
const TABS=[['pending','승인 대기'],['approved','승인됨'],['rejected','거절']];
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><path d="m15.5 11 2 2 4-4"/></svg>';
export function installAccessUI({port,say}){
 const wait=new Map();
 const ask=(type,body={})=>new Promise(resolve=>{const requestId=crypto.randomUUID();wait.set(requestId,resolve);port().postMessage({type,requestId,...body});});
 const onMessage=m=>{if(typeof m?.type!=='string'||!m.type.startsWith('ACCESS_'))return false;const f=wait.get(m.requestId);if(f){wait.delete(m.requestId);f(m);}return true;};
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 const when=iso=>{const d=new Date(iso);if(!iso||isNaN(d))return '';return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
 let users=[],error='',tab='pending',catalog={features:[],accents:[['','기본 파랑']]},openCfg='';
 const count=s=>users.filter(u=>u.status===s).length;
 // Rail entry: not .nav-item (the app rebinds every .nav-item to switchView).
 const entry=el('button','nd-nav-act nd-acc-nav');entry.type='button';entry.innerHTML=ICON+'<span>사용자 승인</span>';
 const badge=el('em','nd-acc-cnt');badge.hidden=true;entry.append(badge);
 const paintBadge=()=>{const n=count('pending');badge.hidden=!n;badge.textContent=String(n);entry.setAttribute('aria-label',n?`사용자 승인, 대기 ${n}명`:'사용자 승인');};
 const place=()=>{const nav=document.querySelector('#appView .rail-nav');if(!nav)return false;if(!entry.isConnected)nav.append(entry);return true;};
 if(!place())new MutationObserver((r,o)=>{if(place())o.disconnect();}).observe(document.body,{childList:true,subtree:true});
 async function load(){const r=await ask('ACCESS_LIST');if(r.type==='ACCESS_USERS'){users=r.users||[];if(r.catalog)catalog=r.catalog;error='';}else error=r.code||'ACCESS_CHECK_FAILED';paintBadge();}
 load();
 let ov=null,box=null;
 function paint(){
  if(!box)return;box.replaceChildren();
  const hd=el('div','nd-acc-hd'),ttl=el('div','nd-acc-ttl');
  ttl.append(el('div','nd-acc-eye','설정'),el('h3',null,'사용자 승인'),el('p',null,'승인한 사람만 NARO Biz를 쓸 수 있어요. 데이터는 각자 자기 저장소에 따로 저장돼요.'));
  const x=el('button','nd-acc-x','×');x.type='button';x.setAttribute('aria-label','닫기');x.onclick=close;hd.append(ttl,x);box.append(hd);
  if(error){const m=el('div','nd-acc-msg'+(error==='ACCESS_NOT_SET_UP'?' setup':''),MSG[error]||MSG.ACCESS_CHECK_FAILED);m.setAttribute('role','status');box.append(m);
   if(error!=='ACCESS_NOT_SET_UP'){const again=el('button','nd-acc-b','다시 불러오기');again.type='button';again.onclick=async()=>{again.disabled=true;await load();paint();};m.append(again);}return;}
  const chips=el('div','nd-acc-tabs');chips.setAttribute('role','tablist');
  for(const [k,label] of TABS){const b=el('button','nd-acc-chip');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(tab===k));
   b.append(label+' ');const n=el('b',k==='pending'&&count(k)?'hot':null,String(count(k)));b.append(n);b.onclick=()=>{tab=k;paint();};chips.append(b);}
  box.append(chips);
  const list=el('div','nd-acc-list');
  if(tab==='approved'){const me=el('div','nd-acc-u');const m=el('div','nd-acc-m');const e=el('div','nd-acc-e','사장님 계정');e.append(el('span','nd-acc-tag me','관리자'));
   m.append(e,el('div','nd-acc-d','항상 사용 가능'));me.append(el('div','nd-acc-av','나'),m);list.append(me);}
  const rows=users.filter(u=>u.status===tab).sort((a,b)=>tab==='pending'?String(a.requestedAt).localeCompare(String(b.requestedAt)):String(b.decidedAt||b.requestedAt).localeCompare(String(a.decidedAt||a.requestedAt)));
  if(!rows.length&&tab!=='approved')list.append(el('div','nd-acc-empty',tab==='pending'?'승인을 기다리는 사람이 없어요.':'거절한 사람이 없어요.'));
  for(const u of rows){
   const row=el('div','nd-acc-u'),m=el('div','nd-acc-m');
   m.append(el('div','nd-acc-e',u.email||'(이메일 없음)'),el('div','nd-acc-d',tab==='pending'?`${when(u.requestedAt)} 신청`:`${when(u.decidedAt)} ${tab==='approved'?'승인':'거절'}`));
   row.append(el('div','nd-acc-av',(u.email||'?')[0].toUpperCase()),m);
   const acts=el('div','nd-acc-acts');
   const act=(label,cls,status,doneText)=>{const b=el('button','nd-acc-b '+cls,label);b.type='button';b.onclick=async()=>{
    acts.querySelectorAll('button').forEach(n=>n.disabled=true);
    const r=await ask('ACCESS_DECIDE',{uid:u.uid,status});
    if(r.type==='ACCESS_DONE'){Object.assign(u,{status:r.user.status,decidedAt:r.user.decidedAt});say(`${u.email} ${doneText}`);paintBadge();paint();}
    else{acts.querySelectorAll('button').forEach(n=>n.disabled=false);say(MSG[r.code]||'처리하지 못했어요. 잠시 후 다시 시도해 주세요.');}
   };return b;};
   if(tab==='pending')acts.append(act('거절','no','rejected','가입을 거절했어요.'),act('승인','ok','approved','승인했어요. 다음 확인부터 사용할 수 있어요.'));
   if(tab==='approved'){
    // 맞춤: 이 사람에게만 켜는 기능·강조 색. 다음 접속(새로고침)부터 그 사람 화면에 적용된다.
    const accLabel=(catalog.accents.find(([k])=>k===(u.accent||''))||['',''])[1];
    const nf=(u.features||[]).length;if(u.accent||nf)m.append(el('div','nd-acc-d nd-acc-cfgsum',[u.accent?`색 ${accLabel}`:'',nf?`기능 ${nf}개`:''].filter(Boolean).join(' · ')));
    const cfg=el('button','nd-acc-b',openCfg===u.uid?'닫기':'기능·색');cfg.type='button';cfg.setAttribute('aria-expanded',String(openCfg===u.uid));cfg.onclick=()=>{openCfg=openCfg===u.uid?'':u.uid;paint();};acts.append(cfg);
    acts.append(act('승인 취소','rv','pending','승인을 취소했어요. 다음 접속부터 승인 대기 화면에서 멈춰요.'));
   }
   if(tab==='rejected')acts.append(act('승인','ok','approved','승인했어요.'));
   row.append(acts);list.append(row);
   if(tab==='approved'&&openCfg===u.uid)list.append(cfgPanel(u));
  }
  box.append(list);
  if(tab==='approved')box.append(el('p','nd-acc-foot','승인을 취소하면 그 사람은 다음 접속부터 다시 ‘승인 대기’ 화면에서 멈춰요. 그 사람의 데이터(자기 Drive·Dropbox)는 지우지 않아요.'));
 }
 function cfgPanel(u){
  const p=el('div','nd-acc-cfg');let accent=u.accent||'';const on=new Set(u.features||[]);
  p.append(el('div','nd-acc-cfg-h','강조 색'));
  const sw=el('div','nd-acc-sw');sw.setAttribute('role','radiogroup');sw.setAttribute('aria-label','강조 색');
  for(const [k,label] of catalog.accents){const b=el('button','nd-acc-swb');b.type='button';b.setAttribute('role','radio');b.dataset.accent=k||'blue';b.setAttribute('aria-checked',String(accent===k));
   const dot=el('i');b.append(dot,label);b.onclick=()=>{accent=k;sw.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',String(x===b)));};sw.append(b);}
  p.append(sw);
  p.append(el('div','nd-acc-cfg-h','추가 기능'));
  if(!catalog.features.length)p.append(el('p','nd-acc-cfg-note','아직 따로 켤 기능이 없어요. 이 사람만을 위한 기능을 만들면 여기에 켜기 칸이 생겨요.'));
  for(const f of catalog.features){const lab=el('label','nd-acc-ft');const c=document.createElement('input');c.type='checkbox';c.checked=on.has(f.key);c.onchange=()=>{c.checked?on.add(f.key):on.delete(f.key);};
   const t=el('span');t.append(el('b',null,f.label),f.desc?el('small',null,f.desc):'');lab.append(c,t);p.append(lab);}
  const row=el('div','nd-acc-cfg-act');const save=el('button','nd-acc-b ok','저장');save.type='button';
  save.onclick=async()=>{save.disabled=true;const r=await ask('ACCESS_SET',{uid:u.uid,features:[...on],accent});
   if(r.type==='ACCESS_DONE'){u.features=r.user.features||[];u.accent=r.user.accent||'';openCfg='';say(`${u.email} 맞춤을 저장했어요. 그 사람이 다음에 접속하면 적용돼요.`);paint();}
   else{save.disabled=false;say(MSG[r.code]||'저장하지 못했어요. 잠시 후 다시 시도해 주세요.');}};
  row.append(save);p.append(row);return p;
 }
 const esc=e=>{if(e.key==='Escape'){e.stopPropagation();close();}};
 function close(){ov?.remove();ov=box=null;removeEventListener('keydown',esc,true);}
 async function open(){
  close();ov=el('div','nd-acc');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','사용자 승인');
  box=el('div','nd-acc-box');ov.append(box);ov.onclick=e=>{if(e.target===ov)close();};
  (document.getElementById('appView')||document.body).append(ov);addEventListener('keydown',esc,true);
  box.append(el('div','nd-acc-loading','불러오는 중…'));
  await load();paint();
 }
 entry.onclick=()=>{if(!matchMedia('(min-width:1024px)').matches&&typeof window.toggleNav==='function')window.toggleNav(false);open();};
 return {onMessage,open};
}
