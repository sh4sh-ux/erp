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
  const tools=foot?.querySelector('.rail-tools');if(tools&&!tools.querySelector('.nd-menu')){const menu=document.createElement('div');menu.className='nd-menu';tools.querySelectorAll(':scope>.rail-act').forEach(a=>menu.append(a));tools.append(menu);
   tools.querySelector('summary')?.setAttribute('aria-label','더보기');document.addEventListener('click',e=>{if(tools.open&&!tools.contains(e.target))tools.open=false;});}
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
   if(menu.closest('#qtForm'))for(const id of ['qtMailBtn','qtCopyBtn']){const b=document.getElementById(id);if(b&&b.parentElement!==pop)pop.prepend(b);}
   menu.querySelectorAll(':scope>.btn').forEach(b=>pop.append(b));
   if(!menu.dataset.ndBound){menu.dataset.ndBound='1';document.addEventListener('click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
    pop.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});}}}

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
 function watchMaterials(){const root=document.getElementById('materialContent');if(!root||root.dataset.ndWatch)return;root.dataset.ndWatch='1';new MutationObserver(materialGraph).observe(root,{childList:true});materialGraph();}

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
 addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='NARO_POSTCODE'||!addrWin||e.source!==addrWin)return;const done=addrDone;addrWin=addrDone=null;done?.(String(e.data.address||'').slice(0,200));});
 function addressWindow(btn,done){
  const w=Math.min(520,screen.availWidth||520),h=Math.min(680,screen.availHeight||680);
  addrWin=window.open(new URL('/postcode.html?theme='+(document.documentElement.dataset.theme==='dark'?'dark':'light'),location.href).href,'naro-postcode',`popup=yes,width=${w},height=${h},left=${Math.max(0,((screen.availWidth||w)-w)/2)},top=${Math.max(0,((screen.availHeight||h)-h)/2)}`);
  addrDone=done;
  if(!addrWin){typeof window.toast==='function'&&window.toast('팝업이 막혀 주소 검색 창을 열지 못했습니다. 팝업을 허용하거나 주소를 직접 입력해 주세요.');return;}
  addrWin.focus();}
 // 거래처 주소 검색 uses the same window (the app binds #coAddressSearch to this global on each render).
 window.openCompanyAddressSearch=function(){const address=document.getElementById('f_address'),detail=document.getElementById('f_address_detail'),btn=document.getElementById('coAddressSearch');
  addressWindow(btn,v=>{if(address?.isConnected){address.value=v;address.dispatchEvent(new Event('input',{bubbles:true}));}detail?.isConnected&&detail.focus();});};
 function supplierAddress(){
  const input=document.getElementById('st_address');if(!input||input.dataset.ndAddr)return;input.dataset.ndAddr='1';
  const wrap=document.createElement('div');wrap.className='nd-addr';input.before(wrap);wrap.append(input);
  const b=document.createElement('button');b.type='button';b.className='nd-addr-btn';b.innerHTML=svgI('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')+'<span>주소 검색</span>';wrap.append(b);
  input.placeholder='[주소 검색]으로 찾거나 직접 입력';
  // 상세 주소 gets its own box like 거래처; on save it joins the base address (the record keeps one address field).
  const detail=document.createElement('input');detail.id='nd_address_detail';detail.type='text';detail.autocomplete='address-line2';detail.placeholder='상세 주소 (동·층·호수)';detail.setAttribute('aria-label','상세 주소');detail.className='nd-addr-detail';wrap.after(detail);
  b.onclick=()=>addressWindow(b,v=>{input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));detail.value='';detail.focus();});
  document.addEventListener('click',e=>{if(!e.target.closest?.('#stSaveBtn'))return;const d=detail.value.trim();if(d){input.value=(input.value.trim()+' '+d).trim();detail.value='';}},true);}


 /* 공급자 정보: the personal-cloud image panel gets the app's form styling; legacy link fields say what they are now. */
 function settingsPolish(){
  const view=document.getElementById('view-settings');if(!view)return;
  for(const sec of view.querySelectorAll('section.card')){const h=sec.querySelector(':scope>h3');if(h&&h.textContent.trim()==='개인 클라우드 이미지'&&!sec.classList.contains('nd-assets')){sec.classList.add('nd-assets');
   const btns=sec.querySelectorAll(':scope>button');btns[0]?.classList.add('nd-assets-up');btns[1]?.classList.add('nd-assets-view');
   const row=document.createElement('div');row.className='nd-assets-row';sec.querySelector(':scope>select')?.before(row);row.append(...sec.querySelectorAll(':scope>select,:scope>button'));}}
  for(const [id,label] of [['st_card_url','명함'],['st_cert_url','사업자등록증']]){const hint=document.getElementById(id)?.closest('.field')?.querySelector('.hint');
   if(hint&&!hint.dataset.nd){hint.dataset.nd='1';hint.textContent=`예전 방식(링크)입니다. 지금 '${label} 보내기'는 아래 '개인 클라우드 이미지'에 저장한 이미지를 보냅니다.`;}}}
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
   chips:{select:'stockFilter',host:'#view-stock .workspace-left',before:'#stockItems',items:[['all','전체'],['short','주문 부족'],['low','최소 미달'],['zero','품절']]},hide:['#view-stock .stock-tools']},
  items:{filter:'#view-items label.ops-category',hide:['#view-items .cols>.card>label.ops-category']},
  sales:{search:'#view-sales .workspace-left>input.panel-b-search',ph:'거래처 검색',filter:'#view-sales .workspace-left>.filter-bar',period:['slFrom','slTo'],
   chips:{select:'slStatus',host:'#view-sales .workspace-left',before:'#view-sales .workspace-left>.panel-b-index',items:[['수주','수주만'],['all','모든 상태']]},hide:['#view-sales .workspace-left>input.panel-b-search','#view-sales .workspace-left>.filter-bar']},
  ar:{search:'#view-ar .filter-bar input[type="search"]',ph:'거래처 검색',filterSelect:'#arFilter',
   chips:{select:'arView',host:'#view-ar .workspace-left',before:'#view-ar .workspace-left>.workspace-record-index',items:[['co','거래처별'],['quote','건별']]},hide:['#view-ar .workspace-left>.filter-bar']},
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
   if(c.chips){const {select:id,host:h,before:bf,items}=c.chips;const select=document.getElementById(id),host=document.querySelector(h),before=document.querySelector(bf);
    if(select&&host&&before&&!host.querySelector(':scope>.nd-chips')){const chipRow=document.createElement('div');chipRow.className='nd-chips';chipRow.setAttribute('role','group');chipRow.setAttribute('aria-label','빠른 필터');
     const sync=()=>chipRow.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===select.value)));
     for(const [v,l] of items){const x=document.createElement('button');x.type='button';x.dataset.v=v;x.textContent=l;x.onclick=()=>{if(select.value!==v){select.value=v;select.dispatchEvent(new Event('change',{bubbles:true}));}sync();};chipRow.append(x);}
     before.before(chipRow);select.addEventListener('change',sync);new MutationObserver(sync).observe(before,{childList:true});sync();}}
  }
  const utils=document.querySelector('#view-settings .workspace-left>.settings-utils'),idx=document.querySelector('#view-settings .workspace-left>.panel-b-index');
  if(utils&&idx&&idx.nextElementSibling!==utils)idx.after(utils);
  if(!document.getElementById('nd-tools-hide')){const st=document.createElement('style');st.id='nd-tools-hide';st.textContent=`@media screen{${hide.map(x=>'#appView '+x).join(',')}{display:none!important}}`;document.head.append(st);}
 }
 function v5(){railDocs();chips();actions();watchMaterials();retireCsv();supplierAddress();watchSettings();tools();
  const roots=['coForm','itForm','qtForm'].map(id=>document.getElementById(id)).filter(Boolean);
  if(roots.length){const mo=new MutationObserver(()=>{mo.disconnect();actions();roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));});roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));}}
 // Screens are (re)built after sign-in and on every render: re-apply the idempotent layout passes each frame something changes.
 let v5Queued=false;
 const v5Again=()=>{if(v5Queued)return;v5Queued=true;requestAnimationFrame(()=>{v5Queued=false;try{railDocs();chips();actions();retireCsv();supplierAddress();settingsPolish();tools();watchMaterials();watchSettings();}catch(e){}});};
 const v5Watch=()=>{const main=document.querySelector('#appView');if(main&&!main.dataset.ndV5){main.dataset.ndV5='1';new MutationObserver(v5Again).observe(main,{childList:true,subtree:true});}};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{v5();v5Watch();}):(v5(),v5Watch());
 desk.addEventListener?.('change',scope);
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',scope):scope();
 document.readyState==='complete'?darkAuto():addEventListener('load',darkAuto,{once:true});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
