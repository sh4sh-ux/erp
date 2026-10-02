/* NARO theme: system | light | dark. One preference shared by the onboarding shell
   and the /erp/ frame (same origin → same localStorage, kept in sync via 'storage'). */
(() => {
 const KEY='naroTheme',root=document.documentElement,media=matchMedia('(prefers-color-scheme: dark)');
 const read=()=>{try{const v=localStorage.getItem(KEY);return v==='light'||v==='dark'?v:'system';}catch{return 'system';}};
 const apply=()=>{const pref=read();root.dataset.themePreference=pref;root.dataset.theme=pref==='system'?(media.matches?'dark':'light'):pref;
  document.querySelectorAll('.nd-theme button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===pref)));};
 const set=pref=>{try{pref==='system'?localStorage.removeItem(KEY):localStorage.setItem(KEY,pref);}catch{}apply();};
 const icons={system:'<path d="M3 5h18v11H3z"/><path d="M8 20h8M12 16v4"/>',light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',dark:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'};
 const labels={system:'시스템',light:'라이트',dark:'다크'};
 function control(){const box=document.createElement('div');box.className='nd-theme';box.setAttribute('role','group');box.setAttribute('aria-label','화면 테마');
  for(const k of ['system','light','dark']){const b=document.createElement('button');b.type='button';b.dataset.themeChoice=k;b.title=labels[k];b.setAttribute('aria-label','테마: '+labels[k]);
   b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[k]}</svg><span class="nd-t-label">${labels[k]}</span>`;
   b.onclick=()=>set(k);box.append(b);}
  return box;}
 media.addEventListener?.('change',apply);
 addEventListener('storage',e=>{if(e.key===KEY||e.key===null)apply();});
 apply();
 window.naroTheme={get:read,set,control,apply};
 /* Dark counterparts for legacy hard-coded colours. Reads this document's own stylesheets once,
    writes screen-only rules scoped to html[data-theme="dark"]. Print/document selectors are skipped. */
 function darkAuto(){
  if(document.getElementById('nd-dark-auto'))return;
  const skip=/printArea|\.p-|\.pv-|pv-sheet|@page|\.print|#?doc-|\.nd-theme/;
  const rgb=v=>{let m=/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(v);if(m)return [+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]];
   m=/^#([0-9a-f]{3,8})$/i.exec(v);if(m){let h=m[1];if(h.length<6)h=[...h].map(c=>c+c).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),h.length===8?parseInt(h.slice(6,8),16)/255:1];}
   return v==='white'?[255,255,255,1]:v==='black'?[0,0,0,1]:null;};
  const hsl=([r,g,b])=>{r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
   if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=Math.round(h*60+360)%360;}return [h,s,l];};
  const map=(prop,v)=>{const c=rgb(v.trim());if(!c||c[3]===0)return null;const [h,s,l]=hsl(c),a=c[3];
   if(prop==='color'){
    if(l>=.5)return null;
    if(s<.18)return l<.2?'var(--nd-ink)':l<.38?'var(--nd-ink-2)':'var(--nd-ink-3)';
    return `hsl(${h} ${Math.round(Math.min(s,.92)*100)}% ${Math.round(Math.max(66,100-l*80))}%)`;}
   if(prop==='background-color'){
    if(l<.82)return null;
    if(s<.25||l>.985&&s<.6)return a<1?`rgba(255,255,255,${(a*.06).toFixed(3)})`:l>.985?'var(--nd-surface)':l>.95?'var(--nd-fill)':'var(--nd-fill-2)';
    return `hsl(${h} ${Math.round(Math.min(s,.85)*100)}% 60% / ${Math.min(.18,.08+(1-l)*1.2).toFixed(3)})`;}
   if(l<.78)return null;
   return s<.25?'var(--nd-line)':`hsl(${h} ${Math.round(Math.min(s,.8)*100)}% 62% / .38)`;};
  const props=['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color'];
  const out=[];
  const walk=rules=>{for(const r of rules){
   if(r.type===4){if(!/print/.test(r.media.mediaText))walk(r.cssRules);continue;}
   if(r.cssRules&&r.type!==1){try{walk(r.cssRules);}catch{}continue;}
   if(r.type!==1||skip.test(r.selectorText))continue;
   const decl=[];
   for(let i=0;i<r.style.length;i++){const p=r.style[i];if(!p.startsWith('--')||/^--(nd|panel-(line|ink|muted|left|surface|rail-bg|selected|accent))$/.test(p)&&r.selectorText.includes('layout-system'))continue;
    const v=r.style.getPropertyValue(p).trim(),c=rgb(v);if(!c)continue;const l=hsl(c)[2];
    const m=/line|border|divider|stroke/.test(p)?map('border',v):l<.5?map('color',v):map('background-color',v);if(m)decl.push(`${p}:${m}`);}
   for(const p of ['background','background-color','border-top-color','border-bottom-color','border-left-color','border-right-color']){const v=r.style.getPropertyValue(p);if(v.includes('color-mix')&&/white|#fff\b|rgb\(255, 255, 255\)/.test(v))decl.push(`${p}:${v.replace(/white|#fff\b|rgb\(255, 255, 255\)/g,'var(--nd-surface)')}`);}
   for(const p of props){const v=r.style.getPropertyValue(p);if(!v||v.includes('var('))continue;const m=map(p.startsWith('border')||p==='outline-color'?'border':p,v);if(m)decl.push(`${p}:${m}${r.style.getPropertyPriority(p)?' !important':''}`);}
   if(!decl.length)continue;
   const sel=r.selectorText.split(/,(?![^(]*\))/).map(s=>{s=s.trim();if(/^(html|:root)\b/.test(s))return s.replace(/^(html|:root)/,'html[data-theme="dark"]');return 'html[data-theme="dark"] '+s.replace(/^body\b/,'body');}).join(',');
   out.push(`${sel}{${decl.join(';')}}`);}};
  for(const sheet of document.styleSheets){if(sheet.ownerNode?.id==='naro-design')continue;try{walk(sheet.cssRules);}catch{}}
  const style=document.createElement('style');style.id='nd-dark-auto';style.textContent='@media screen{'+out.join('\n')+'}';
  const design=document.getElementById('naro-design');design?design.before(style):document.head.append(style);
 }
 const mount=()=>{const foot=document.querySelector('#appView .rail-foot');if(foot&&!foot.querySelector('.nd-theme'))foot.prepend(control());
  const tools=foot?.querySelector('.rail-tools');if(tools&&!tools.querySelector('.nd-menu')){const menu=document.createElement('div');menu.className='nd-menu';
   const acct=document.createElement('div');acct.className='nd-acct';acct.innerHTML='<b>내 계정</b><small></small><span class="nd-acct-sync"><i></i><em></em></span>';menu.append(acct);
   // The connection line lives here (rail stays short); the rail row itself shows only while syncing or on error.
   const sync=foot.querySelector('.sync-state'),line=acct.querySelector('.nd-acct-sync');
   const who=()=>{const t=(document.getElementById('tbUser')?.textContent||'').trim();acct.querySelector('small').textContent=t||'연결된 저장공간';
    const st=(sync?.querySelector('.sync-text')?.textContent||sync?.textContent||'').trim();line.hidden=!st;line.querySelector('em').textContent=st;
    line.className='nd-acct-sync '+(sync?.className.match(/\b(saved|syncing|error)\b/)?.[1]||'');};who();
   const tb=document.getElementById('tbUser');for(const n of [tb,sync])n&&new MutationObserver(who).observe(n,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});tools.querySelectorAll(':scope>.rail-act').forEach(a=>menu.append(a));tools.append(menu);
   tools.querySelector('summary')?.setAttribute('aria-label','내 계정: 새로고침·로그아웃');tools.querySelector('summary')?.setAttribute('title','내 계정');document.addEventListener('click',e=>{if(tools.open&&!tools.contains(e.target))tools.open=false;});}
  apply();};
 /* Desktop scope row: companies/items keep their search + add in the 144px header, like quotes.
    Original nodes move (listeners intact) and return when the viewport leaves desktop. */
 const desk=matchMedia('(min-width:1024px)'),moved=[];
 function scope(){
  if(desk.matches&&!moved.length){for(const v of ['companies','items']){const head=document.querySelector(`#view-${v}>.page-head`),row=document.querySelector(`#view-${v} .list-head`);
    if(!head||!row||head.contains(row))continue;const mark=document.createComment('nd-scope-origin');row.before(mark);head.append(row);head.classList.add('nd-scope');moved.push([mark,row,head]);}}
  else if(!desk.matches&&moved.length){moved.splice(0).forEach(([mark,row,head])=>{mark.replaceWith(row);head.classList.remove('nd-scope');});}
 }

 /* v5 시안 1차: rail '자료' group · quick-filter chips (drive the existing selects) · one action-bar order.
    Existing nodes keep their handlers; only placement changes. */
 const svgI=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
 const ICON_CARD='<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.8-2 3-2s2.4.5 3 2M14 10h4M14 13h3"/>',
  ICON_DOC='<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>',ICON_DOWN='<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>';
 function railDocs(){const nav=document.querySelector('#appView .rail-nav');if(!nav||nav.querySelector('.nd-docs'))return;
  const before=[...nav.querySelectorAll('.nav-sec')].find(s=>s.textContent.trim()==='설정');
  const sec=document.createElement('div');sec.className='nav-sec nd-docs';sec.textContent='자료';
  // Not .nav-item: the app rebinds every .nav-item to switchView(dataset.view).
  // Mirrors the source button: when this build disables it, say so instead of a dead click.
  const act=(id,label,icon)=>{const b=document.createElement('button'),src=document.getElementById(id);b.type='button';b.className='nd-nav-act';b.innerHTML=svgI(icon)+`<span>${label}</span><em class="nd-soon">준비 중</em>`;
   const mirror=()=>{const off=!src||src.disabled;b.classList.toggle('nd-off',off);b.title=off?'이번 버전에서는 아직 지원하지 않습니다.':label;};
   if(src)new MutationObserver(mirror).observe(src,{attributes:true,attributeFilter:['disabled']});mirror();
   b.onclick=()=>{if(!src||src.disabled){typeof window.toast==='function'&&window.toast('이번 버전에서는 아직 지원하지 않습니다.');return;}
    src.click();if(!desk.matches&&typeof window.toggleNav==='function')window.toggleNav(false);};return b;};
  const exp=document.createElement('button');exp.type='button';exp.className='nd-nav-act';exp.innerHTML=svgI(ICON_DOWN)+'<span>데이터 내보내기</span>';
  exp.onclick=()=>{if(!desk.matches&&typeof window.toggleNav==='function')window.toggleNav(false);openExport();};
  const nodes=[sec,act('bizCardBtn','명함 보내기',ICON_CARD),act('bizCertBtn','사업자등록증',ICON_DOC),exp];
  before?before.before(...nodes):nav.append(...nodes);}
 const CHIPS=[
  {select:'qtStatus',host:'#view-quotes .quote-list-card',list:'qtList',items:[['','전체'],['작성중','작성중'],['발송','발송'],['수주','수주'],['납품','납품']]},
  {select:'coType',host:'#view-companies>.cols>.card:first-child',list:'coList',items:[['','전체'],['매출','매출'],['매입','매입']]}];
 function chips(){for(const c of CHIPS){const select=document.getElementById(c.select),host=document.querySelector(c.host),list=document.getElementById(c.list);
  if(!select||!host||!list||host.querySelector('.nd-chips'))continue;
  const row=document.createElement('div');row.className='nd-chips';row.setAttribute('role','group');row.setAttribute('aria-label','빠른 필터');
  const sync=()=>row.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===select.value)));
  for(const [v,label] of c.items){const b=document.createElement('button');b.type='button';b.dataset.v=v;b.textContent=label;
   b.onclick=()=>{if(select.value!==v){select.value=v;select.dispatchEvent(new Event('change',{bubbles:true}));}sync();};row.append(b);}
  list.before(row);select.classList.add('nd-chip-source');
  select.addEventListener('change',sync);new MutationObserver(sync).observe(list,{childList:true});sync();}}
 /* Action bar: [secondary ≤4] … [⋯ more] [save]. Quote copy/email join delete inside ⋯. */
 function actions(){
  for(const menu of document.querySelectorAll('#appView :is(#coForm,#itForm,#qtForm) .form-actions>.panel-b-danger')){
   let pop=menu.querySelector(':scope>.nd-pop');if(!pop){pop=document.createElement('div');pop.className='nd-pop';menu.append(pop);
    menu.querySelector('summary')?.setAttribute('aria-label','더보기');}
   // 이메일 sits next to 공유 in the bar; only 복사 joins 삭제 inside ⋯.
   // Quote bar: [견적서 ▾] [공유] [이메일] … [⋯ 인쇄·이미지·복사·삭제] [저장].
   if(menu.closest('#qtForm')){for(const id of ['qtCopyBtn','qtImgBtn','qtPrintBtn']){const b=document.getElementById(id);if(b&&b.parentElement!==pop)pop.prepend(b);}
    const mail=document.getElementById('qtMailBtn'),share=document.getElementById('qtShareBtn');if(mail&&share&&mail.previousElementSibling!==share)share.after(mail);}
   menu.querySelectorAll(':scope>.btn').forEach(b=>pop.append(b));
   // 하단 버튼 규칙: ⋯ 안에 넣을 것이 하나뿐이면(거래처·품목의 삭제) ⋯ 대신 그 버튼을 바로 보인다.
   // 버튼을 옮기면 패널 레이아웃이 다시 넣어 서로 되돌리므로, 옮기지 않고 메뉴를 펼친 채 ⋯만 숨긴다.
   if(!menu.closest('#qtForm')){const single=pop.querySelectorAll(':scope>button,:scope>.btn').length===1;
    if(menu.classList.contains('nd-solo-menu')!==single)menu.classList.toggle('nd-solo-menu',single);
    if(single&&!menu.open)menu.open=true;}
   if(!menu.dataset.ndBound){menu.dataset.ndBound='1';document.addEventListener('click',e=>{if(menu.open&&!menu.classList.contains('nd-solo-menu')&&!menu.contains(e.target))menu.open=false;});
    pop.addEventListener('click',e=>{if(e.target.closest('button')&&!menu.classList.contains('nd-solo-menu'))menu.open=false;});}}
  // Phone quote bar: [⋯] [공유] [이메일] [저장]. The rest (문서 종류·복사·인쇄·이미지·삭제) opens above the bar in 2 columns.
  for(const more of document.querySelectorAll('#appView #qtForm .quote-form-actions>.qp-more')){
   const bar=more.parentElement,save=bar.querySelector(':scope>.btn.save');
   for(const id of ['qtShareBtn','qtMailBtn']){const b=document.getElementById(id);if(b&&b.parentElement!==bar)save?save.before(b):bar.append(b);}
   let pop=more.querySelector(':scope>.nd-qpop');if(!pop){pop=document.createElement('div');pop.className='nd-qpop';more.append(pop);}
   for(const c of [...more.children])if(c!==pop&&c.tagName!=='SUMMARY')pop.append(c);
   if(!more.dataset.ndBound){more.dataset.ndBound='1';more.querySelector('summary')?.setAttribute('aria-label','더보기');
    document.addEventListener('click',e=>{if(more.open&&!more.contains(e.target))more.open=false;});
    pop.addEventListener('click',e=>{if(e.target.closest('button'))more.open=false;});}}
 }

 /* 업체 제공 자재: received = 보유 + 사용 + 반환·불량 for the selected material, as one stacked bar (blue ramp).
    Reads the same ledger the screen already shows; draws only. */
 function materialGraph(){
  const root=document.getElementById('materialContent'),hero=root?.querySelector('.material-balance-hero');if(!hero||root.querySelector('.nd-mat'))return;
  let cid,name,rows;try{cid=materialSelectedCompanyId;name=materialSelectedName;rows=db.material_moves;}catch{return;}
  rows=(rows||[]).filter(m=>!m.void_at&&m.company_id===cid&&m.material===name);
  const sum=test=>rows.filter(m=>test(m.kind)).reduce((s,m)=>s+(Number(m.qty)||0),0);
  const recv=sum(k=>k==='받음'),used=sum(k=>k==='작업 완료'),ret=sum(k=>k!=='받음'&&k!=='작업 완료');if(recv<=0)return;
  const n=v=>Math.round(v).toLocaleString('ko-KR'),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const segs=[['보유',Math.max(0,recv-used-ret),'held'],['사용',used,'used'],['반환·불량',ret,'ret']];
  const card=document.createElement('div');card.className='nd-mat';
  card.innerHTML=`<div class="nd-mat-hd"><span>받은 ${esc(name)} ${n(recv)}개</span><span>받음 = 보유 + 사용 + 반환·불량</span></div>`
   +`<div class="nd-mat-bar" role="img" aria-label="${segs.map(([l,v])=>`${l} ${n(v)}개`).join(', ')}">${segs.filter(([,v])=>v>0).map(([l,v,k])=>`<i class="${k}" style="flex-grow:${v}" title="${l} ${n(v)}개"></i>`).join('')}</div>`
   +`<div class="nd-mat-legend">${segs.map(([l,v,k])=>`<span><i class="${k}"></i>${l}<b>${n(v)}</b></span>`).join('')}</div>`;
  const summary=root.querySelector('.material-summary');summary?summary.before(card):hero.after(card);}
 function watchMaterials(){const root=document.getElementById('materialContent');if(!root||root.dataset.ndWatch)return;root.dataset.ndWatch='1';new MutationObserver(()=>{materialGraph();materialsMobile();}).observe(root,{childList:true});materialGraph();}

 /* 데이터 내보내기: one place for every export (rail · 자료). CSV = UTF-8 with BOM (Excel opens Korean as-is),
    header row in Korean, plain numbers. Reads db only; sales/receivables/backup reuse the app's own exporters. */
 const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
 const ymd=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
 const PERIODS={all:['전체 기간',()=>['','']],month:['이번 달',()=>{const d=new Date();return [ymd(new Date(d.getFullYear(),d.getMonth(),1)),today()];}],
  last:['지난 달',()=>{const d=new Date();return [ymd(new Date(d.getFullYear(),d.getMonth()-1,1)),ymd(new Date(d.getFullYear(),d.getMonth(),0))];}],
  year:['올해',()=>[new Date().getFullYear()+'-01-01',today()]],prev:['작년',()=>{const y=new Date().getFullYear()-1;return [y+'-01-01',y+'-12-31'];}],custom:['직접 기간',null]};
 const cell=v=>v==null?'':typeof v==='number'?String(v):(typeof csvEsc==='function'?csvEsc(v):String(v));
 const inRange=(d,[from,to])=>(!from||String(d||'')>=from)&&(!to||String(d||'')<=to);
 const company=id=>typeof coName==='function'?coName(id):((db.companies||[]).find(c=>c.id===id)?.name||'');
 const totals=lines=>{try{return quoteTotals({lines});}catch{const supply=lines.reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0),vat=Math.round(supply*.1);return {supply,vat,total:supply+vat};}};
 const SETS=[
  {key:'quotes',label:'견적서',sub:'견적 1건 = 1줄 · 품목 줄로 펼치기 선택',period:true,opts:[['lines','품목 줄로 펼치기','견적 1건이 품목 수만큼 여러 줄이 됩니다'],['cancel','취소된 견적 포함','']],
   rows(o,r){const qs=(db.quotes||[]).filter(q=>inRange(q.date,r)&&(o.cancel||q.status!=='취소')).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(o.lines){const out=[['견적번호','견적일','거래처','상태','품명','색상','규격/옵션','단위','수량','단가','공급가액']];
     qs.forEach(q=>(q.lines||[]).filter(l=>(l.name||'').trim()).forEach(l=>out.push([q.no,q.date,company(q.company_id),q.status,l.name,l.color||'',l.spec||'',l.unit||'',Number(l.qty)||0,Number(l.price)||0,(Number(l.qty)||0)*(Number(l.price)||0)])));return out;}
    const out=[['견적번호','견적일','거래처','상태','유효기간','품목 수','총수량','공급가액','세액','합계','비고']];
    qs.forEach(q=>{const lines=(q.lines||[]).filter(l=>(l.name||'').trim()),t=totals(lines);out.push([q.no,q.date,company(q.company_id),q.status,q.valid||'',lines.length,lines.reduce((s,l)=>s+(Number(l.qty)||0),0),t.supply,t.vat,t.total,q.memo||'']);});return out;}},
  {key:'companies',label:'거래처',sub:'상호 · 연락처 · 사업자번호 · 주소',
   rows(){const out=[['상호','구분','담당자','연락처','이메일','사업자번호','주소','상세주소','메모']];
    (db.companies||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).forEach(c=>out.push([c.name,c.type||'',c.contact||'',c.phone||'',c.email||'',c.biz_no||'',c.address_base??c.address??'',c.address_detail||'',c.memo||'']));return out;}},
  {key:'items',label:'품목',sub:'코드 · 단가 · 색상 · 규격',
   rows(){const out=[['품목코드','품명','유형','카테고리','단위','매입단가','매출단가','색상','규격/옵션']];
    (db.items||[]).forEach(i=>out.push([i.code||'',i.name,i.type||'',i.category||'',i.unit||'',Number(i.buy_price)||0,Number(i.sell_price)||0,(i.colors||[]).join(' / '),(i.variants||[]).map(v=>v.spec).filter(Boolean).join(' / ')]));return out;}},
  {key:'payments',label:'입금·출금',sub:'기간별 내역 · 들어온 돈과 나간 돈',period:true,
   rows(o,r){const quote=id=>(db.quotes||[]).find(q=>q.id===id)?.no||'';const out=[['날짜','구분','거래처','결제수단','금액','연결 견적','메모']];
    (db.payments||[]).filter(p=>!p.void_at&&inRange(p.date,r)).sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(p=>out.push([p.date,p.kind==='수금'?'입금':p.kind==='지급'?'출금':p.kind||'',company(p.company_id),p.method||'',Number(p.amount)||0,quote(p.quote_id),p.memo||'']));return out;}},
  {key:'sales',label:'매출 집계',sub:'거래처별 품목 집계 · 매출 집계 화면과 같은 계산',period:true,app:true,
   run(r){const from=document.getElementById('slFrom'),to=document.getElementById('slTo');if(!from||!to||typeof exportSalesCsv!=='function')return false;
    const keep=[from.value,to.value];const [a,b]=r[0]?r:['2000-01-01',today()];from.value=a;to.value=b;try{exportSalesCsv();}finally{from.value=keep[0];to.value=keep[1];}return true;}},
  {key:'ar',label:'받을 금액',sub:'거래처별 납품 − 입금 · 오늘 기준',app:true,run(){if(typeof exportArCsv!=='function')return false;exportArCsv();return true;}},
  {key:'backup',label:'전체 백업',sub:'JSON · 다시 불러오기용 (모든 자료)',json:true,app:true,run(){if(typeof exportBackup!=='function')return false;exportBackup();return true;}}];
 let exportDialog=null;
 function openExport(){
  if(exportDialog){exportDialog.showModal();return;}
  const d=document.createElement('dialog');d.className='nd-export';d.setAttribute('aria-labelledby','ndExportTitle');
  const state={key:'quotes',period:'all',from:'',to:'',opts:{}};
  const range=()=>state.period==='custom'?[state.from,state.to]:PERIODS[state.period][1]();
  const n=v=>Math.round(v).toLocaleString('ko-KR'),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const draw=()=>{const set=SETS.find(x=>x.key===state.key),r=range(),rows=set.rows?set.rows(state.opts,r):null,count=rows?rows.length-1:null;
   const list=SETS.map(x=>`<button type="button" class="nd-ex-item${x.key===state.key?' on':''}" data-k="${x.key}" aria-pressed="${x.key===state.key}"><span><b>${x.label}</b><small>${x.sub}</small></span><em>${x.json?'JSON':'CSV'}</em></button>`).join('');
   const period=set.period?`<div class="nd-ex-row"><label>기간<select data-f="period">${Object.entries(PERIODS).map(([k,[l]])=>`<option value="${k}"${k===state.period?' selected':''}>${l}</option>`).join('')}</select></label>${state.period==='custom'?`<label>시작일<input type="date" data-f="from" value="${state.from}"></label><label>종료일<input type="date" data-f="to" value="${state.to}"></label>`:`<span class="nd-ex-range">${r[0]?`${r[0]} – ${r[1]}`:'처음부터 오늘까지'}</span>`}</div>`:'';
   const opts=(set.opts||[]).map(([k,l,h])=>`<label class="nd-ex-check"><input type="checkbox" data-o="${k}"${state.opts[k]?' checked':''}><span>${l}${h?`<small>${h}</small>`:''}</span></label>`).join('');
   const fname=fileName(set,r);
   const preview=rows?(count?`<div class="nd-ex-table" role="table"><div class="nd-ex-tr nd-ex-th">${rows[0].map(h=>`<span>${esc(h)}</span>`).join('')}</div>${rows.slice(1,4).map(row=>`<div class="nd-ex-tr">${row.map(v=>`<span class="${typeof v==='number'?'num':''}">${esc(v)}</span>`).join('')}</div>`).join('')}</div>`:'<p class="nd-ex-empty">이 조건에 해당하는 자료가 없습니다.</p>'):`<p class="nd-ex-empty">${set.json?'모든 자료(거래처·품목·견적서·입금·출금·재고·자재·공급자 정보)를 한 파일로 저장합니다. 앱의 가져오기로 다시 불러올 수 있습니다.':'앱의 '+set.label+' 계산 그대로 만듭니다.'}</p>`;
   d.innerHTML=`<div class="nd-ex-head"><div><div class="nd-ex-eye">자료</div><h2 id="ndExportTitle">데이터 내보내기</h2></div><button type="button" class="nd-ex-close" aria-label="닫기">닫기</button></div>
    <div class="nd-ex-body"><nav class="nd-ex-list" aria-label="내보낼 자료">${list}</nav>
    <section class="nd-ex-main"><div class="nd-ex-title"><h3>${set.label}</h3>${count!=null?`<span>${n(count)}건</span>`:''}</div>${period}${opts?`<div class="nd-ex-opts">${opts}</div>`:''}
     <div class="nd-ex-file"><div><span>파일</span><b>${esc(fname)}</b></div><div><span>형식</span>${set.json?'JSON — 앱 복원용':'CSV · UTF-8(BOM) · 쉼표 구분 — 엑셀에서 더블클릭해도 한글이 깨지지 않습니다'}</div>${set.json?'':'<div><span>숫자</span>쉼표 없는 숫자(엑셀에서 바로 합계·정렬) · 날짜 2026-10-03</div>'}</div>
     <div class="nd-ex-prev"><div class="nd-ex-sub">미리보기${rows&&count?` <small>처음 ${Math.min(3,count)}줄</small>`:''}</div>${preview}</div></section></div>
    <div class="nd-ex-foot"><button type="button" class="nd-ex-go"${count===0?' disabled':''}>${set.json?'백업 내려받기':'CSV 내려받기'}</button></div>`;
   d.querySelector('.nd-ex-close').onclick=()=>d.close();
   d.querySelectorAll('.nd-ex-item').forEach(b=>b.onclick=()=>{state.key=b.dataset.k;draw();d.querySelector(`.nd-ex-item[data-k="${state.key}"]`)?.focus();});
   d.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{state[el.dataset.f]=el.value;if(el.dataset.f==='period'&&el.value==='custom'&&!state.from){[state.from,state.to]=PERIODS.month[1]();}draw();});
   d.querySelectorAll('[data-o]').forEach(el=>el.onchange=()=>{state.opts[el.dataset.o]=el.checked;draw();});
   d.querySelector('.nd-ex-go').onclick=()=>{
    if(set.run){if(!set.run(r)&&typeof window.toast==='function')window.toast('이 자료는 지금 내보낼 수 없습니다.');return;}
    if(!count)return;const csv=rows.map(row=>row.map(cell).join(','));
    if(typeof downloadCsv==='function')downloadCsv(csv,fname);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv.join('\n')],{type:'text/csv;charset=utf-8'}));a.download=fname;a.click();}};
  };
  const fileName=(set,r)=>set.json?`erp_백업_${today()}.json`:set.key==='ar'?`미수금_${today()}.csv`:set.key==='sales'?`매출집계_${r[0]||'전체'}_${r[1]||today()}.csv`:`NARO_${set.label.replace('·','')}_${set.period?(r[0]?`${r[0]}_${r[1]}`:`전체_${today()}`):today()}.csv`;
  d.addEventListener('click',e=>{if(e.target===d)d.close();});
  document.body.append(d);exportDialog=d;draw();d.showModal();
 }
 window.naroExport=openExport;
 /* Per-screen CSV buttons retire: the rail's 데이터 내보내기 is the one place (functions stay, reused above). */
 function retireCsv(){for(const id of ['qtCsvBtn','slCsvBtn','arCsvBtn']){const b=document.getElementById(id);if(b)b.classList.add('nd-retired');}
}
 /* 공급자 정보 주소: the same address search as 거래처 (Daum postcode, loaded on demand). */

 /* Address search opens /postcode.html in its own window: the app page's CSP (no third-party script) stays as is,
    and the widget never runs next to business data. The window posts the address back (same origin only). */
 let addrWin=null,addrDone=null;
 addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='NARO_POSTCODE'||!addrWin||e.source!==addrWin)return;const done=addrDone;addrWin=addrDone=null;done?.(String(e.data.address||'').slice(0,200),String(e.data.building||'').slice(0,100));});
 // A new address replaces a building-only detail; anything the user typed (호수 등) stays.
 function fillDetail(el,building){const cur=el.value.trim();if(building&&(!cur||cur===el.dataset.ndBuilding)){el.value=building+' ';el.dataset.ndBuilding=building;el.dispatchEvent(new Event('input',{bubbles:true}));}el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch{}}
 function addressWindow(btn,done){
  const w=Math.min(520,screen.availWidth||520),h=Math.min(680,screen.availHeight||680);
  addrWin=window.open(new URL('/postcode.html?theme='+(document.documentElement.dataset.theme==='dark'?'dark':'light'),location.href).href,'naro-postcode',`popup=yes,width=${w},height=${h},left=${Math.max(0,((screen.availWidth||w)-w)/2)},top=${Math.max(0,((screen.availHeight||h)-h)/2)}`);
  addrDone=done;
  if(!addrWin){typeof window.toast==='function'&&window.toast('팝업이 막혀 주소 검색 창을 열지 못했습니다. 팝업을 허용하거나 주소를 직접 입력해 주세요.');return;}
  addrWin.focus();}
 // 거래처 주소 검색 uses the same window (the app binds #coAddressSearch to this global on each render).
 window.openCompanyAddressSearch=function(){const address=document.getElementById('f_address'),detail=document.getElementById('f_address_detail'),btn=document.getElementById('coAddressSearch');
  addressWindow(btn,(v,b)=>{if(address?.isConnected){address.value=v;address.dispatchEvent(new Event('input',{bubbles:true}));}if(detail?.isConnected){fillDetail(detail,b);}});};
 function supplierAddress(){
  const input=document.getElementById('st_address');if(!input||input.dataset.ndAddr)return;input.dataset.ndAddr='1';
  const wrap=document.createElement('div');wrap.className='nd-addr';input.before(wrap);wrap.append(input);
  const b=document.createElement('button');b.type='button';b.className='nd-addr-btn';b.innerHTML=svgI('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')+'<span>주소 검색</span>';wrap.append(b);
  input.placeholder='[주소 검색]으로 찾거나 직접 입력';
  // 상세 주소 gets its own box like 거래처; on save it joins the base address (the record keeps one address field).
  const detail=document.createElement('input');detail.id='nd_address_detail';detail.type='text';detail.autocomplete='address-line2';detail.placeholder='상세 주소 (동·층·호수)';detail.setAttribute('aria-label','상세 주소');detail.className='nd-addr-detail';wrap.after(detail);
  b.onclick=()=>addressWindow(b,(v,bn)=>{input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));detail.value='';fillDetail(detail,bn);});
  document.addEventListener('click',e=>{if(!e.target.closest?.('#stSaveBtn'))return;const d=detail.value.trim();if(d){input.value=(input.value.trim()+' '+d).trim();detail.value='';}},true);}


 /* 공급자 정보: the personal-cloud image panel gets the app's form styling; legacy link fields say what they are now. */
 function settingsPolish(){
  const view=document.getElementById('view-settings');if(!view)return;
  for(const sec of view.querySelectorAll('section.card')){const h=sec.querySelector(':scope>h3');if(h&&h.textContent.trim()==='개인 클라우드 이미지'&&!sec.classList.contains('nd-assets')){sec.classList.add('nd-assets');
   const btns=sec.querySelectorAll(':scope>button');btns[0]?.classList.add('nd-assets-up');btns[1]?.classList.add('nd-assets-view');
   const row=document.createElement('div');row.className='nd-assets-row';sec.querySelector(':scope>select')?.before(row);row.append(...sec.querySelectorAll(':scope>select,:scope>button'));}}
  for(const [id,label] of [['st_card_url','명함'],['st_cert_url','사업자등록증']]){const hint=document.getElementById(id)?.closest('.field')?.querySelector('.hint');
   if(hint&&!hint.dataset.nd){hint.dataset.nd='1';hint.textContent=`예전 방식(링크)입니다. 지금 '${label} 보내기'는 아래 '개인 클라우드 이미지'에 저장한 이미지를 보냅니다.`;}}
  settingsSections(view);}
 /* 백업·가져오기 lived in a fold under the left index and overflowed it. It is a section of the right panel now
    (moved node, original handlers), and the left index lists it with 개인 클라우드 이미지 like any other section. */
 function settingsSections(view){
  const body=view.querySelector('.workspace-right>.card'),left=view.querySelector('.workspace-left');if(!body||!left)return;
  const backup=view.querySelector('.settings-util-backup');
  const assets=body.querySelector('.nd-assets');
  if(backup&&(!body.contains(backup)||(assets&&assets.nextElementSibling!==backup))){backup.classList.add('nd-backup');(assets||body.lastElementChild).after(backup);
   if(!backup.querySelector(':scope>.nd-sec-t')){const h=document.createElement('h3');h.className='nd-sec-t';h.textContent='백업·가져오기';backup.prepend(h);}}
  view.querySelectorAll('.settings-utils>details.panel-b-more').forEach(d=>{if(![...d.children].some(c=>c.tagName!=='SUMMARY'&&!c.hidden&&c.classList.contains('settings-util-card')))d.closest('.settings-utils').classList.add('nd-empty');});
  const list=left.querySelector('.panel-b-index:not(.nd-index-x)');if(!list)return;
  let extra=left.querySelector('.nd-index-x');
  if(!extra){extra=document.createElement('div');extra.className='panel-b-index nd-index-x';list.after(extra);
   left.addEventListener('click',e=>{const b=e.target.closest('.panel-b-index button');if(!b)return;
    left.querySelectorAll('.panel-b-index button').forEach(n=>n.classList.toggle('on',n===b));
    if(!b.dataset.ndSec)body.querySelectorAll(':scope>.panel-b-selected').forEach(n=>n.classList.remove('panel-b-selected'));},true);}
  const targets=[[body.querySelector('.nd-assets'),'명함·사업자등록증'],[body.querySelector('.nd-backup'),'백업·가져오기']].filter(([t])=>t);
  if(extra.childElementCount!==targets.length){extra.replaceChildren(...targets.map(([t,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.ndSec='1';
   b.onclick=()=>{view.querySelectorAll('.panel-b-selected').forEach(n=>n.classList.remove('panel-b-selected'));t.classList.add('panel-b-selected');t.scrollIntoView({block:'start',behavior:'smooth'});};return b;}));}
  // 명함·사업자등록증 are photos now; the old link fields stay in the form (values kept) but out of sight.
  for(const b of left.querySelectorAll('.panel-b-index:not(.nd-index-x) button'))if(/이미지 링크/.test(b.textContent))b.classList.add('nd-legacy');
  const q=left.querySelector('.panel-b-search'),sync=()=>extra.querySelectorAll('button').forEach(b=>b.hidden=!!q?.value.trim()&&!b.textContent.includes(q.value.trim()));
  if(q&&!q.dataset.ndX){q.dataset.ndX='1';q.addEventListener('input',sync);}sync();}
 function watchSettings(){const view=document.getElementById('view-settings');if(!view||view.dataset.ndWatch)return;view.dataset.ndWatch='1';new MutationObserver(settingsPolish).observe(view,{childList:true});settingsPolish();}

 /* 왼쪽 패널 규칙 (all list screens): the header band holds every control — [검색 · 늘어남] [필터] [＋].
    Below the 144 line: an optional 44px chip band, then only the list scrolls. Nothing moves when the list scrolls.
    Header controls proxy to the screen's own inputs/buttons (found at event time, so re-renders are safe);
    filter blocks move as-is into a popover so their handlers stay intact. */
 const ICON_SEARCH='<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',ICON_FILTER='<path d="M4 6h16M7 12h10M10 18h4"/>',ICON_PLUS='<path d="M12 5v14M5 12h14"/>';
 const TOOLS={
  materials:{search:'#view-materials .material-owners>input.panel-b-search',ph:'업체·자재 검색',add:[['자재 받음','#mm_new_receipt']],
   hide:['#view-materials .material-owners>input.panel-b-search','#view-materials #mm_new_receipt','#view-materials .material-owners-head'],count:'#view-materials .material-owners-head .hint'},
  payments:{search:'#paySearch',ph:'거래처·메모·견적번호',add:[['입금 기록 추가','#payInbound'],['출금 기록 추가','#payOutbound']],filter:'#view-payments .ops-filters>details.panel-b-more',
   chips:{select:'payFilter',host:'#view-payments .workspace-left',before:'#view-payments .workspace-left>.panel-b-index',items:[['','전체'],['수금','입금'],['지급','출금']]},hide:['#view-payments .ops-actions','#view-payments .ops-filters']},
  stock:{search:'#stockSearch',ph:'품목명·코드·색상·규격',add:[['입고 추가','#stockRegister'],['출고 추가','#stockOutbound'],['재고 조정','#stockAdjust']],filter:'#view-stock .stock-tools>details.panel-b-more',
   chips:{select:'stockFilter',host:'#view-stock .workspace-left',before:'#stockItems',items:[['all','전체'],['short','주문 부족'],['low','최소 미달'],['zero','품절']],mafter:'#view-stock>.page-head'},hide:['#view-stock .stock-tools']},
  items:{filter:'#view-items label.ops-category',hide:['#view-items .cols>.card>label.ops-category']},
  sales:{search:'#view-sales .workspace-left>input.panel-b-search',ph:'거래처 검색',filter:'#view-sales .workspace-left>.filter-bar,#view-sales>.filter-bar',period:['slFrom','slTo'],
   chips:{select:'slStatus',host:'#view-sales .workspace-left',before:'#view-sales .workspace-left>.panel-b-index',items:[['수주','수주만'],['all','모든 상태']],mafter:'#view-sales>.page-head'},hide:['#view-sales .workspace-left>input.panel-b-search','#view-sales .workspace-left>.filter-bar','#view-sales>.filter-bar']},
  ar:{search:'#view-ar .filter-bar input[type="search"]',ph:'거래처 검색',filterSelect:'#arFilter',
   chips:{select:'arView',host:'#view-ar .workspace-left',before:'#view-ar .workspace-left>.workspace-record-index',items:[['co','거래처별'],['quote','건별']],mafter:'#view-ar>.page-head'},hide:['#view-ar .workspace-left>.filter-bar','#view-ar>.filter-bar']},
  settings:{search:'#view-settings .workspace-left>input.panel-b-search',ph:'설정 검색',hide:['#view-settings .workspace-left>input.panel-b-search']}};
 let pop=null;
 function closePop(){if(pop){pop.el.remove();pop.btn.setAttribute('aria-expanded','false');pop.restore?.();pop=null;}}
 function openPop(btn,build,restore,title){if(pop&&pop.btn===btn){closePop();return;}closePop();
  // Same width as the tool row it opens from, right under it (like the receipt app's pickers).
  const el=document.createElement('div');el.className='nd-pop-panel';el.setAttribute('role','dialog');
  if(title){const h=document.createElement('div');h.className='nd-pop-hd';h.textContent=title;el.append(h);el.setAttribute('aria-label',title);}
  const body=document.createElement('div');body.className='nd-pop-body';el.append(body);build(body);(document.getElementById('appView')||document.body).append(el);
  const row=btn.parentElement.getBoundingClientRect(),w=Math.min(row.width,innerWidth-32);el.style.width=w+'px';
  el.style.left=Math.max(16,Math.min(row.left,innerWidth-w-16))+'px';el.style.top=(row.bottom+8)+'px';
  btn.setAttribute('aria-expanded','true');pop={el,btn,restore};}
 document.addEventListener('pointerdown',e=>{if(pop&&!pop.el.contains(e.target)&&!pop.btn.contains(e.target))closePop();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pop){const b=pop.btn;closePop();b.focus();}});
 const toolBtn=(icon,label,cls='')=>{const b=document.createElement('button');b.type='button';b.className='nd-tool '+cls;b.setAttribute('aria-label',label);b.title=label;b.innerHTML=svgI(icon);return b;};
 function tools(){
  const hide=[];
  for(const [view,c] of Object.entries(TOOLS)){
   hide.push(...(c.hide||[]));
   const head=document.querySelector(`#view-${view}>.page-head`);if(!head||(view!=='items'&&head.querySelector('.nd-tools')))continue;
   const row=view==='items'?document.querySelector('#view-items .list-head'):document.createElement('div');if(!row||row.querySelector('.nd-tool'))continue;
   if(view!=='items'){row.className='nd-tools';head.append(row);head.classList.add('nd-scope','nd-own-tools');}
   if(c.search){const lab=document.createElement('label');lab.className='nd-tsearch';lab.innerHTML=svgI(ICON_SEARCH);
    const input=document.createElement('input');input.type='search';input.placeholder=c.ph;input.setAttribute('aria-label',c.ph);lab.append(input);row.append(lab);
    const push=()=>{const o=document.querySelector(c.search);if(o&&o.value!==input.value){o.value=input.value;o.dispatchEvent(new Event('input',{bubbles:true}));}};
    input.addEventListener('input',push);
    const v=document.getElementById('view-'+view);new MutationObserver(()=>{const o=document.querySelector(c.search);if(o&&input.value&&o.value!==input.value)push();}).observe(v,{childList:true,subtree:true});}
   if(c.period){const b=document.createElement('button');b.type='button';b.className='nd-tperiod';row.append(b);
    const label=()=>{const [f,t]=c.period.map(id=>{const i=document.getElementById(id);const d=i?.parentElement?.querySelector('.date-control-display:not(.empty)');return i?.value||(d?.textContent.trim().replace(/\.\s*/g,'-').replace(/-$/,'').replace(/-(\d)(?=-|$)/g,'-0$1'))||'';});b.innerHTML=svgI('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>')+`<span>${f&&t?(f===t?f.replace(/-/g,'.'):f.replace(/-/g,'.')+' – '+t.slice(5).replace(/-/g,'.')):'기간 선택'}</span>`;};
    label();setTimeout(label,800);c.period.forEach(id=>document.getElementById(id)?.addEventListener('change',label));
    b.onclick=()=>{const block=document.querySelector(c.filter);if(!block)return;const mark=document.createComment('nd-filter');block.before(mark);
     openPop(b,el=>{el.classList.add('nd-pop-filter');el.append(block);},()=>{mark.replaceWith(block);label();},'기간 · 필터');};}
   if(c.filter&&!c.period){const b=toolBtn(ICON_FILTER,'필터');row.insertBefore(b,row.querySelector('.btn-add'));
    b.onclick=()=>{const block=document.querySelector(c.filter);if(!block)return;const mark=document.createComment('nd-filter');block.before(mark);if(block.tagName==='DETAILS')block.open=true;
     openPop(b,el=>{el.classList.add('nd-pop-filter');el.append(block);},()=>mark.replaceWith(block),'필터');};}
   if(c.filterSelect){const b=toolBtn(ICON_FILTER,'필터');row.append(b);
    b.onclick=()=>{const sel=document.querySelector(c.filterSelect);if(!sel)return;const mark=document.createComment('nd-filter');sel.before(mark);
     openPop(b,el=>{el.classList.add('nd-pop-filter');const l=document.createElement('label');l.className='nd-pop-field';l.textContent='표시';l.append(sel);el.append(l);},()=>mark.replaceWith(sel),'필터');};}
   if(c.add){const b=toolBtn(ICON_PLUS,c.add.length>1?'새 기록':c.add[0][0],'nd-tadd');row.append(b);
    b.onclick=()=>{if(c.add.length===1){document.querySelector(c.add[0][1])?.click();return;}
     openPop(b,el=>{el.classList.add('nd-pop-menu');for(const [l,sel] of c.add){const m=document.createElement('button');m.type='button';m.textContent=l;m.onclick=()=>{closePop();document.querySelector(sel)?.click();};el.append(m);}},null,'새로 만들기');};}
   if(c.count){const span=document.createElement('span');span.className='count nd-tcount';head.querySelector('h2')?.after(span);
    const upd=()=>{const t=document.querySelector(c.count)?.textContent.trim()||'';if(span.textContent!==t)span.textContent=t;};new MutationObserver(upd).observe(document.getElementById('view-'+view),{childList:true,subtree:true});upd();}
   if(c.chips){const {select:id,host:h,before:bf,items,mafter}=c.chips;const select=document.getElementById(id),host=document.querySelector(h),before=document.querySelector(bf);
    const row=(cls)=>{const chipRow=document.createElement('div');chipRow.className='nd-chips'+(cls?' '+cls:'');chipRow.setAttribute('role','group');chipRow.setAttribute('aria-label','빠른 필터');
     const sync=()=>chipRow.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===select.value)));
     for(const [v,l] of items){const x=document.createElement('button');x.type='button';x.dataset.v=v;x.textContent=l;x.onclick=()=>{if(select.value!==v){select.value=v;select.dispatchEvent(new Event('change',{bubbles:true}));}sync();};chipRow.append(x);}
     select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{childList:true,attributes:true});sync();return chipRow;};
    if(select&&host&&before&&!host.querySelector(':scope>.nd-chips'))before.before(row(''));
    // Phones hide the left panel these chips live in; a twin row sits under the header there.
    const ma=mafter&&document.querySelector(mafter);if(select&&ma&&!(ma.nextElementSibling?.classList.contains('nd-chips-m')))ma.after(row('nd-chips-m'));}
  }
  const utils=document.querySelector('#view-settings .workspace-left>.settings-utils'),idx=document.querySelector('#view-settings .workspace-left>.panel-b-index');
  if(utils&&idx&&idx.nextElementSibling!==utils)idx.after(utils);
  if(!document.getElementById('nd-tools-hide')){const st=document.createElement('style');st.id='nd-tools-hide';st.textContent=`@media screen{${hide.map(x=>'#appView '+x).join(',')}{display:none!important}}`;document.head.append(st);}
 }

 /* Detail-header eyebrow = the rail group of the screen (one vocabulary everywhere). */
 const EYEBROW={quotes:'업무',materials:'업무',payments:'업무',stock:'업무',companies:'기준정보',items:'기준정보',sales:'분석',ar:'분석',settings:'설정'};
 /* 재고 사이즈별 입력: one spreadsheet-style row (phone: list with − +). Writes the same stockQuickValues the
    original review step reads, so 변경 내용 확인 · stock math · saving are unchanged. */
 function stockMatrix(){
  const area=document.getElementById('stockQuickEntry'),grid=area?.querySelector(':scope>.stock-size-grid');
  // 입고/출고 as a segmented control over the original select.
  const kindSel=document.getElementById('ivKind');
  if(kindSel&&!kindSel.dataset.ndSeg){kindSel.dataset.ndSeg='1';const seg=document.createElement('div');seg.className='nd-kind';seg.setAttribute('role','radiogroup');seg.setAttribute('aria-label','입출고 구분');
   const sync=()=>seg.querySelectorAll('button').forEach(b=>{const on=b.dataset.v===kindSel.value;b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));});
   for(const o of kindSel.options){const b=document.createElement('button');b.type='button';b.dataset.v=o.value;b.textContent=o.textContent;b.setAttribute('role','radio');b.onclick=()=>{if(kindSel.value!==o.value){kindSel.value=o.value;kindSel.dispatchEvent(new Event('change',{bubbles:true}));}sync();};seg.append(b);}
   kindSel.classList.add('nd-kind-src');kindSel.after(seg);kindSel.addEventListener('change',sync);sync();}
  if(!area||!grid){area?.querySelector('.nd-sz')?.remove();if(area)delete area.dataset.ndKey;const ab=document.getElementById('ivAddBtn');if(ab?.dataset.ndLabel&&ab.textContent!==ab.dataset.ndLabel)ab.textContent=ab.dataset.ndLabel;return;}
  const item=db.items.find(i=>i.id===document.getElementById('ivItem')?.value),color=document.getElementById('ivColor')?.value||'';
  const specs=[...grid.querySelectorAll('input[data-stock-size]')].map(i=>i.getAttribute('aria-label').replace(/ 수량$/,''));
  const key=[item?.id,color,specs.join(',')].join('|');
  document.getElementById('stockQuickToggle')?.classList.add('nd-retired');grid.classList.add('nd-retired');
  if(area.dataset.ndKey===key&&area.querySelector('.nd-sz'))return;
  area.dataset.ndKey=key;area.querySelector('.nd-sz')?.remove();
  const cur=currentStocks(),now=s=>cur[stockKeyOf({item_id:item?.id,color,spec:s})]||0;
  const val=s=>{const v=String(stockQuickValues[s]??'').replace(/,/g,'').trim();return /^\d+(\.\d+)?$/.test(v)?Number(v):0;};
  const out=()=>kindSel?.value==='출고';
  const n=v=>(typeof fmt==='function'?fmt(v):String(v));
  const wrap=document.createElement('div');wrap.className='nd-sz';
  const bar=document.createElement('div');bar.className='nd-sz-bar';bar.innerHTML='<b>사이즈별 수량</b><button type="button" data-a="same">모두 같은 수량</button><button type="button" data-a="clear">지우기</button>';
  // Desktop table
  const t=document.createElement('table');t.className='nd-sz-table';
  t.innerHTML=`<thead><tr><th class="k"></th>${specs.map(s=>`<th>${escapeHtml(s)}</th>`).join('')}<th class="sum">합계</th></tr></thead><tbody>
   <tr class="now"><td class="k">현재</td>${specs.map(s=>`<td>${n(now(s))}</td>`).join('')}<td class="sum" data-now></td></tr>
   <tr class="qty"><td class="k" data-kind></td>${specs.map((s,i)=>`<td><input data-i="${i}" inputmode="numeric" autocomplete="off" aria-label="${escapeAttr(s)} 수량" placeholder="0" value="${escapeAttr(stockQuickValues[s]??'')}"></td>`).join('')}<td class="sum" data-total></td></tr>
   <tr class="after"><td class="k">변경 후</td>${specs.map((s,i)=>`<td data-after="${i}"></td>`).join('')}<td class="sum" data-aftersum></td></tr></tbody>`;
  // Phone list
  const list=document.createElement('div');list.className='nd-sz-list';
  list.innerHTML=specs.map((s,i)=>`<div class="nd-sz-row"><span class="sz">${escapeHtml(s)}</span><span class="cur">현재 ${n(now(s))} → <b data-after="${i}"></b></span><span class="step"><button type="button" data-step="-1" data-i="${i}" aria-label="${escapeAttr(s)} 1 빼기">−</button><input data-i="${i}" inputmode="numeric" autocomplete="off" aria-label="${escapeAttr(s)} 수량" placeholder="0" value="${escapeAttr(stockQuickValues[s]??'')}"><button type="button" data-step="1" data-i="${i}" aria-label="${escapeAttr(s)} 1 더하기">+</button></span></div>`).join('')+'<div class="nd-sz-total"><span>합계</span><b data-total></b></div>';
  wrap.append(bar,t,list);
  const tip=document.createElement('p');tip.className='nd-sz-tip';tip.innerHTML='<b>빠르게 입력</b> Enter·Tab 다음 사이즈 · ↑↓ 1씩 · 엑셀에서 한 줄 복사 후 붙여넣으면 사이즈별로 채워져요';wrap.append(tip);
  grid.before(wrap);
  const addBtn=document.getElementById('ivAddBtn');if(addBtn&&!addBtn.dataset.ndLabel)addBtn.dataset.ndLabel=addBtn.textContent;
  const set=(el,text,cls)=>{if(el.textContent!==text)el.textContent=text;if(cls!==undefined&&el.className!==cls)el.className=cls;};
  function update(){
   const sign=out()?-1:1;let total=0,nowSum=0,afterSum=0;
   specs.forEach((s,i)=>{const q=val(s),a=now(s)+sign*q;total+=q;nowSum+=now(s);afterSum+=a;
    wrap.querySelectorAll(`[data-after="${i}"]`).forEach(el=>set(el,n(a),a<0?'neg':q?'chg':''));
    wrap.querySelectorAll(`input[data-i="${i}"]`).forEach(inp=>{const v=String(stockQuickValues[s]??'');if(inp.value!==v&&document.activeElement!==inp)inp.value=v;});});
   wrap.querySelectorAll('[data-kind]').forEach(el=>set(el,out()?'출고':'입고'));
   wrap.querySelectorAll('[data-total]').forEach(el=>set(el,total?n(total)+'개':'0'));
   wrap.querySelectorAll('[data-now]').forEach(el=>set(el,n(nowSum)));wrap.querySelectorAll('[data-aftersum]').forEach(el=>set(el,n(afterSum)));
   if(addBtn){const label=addBtn.dataset.ndLabel+(total&&!wrap.classList.contains('compact')&&!matchMedia('(max-width:780px)').matches?` · ${n(total)}개`:'');if(addBtn.textContent!==label)addBtn.textContent=label;}
  }
  const put=(i,v)=>{if(i<0||i>=specs.length)return;stockQuickValues[specs[i]]=v===''||v==null?'':String(v);};
  wrap.addEventListener('input',e=>{const inp=e.target.closest('input[data-i]');if(!inp)return;const clean=inp.value.replace(/[^\d.]/g,'');if(clean!==inp.value)inp.value=clean;put(+inp.dataset.i,clean);update();});
  wrap.addEventListener('focusin',e=>{const inp=e.target.closest('input[data-i]');if(inp)requestAnimationFrame(()=>inp.select());});
  wrap.addEventListener('keydown',e=>{const inp=e.target.closest('input[data-i]');if(!inp||e.isComposing)return;const i=+inp.dataset.i,box=inp.closest('table,.nd-sz-list');
   if(e.key==='Enter'){e.preventDefault();const next=box.querySelector(`input[data-i="${i+1}"]`);(next||document.getElementById('ivMemo'))?.focus();}
   else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const v=Math.max(0,val(specs[i])+(e.key==='ArrowUp'?1:-1));put(i,v||'');inp.value=String(stockQuickValues[specs[i]]);update();inp.select();}});
  wrap.addEventListener('paste',e=>{const inp=e.target.closest('input[data-i]');if(!inp)return;const text=(e.clipboardData||window.clipboardData)?.getData('text')||'';
   const cells=text.trim().split(/[\t\n\r,;]+|\s{2,}|\s/).map(x=>x.replace(/,/g,'').trim());if(cells.length<2)return;e.preventDefault();
   const start=+inp.dataset.i;cells.forEach((c,k)=>put(start+k,/^\d+(\.\d+)?$/.test(c)?c:''));update();
   wrap.querySelectorAll('input[data-i]').forEach(x=>x.value=String(stockQuickValues[specs[+x.dataset.i]]??''));typeof toast==='function'&&toast(`${Math.min(cells.length,specs.length-start)}개 사이즈에 붙여넣었어요`);});
  wrap.addEventListener('click',e=>{const st=e.target.closest('[data-step]');if(st){const i=+st.dataset.i;put(i,Math.max(0,val(specs[i])+ +st.dataset.step)||'');update();wrap.querySelectorAll(`input[data-i="${i}"]`).forEach(x=>x.value=String(stockQuickValues[specs[i]]??''));return;}
   const a=e.target.closest('[data-a]')?.dataset.a;if(!a)return;
   if(a==='clear'){specs.forEach((s,i)=>put(i,''));wrap.querySelectorAll('input[data-i]').forEach(x=>x.value='');update();return;}
   const focused=document.activeElement?.closest?.('.nd-sz input[data-i]');const base=focused?val(specs[+focused.dataset.i]):(specs.map(val).find(v=>v>0)||0);
   if(!base){typeof toast==='function'&&toast('한 칸에 수량을 넣은 뒤 누르면 모든 사이즈에 같은 수량이 들어가요');wrap.querySelector('input[data-i]')?.focus();return;}
   specs.forEach((s,i)=>put(i,base));wrap.querySelectorAll('input[data-i]').forEach(x=>x.value=String(base));update();});
  if(kindSel&&!kindSel.dataset.ndSz){kindSel.dataset.ndSz='1';kindSel.addEventListener('change',()=>{const w=document.querySelector('#stockQuickEntry .nd-sz');w&&w.dispatchEvent(new Event('nd-update'));});}
  wrap.addEventListener('nd-update',update);
  // Too narrow for one row of comfortable cells (≥56px each) → the list layout with − + (same inputs, same state).
  const fit=()=>{const c=wrap.clientWidth>0&&wrap.clientWidth<specs.length*56+156;if(wrap.classList.contains('compact')!==c)wrap.classList.toggle('compact',c);};
  try{new ResizeObserver(fit).observe(wrap);}catch{}fit();
  update();
 }
 /* 기간 칩 — one period control for every filter (견적서 · 입금출금 · 매출): [전체][이번 달][지난 달][올해].
    Each chip sets the screen's own date inputs and fires their change event, so each screen filters as before;
    the date inputs stay below for a custom range. The chip matching the current range is highlighted. */
 function periodPresets(){
  const pad=n=>String(n).padStart(2,'0'),ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today=new Date(),y=today.getFullYear(),m=today.getMonth();
  const ranges={month:[ymd(new Date(y,m,1)),ymd(today)],prev:[ymd(new Date(y,m-1,1)),ymd(new Date(y,m,0))],year:[ymd(new Date(y,0,1)),ymd(today)]};
  const ym=d=>d.slice(0,7);
  const earliest=()=>{const ds=(db.quotes||[]).map(q=>q.date).filter(Boolean).sort();return ds[0]||ymd(new Date(y-5,0,1));};
  const fire=id=>{const el=document.getElementById(id);el&&el.dispatchEvent(new Event('change',{bubbles:true}));};
  const setv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  const screens=[
   {host:'#view-sales .filter-bar',before:'#slFrom',
    now(){const f=document.getElementById('slFrom')?.value,t=document.getElementById('slTo')?.value;return {f,t,all:f===earliest()&&t===ranges.month[1]};},
    apply(k){const [f,t]=k==='all'?[earliest(),ymd(today)]:ranges[k];setv('slFrom',f);setv('slTo',t);fire('slFrom');}},
   {host:'#view-quotes .quote-filters',before:'.quote-period-row',
    now(){const f=document.getElementById('qtFrom')?.value||'',t=document.getElementById('qtTo')?.value||'';return {f,t,all:!f&&!t};},
    apply(k){if(k==='all'){document.getElementById('qtAllDates')?.click();return;}const [f,t]=ranges[k];setv('qtFrom',f);setv('qtTo',t);fire('qtFrom');fire('qtTo');}},
   {host:'#payPeriod',hostUp:true,before:null,
    now(){const p=document.getElementById('payPeriod')?.value,mo=document.getElementById('payMonth')?.value,f=document.getElementById('payFrom')?.value,t=document.getElementById('payTo')?.value;
     return p==='all'?{all:true}:p==='month'?{f:mo+'-01',t:mo===ym(ranges.month[0])?ranges.month[1]:mo===ym(ranges.prev[0])?ranges.prev[1]:'',month:mo}:{f,t};},
    apply(k){if(k==='all'){setv('payPeriod','all');fire('payPeriod');return;}
     if(k==='year'){setv('payPeriod','range');setv('payFrom',ranges.year[0]);setv('payTo',ranges.year[1]);fire('payPeriod');return;}
     setv('payPeriod','month');setv('payMonth',ym(ranges[k][0]));fire('payPeriod');}}
  ];
  for(const sc of screens){
   let host=document.querySelector(sc.host);if(!host)continue;
   if(sc.hostUp)host=host.closest('label')?.parentElement;if(!host)continue;
   let row=host.querySelector(':scope>.nd-period');
   if(!row){row=document.createElement('div');row.className='nd-period';row.setAttribute('role','group');row.setAttribute('aria-label','기간');
    row.innerHTML='<span class="nd-period-l">기간</span>'+[['all','전체'],['month','이번 달'],['prev','지난 달'],['year','올해']].map(([k,l])=>`<button type="button" data-p="${k}">${l}</button>`).join('');
    row.addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;sc.apply(b.dataset.p);requestAnimationFrame(()=>periodPresets());});
    const ref=sc.hostUp?document.getElementById('payPeriod').closest('label'):(sc.before?host.querySelector(sc.before):null);
    const anchorEl=ref&&ref.parentElement===host?ref:ref?.closest(`${sc.host}>*`)||null;
    anchorEl?anchorEl.before(row):host.prepend(row);}
   if(sc.hostUp){const lb=document.getElementById('payPeriod')?.closest('label'),tn=lb&&[...lb.childNodes].find(c=>c.nodeType===3&&c.textContent.trim());if(tn&&tn.textContent.trim()!=='직접 지정')tn.textContent='직접 지정';}
   if(sc.host.includes('quote')){const rg=host.querySelector('.naro-period-selector>button:not(#qtAllDates)');if(rg&&rg.parentElement!==row){rg.classList.add('nd-period-custom');rg.textContent='직접 선택';row.append(rg);}}
   const c=sc.now();let on='';
   if(c.all)on='all';else for(const k of ['month','prev','year'])if(c.f===ranges[k][0]&&(c.t===ranges[k][1]||(k==='month'&&c.month===ym(ranges.month[0]))))on=k;
   row.querySelectorAll('button').forEach(b=>{const v=b.dataset.p===on;if(b.classList.contains('on')!==v)b.classList.toggle('on',v);if(b.getAttribute('aria-pressed')!==String(v))b.setAttribute('aria-pressed',String(v));});
  }
 }
 /* 월별 매출·입금 짚어 보기 (영수증 앱 지출 추이와 같은 방식): 차트 위에 마우스를 대거나 손가락으로 밀면
    그 달에 얇은 세로선이 생기고, 범례 자리에 '9월 · 매출 N원 · 입금 N원'이 나온다. 떼면 범례로 돌아간다. */
 function dashHover(){
  const chart=document.getElementById('dashChart');if(!chart)return;
  chart.querySelectorAll('.cbar[title]').forEach(b=>{b.dataset.v=b.getAttribute('title');b.removeAttribute('title');});
  if(chart.dataset.ndHover)return;chart.dataset.ndHover='1';
  const head=chart.parentElement?.querySelector('.card-head');const legend=head?.querySelector('.legend');if(!legend)return;
  const note=document.createElement('div');note.className='nd-chd';note.setAttribute('aria-live','polite');note.hidden=true;legend.after(note);
  const cur=document.createElement('i');cur.className='nd-ccur';cur.hidden=true;
  let last=null;
  const pick=x=>{const gs=[...chart.querySelectorAll('.cgroup')];let best=null,bd=1e9;for(const g of gs){const r=g.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-x);if(d<bd){bd=d;best=g;}}return best;};
  const show=e=>{const g=pick(e.clientX);if(!g)return;if(g===last)return;last?.classList.remove('nd-con');last=g;g.classList.add('nd-con');
   if(cur.parentElement!==chart)chart.append(cur);
   const cr=chart.getBoundingClientRect(),gr=g.getBoundingClientRect(),bars=g.querySelector('.cbars')?.getBoundingClientRect()||gr;
   cur.style.left=(gr.left-cr.left+gr.width/2)+'px';cur.style.top=(bars.top-cr.top)+'px';cur.style.height=bars.height+'px';cur.hidden=false;
   const label=g.querySelector('.clabel')?.textContent.trim()||'';const v=k=>(g.querySelector('.cbar.'+k)?.dataset.v||'').replace(/^\S+\s*/,'');
   note.innerHTML='';const b=document.createElement('b');b.textContent=label;const sp=(c,t)=>{const x=document.createElement('span');x.className=c;x.textContent=t;return x;};note.append(b,' · ',sp('s','매출 '+v('sale')),' · ',sp('i','입금 '+v('in')));
   note.hidden=false;legend.hidden=true;chart.classList.add('nd-chov');};
  const hide=()=>{last?.classList.remove('nd-con');last=null;cur.hidden=true;note.hidden=true;legend.hidden=false;chart.classList.remove('nd-chov');};
  chart.addEventListener('pointermove',show);chart.addEventListener('pointerdown',show);
  chart.addEventListener('pointerleave',hide);chart.addEventListener('pointercancel',hide);chart.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')hide();});
 }
 /* 레일 아이콘: 매출 집계 = 막대 그래프, 받을 금액 = 지갑 (달력·시계는 뜻과 안 맞아서). 레일·모바일 더보기 공통. */
 function navIcons(){
  const icons={sales:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-4"/><path d="M13 17V9"/><path d="M18 17V5"/>',
   ar:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'};
  for(const [v,d] of Object.entries(icons))document.querySelectorAll(`#appView [data-view="${v}"] svg:not([data-nd-icon])`).forEach(svg=>{svg.innerHTML=d;svg.setAttribute('data-nd-icon',v);});
 }
 /* 업체 제공 자재 — 폰(≤780px): 목록 → 상세 두 단계. 상세는 [‹ 업체 제공 자재][⋯ 기준일·재고내역서] · 업체명 · 자재 칩 · 남은 수량 ·
    그래프 · 기록, 아래에 [− N +][N개 사용 기록][+] 고정. [+]·기록 줄은 아래에서 올라오는 기록 창(원래 상세 입력 폼)을 연다.
    원래 화면의 버튼·폼을 그대로 쓰고 위치·모양만 바꾼다. PC는 그대로(자재 칩 모양·폼 버튼 순서만 공통). */
 const MM_PHONE=matchMedia('(max-width:780px)');let mmVoid=null;
 function materialsMobile(){
  const view=document.getElementById('view-materials'),root=document.getElementById('materialContent');if(!view||!root)return;
  if(!view.dataset.ndMm){view.dataset.ndMm='1';
   const setOpen=v=>{view.classList.toggle('nd-mm-open',v);view.classList.toggle('mobile-record-open',v);};
   view.addEventListener('click',e=>{if(!MM_PHONE.matches)return;
    if(e.target.closest('.material-owner')){setOpen(true);requestAnimationFrame(()=>{view.scrollTop=0;});return;}
    if(e.target.closest('.nd-mm-back')){setOpen(false);return;}
    const vb=e.target.closest('.nd-mm-void');if(vb){const id=vb.dataset.id;mmVoid=null;view.querySelector(`[data-mm-void="${CSS.escape(id)}"]`)?.click();return;}
    const rec=e.target.closest('.material-record');if(rec&&!e.target.closest('button,a,input,select')){const ed=rec.querySelector('[data-mm-edit]');if(ed){mmVoid=ed.dataset.mmEdit;ed.click();requestAnimationFrame(materialsMobile);}}});
   MM_PHONE.addEventListener('change',()=>setOpen(false));}
  const detail=root.querySelector('.material-detail'),head=detail?.querySelector('.material-detail-head'),ctl=detail?.querySelector('.material-statement-controls');
  if(!detail||!head)return;
  if(MM_PHONE.matches){
   let bar=detail.querySelector(':scope>.nd-mm-bar');
   if(!bar){bar=document.createElement('div');bar.className='nd-mm-bar';
    bar.innerHTML='<button type="button" class="nd-mm-back">‹ 업체 제공 자재</button><details class="nd-mm-more"><summary aria-label="더보기"></summary><div class="nd-mm-pop"></div></details>';
    detail.prepend(bar);const more=bar.querySelector('details');document.addEventListener('click',e=>{if(more.open&&!more.contains(e.target))more.open=false;});}
   const pop=bar.querySelector('.nd-mm-pop');if(ctl&&ctl.parentElement!==pop)pop.append(ctl);
   const dIn=pop.querySelector('input[type="date"]');let asof=head.querySelector('.nd-mm-asof');
   if(!asof){asof=document.createElement('div');asof.className='nd-mm-asof';head.querySelector('h3')?.after(asof);}
   const v=dIn?.value||'';const t=new Date();const td=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
   const txt=v?`${v===td?'오늘(':''}${+v.slice(5,7)}월 ${+v.slice(8,10)}일${v===td?')':''} 기준`:'';if(asof.textContent!==txt)asof.textContent=txt;
  }else{const pop=detail.querySelector('.nd-mm-pop');if(ctl&&pop&&ctl.parentElement===pop)head.append(ctl);}
  // 기록 창: 구분을 칩으로 (원래 select를 바꾸고 change를 보낸다)
  const kind=document.getElementById('mm_kind'),card=document.getElementById('materialEntryCard');
  if(kind&&card){const field=kind.closest('.field');let chips=card.querySelector('.nd-mm-kind');
   if(!chips){chips=document.createElement('div');chips.className='nd-kind nd-mm-kind';chips.setAttribute('role','group');chips.setAttribute('aria-label','기록 구분');
    chips.innerHTML=[...kind.options].map(o=>`<button type="button" data-v="${o.value.replace(/"/g,'&quot;')}">${o.value==='작업 완료'?'사용':o.textContent.replace('/','·')}</button>`).join('');
    chips.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=document.getElementById('mm_kind');if(k.value!==b.dataset.v){k.value=b.dataset.v;k.dispatchEvent(new Event('change',{bubbles:true}));k.dispatchEvent(new Event('input',{bubbles:true}));}requestAnimationFrame(materialsMobile);});
    (field?.closest('.grid2')||field)?.before(chips);field?.classList.add('nd-mm-kindsrc');}
   chips.querySelectorAll('button').forEach(b=>{const on=b.dataset.v===kind.value;if(b.classList.contains('on')!==on)b.classList.toggle('on',on);});
   const actions=card.querySelector('.material-form-actions');let vb=actions?.querySelector('.nd-mm-void');
   if(card.hidden){mmVoid=null;}
   if(mmVoid&&!card.hidden&&actions&&MM_PHONE.matches){if(!vb){vb=document.createElement('button');vb.type='button';vb.className='btn ghost nd-mm-void';vb.textContent='기록 취소';actions.prepend(vb);}if(vb.dataset.id!==mmVoid)vb.dataset.id=mmVoid;}
   else if(vb)vb.remove();}
 }
 /* 색 정의에 맞춘 꼬리표 이름: 재고 '조정' = 청록, '부분납품' = 앰버, 대시보드 '예상 이익' = 청록. (원래 화면은 in/out만 구분) */
 function colorTags(){
  document.querySelectorAll('#appView .pill:not(.adj)').forEach(p=>{const t=p.textContent.trim();if(t==='조정'||t==='재고 조정')p.classList.add('adj');});
  document.querySelectorAll('#appView .pill.st-sent:not(.st-partial)').forEach(p=>{if(p.textContent.trim()==='부분납품')p.classList.add('st-partial');});
  document.querySelectorAll('#appView #view-dash .k').forEach(k=>{if(/예상 (이익|마진)/.test(k.textContent)){const v=k.nextElementSibling;if(v&&!v.classList.contains('nd-profit'))v.classList.add('nd-profit');}});
 }
 /* 재고 — 폰(≤780px): 목록 → 상세. 상세 = [‹ 재고] 품목명 · 옵션 표(한 줄에 한 옵션) · 최근 입출고, 아래 [입고][출고][조정] 고정.
    입력 폼(원래 '재고 입력' 카드)은 아래에서 올라오는 창. 원래 버튼·폼을 그대로 쓰고 위치·모양만 바꾼다. */
 const ST_PHONE=matchMedia('(max-width:780px)');let stSheet=false;
 function stockMobile(){
  const view=document.getElementById('view-stock');if(!view)return;const cards=view.querySelectorAll(':scope>.cols>.card');const detail=cards[1];if(!detail)return;
  if(!view.dataset.ndSt){view.dataset.ndSt='1';
   const setOpen=v=>{view.classList.toggle('nd-st-open',v);view.classList.toggle('mobile-record-open',v);};
   // 품목 줄은 원래 화면이 눌린 즉시 다시 그리므로(눌린 요소가 사라짐) 캡처 단계에서 먼저 잡는다.
   view.addEventListener('click',e=>{if(!ST_PHONE.matches)return;if(e.target.closest('#stockItems>.stock-item')){stSheet=false;setOpen(true);requestAnimationFrame(()=>{view.scrollTop=0;stockMobile();});}},true);
   view.addEventListener('click',e=>{if(!ST_PHONE.matches)return;
    if(e.target.closest('.nd-st-back')){stSheet=false;setOpen(false);requestAnimationFrame(stockMobile);return;}
    const a=e.target.closest('.nd-st-act [data-go]');if(a){stSheet=true;document.getElementById(a.dataset.go)?.click();requestAnimationFrame(stockMobile);}});
   ST_PHONE.addEventListener('change',()=>setOpen(false));}
  let bar=detail.querySelector(':scope>.nd-st-bar');
  if(!bar){bar=document.createElement('div');bar.className='nd-st-bar';bar.innerHTML='<button type="button" class="nd-st-back">‹ 재고</button><b class="nd-st-title"></b>';detail.prepend(bar);}
  const sel=view.querySelector('#stockItems>.stock-item.selected>span:first-child,#stockItems>.stock-item.selected');
  const name=(sel?.firstChild?.textContent||sel?.textContent||'').trim().replace(/\s+/g,' ').slice(0,40);const tt=bar.querySelector('.nd-st-title');if(tt.textContent!==name)tt.textContent=name;
  let act=detail.querySelector(':scope>.nd-st-act');
  if(!act){act=document.createElement('div');act.className='nd-st-act';act.innerHTML='<button type="button" data-go="stockRegister" class="p">입고</button><button type="button" data-go="stockOutbound">출고</button><button type="button" data-go="stockAdjust">조정</button>';detail.append(act);}
  // 입력 창은 아래 바의 [입고][출고][조정]으로 열었을 때만 시트로 띄운다(품목을 고르면 원래 화면이 폼을 자동으로 펴기 때문).
  const add=detail.querySelector(':scope>.stock-add');const formOn=!!(add&&!add.hidden&&getComputedStyle(add).display!=='none'||add&&view.classList.contains('nd-st-sheet')&&!add.hidden);
  if(!add||add.hidden)stSheet=false;const open=ST_PHONE.matches&&stSheet&&!!add&&!add.hidden;
  if(view.classList.contains('nd-st-sheet')!==open)view.classList.toggle('nd-st-sheet',open);
 }
 function eyebrows(){for(const [v,t] of Object.entries(EYEBROW))document.querySelectorAll(`#view-${v} :is(.workspace-heading,.panel-b-empty-heading)>.workspace-caption`).forEach(c=>{if(c.textContent!==t)c.textContent=t;});}
 function v5(){railDocs();chips();actions();watchMaterials();retireCsv();supplierAddress();watchSettings();tools();
  const roots=['coForm','itForm','qtForm'].map(id=>document.getElementById(id)).filter(Boolean);
  if(roots.length){const mo=new MutationObserver(()=>{mo.disconnect();actions();roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));});roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));}}
 // Screens are (re)built after sign-in and on every render: re-apply the idempotent layout passes each frame something changes.
 let v5Queued=false;
 const v5Again=()=>{if(v5Queued)return;v5Queued=true;requestAnimationFrame(()=>{v5Queued=false;try{railDocs();chips();actions();retireCsv();supplierAddress();settingsPolish();tools();stockMatrix();periodPresets();dashHover();navIcons();materialsMobile();colorTags();stockMobile();watchMaterials();watchSettings();eyebrows();}catch(e){}});};
 const v5Watch=()=>{const main=document.querySelector('#appView');if(main&&!main.dataset.ndV5){main.dataset.ndV5='1';new MutationObserver(v5Again).observe(main,{childList:true,subtree:true});}};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{v5();v5Watch();}):(v5(),v5Watch());
 desk.addEventListener?.('change',scope);
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',scope):scope();
 document.readyState==='complete'?darkAuto():addEventListener('load',darkAuto,{once:true});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
