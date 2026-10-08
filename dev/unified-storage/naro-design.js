/* NARO company ledger groups — display only; never persist or infer quote links. */
const NaroCompanyLedger=(()=>{
 const text=v=>String(v??'');
 const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const amount=v=>Number.isFinite(Number(v))?Number(v):0;
 const money=v=>amount(v).toLocaleString('ko-KR');
 const latest=events=>events.map(e=>e.date).filter(Boolean).sort().at(-1)||'';
 function rows(data,cid,helpers){
  const quotes=data.quotes||[],payments=data.payments||[],counts=new Map(),groups=[],byId=new Map(),separate=[];
  for(const q of quotes)if(q.id)counts.set(q.id,(counts.get(q.id)||0)+1);
  quotes.forEach((q,index)=>{
   if(q.company_id!==cid)return;
   const deliveries=(q.deliveries||[]).map(d=>{
    const lines=helpers.deliveredLines(q,d),names=lines.map(l=>l.name).filter(Boolean);
    return {date:d.date||q.delivered_at||'',ts:d.created_at||'',kind:'납품',amount:helpers.total(lines),description:names.length?names[0]+(names.length>1?` 외 ${names.length-1}건`:''):'납품',memo:d.memo||''};
   });
   const group={type:'quote',key:'q:'+index,no:q.no||'견적번호 없음',deliveries,payments:[],quoteTotal:helpers.quoteAmount(q),full:helpers.fullyDelivered(q)};
   groups.push(group);
   // Duplicate/missing IDs are never used to associate a payment, even if numbers/amounts match.
   if(q.id&&counts.get(q.id)===1)byId.set(q.id,group);
  });
  payments.forEach((p,index)=>{
   if(p.company_id!==cid||p.void_at)return;
   const event={date:p.date||'',ts:p.created_at||'',kind:p.kind==='수금'?'입금':p.kind==='지급'?'출금':p.kind||'입출금',amount:amount(p.amount),description:p.method||'',memo:p.memo||''};
   const group=p.quote_id&&byId.get(p.quote_id);
   if(group&&p.kind==='수금'&&Number.isFinite(Number(p.amount))&&Number(p.amount)>0){group.payments.push(event);return;}
   if(group&&p.kind==='수금')group.review=true;
   separate.push({type:'payment',key:'p:'+index,event,no:group?.no||'',linked:!!group,hasReference:!!p.quote_id,date:event.date});
  });
  return [...groups.filter(g=>g.deliveries.length||g.payments.length).map(g=>{
   const delivered=g.deliveries.reduce((s,e)=>s+e.amount,0),paid=g.payments.reduce((s,e)=>s+e.amount,0),balance=delivered-paid;
   const hasDelivery=g.deliveries.length>0,hasPayment=g.payments.length>0;
   let status,tone='neutral';
   if(!hasDelivery){status=paid>g.quoteTotal?'초과 입금 · 납품 전':'선입금 · 납품 전';tone='warning';}
   else if(g.full&&hasPayment&&balance===0){status='납품·입금 완료';tone='complete';}
   else {
    const delivery=g.full?'납품 완료':'부분 납품';
    const payment=!hasPayment?'입금 없음':paid>g.quoteTotal?'초과 입금':balance<0?(g.full?'초과 입금':'선입금 포함'):balance===0?'납품분 입금 완료':'부분 입금';
    status=delivery+' · '+payment;tone=hasPayment?'warning':'neutral';
   }
   if(g.review){status='별도 입금 내역 확인 필요';tone='warning';}
   return {...g,delivered,paid,balance,status,tone,amount:hasDelivery?delivered:paid,date:latest(g.deliveries)||latest(g.payments),events:[...g.deliveries,...g.payments].sort((a,b)=>text(a.date).localeCompare(text(b.date))||text(a.ts).localeCompare(text(b.ts)))};
  }),...separate].sort((a,b)=>text(b.date).localeCompare(text(a.date))||a.key.localeCompare(b.key));
 }
 const value=n=>`<span class="nd-cl-number">${escape(money(n))}<small>원</small></span>`;
 function html(entries){
  const quotes=entries.filter(e=>e.type==='quote').length,other=entries.length-quotes;
  const count=[quotes?`견적 ${quotes}건`:'',other?`별도 입출금 ${other}건`:''].filter(Boolean).join(' · ')||'0건';
  const eventHtml=e=>`<div class="nd-cl-event"><div><span>${escape(e.date||'날짜 없음')} · ${escape(e.kind)}</span>${e.description?`<small>${escape(e.description)}</small>`:''}${e.memo?`<small>${escape(e.memo)}</small>`:''}</div>${value(e.amount)}</div>`;
  return `<h3 class="co-ledger-h nd-cl-heading">거래 내역 <span>${count}</span></h3><div class="nd-cl-list">${entries.length?entries.map(g=>{
   if(g.type==='payment')return `<details class="nd-cl-row"><summary><div class="nd-cl-main"><b>${escape(g.no||g.event.kind)}</b><strong>${g.event.kind==='출금'?'−':''}${value(g.event.amount)}</strong></div><div class="nd-cl-description">${escape(g.event.description||'입출금 기록')}${g.hasReference&&!g.linked?' · 견적 연결 확인 필요':!g.hasReference?' · 연결 견적 없음':''}</div><div class="nd-cl-meta"><span class="nd-cl-status">${escape(g.event.kind)} · 별도 기록</span><span>${escape(g.date||'날짜 없음')}<i class="nd-cl-chevron" aria-hidden="true"></i></span></div></summary><div class="nd-cl-detail">${eventHtml(g.event)}</div></details>`;
   const desc=g.deliveries.at(-1)?.description||'납품 전 입금 내역';
   const hint=g.review?'별도 기록의 입금 금액을 확인해 주세요':g.payments.length&&g.deliveries.length&&g.tone!=='complete'?`입금 ${money(g.paid)}원 · ${g.balance<0?'납품액 초과':'납품 잔액'} ${money(Math.abs(g.balance))}원`:'';
   return `<details class="nd-cl-row"><summary><div class="nd-cl-main"><b>${escape(g.no)}</b><strong>${!g.deliveries.length?'<em>입금</em>':!g.full?'<em>납품액</em>':''}${value(g.amount)}</strong></div><div class="nd-cl-description">${escape(desc)}</div><div class="nd-cl-meta"><span class="nd-cl-status ${g.tone}">${escape(g.status)}</span><span>${escape(g.date||'날짜 없음')}${g.deliveries.length?' 납품':''}<i class="nd-cl-chevron" aria-hidden="true"></i></span></div>${hint?`<div class="nd-cl-hint">${escape(hint)}</div>`:''}</summary><div class="nd-cl-detail"><div class="nd-cl-detail-heading">원본 내역 · ${g.events.length}건</div>${g.events.map(eventHtml).join('')}<div class="nd-cl-event nd-cl-balance"><span>${!g.deliveries.length?'납품 전 입금':g.balance<0?'납품액 초과 입금':'납품 기준 잔액'}</span>${g.review?'별도 입금 확인 필요':value(!g.deliveries.length?g.paid:Math.abs(g.balance))}</div></div></details>`;
  }).join(''):'<div class="empty">아직 거래 내역이 없습니다.</div>'}</div>`;
 }
 function replaceLedger(original,entries){
  const begin=original.indexOf('<h3 class="co-ledger-h">거래 내역 '),end=original.indexOf('<h3 class="co-ledger-h" style="margin-top:28px">거래처 정보',begin);
  // Preserve the original markup if a future base version changes its ledger boundary.
  return begin>=0&&end>begin?original.slice(0,begin)+html(entries)+original.slice(end):original;
 }
 return {rows,html,replaceLedger};
})();
/* NARO theme: system | light | dark. One preference shared by the onboarding shell
   and the /erp/ frame (same origin → same localStorage, kept in sync via 'storage'). */
(() => {
 if(typeof coLedgerHtml==='function'){
  const originalLedger=coLedgerHtml;
  coLedgerHtml=function(c){
   return NaroCompanyLedger.replaceLedger(originalLedger(c),NaroCompanyLedger.rows(db,c.id,{
    deliveredLines,total:lines=>quoteTotals({lines}).total,quoteAmount,fullyDelivered:quoteIsFullyDelivered
   }));
  };
 }
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
  card.innerHTML=`<div class="nd-mat-hd"><span>받은 수량 ${n(recv)}개</span><span>받음 = 보유 + 사용 + 반환·불량</span></div>`
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
  // 열 때마다 다시 그린다 — 닫은 사이 저장한 내용(거래처 이름 등)이 미리보기·파일에 바로 반영되게.
  if(exportDialog){exportDialog._draw?.();exportDialog.showModal();return;}
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
    // 내려받는 순간의 최신 자료로 다시 만든다(미리보기를 그린 뒤 바뀌었을 수 있음).
    const now=set.rows(state.opts,range());if(now.length<2)return;const csv=now.map(row=>row.map(cell).join(','));
    if(typeof downloadCsv==='function')downloadCsv(csv,fname);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv.join('\n')],{type:'text/csv;charset=utf-8'}));a.download=fname;a.click();}};
  };
  d._draw=draw;
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
   b.onclick=()=>{view.querySelectorAll('.panel-b-selected').forEach(n=>n.classList.remove('panel-b-selected'));t.classList.add('panel-b-selected');(window.naroReveal||(x=>x.scrollIntoView({block:'start',behavior:'smooth'})))(t);};return b;}));}
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
  sales:{search:'#view-sales .workspace-left>input.panel-b-search',ph:'거래처 검색',filter:'#view-sales .workspace-left>.filter-bar,#view-sales>.filter-bar',
   chips:{select:'slStatus',host:'#view-sales .workspace-left',before:'#view-sales .workspace-left>.panel-b-index',items:[['수주','수주만'],['all','모든 상태']],mafter:'#view-sales>.page-head'},hide:['#view-sales .workspace-left>input.panel-b-search','#view-sales .workspace-left>.filter-bar','#view-sales>.filter-bar']},
  ar:{search:'#view-ar .filter-bar input[type="search"]',ph:'거래처 검색',filterSelect:'#arFilter',
   chips:{select:'arView',host:'#view-ar .workspace-left',before:'#view-ar .workspace-left>.workspace-record-index',items:[['co','거래처별'],['quote','건별']],mafter:'#view-ar>.page-head'},hide:['#view-ar .workspace-left>.filter-bar','#view-ar>.filter-bar']},
  settings:{search:'#view-settings .workspace-left>input.panel-b-search',ph:'설정 검색',hide:['#view-settings .workspace-left>input.panel-b-search']}};
 let pop=null;
 function closePop(){if(pop){pop.el.remove();pop.btn.setAttribute('aria-expanded','false');pop.restore?.();pop=null;}}
 function openPop(btn,build,restore,title){if(popToggled.k===popKey(btn)&&Date.now()-popToggled.t<600){popToggled={k:'',t:0};return;}if(pop&&pop.btn===btn){closePop();return;}closePop();
  // Same width as the tool row it opens from, right under it (like the receipt app's pickers).
  const el=document.createElement('div');el.className='nd-pop-panel';if(btn.closest('#view-payments'))el.classList.add('nd-pay-filter');el.setAttribute('role','dialog');
  if(title){const h=document.createElement('div');h.className='nd-pop-hd';h.textContent=title;el.append(h);el.setAttribute('aria-label',title);}
  const body=document.createElement('div');body.className='nd-pop-body';el.append(body);build(body);(document.getElementById('appView')||document.body).append(el);
  const row=btn.parentElement.getBoundingClientRect(),w=Math.min(row.width,innerWidth-32);el.style.width=w+'px';
  el.style.left=Math.max(16,Math.min(row.left,innerWidth-w-16))+'px';el.style.top=(row.bottom+8)+'px';
  btn.setAttribute('aria-expanded','true');pop={el,btn,restore};}
 // 같은 도구 버튼을 다시 누르면 닫힘(토글) — 팝업이 열린 사이 도구 줄이 다시 그려져 버튼이 바뀌어도 '같은 버튼'(화면+이름)으로 알아본다.
 const popKey=b=>b?((b.closest('.view')?.id||'')+'|'+(b.getAttribute('aria-label')||b.className)):'';let popToggled={k:'',t:0};
 document.addEventListener('pointerdown',e=>{if(!pop){popToggled={k:'',t:0};return;}if(pop.el.contains(e.target))return; // 닫힌 뒤 새로 누르면 늘 다시 열린다(버튼 글자가 다시 그려져 click이 빠져도 남지 않게)
 const tb=e.target.closest?.('button');
  if(tb&&(pop.btn.contains(e.target)||popKey(tb)===popKey(pop.btn))){popToggled={k:popKey(tb),t:Date.now()};closePop();return;}
  closePop();},true);
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
    const v=document.getElementById('view-'+view);new MutationObserver(()=>{const o=document.querySelector(c.search);if(view==='payments'&&matchMedia('(max-width:780px)').matches){if(o&&o.value!==input.value)input.value=o.value;}else if(o&&input.value&&o.value!==input.value)push();}).observe(v,{childList:true,subtree:true});}
   if(c.period){const b=document.createElement('button');b.type='button';b.className='nd-tperiod';row.append(b);
    const label=()=>{const [f,t]=c.period.map(id=>{const i=document.getElementById(id);const d=i?.parentElement?.querySelector('.date-control-display:not(.empty)');return i?.value||(d?.textContent.trim().replace(/\.\s*/g,'-').replace(/-$/,'').replace(/-(\d)(?=-|$)/g,'-0$1'))||'';});b.innerHTML=svgI('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>')+`<span>${f&&t?(f===t?f.replace(/-/g,'.'):f.replace(/-/g,'.')+' – '+t.slice(5).replace(/-/g,'.')):'기간 선택'}</span>`;};
    label();setTimeout(label,800);c.period.forEach(id=>document.getElementById(id)?.addEventListener('change',label));
    b.onclick=()=>{if(pop?.btn===b){closePop();return;}const block=document.querySelector(c.filter);if(!block)return;const mark=document.createComment('nd-filter');block.before(mark);
     openPop(b,el=>{el.classList.add('nd-pop-filter');el.append(block);},()=>{mark.replaceWith(block);label();},'기간 · 필터');};}
   if(c.filter&&!c.period){const b=toolBtn(ICON_FILTER,'필터');row.insertBefore(b,row.querySelector('.btn-add'));
    b.onclick=()=>{if(pop?.btn===b){closePop();return;}const block=document.querySelector(c.filter);
     if(!block){ // 폰처럼 PC용 필터 묶음이 없는 화면: 원래 고르기 칸(select)을 그대로 꺼내 보여주고 닫으면 제자리로
      const view=document.getElementById('view-'+b.closest('.view')?.id.replace('view-',''))||b.closest('.view');
      const fields=[...(view?.querySelectorAll(':scope .ops-category, :scope .ops-filters>label')||[])].filter(l=>l.querySelector('select,input')&&!l.closest('.nd-pop'));if(!fields.length)return;
      const marks=fields.map(f=>{const m=document.createComment('nd-filter');f.before(m);return m;});
      openPop(b,el=>{el.classList.add('nd-pop-filter');fields.forEach(f=>{f.classList.add('nd-pop-field');el.append(f);});},()=>fields.forEach((f,i)=>{f.classList.remove('nd-pop-field');marks[i].replaceWith(f);}),'필터');return;}
     const mark=document.createComment('nd-filter');block.before(mark);if(block.tagName==='DETAILS')block.open=true;
     openPop(b,el=>{el.classList.add('nd-pop-filter');el.append(block);},()=>mark.replaceWith(block),'필터');};}
   if(c.filterSelect){const b=toolBtn(ICON_FILTER,'필터');row.append(b);
    b.onclick=()=>{if(pop?.btn===b){closePop();return;}const sel=document.querySelector(c.filterSelect);if(!sel)return;const mark=document.createComment('nd-filter');sel.before(mark);
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
  if(kindSel&&kindSel.dataset.ndSeg)kindSel.nextElementSibling?.querySelectorAll?.('button').forEach(b=>{const on=b.dataset.v===kindSel.value;if(b.classList.contains('on')!==on)b.classList.toggle('on',on);});
  if(kindSel&&!kindSel.dataset.ndSeg){kindSel.dataset.ndSeg='1';const seg=document.createElement('div');seg.className='nd-kind';seg.setAttribute('role','radiogroup');seg.setAttribute('aria-label','입출고 구분');
   const sync=()=>seg.querySelectorAll('button').forEach(b=>{const on=b.dataset.v===kindSel.value;b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));});
   for(const o of kindSel.options){const b=document.createElement('button');b.type='button';b.dataset.v=o.value;b.textContent=o.textContent;b.setAttribute('role','radio');b.onclick=()=>{if(kindSel.value!==o.value){kindSel.value=o.value;kindSel.dispatchEvent(new Event('change',{bubbles:true}));}sync();};seg.append(b);}
   kindSel.classList.add('nd-kind-src');kindSel.after(seg);kindSel.addEventListener('change',sync);sync();}
  if(!area||!grid){area?.querySelector('.nd-sz')?.remove();if(area)delete area.dataset.ndKey;stockBtnLabel(0);return;}
  const item=db.items.find(i=>i.id===document.getElementById('ivItem')?.value),color=document.getElementById('ivColor')?.value||'';
  const specs=[...grid.querySelectorAll('input[data-stock-size]')].map(i=>i.getAttribute('aria-label').replace(/ 수량$/,''));
  const key=[item?.id,color,specs.join(','),stockAdj?'adj':''].join('|');
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
   <tr class="now"><td class="k">${stockAdj?'장부 수량':'현재'}</td>${specs.map(s=>`<td>${n(now(s))}</td>`).join('')}<td class="sum" data-now></td></tr>
   <tr class="qty"><td class="k" data-kind></td>${specs.map((s,i)=>`<td><input data-i="${i}" inputmode="numeric" autocomplete="off" aria-label="${escapeAttr(s)} ${stockAdj?'실제 수량':'수량'}" placeholder="${stockAdj?'그대로':'0'}" value="${escapeAttr(stockQuickValues[s]??'')}"></td>`).join('')}<td class="sum" data-total></td></tr>
   <tr class="after"><td class="k">${stockAdj?'차이':'변경 후'}</td>${specs.map((s,i)=>`<td data-after="${i}"></td>`).join('')}<td class="sum" data-aftersum></td></tr></tbody>`;
  // Phone list
  const list=document.createElement('div');list.className='nd-sz-list';
  list.innerHTML=specs.map((s,i)=>`<div class="nd-sz-row"><span class="sz">${escapeHtml(s)}</span><span class="cur">${stockAdj?'장부':'현재'} ${n(now(s))} ${stockAdj?'· 차이':'→'} <b data-after="${i}"></b></span><span class="step"><button type="button" data-step="-1" data-i="${i}" aria-label="${escapeAttr(s)} 1 빼기">−</button><input data-i="${i}" inputmode="numeric" autocomplete="off" aria-label="${escapeAttr(s)} ${stockAdj?'실제 수량':'수량'}" placeholder="${stockAdj?'그대로':'0'}" value="${escapeAttr(stockQuickValues[s]??'')}"><button type="button" data-step="1" data-i="${i}" aria-label="${escapeAttr(s)} 1 더하기">+</button></span></div>`).join('')+'<div class="nd-sz-total"><span>합계</span><b data-total></b></div>';
  wrap.append(bar,t,list);
  const tip=document.createElement('p');tip.className='nd-sz-tip';tip.innerHTML='<b>빠르게 입력</b> Enter·Tab 다음 사이즈 · ↑↓ 1씩 · 엑셀에서 한 줄 복사 후 붙여넣으면 사이즈별로 채워져요';wrap.append(tip);
  grid.before(wrap);
  const addBtn=document.getElementById('ivAddBtn');if(addBtn&&!addBtn.dataset.ndLabel)addBtn.dataset.ndLabel=addBtn.textContent;
  const set=(el,text,cls)=>{if(el.textContent!==text)el.textContent=text;if(cls!==undefined&&el.className!==cls)el.className=cls;};
  function update(){
   if(stockAdj){ // 조정: 칸 = 실제 수량(빈칸 = 그대로), 아래 줄 = 차이
    let changed=0,diff=0,actSum=0,nowSum=0;
    specs.forEach((s,i)=>{const raw=String(stockQuickValues[s]??'').trim(),has=raw!=='',act=has?Number(raw):now(s),d=act-now(s);nowSum+=now(s);actSum+=act;if(has&&d){changed++;diff+=d;}
     wrap.querySelectorAll(`[data-after="${i}"]`).forEach(el=>set(el,has&&d?(d>0?'+':'−')+n(Math.abs(d)):'·',has&&d?(d>0?'pos':'neg'):'dim'));
     wrap.querySelectorAll(`input[data-i="${i}"]`).forEach(inp=>{const v=String(stockQuickValues[s]??'');if(inp.value!==v&&document.activeElement!==inp)inp.value=v;});});
    wrap.querySelectorAll('[data-kind]').forEach(el=>set(el,'실제 수량'));if(wrap.dataset.kind!=='adj')wrap.dataset.kind='adj';
    wrap.querySelectorAll('[data-total]').forEach(el=>set(el,n(actSum)));wrap.querySelectorAll('[data-now]').forEach(el=>set(el,n(nowSum)));
    wrap.querySelectorAll('[data-aftersum]').forEach(el=>set(el,diff?(diff>0?'+':'−')+n(Math.abs(diff)):'·',diff?(diff>0?'pos':'neg'):'dim'));
    stockAdjLabel(changed,diff);return;}
   const sign=out()?-1:1;let total=0,nowSum=0,afterSum=0;
   specs.forEach((s,i)=>{const q=val(s),a=now(s)+sign*q;total+=q;nowSum+=now(s);afterSum+=a;
    wrap.querySelectorAll(`[data-after="${i}"]`).forEach(el=>set(el,n(a),a<0?'neg':q?'chg':''));
    wrap.querySelectorAll(`input[data-i="${i}"]`).forEach(inp=>{const v=String(stockQuickValues[s]??'');if(inp.value!==v&&document.activeElement!==inp)inp.value=v;});});
   wrap.querySelectorAll('[data-kind]').forEach(el=>set(el,out()?'출고':'입고'));
   const kd=out()?'out':'in';if(wrap.dataset.kind!==kd)wrap.dataset.kind=kd;
   wrap.querySelectorAll('[data-total]').forEach(el=>set(el,total?n(total)+'개':'0'));
   wrap.querySelectorAll('[data-now]').forEach(el=>set(el,n(nowSum)));wrap.querySelectorAll('[data-aftersum]').forEach(el=>set(el,n(afterSum)));
   stockBtnLabel(total);
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
 // Keep the original date inputs/listeners; only normalize their filter presentation.
 function filterDates(){
  for(const [id,title] of [['slFrom','시작일'],['slTo','종료일'],['qtFrom','시작일'],['qtTo','종료일']]){
   const input=document.getElementById(id);if(!input)continue;
   let wrap=input.closest('.date-control');if(!wrap)continue; // core date enhancement owns the native input
   wrap.classList.add('nd-filter-date');
   let field=wrap.closest('label');
   if(!field){field=document.createElement('label');wrap.before(field);field.append(wrap);}
   field.classList.add('nd-filter-date-field');field.htmlFor=id;
   if(!field.querySelector('.filter-label')){const label=document.createElement('span');label.className='filter-label';label.textContent=title;field.prepend(label);}
   if(input.getAttribute('aria-label')!==title)input.setAttribute('aria-label',title);
   let value=wrap.querySelector('.nd-filter-date-value');
   if(!value){value=document.createElement('span');value.className='nd-filter-date-value';value.setAttribute('aria-hidden','true');wrap.append(value);}
   const text=input.value?input.value.replaceAll('-','.'): '날짜 선택';
   if(value.textContent!==text)value.textContent=text;
   value.classList.toggle('empty',!input.value);
  }
 }
 document.addEventListener('input',e=>{if(['slFrom','slTo','qtFrom','qtTo'].includes(e.target.id))filterDates();});
 document.addEventListener('change',e=>{if(['slFrom','slTo','qtFrom','qtTo'].includes(e.target.id))filterDates();});
 function periodPresets(){
  const pad=n=>String(n).padStart(2,'0'),ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today=new Date(),y=today.getFullYear(),m=today.getMonth();
  const ranges={month:[ymd(new Date(y,m,1)),ymd(today)],prev:[ymd(new Date(y,m-1,1)),ymd(new Date(y,m,0))],year:[ymd(new Date(y,0,1)),ymd(today)]};
  const ym=d=>d.slice(0,7);
  const earliest=()=>{const ds=(db.quotes||[]).map(q=>q.date).filter(Boolean).sort();return ds[0]||ymd(new Date(y-5,0,1));};
  const fire=id=>{const el=document.getElementById(id);el&&el.dispatchEvent(new Event('change',{bubbles:true}));};
  const setv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  const screens=[
   {host:'#view-sales .filter-bar',anchor:'slFrom',before:'#slFrom',
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
   // Sales fields move into a popup outside #view-sales. Keep the same source controls live there.
   let host=sc.anchor?document.getElementById(sc.anchor)?.closest('.filter-bar'):document.querySelector(sc.host);if(!host)continue;
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
   if(sc.anchor==='slFrom'&&!host.querySelector('.nd-sales-reset')){
    const reset=document.createElement('button');reset.type='button';reset.className='btn nd-sales-reset';reset.textContent='필터 초기화';
    reset.onclick=()=>{setv('slCo','');setv('slStatus','all');sc.apply('all');fire('slStatus');periodPresets();};
    host.append(reset);
   }
  }
  filterDates();
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
 const COMPANY_ICON='<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 8h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>';
 function navIcons(){
  const icons={dash:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
   companies:COMPANY_ICON,
   materials:'<path d="m16 16 2 2 4-4M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14M3.3 7 12 12l8.7-5M12 22V12M7.5 4.3l9 5.2"/>',
   sales:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-4"/><path d="M13 17V9"/><path d="M18 17V5"/>',
   ar:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'};
  for(const [v,d] of Object.entries(icons))document.querySelectorAll(`#appView [data-view="${v}"] svg:not([data-nd-icon])`).forEach(svg=>{svg.innerHTML=d;svg.setAttribute('data-nd-icon',v);});
 }
 // Local navigation preference only. No account tokens, business data or cloud writes.
 function mobileNavModel(){
  const key='naro.mobileNav.v1',defaults=['quotes','payments','materials'];
  const labels={quotes:'견적서',payments:'입금·출금',materials:'자재',companies:'거래처',items:'품목',stock:'재고',sales:'매출 집계',ar:'받을 금액',settings:'공급자 정보'};
  const normalize=value=>{
   const slots=Array.isArray(value)?value.filter(v=>typeof v==='string'&&Object.hasOwn(labels,v)):[];
   return [...new Set([...slots,...defaults])].slice(0,3);
  };
  const move=(slots,from,to)=>{const next=normalize(slots);if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>2||to>2)return next;next.splice(to,0,next.splice(from,1)[0]);return next;};
  const assign=(slots,index,value)=>{const next=normalize(slots);if(!Number.isInteger(index)||index<0||index>2||!Object.hasOwn(labels,value))return next;const old=next.indexOf(value);if(old>=0&&old!==index)return next;next[index]=value;return next;};
  const read=storage=>{try{const saved=JSON.parse(storage.getItem(key));return saved?.version===1?normalize(saved.slots):[...defaults];}catch{return [...defaults];}};
  const write=(storage,slots)=>{try{storage.setItem(key,JSON.stringify({version:1,slots:normalize(slots)}));return true;}catch{return false;}};
  return {key,defaults,labels,normalize,move,assign,read,write};
 }
 let mobileNavController=null;
 function mobileNavPreferences(){
  if(mobileNavController){mobileNavController.sync();return;}
  const bar=document.getElementById('bottomNav'),rail=document.querySelector('#appView .rail-nav'),more=document.getElementById('moreNavBtn');
  if(!bar||!rail||!more)return;
  const buttons=[...bar.querySelectorAll('.mobile-nav-item')].filter(b=>b.dataset.view!=='dash');if(buttons.length!==3)return;
  const model=mobileNavModel();let storage;try{storage=window.localStorage;}catch{}
  let slots=model.read(storage),draft=[...slots],dialog=null;
  const source=v=>rail.querySelector(`.nav-item[data-view="${v}"]`);
  const icon=v=>source(v)?.querySelector('svg')?.outerHTML||'';
  const active=()=>typeof currentView==='string'?currentView:document.querySelector('#appView .view:not(.hidden)')?.id.replace('view-','');
  const sync=()=>{
   const view=active();buttons.forEach((b,i)=>{
    const v=slots[i];if(b.dataset.view!==v||b.querySelector('span')?.textContent!==model.labels[v]){b.dataset.view=v;b.innerHTML=icon(v);const label=document.createElement('span');label.textContent=model.labels[v];b.append(label);}
    b.classList.toggle('on',v===view);if(v===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
   });
   more.classList.toggle('on',!!view&&view!=='dash'&&!slots.includes(view));
  };
  const edit=document.createElement('button');edit.type='button';edit.className='nd-nav-act nd-mobile-nav-edit';edit.innerHTML=svgI('<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="17" r="2" fill="currentColor"/>')+'<span>하단 메뉴 편집</span>';rail.append(edit);
  const renderDraft=()=>{
   const preview=dialog.querySelector('.nd-mn-preview');preview.replaceChildren();
   for(const v of ['dash',...draft,'more']){const cell=document.createElement('span');cell.innerHTML=v==='more'?svgI('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'):icon(v);const text=document.createElement('small');text.textContent=v==='dash'?'홈':v==='more'?'더보기':model.labels[v];cell.append(text);preview.append(cell);}
   // Native mobile pickers must keep the same select and option nodes while open.
   const list=dialog.querySelector('.nd-mn-slots');
   if(!list.children.length)list.innerHTML=draft.map((v,i)=>`<div class="nd-mn-row" data-slot="${i}"><label><span>${i+1}번 메뉴</span><select data-slot-select="${i}">${Object.entries(model.labels).filter(([v])=>source(v)).map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select></label><button type="button" data-move="-1" aria-label="${i+1}번 메뉴 위로"${i===0?' disabled':''}>${svgI('<path d="m6 14 6-6 6 6"/>')}</button><button type="button" data-move="1" aria-label="${i+1}번 메뉴 아래로"${i===2?' disabled':''}>${svgI('<path d="m6 10 6 6 6-6"/>')}</button></div>`).join('');
   list.querySelectorAll('select').forEach((select,i)=>{select.value=draft[i];for(const option of select.options)option.disabled=option.value!==draft[i]&&draft.includes(option.value);});
  };
  edit.onclick=()=>{
   if(!dialog){dialog=document.createElement('dialog');dialog.className='nd-mobile-nav-dialog';dialog.setAttribute('aria-labelledby','ndMobileNavTitle');
    dialog.innerHTML='<header><h2 id="ndMobileNavTitle">하단 메뉴 편집</h2><button type="button" data-mn-close aria-label="닫기">×</button></header><p class="nd-mn-help">홈과 더보기는 고정입니다. 서로 다른 메뉴 3개를 골라 주세요.<br>오른쪽 위·아래 화살표로 순서를 바꿀 수 있어요.</p><div class="nd-mn-preview" aria-label="하단 메뉴 미리보기"></div><div class="nd-mn-slots"></div><p class="nd-mn-note">이 기기·브라우저에만 저장됩니다. 같은 브라우저를 함께 사용하면 메뉴 설정도 공유됩니다. 업무 데이터는 변경되지 않습니다.</p><p class="nd-mn-status" role="status" aria-live="polite"></p><footer><button type="button" data-mn-reset>기본값</button><button type="button" data-mn-close>취소</button><button type="button" data-mn-save>저장</button></footer>';
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{edit.focus();});
    // Keep Esc/Tab inside the top-layer dialog, not the drawer's keyboard handler.
    dialog.addEventListener('keydown',e=>{if(!['Shift','Control','Alt','Meta'].includes(e.key))delete dialog.dataset.mnPointer;e.stopPropagation();});
    dialog.addEventListener('pointerdown',()=>{dialog.dataset.mnPointer='true';},true);
    dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();return;}if(!b)return;
     if(b.hasAttribute('data-mn-close'))dialog.close();
     else if(b.hasAttribute('data-mn-reset')){draft=[...model.defaults];renderDraft();dialog.querySelector('.nd-mn-status').textContent='기본 메뉴를 선택했습니다. 저장하면 적용됩니다.';}
     else if(b.hasAttribute('data-mn-save')){draft=model.normalize(draft);if(!model.write(storage,draft)){dialog.querySelector('.nd-mn-status').textContent='이 브라우저에 설정을 저장하지 못했습니다. 기존 메뉴는 유지됩니다.';return;}slots=[...draft];sync();dialog.close();typeof toast==='function'&&toast('하단 메뉴를 저장했습니다.');}
     else if(b.hasAttribute('data-move')){const from=Number(b.closest('[data-slot]').dataset.slot),to=from+Number(b.dataset.move);draft=model.move(draft,from,to);renderDraft();dialog.querySelector('.nd-mn-status').textContent='메뉴 순서를 변경했습니다. 저장하면 적용됩니다.';}
    });
    dialog.addEventListener('change',e=>{if(!e.target.matches('[data-slot-select]'))return;const index=Number(e.target.dataset.slotSelect),value=e.target.value,duplicate=draft.some((v,i)=>i!==index&&v===value);draft=model.assign(draft,index,value);renderDraft();dialog.querySelector('.nd-mn-status').textContent=duplicate?'이미 사용 중인 메뉴입니다. 순서는 위·아래 버튼으로 변경해 주세요.':'메뉴를 변경했습니다. 저장하면 적용됩니다.';});
   }
   draft=[...slots];dialog.querySelector('.nd-mn-status').textContent='';renderDraft();dialog.showModal();
  };
  addEventListener('storage',e=>{if(e.key!==model.key&&e.key!==null)return;slots=model.read(storage);sync();if(dialog?.open){dialog.close();typeof toast==='function'&&toast('다른 창에서 하단 메뉴 설정이 변경되었습니다.');}});
  mobileNavController={sync};sync();
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
  const name=(sel?.firstChild?.textContent||sel?.textContent||'').trim().replace(/\s+/g,' ').slice(0,40);const tt=bar.querySelector('.nd-st-title');const mm=/^(.*?)\s*\[([^\]]+)\]$/.exec(name);const nm=mm?mm[1]:name,cd=mm?mm[2]:'';if(tt.dataset.k!==name){tt.dataset.k=name;tt.textContent=nm;if(cd){const c=document.createElement('span');c.className='nd-code';c.textContent=cd;tt.append(' ',c);}} // 품번은 [ ] 없이 얇은 회색
  let act=detail.querySelector(':scope>.nd-st-act');
  if(!act){act=document.createElement('div');act.className='nd-st-act';act.innerHTML='<button type="button" data-go="stockRegister" class="p">입고</button><button type="button" data-go="stockOutbound">출고</button><button type="button" data-go="stockAdjust">조정</button>';detail.append(act);}
  // 입력 창은 아래 바의 [입고][출고][조정]으로 열었을 때만 시트로 띄운다(품목을 고르면 원래 화면이 폼을 자동으로 펴기 때문).
  const add=detail.querySelector(':scope>.stock-add');const formOn=!!(add&&!add.hidden&&getComputedStyle(add).display!=='none'||add&&view.classList.contains('nd-st-sheet')&&!add.hidden);
  if(!add||add.hidden)stSheet=false;const open=ST_PHONE.matches&&stSheet&&!!add&&!add.hidden;
  if(view.classList.contains('nd-st-sheet')!==open)view.classList.toggle('nd-st-sheet',open);
 }
 /* 표 규칙: 표 위 제목(상호·섹션 제목)과 첫 열 글자가 같은 세로선, 마지막 열(금액)도 같은 여백. 표마다 구조가 달라
    제목과 표의 실제 위치를 재서 첫·마지막 칸 여백(--nd-tx)만 맞춘다. 같은 값이면 다시 쓰지 않는다(무한 반복 방지). */
 function tableAlign(){
  for(const t of document.querySelectorAll('#appView .view table.tbl')){
   if(!t.getClientRects().length)continue;
   const box=t.closest('.card,.workspace-right,#stockOverview,section');if(!box)continue;
   let head=null;for(const h of box.querySelectorAll('h3')){if(!h.getClientRects().length)continue;if(h.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING)head=h;else break;}
   if(!head)continue;
   // 제목이 표 왼쪽 끝과 같은 선이면 제목을 첫 열 글자 위치로 들이고, 제목이 안쪽에 있으면 첫·마지막 칸 여백을 제목에 맞춘다.
   const cell=t.querySelector('thead th,tbody td');const pad=cell?Math.round(parseFloat(getComputedStyle(cell).paddingLeft)):0;
   const base=Math.round(head.getBoundingClientRect().left-(parseFloat(head.style.paddingLeft)||0)-t.getBoundingClientRect().left);
   const hp=base>=-1&&base<4&&pad>0?pad+'px':'';if(head.style.paddingLeft!==hp)head.style.paddingLeft=hp;
   const v=base>=4&&base<=40?base+'px':'';if(t.style.getPropertyValue('--nd-tx')!==v){if(v)t.style.setProperty('--nd-tx',v);else t.style.removeProperty('--nd-tx');}
  }
 }
 /* 입금·출금 입력의 '거래 유형'도 구분 버튼으로 (재고 입출고와 같은 모양·색). 원래 select를 바꾸고 change를 보낸다. */
 function payKindChips(){
  const sel=document.getElementById('payKind');if(!sel)return;
  // 원래 화면이 코드로 값을 바꿔도(입금/출금 기록 추가 버튼) 칩이 따라가게 매번 맞춘다.
  if(sel.dataset.ndSeg){sel.nextElementSibling?.querySelectorAll?.('button').forEach(b=>{const on=b.dataset.v===sel.value;if(b.classList.contains('on')!==on)b.classList.toggle('on',on);});return;}sel.dataset.ndSeg='1';
  const seg=document.createElement('div');seg.className='nd-kind nd-pay-kind';seg.setAttribute('role','radiogroup');seg.setAttribute('aria-label','거래 유형');
  const sync=()=>seg.querySelectorAll('button').forEach(b=>{const on=b.dataset.v===sel.value;if(b.classList.contains('on')!==on)b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));});
  for(const o of sel.options){const b=document.createElement('button');b.type='button';b.dataset.v=o.value;b.textContent=({'수금':'입금','지급':'출금'})[o.textContent.trim()]||o.textContent;b.setAttribute('role','radio');b.onclick=()=>{if(sel.value!==o.value){sel.value=o.value;sel.dispatchEvent(new Event('change',{bubbles:true}));}sync();};seg.append(b);}
  sel.classList.add('nd-kind-src');sel.after(seg);sel.addEventListener('change',sync);sync();
 }
 /* 품목 고르기 = 견적서 품목 검색과 같은 창 (검색 · 품명 · 코드 꼬리표 · 판매 단가, 가나다순).
    거래처 약정 단가의 '제품', 재고 입력의 '품목'에 쓴다. 원래 select는 숨겨 두고 값만 바꿔 change를 보낸다(저장 규칙은 그대로). */
 let ndPop=null;
 const ndClosePick=()=>{if(ndPop){ndPop.remove();ndPop=null;}document.querySelectorAll('.ip-btn.nd-ip.on').forEach(b=>b.classList.remove('on'));};
 function itemPickers(){
  const sels=document.querySelectorAll('#appView select[data-rule="item_id"],#appView select#ivItem');
  for(const sel of sels){
   let btn=sel.nextElementSibling?.classList?.contains('nd-ip')?sel.nextElementSibling:null;
   if(!btn){btn=document.createElement('button');btn.type='button';btn.className='ip-btn nd-ip';sel.after(btn);sel.classList.add('nd-ip-src');
    btn.addEventListener('click',()=>openPick(sel,btn));}
   const it=(db.items||[]).find(i=>i.id===sel.value);
   const html=it?`${typeof isWork==='function'&&isWork(it)?'<span class="pill work">작업</span> ':''}${escapeHtml(it.name)}${it.code?`<span class="cd">${escapeHtml(it.code)}</span>`:''}`:`<span class="ph">${escapeHtml(sel.options[sel.selectedIndex]?.textContent||'품목 선택')} — 품명·코드 검색</span>`;
   if(btn.dataset.html!==html){btn.dataset.html=html;btn.innerHTML=html;}
   if(btn.disabled!==sel.disabled)btn.disabled=sel.disabled;
  }
 }
 function openPick(sel,btn){
  ndClosePick();if(typeof closeItemPicker==='function')closeItemPicker();btn.classList.add('on');
  const allowed=new Set([...sel.options].map(o=>o.value).filter(Boolean));
  const items=(db.items||[]).filter(i=>allowed.has(i.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko')||(a.code||'').localeCompare(b.code||'','ko'));
  const r=btn.getBoundingClientRect(),pop=document.createElement('div');pop.className='ip-pop nd-ip-pop';
  pop.innerHTML='<input type="text" placeholder="품명·코드 검색" autocomplete="off"><div class="ip-list"></div>';
  (document.getElementById('appView')||document.body).append(pop);ndPop=pop;
  const w=Math.min(Math.max(300,r.width),innerWidth-16);/* 칸과 같은 너비(좁은 칸만 300 이상) */pop.style.width=w+'px';pop.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
  const below=innerHeight-r.bottom,above=below<240&&r.top>below;if(above)pop.style.bottom=(innerHeight-r.top+6)+'px';else pop.style.top=(r.bottom+6)+'px';
  pop.style.maxHeight=Math.max(0,(above?r.top:below)-14)+'px';
  const input=pop.querySelector('input'),list=pop.querySelector('.ip-list');let hi=0,shown=[];
  const price=i=>{try{return typeof itemSell==='function'?itemSell(i):i.sell_price;}catch{return i.sell_price;}};
  const pick=id=>{if(sel.value!==id){sel.value=id;sel.dispatchEvent(new Event('change',{bubbles:true}));sel.dispatchEvent(new Event('input',{bubbles:true}));}ndClosePick();itemPickers();btn.focus();};
  const draw=()=>{const q=input.value.trim().toLowerCase();shown=items.filter(i=>!q||(i.name||'').toLowerCase().includes(q)||(i.code||'').toLowerCase().includes(q));hi=Math.min(hi,Math.max(0,shown.length-1));
   list.innerHTML=shown.length?shown.map((i,n)=>{const tag=typeof isWork==='function'&&isWork(i)?'[작업] ':'';const p=price(i);return `<div class="ip-opt ${n===hi?'hi':''}" data-id="${escapeAttr(i.id)}"><span class="nm">${tag}${escapeHtml(i.name)}</span>${i.code?`<span class="cd">${escapeHtml(i.code)}</span>`:''}<span class="pr">${p?fmt(p):''}</span></div>`;}).join(''):`<div class="ip-empty">"${escapeHtml(input.value)}"에 맞는 품목이 없습니다</div>`;
   list.querySelectorAll('.ip-opt').forEach(o=>o.onmousedown=ev=>{ev.preventDefault();pick(o.dataset.id);});};
  draw();input.oninput=()=>{hi=0;draw();};
  input.onkeydown=ev=>{if(ev.key==='ArrowDown'){ev.preventDefault();hi=Math.min(hi+1,shown.length-1);draw();list.querySelector('.hi')?.scrollIntoView({block:'nearest'});}
   else if(ev.key==='ArrowUp'){ev.preventDefault();hi=Math.max(hi-1,0);draw();list.querySelector('.hi')?.scrollIntoView({block:'nearest'});}
   else if(ev.key==='Enter'){ev.preventDefault();if(shown[hi])pick(shown[hi].id);}
   else if(ev.key==='Escape'){ev.preventDefault();ndClosePick();btn.focus();}};
  setTimeout(()=>input.focus(),0);
 }
 document.addEventListener('mousedown',e=>{if(ndPop&&!ndPop.contains(e.target)&&!e.target.closest('.nd-ip'))ndClosePick();});
 addEventListener('scroll',e=>{if(ndPop&&!e.composedPath().includes(ndPop))ndClosePick();},true);
 addEventListener('resize',ndClosePick);
 /* 견적서(폰) 품목 탭: '옵션별 한번에'는 품목을 넣는 기능이라 '+ 품목 추가' 옆에 한 줄로. */
 function quoteAddRow(){
  const size=document.getElementById('fq_sizeBtn'),prod=document.querySelector('#qtForm .qp-products');if(!size||!prod)return;
  const add=prod.querySelector(':scope>.qp-add, :scope>.nd-addrow>.qp-add');if(!add)return;
  let row=prod.querySelector(':scope>.nd-addrow');if(!row){row=document.createElement('div');row.className='nd-addrow';add.before(row);}
  if(add.parentElement!==row)row.append(add);if(size.parentElement!==row)row.append(size);
 }
 /* 재고 부족 알림: 줄마다 [품명 코드 …… 부족 N] / [색상 · 규격 …… 필요 · 보유] 두 줄로. 원래 문장에서 값만 읽어 다시 그린다. */
 // 받을 금액이 음수(입금이 납품보다 많음 = 선입금)면 '0원' + '미리 받은 돈 N원'. 계산은 그대로, 보이는 것만.
 // 고친 값은 끝에 보이지 않는 표시(​)를 달아, 앱이 다시 쓴 값과 구분한다(같은 값을 또 고치지 않게).
 const ADV='​';
 function advancePaid(){
  const spots=[];
  document.querySelectorAll('#view-dash .mo-sub>div').forEach(d=>{const k=d.querySelector('.k'),v=d.querySelector('.v');if(k&&v&&/미수금|받을 금액/.test(k.textContent))spots.push([v,d]);});
  document.querySelectorAll('#appView .scr-hero').forEach(h=>{const l=h.querySelector('.lbl'),v=h.querySelector('.big');if(l&&v&&/미수금|받을 금액/.test(l.textContent))spots.push([v,h]);});
  for(const [v,host] of spots){
   const t=v.textContent;if(t.endsWith(ADV))continue;
   const m=/^\s*[-−]([\d,]+)원\s*$/.exec(t),old=host.querySelector(':scope>.nd-adv');
   if(!m){old?.remove();continue;}
   v.textContent='0원'+ADV;v.classList.remove('neg');
   const n=old||document.createElement('div');n.className='nd-adv';n.textContent='미리 받은 돈 '+m[1]+'원';if(!old)host.append(n);
  }
 }
 function shortageTidy(){
  for(const box of document.querySelectorAll('#appView .shortbox:not([data-nd])')){
   box.dataset.nd='1';const rows=[...box.querySelectorAll(':scope>.row')];
   const hd=box.querySelector(':scope>.hd');if(hd){hd.innerHTML=`<b>재고 부족 ${rows.length}건</b><span>수주하려면 아래 자재를 확보해야 해요</span>`;}
   for(const r of rows){const label=r.querySelector('.nm')?.textContent||'',v=r.querySelector('.v')?.textContent||'';
    const parts=label.split(' · '),m=/^(.*?)\s*\[([^\]]+)\]\s*$/.exec(parts[0]||'');const name=m?m[1]:parts[0],code=m?m[2]:'',opt=parts.slice(1).join(' · ');
    const n=/필요\s*([-\d,]+)\s*·\s*보유\s*([-\d,]+)\s*·\s*부족\s*([-\d,]+)/.exec(v);if(!n)continue;
    const e=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    r.classList.add('nd-sr');r.innerHTML=`<div class="a"><b>${e(name)}</b>${code?`<span class="cd">${e(code)}</span>`:''}</div><div class="lack">부족 ${e(n[3])}</div><div class="o">${e(opt)}</div><div class="nh">필요 ${e(n[1])} · 보유 ${e(n[2])}</div>`;}
  }
 }
 function eyebrows(){for(const [v,t] of Object.entries(EYEBROW))document.querySelectorAll(`#view-${v} :is(.workspace-heading,.panel-b-empty-heading)>.workspace-caption`).forEach(c=>{if(c.textContent!==t)c.textContent=t;});}
 function v5(){navIcons();mobileNavPreferences();railDocs();chips();actions();watchMaterials();retireCsv();supplierAddress();watchSettings();tools();
  const roots=['coForm','itForm','qtForm'].map(id=>document.getElementById(id)).filter(Boolean);
  if(roots.length){const mo=new MutationObserver(()=>{mo.disconnect();actions();roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));});roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));}}
 // Screens are (re)built after sign-in and on every render: re-apply the idempotent layout passes each frame something changes.
 let v5Queued=false;
 // 저장 전 확인(거래처·품목): 잘못된 메일 주소·사업자번호, 같은 이름 거래처, 음수 단가. 앱의 저장 함수 앞에서 막는다.
 const SAVE_CHECKS={
  coSaveBtn(){
   const v=id=>(document.getElementById(id)?.value||'').trim(),name=v('f_name'),email=v('f_email'),biz=v('f_biz');
   if(email&&!email.split(/[,;]/).map(x=>x.trim()).filter(Boolean).every(x=>/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(x)))return {msg:'이메일 형식을 확인해 주세요. (예: name@company.co.kr — 여러 개는 쉼표로)',focus:'f_email'};
   if(biz&&biz.replace(/\D/g,'').length!==10)return {msg:'사업자등록번호는 숫자 10자리예요. (예: 123-45-67890)',focus:'f_biz'};
   const key=t=>String(t||'').replace(/\s+/g,'').toLowerCase(),same=name&&(db.companies||[]).filter(c=>c.id!==coSel&&key(c.name)===key(name));
   if(same&&same.length&&!confirm(`같은 이름의 거래처 "${same[0].name}"가 이미 있어요.\n그래도 따로 등록할까요? (지점 등 다른 거래처일 때만)`))return {msg:'',focus:'f_name'};
  },
  itSaveBtn(){
   for(const [id,label] of [['fi_sell','판매가'],['fi_buy','매입가']]){const el=document.getElementById(id);if(!el)continue;const n=Number(String(el.value).replace(/,/g,''));if(String(el.value).trim()&&(!Number.isFinite(n)||n<0))return {msg:label+'는 0 이상의 숫자로 입력해 주세요.',focus:id};}
  }
 };
 document.addEventListener('click',e=>{const b=e.target.closest?.('#coSaveBtn,#itSaveBtn');if(!b||!document.getElementById('appView')?.contains(b))return;
  let r;try{r=SAVE_CHECKS[b.id]();}catch{return;}
  if(!r)return;e.preventDefault();e.stopImmediatePropagation();
  if(r.msg&&typeof window.toast==='function')window.toast(r.msg);const f=document.getElementById(r.focus);f?.focus();f?.select?.();},true);
 /* ── 바로가기: 할 일이 있는 숫자는 누르면 그 일을 하는 칸까지 ──────────────────────────
    계산서 미발행 → 목록(오늘 발행·열기) / 받을 금액 → 입금 입력(거래처·견적·남은 금액 채움) / 재고 부족 → 입고(부족 수량 채움)
    미납품 잔액 → 납품 기록 / 회신 대기 견적 → 견적서 '발송'만. 앱의 계산·저장 함수는 그대로 쓰고, 화면 이동과 칸 채우기만 한다. */
 const jWon=n=>(typeof won==='function'?won(n):(Math.round(n)||0).toLocaleString('ko-KR')+'원');
 const jEsc=t=>typeof escapeHtml==='function'?escapeHtml(String(t??'')):String(t??'');
 const jMd=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');return m?`${+m[2]}월 ${+m[3]}일`:'';};
 const jWait=ms=>new Promise(r=>setTimeout(r,ms));
 const jPhone=()=>matchMedia('(max-width:780px)').matches;
 function jSheet({title,sub,rows,empty,note}){
  document.querySelector('#appView .nd-jmp')?.remove();
  const ov=document.createElement('div');ov.className='nd-jmp';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label',title);
  const box=document.createElement('div');box.className='nd-jmp-box';ov.append(box);
  box.innerHTML=`<div class="nd-jmp-hd"><div><b>${jEsc(title)}</b>${sub?`<div class="nd-jmp-sub">${jEsc(sub)}</div>`:''}</div><button type="button" class="nd-jmp-x" aria-label="닫기">×</button></div><div class="nd-jmp-list"></div>${note?`<p class="nd-jmp-note">${jEsc(note)}</p>`:''}`;
  const list=box.querySelector('.nd-jmp-list');
  if(!rows.length)list.innerHTML=`<div class="nd-jmp-empty">${jEsc(empty||'처리할 항목이 없어요.')}</div>`;
  for(const r of rows){
   const li=document.createElement('div');li.className='nd-jmp-li';
   li.innerHTML=`<div class="nd-jmp-m"><div class="n">${jEsc(r.name)}${r.tag?` <span class="nd-jmp-tag">${jEsc(r.tag)}</span>`:''}</div><div class="d">${jEsc(r.meta||'')}</div></div><div class="nd-jmp-amt"${r.tone?` data-tone="${r.tone}"`:''}>${jEsc(r.amt||'')}</div><div class="nd-jmp-acts"></div>`;
   const acts=li.querySelector('.nd-jmp-acts');
   for(const a of r.actions||[]){const b=document.createElement('button');b.type='button';b.className='nd-jmp-b'+(a.primary?' p':'');b.textContent=a.label;b.onclick=async()=>{if(a.keep){acts.querySelectorAll('button').forEach(x=>x.disabled=true);const done=await a.fn(li);if(done){acts.innerHTML=`<span class="nd-jmp-done">${jEsc(done)}</span>`;}else acts.querySelectorAll('button').forEach(x=>x.disabled=false);return;}close();a.fn();};acts.append(b);}
   list.append(li);
  }
  const esc=e=>{if(e.key==='Escape'){e.stopPropagation();close();}};
  function close(){ov.remove();removeEventListener('keydown',esc,true);}
  ov.onclick=e=>{if(e.target===ov)close();};box.querySelector('.nd-jmp-x').onclick=close;addEventListener('keydown',esc,true);
  (document.getElementById('appView')||document.body).append(ov);
  return {close};
 }
 function jBanner(host,html,before){if(!host&&!before)return;document.querySelectorAll('#appView .nd-jbanner').forEach(x=>x.remove());const b=document.createElement('div');b.className='nd-jbanner';b.setAttribute('role','status');b.innerHTML=html;if(before)before.before(b);else host.prepend(b);}
 function jFocus(el){if(!el)return;el.classList.add('nd-jfocus');const off=()=>{el.classList.remove('nd-jfocus');el.removeEventListener('input',off);};el.addEventListener('input',off);requestAnimationFrame(()=>{el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true});});}
 function jOpenQuote(id){
  document.querySelectorAll('#appView .nd-jbanner').forEach(x=>x.remove());
  if(typeof currentView!=='undefined'&&currentView==='quotes'&&qtSel!==id&&!guardQtLeave())return false;
  qtSel=id;qtEditing=null;qtBaseline='';switchView('quotes');renderQtList();renderQtDetail();scrollToDetail('qtForm');return true;
 }
 /* ① 계산서 미발행 */
 function jTaxQuotes(cid){return db.quotes.filter(q=>QT_COMMITTED.includes(q.status)&&needsTax(q)&&(!cid||q.company_id===cid)).sort((a,b)=>(a.delivered_at||'').localeCompare(b.delivered_at||''));}
 async function jTaxOpen(id){
  if(!jOpenQuote(id))return;await jWait(120);
  const q=db.quotes.find(x=>x.id===id);
  const tab=document.getElementById('qp-tab-basic');if(tab&&tab.getClientRects().length&&tab.getAttribute('aria-selected')!=='true')tab.click();
  await jWait(60);
  jBanner(null,`<b>계산서 발행일</b>을 넣고 저장하세요 · ${jEsc(coName(q.company_id))} ${jEsc(jWon(deliveredAmount(q)))}`,document.getElementById('fq_tax')?.closest('.field'));
  jFocus(document.getElementById('fq_tax'));
 }
 async function jTaxToday(id){
  if(qtSel===id&&qtHasUnsavedChanges()){jTaxOpen(id);return '';}
  const day=localDate(),next=db.quotes.map(x=>x.id===id?{...x,tax_at:day}:x);
  if(!await saveTable('quotes',next))return '';
  db.quotes=next;try{renderers[currentView]?.();}catch{}
  return `✓ ${jMd(day)} 발행`;
 }
 function jTaxList(cid){
  const qs=jTaxQuotes(cid);
  if(qs.length===1&&cid){jTaxOpen(qs[0].id);return;}
  const total=qs.reduce((s,q)=>s+deliveredAmount(q),0);
  jSheet({title:`계산서 미발행 ${qs.length}건`,sub:`${jWon(total)} · 납품일 오래된 순`+(cid?` · ${coName(cid)}`:''),empty:'계산서를 모두 발행했어요.',
   note:qs.length?'[오늘 발행]은 계산서 발행일을 오늘로 바로 저장해요. 날짜를 바꾸려면 [열기].':'',
   rows:qs.map(q=>{const amt=deliveredAmount(q),d=daysSince(q.delivered_at);return {name:coName(q.company_id),tag:quotePaid(q.id)>=amt?'입금 완료':'',meta:`${q.no||''}${q.delivered_at?` · ${jMd(q.delivered_at)} 납품`:''}${d?` · ${d}일째`:''}`,amt:jWon(amt),
    actions:[{label:'열기',fn:()=>jTaxOpen(q.id)},{label:'오늘 발행',primary:true,keep:true,fn:()=>jTaxToday(q.id)}]};})});
 }
 /* ② 받을 금액 → 입금 */
 async function jPayFor(cid){
  document.querySelectorAll('#appView .nd-jbanner').forEach(x=>x.remove());
  const r=arData().find(x=>x.cid===cid);if(!r||r.open<=0)return;
  const qs=openQuotesOf(cid).slice().reverse(),q=qs[0];
  if(!switchView('payments')&&typeof currentView!=='undefined'&&currentView!=='payments')return;
  await jWait(80);
  const entry=document.getElementById('payEntry');if(entry)entry.open=true;
  const set=(id,v)=>{const el=document.getElementById(id);if(!el)return;el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
  set('payKind','수금');set('payCo',cid);
  const amt=document.getElementById('payAmt');if(amt)amt.value='';
  if(q)set('payQuote',q.id);
  const n=Math.min(r.open,q?quoteBalance(q):r.open);if(amt)amt.value=n.toLocaleString('ko-KR');
  await jWait(60);
  jBanner(entry?.querySelector('.pay-add')||entry,`받을 금액 <b>${jEsc(jWon(r.open))}</b> 입금을 기록합니다 · ${jEsc(coName(cid))}${q?` · ${jEsc(q.no||'')}`:''} · 금액이 다르면 고쳐서 저장하세요`);
  jFocus(amt);
 }
 function jPayList(){
  const rows=arData().filter(r=>r.open>0).sort((a,b)=>b.open-a.open);
  if(rows.length===1){jPayFor(rows[0].cid);return;}
  jSheet({title:`받을 금액 ${rows.length}곳`,sub:`${jWon(rows.reduce((s,r)=>s+r.open,0))} · 많은 순`,empty:'받을 금액이 남은 거래처가 없어요.',
   rows:rows.map(r=>({name:coName(r.cid),meta:`납품 ${jWon(r.delivered)} · 입금 ${jWon(r.paid)}${r.lastPay?` · 최근 입금 ${jMd(r.lastPay)}`:''}`,amt:jWon(r.open),tone:'red',actions:[{label:'입금 입력',primary:true,fn:()=>jPayFor(r.cid)}]}))});
 }
 /* ③ 재고 부족 → 입고 */
 function jShortGroups(){
  const g={};for(const [k,v] of Object.entries(currentStocks())){if(v>0)continue;const [item_id,color,spec]=k.split('|');const key=item_id+'|'+color;(g[key]||(g[key]={item_id,color,sizes:[]})).sizes.push({spec,lack:Math.max(0,-v)});}
  return Object.values(g).map(x=>({...x,item:db.items.find(i=>i.id===x.item_id),total:x.sizes.reduce((s,z)=>s+z.lack,0)})).filter(x=>x.item).sort((a,b)=>b.total-a.total);
 }
 async function jStockFor(gr){
  document.querySelectorAll('#appView .nd-jbanner').forEach(x=>x.remove());
  if(!switchView('stock')&&typeof currentView!=='undefined'&&currentView!=='stock')return;
  await jWait(100);
  const row=document.querySelector(`#view-stock [data-stock-id="${CSS.escape(gr.item_id)}"]`);row?.click();await jWait(200);
  if(jPhone())document.querySelector('#view-stock [data-go="stockRegister"]')?.click();else document.getElementById('stockRegister')?.click();
  await jWait(200);
  const set=(id,v)=>{const el=document.getElementById(id);if(!el||el.value===v)return;el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
  set('ivKind','입고');set('ivItem',gr.item_id);await jWait(80);set('ivColor',gr.color);await jWait(120);
  let first=null;
  for(const z of gr.sizes){if(!z.lack)continue;const lab=z.spec+' 수량';
   try{stockQuickValues[z.spec]=String(z.lack);}catch{}
   const all=[...document.querySelectorAll('#view-stock .stock-add input')].filter(i=>i.getAttribute('aria-label')===lab);
   for(const inp of all){inp.value=String(z.lack);inp.dispatchEvent(new Event('input',{bubbles:true}));if(!inp.matches('[data-stock-size]')){inp.classList.add('nd-jfocus');if(inp.getClientRects().length)first=first||inp;}}}
  const add=document.querySelector('#view-stock .stock-add');
  jBanner(add,gr.total?`<b>부족한 수량</b>을 미리 넣었어요 · 실제 입고 수량으로 고친 뒤 [변경 내용 확인]을 눌러 주세요`:`<b>${jEsc(gr.item.name)} · ${jEsc(gr.color)}</b> 입고 수량을 넣어 주세요`);
  (first||document.querySelector('#view-stock .stock-add input:not([type=hidden])'))?.scrollIntoView({block:'center',behavior:'smooth'});first?.focus({preventScroll:true});
 }
 function jShortList(){
  const gs=jShortGroups();
  jSheet({title:`재고 부족 ${gs.length}품목`,sub:'재고 0개 이하인 옵션 · 부족 많은 순',empty:'부족한 품목이 없어요.',
   rows:gs.map(x=>({name:`${x.item.name}${x.item.code?` [${x.item.code}]`:''} · ${x.color||'색상 없음'}`,meta:x.sizes.map(z=>`${z.spec||'기본'} ${z.lack?z.lack+' 부족':'품절'}`).join(' · '),amt:x.total?`${x.total}개`:'품절',tone:'amber',actions:[{label:'입고 입력',primary:true,fn:()=>jStockFor(x)}]}))});
 }
 /* ④ 미납품 → 납품 기록  ⑤ 회신 대기 → 견적서 '발송' */
 function jPendingQuotes(cid){return db.quotes.filter(q=>QT_COMMITTED.includes(q.status)&&quoteOrderedQty(q)>quoteDeliveredQty(q)&&(!cid||q.company_id===cid)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));}
 function jBasicTab(){const tab=document.getElementById('qp-tab-basic');if(tab&&tab.getClientRects().length&&tab.getAttribute('aria-selected')!=='true')tab.click();}
 async function jDeliverOpen(id){if(!jOpenQuote(id))return;await jWait(150);jBasicTab();await jWait(60);const b=document.getElementById('fd_open');if(b&&b.getClientRects().length)b.click();await jWait(120);const f=document.getElementById('fq_delivery_form');jBanner(f,'<b>남은 수량 전체 입력</b>을 누르거나 수량을 넣고 [납품 기록 추가] 뒤 견적서를 저장하세요');jFocus(document.getElementById('fd_fill_all'));}
 function jPendingList(cid){
  const qs=jPendingQuotes(cid);if(qs.length===1&&cid){jDeliverOpen(qs[0].id);return;}
  jSheet({title:`미납품 ${qs.length}건`,sub:'수주했지만 아직 다 납품하지 않은 견적 · 오래된 순',empty:'남은 납품이 없어요.',
   rows:qs.map(q=>({name:coName(q.company_id),meta:`${q.no||''} · ${jMd(q.date)} · 남은 ${quoteOrderedQty(q)-quoteDeliveredQty(q)}개`,amt:jWon(quoteAmount(q)-deliveredAmount(q)),actions:[{label:'납품 기록',primary:true,fn:()=>jDeliverOpen(q.id)}]}))});
 }
 function jSentQuotes(){if(switchView('quotes')===false)return;const s=document.getElementById('qtStatus');if(s&&s.value!=='발송'){s.value='발송';s.dispatchEvent(new Event('change',{bubbles:true}));}}
 /* 누를 수 있는 숫자 표시(›) — 렌더 때마다 다시 붙인다. 바뀔 때만 속성을 쓴다. */
 function jMark(el,go,cid){if(!el)return;const has=el.dataset.ndGo||'';if(go){if(has!==go)el.dataset.ndGo=go;if((cid||'')!==(el.dataset.ndCid||'')){if(cid)el.dataset.ndCid=cid;else delete el.dataset.ndCid;}if(!el.hasAttribute('tabindex'))el.tabIndex=0;if(el.getAttribute('role')!=='button')el.setAttribute('role','button');}else if(has){delete el.dataset.ndGo;delete el.dataset.ndCid;el.removeAttribute('tabindex');el.removeAttribute('role');}}
 const jPos=el=>{const t=(el?.textContent||'').replace(/[^\d-]/g,'');return !!t&&!t.startsWith('-')&&Number(t)>0;};
 function jumpMarks(){
  if(typeof arData!=='function')return;
  const ar=document.getElementById('view-ar');
  if(ar&&!ar.classList.contains('hidden')){
   jMark(document.getElementById('arUntaxed'),jPos(document.getElementById('arUntaxed'))&&'tax');
   jMark(document.getElementById('arOpen'),jPos(document.getElementById('arOpen'))&&'pay');
   jMark(document.getElementById('arPending'),jPos(document.getElementById('arPending'))&&'pending');
   const tbl=document.getElementById('arTbl'),view=document.getElementById('arView');
   if(tbl&&(!view||view.value!=='quote')){const rows=arRows(),trs=[...tbl.querySelectorAll('tbody>tr')];rows.forEach((r,i)=>{const tds=trs[i]?.children;if(!tds||tds.length<7)return;jMark(tds[4],r.open>0&&'pay',r.cid);jMark(tds[5],r.pending>0&&'pending',r.cid);jMark(tds[6],r.untaxed>0&&'tax',r.cid);});}
  }
  document.querySelectorAll('#view-dash .mo-sub>div').forEach(d=>{const k=d.querySelector('.k'),v=d.querySelector('.v');if(k&&v&&/미수금|받을 금액/.test(k.textContent))jMark(v,jPos(v)&&'pay');});
  const co=document.getElementById('view-companies');
  if(co&&!co.classList.contains('hidden')&&typeof coSel!=='undefined'&&coSel){co.querySelectorAll('.scr-hero').forEach(h=>{const l=h.querySelector('.lbl'),v=h.querySelector('.big');if(l&&v&&/미수금|받을 금액/.test(l.textContent))jMark(v,jPos(v)&&'pay',coSel);const t=h.querySelector('.sub b.tax-unissued');if(t)jMark(t,'tax',coSel);});}
 }
 const jRoute={tax:cid=>jTaxList(cid),pay:cid=>cid?jPayFor(cid):jPayList(),pending:cid=>jPendingList(cid)};
 const jTodo={'계산서 미발행':()=>jTaxList(),'재고 부족':()=>jShortList(),'회신 대기 견적':()=>jSentQuotes()};

 /* 대시보드 매출·입금 그래프 금액을 누르면 그 기간의 내역 창(규칙 2 작은 창). 그래프와 같은 계산:
    매출 = 납품 기록(납품일, deliveredLines+quoteTotals), 입금 = 수금(입금일, 취소 제외). 줄을 누르면 견적서 / 입금 기록으로. */
 let periodSheetEl=null;
 function periodSheet(kind,values){
  if(typeof db==='undefined')return;
  const key=values?.querySelector('b')?.textContent.trim()||'';if(!/^\d{4}(-\d\d){0,2}$/.test(key))return;
  const meta=values.closest('#view-dash')?.querySelector('.nd-db-chart-meta>span')?.textContent.match(/(\d{4}-\d\d-\d\d)\s*—\s*(\d{4}-\d\d-\d\d)/);
  const from=meta?.[1]||'0000-00-00',to=meta?.[2]||'9999-99-99',hit=d=>typeof d==='string'&&d.startsWith(key)&&d>=from&&d<=to;
  const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const co=id=>(db.companies||[]).find(c=>c.id===id)?.name||'거래처 없음',won=v=>Math.round(v).toLocaleString('ko-KR');
  let rows=[];
  if(kind==='sale'){for(const q of db.quotes||[])for(const d of q.deliveries||[])if(hit(d.date)){let amt=0;try{amt=quoteTotals({lines:deliveredLines(q,d)}).total;}catch{}rows.push({date:d.date,name:co(q.company_id),sub:q.no||'',amt,open:()=>{if(switchView('quotes')===false)return;if(typeof clearQtFilters==='function')clearQtFilters();qtSel=q.id;renderQtList();renderQtDetail();}});}}
  else for(const p of db.payments||[])if(p.kind==='수금'&&!p.void_at&&hit(p.date))rows.push({date:p.date,name:co(p.company_id),sub:[p.method,p.quote_id?(db.quotes||[]).find(x=>x.id===p.quote_id)?.no:''].filter(Boolean).join(' · '),amt:Number(p.amount)||0,open:()=>{if(switchView('payments')===false)return;openPaySheet(p.id);}});
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  const sum=rows.reduce((s,r)=>s+r.amt,0),label=kind==='sale'?'매출':'입금';
  if(!periodSheetEl){periodSheetEl=document.createElement('dialog');periodSheetEl.className='nd-pay-sheet nd-period-sheet';periodSheetEl.setAttribute('aria-labelledby','ndPerTtl');
   periodSheetEl.addEventListener('click',ev=>{if(ev.target===periodSheetEl)periodSheetEl.close();});(document.getElementById('appView')||document.body).append(periodSheetEl);}
  const d=periodSheetEl;
  d.innerHTML=`<div class="nd-ps-hd"><b id="ndPerTtl">${e(key)} ${label}</b><span class="nd-per-sum ${kind}">${won(sum)}원 · ${rows.length}건</span></div>
   <p class="nd-per-note">${kind==='sale'?'납품일 기준 · 부가세 포함 · 줄을 누르면 견적서로':'입금일 기준 · 줄을 누르면 입금 기록으로'}</p>
   <div class="nd-per-list">${rows.length?rows.map((r,i)=>`<button type="button" class="nd-per-row" data-i="${i}"><span class="nd-per-nm">${e(r.name)}</span><span class="nd-per-amt">${won(r.amt)}원</span><span class="nd-per-sub">${e(r.date)}${r.sub?' · '+e(r.sub):''}</span></button>`).join(''):`<p class="nd-per-empty">이 기간의 ${label} 내역이 없습니다.</p>`}</div>
   <div class="nd-ps-act nd-per-act"><button type="button" class="nd-ps-close" data-ps="close">닫기</button></div>`;
  d.querySelector('[data-ps="close"]').onclick=()=>d.close();
  d.querySelectorAll('.nd-per-row').forEach(b=>b.onclick=()=>{d.close();rows[+b.dataset.i].open();});
  if(!d.open){d.tabIndex=-1;d.showModal();d.focus({preventScroll:true});} // 첫 줄에 초점 테두리가 생기지 않게 창 자체에 초점
 }

 /* 요약 칸 = 대시보드 '10월 현황' 칸과 같은 모양(규칙 27). 누르면 그 목록으로 — 칸 전체가 버튼. */
 const STAT_LINKS={arDelivered:'delivered',arPaid:'paid',arPending:'pending',arUntaxed:'tax',paySumIn:'in',paySumOut:'out',paySumNet:'all'};
 function statLinks(){
  for(const [id,go] of Object.entries(STAT_LINKS)){const v=document.getElementById(id);const cell=v?.closest('.stat,.scr-hero');if(!cell||cell.dataset.ndStat===go)continue;
   cell.dataset.ndStat=go;cell.setAttribute('role','button');cell.tabIndex=0;cell.classList.add('nd-stat-link');}
  document.querySelectorAll('#view-stock .stats>.stock-kpi:not(.nd-stat-link)').forEach(b=>b.classList.add('nd-stat-link'));
  // 숫자 뒤 단위(원·종)는 대시보드처럼 작게 — 앱이 글자를 다시 쓰면 다음 패스에서 다시 나눈다(같으면 손대지 않음)
  document.querySelectorAll('#view-ar .stats .stat>.v, #view-stock .stats .stat>.v, #view-payments .ops-summary :is(.stat>.v,.scr-hero>.big)').forEach(v=>{if(v.children.length)return;const m=v.textContent.match(/^(.*\d)\s*(원|종|개|곳|건)$/);if(m)v.innerHTML=m[1].replace(/[&<>]/g,'')+'<small class="nd-cur">'+m[2]+'</small>';});
 }
 const setSel=(id,val)=>{const s=document.getElementById(id);if(s&&s.value!==val){s.value=val;s.dispatchEvent(new Event('change',{bubbles:true}));}};
 const statRoute={
  delivered:()=>{if(switchView('quotes')===false)return;setSel('qtStatus','납품');},
  paid:()=>{if(switchView('payments')===false)return;setSel('payFilter','수금');},
  pending:()=>jPendingList(),tax:()=>jTaxList(),
  in:()=>setSel('payFilter','수금'),out:()=>setSel('payFilter','지급'),all:()=>setSel('payFilter','')};

 /* 업체 제공 자재(PC): 조회 기준일·재고내역서는 오른쪽 헤더 아래 줄(제목 아래, 왼쪽)로 — 다른 화면처럼 '이 화면을 고르는 도구'는 헤더에. 폰은 제자리. */
 const matDesk=matchMedia('(min-width:1024px)');
 function materialHeadTools(){
  const head=document.querySelector('#view-materials .material-detail-head'),ctl=document.querySelector('#view-materials .material-statement-controls');
  if(!head||!ctl)return;
  if(matDesk.matches){if(ctl.parentElement!==head){if(!ctl.previousSibling||ctl.previousSibling.nodeType!==8||ctl.previousSibling.data!=='nd-mat-tools'){ctl.before(document.createComment('nd-mat-tools'));}ctl.__ndHome=ctl.previousSibling;head.append(ctl);ctl.classList.add('nd-mh-tools');}}
  else if(ctl.parentElement===head&&ctl.__ndHome?.parentNode){ctl.__ndHome.after(ctl);ctl.classList.remove('nd-mh-tools');}
 }
 matDesk.addEventListener('change',()=>materialHeadTools());

 /* 품목 고르기 목록(B안, 10/8): 이름이 같은 품목은 이름을 한 번만(묶음 머리 'N종'), 그 아래 줄은 품번을 크게.
    폰 견적서 '품목 검색'(.qp-results)과 PC 품목 고르기(.ip-list) 공통. 앱이 목록을 다시 그릴 때마다 다시 묶는다.
    가나다순이라 같은 이름은 늘 붙어 있다. 카테고리와 상관없이 '같은 이름'으로 묶는다. */
 function groupPickRows(list){
  const ip=list.classList.contains('ip-list');
  list.querySelectorAll(':scope>.nd-grp').forEach(h=>h.remove());
  list.querySelectorAll(':scope>.nd-grp-in').forEach(r=>r.classList.remove('nd-grp-in'));
  const rows=[...list.children].filter(r=>ip?(r.classList.contains('ip-opt')&&r.dataset.id!=='__free__'):(r.classList.contains('qp-result')&&r.querySelector('strong')));
  const nameOf=r=>(ip?r.querySelector('.nm'):r.querySelector('strong'))?.textContent.trim()||'';
  for(let i=0;i<rows.length;){let j=i;const n=nameOf(rows[i]);while(j+1<rows.length&&nameOf(rows[j+1])===n&&rows[j+1].previousElementSibling===rows[j])j++;
   if(n&&j>i){const h=document.createElement('div');h.className='nd-grp';h.setAttribute('aria-hidden','true');const b=document.createElement('b');b.textContent=n;const c=document.createElement('span');c.textContent=(j-i+1)+'종';h.append(b,c);rows[i].before(h);for(let k=i;k<=j;k++)rows[k].classList.add('nd-grp-in');}
   i=j+1;}
 }
 const pickMo=new MutationObserver(recs=>{
  const lists=new Set();
  for(const r of recs){const t=r.target;if(t.nodeType===1&&t.matches?.('.qp-results,.ip-list'))lists.add(t);
   r.addedNodes.forEach(n=>{if(n.nodeType===1)n.querySelectorAll?.('.qp-results,.ip-list').forEach(l=>lists.add(l));});}
  if(!lists.size)return;lists.forEach(groupPickRows);pickMo.takeRecords(); // 우리가 넣은 머리 줄 변화는 버린다
 });
 // 10/8 사용자 요청: 묶지 않고 모두 한 줄씩 나열(모자처럼). 묶음 코드는 남겨 두되 켜지 않는다.
 // pickMo.observe(document.body,{childList:true,subtree:true});

 /* 부가세 포함 단가 줄 범례: 견적서 품목 제목 줄 오른쪽에 한 번(금액 칸은 숫자만). 같으면 손대지 않는다. */
 function vatIncLegend(){
  const f=document.getElementById('qtForm');if(!f)return;
  const e=typeof qtEditing!=='undefined'?qtEditing:null;
  const lines=(e?.lines||[]).filter(l=>(l.name||'').trim()&&(Number(l.qty)||0)>0),inc=lines.filter(l=>l.vat_inc).length;
  const mode=!inc?'':inc===lines.length?'all':'mixed';
  if((f.dataset.vinc||'')!==mode){if(mode)f.dataset.vinc=mode;else delete f.dataset.vinc;}
  const cls='nd-vinc-lg'+(mode==='mixed'?' mixed':''),txt=mode==='all'?'단가·금액 부가세 포함':'부가세 포함 단가';
  const put=t=>{if(!t)return;let lg=t.querySelector(':scope>.nd-vinc-lg');if(!mode){lg?.remove();return;}
   if(!lg){lg=document.createElement('span');t.append(lg);}if(lg.className!==cls)lg.className=cls;if(lg.textContent!==txt)lg.textContent=txt;};
  put([...f.querySelectorAll('.qt-sec-t')].find(x=>/^품목/.test(x.textContent.trim())));        // PC 품목 제목 줄
  put(f.querySelector('.qp-cards>section:first-child>h3'));                                    // 폰 카드 '품목 N건'
  const incIds=new Set(lines.filter(l=>l.vat_inc).map(l=>l.id));                              // 폰: 섞였을 때 그 카드 금액 앞 점
  f.querySelectorAll('.qp-card').forEach(c=>{const id=c.querySelector('[data-qp-edit]')?.dataset.qpEdit;const on=mode==='mixed'&&incIds.has(id);if(c.classList.contains('nd-vinc')!==on)c.classList.toggle('nd-vinc',on);});
 }
 function jClick(e){
  const app=document.getElementById('appView');if(!app||!app.contains(e.target))return false;
  const sc=e.target.closest?.('[data-nd-stat]');if(sc&&statRoute[sc.dataset.ndStat]){statRoute[sc.dataset.ndStat]();return true;}
  const dv=e.target.closest?.('#view-dash .nd-db-values :is(.nd-db-sale,.nd-db-receipt)');
  if(dv){periodSheet(dv.classList.contains('nd-db-sale')?'sale':'receipt',dv.closest('.nd-db-values'));return true;}
  const go=e.target.closest?.('[data-nd-go]');
  if(go){jRoute[go.dataset.ndGo]?.(go.dataset.ndCid||'');return true;}
  const tile=e.target.closest?.('#view-dash .todo-tile'),label=tile?.querySelector('.tl')?.textContent.trim();
  if(tile&&jTodo[label]){jTodo[label]();return true;}
  const sug=e.target.closest?.('#view-dash .sug .sbtn')?.closest('.sug'),cat=sug?.querySelector('.scat')?.textContent.trim();
  if(sug&&jTodo[cat]){jTodo[cat]();return true;}
  return false;
 }
 document.addEventListener('click',e=>{try{if(jClick(e)){e.preventDefault();e.stopImmediatePropagation();}}catch(err){}},true);
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest?.('[data-nd-go],[data-nd-stat]')){e.preventDefault();jClick(e);}},true);
 // 저장 버튼 상태: 저장된 그대로면 회색 '저장됨', 고치기 시작하면 파란 '저장'. 새로 만드는 중('등록')은 그대로.
 // 회색이어도 누를 수는 있다(재고 반영을 다시 하려고 견적을 다시 저장하는 경우 등).
 const SAVE_STATE=[['qtSaveBtn',()=>typeof qtHasUnsavedChanges==='function'&&!qtHasUnsavedChanges()],['coSaveBtn',()=>typeof masterHasUnsavedChanges==='function'&&!masterHasUnsavedChanges('companies')],['itSaveBtn',()=>typeof masterHasUnsavedChanges==='function'&&!masterHasUnsavedChanges('items')]];
 function saveState(){
  for(const [id,clean] of SAVE_STATE){
   const b=document.getElementById(id);if(!b||b.children.length)continue;
   const t=b.textContent.trim();if(t!=='저장'&&t!=='저장됨'){if(b.classList.contains('nd-saved'))b.classList.remove('nd-saved');continue;}
   let saved=false;try{saved=clean();}catch{}
   if(b.classList.contains('nd-saved')!==saved)b.classList.toggle('nd-saved',saved);
   const label=saved?'저장됨':'저장';if(t!==label)b.textContent=label;
   const aria=saved?'저장됨 — 바뀐 내용 없음':'저장';if(b.getAttribute('aria-label')!==aria)b.setAttribute('aria-label',aria);
  }
 }
 let saveStateQueued=false;const saveStateSoon=()=>{if(saveStateQueued)return;saveStateQueued=true;requestAnimationFrame(()=>{saveStateQueued=false;try{saveState();}catch{}});};
 for(const ev of ['input','change','click'])document.addEventListener(ev,saveStateSoon,true);
 // 폰: 목록 화면인지 상세 화면인지(data-nd-phone="list|detail") — 목록이면 흰 바탕. 바뀔 때만 쓴다.
 function phoneListState(){
  const shown=el=>!!el&&getComputedStyle(el).display!=='none';
  const st={
   quotes:v=>!document.getElementById('qtCols')?.classList.contains('detail-open'),
   companies:v=>!v.classList.contains('mobile-record-open'),
   items:v=>!shown(v.querySelector(':scope>.cols>.card:nth-child(2)')),
   payments:()=>true,
   stock:v=>!v.classList.contains('nd-st-open'),
   materials:v=>!v.classList.contains('nd-mm-open')};
  for(const [k,fn] of Object.entries(st)){const v=document.getElementById('view-'+k);if(!v)continue;const want=fn(v)?'list':'detail';if(v.dataset.ndPhone!==want)v.dataset.ndPhone=want;}
 }
 // 업체 제공 자재: 칩의 '· N개'와 큰 숫자가 같은 내용 → 칩은 이름만, 자재가 하나면 칩 줄을 숨기고, 여럿이면 큰 숫자 위 글자는 '남은 수량'.
 function materialDedupe(){
  const tabs=document.querySelector('#view-materials .material-type-tabs');if(!tabs)return;
  const list=[...tabs.querySelectorAll('.material-type-tab')];
  for(const t of list){const m=/^(.*?)\s*·\s*([\d,]+개)$/.exec(t.textContent.trim());if(m){t.textContent=m[1];t.title=m[1]+' '+m[2]+' 남음';}}
  const single=list.length<=1;if(tabs.hidden!==single)tabs.hidden=single;
  const label=document.querySelector('#view-materials .material-balance-hero>span');
  if(label&&!single&&label.textContent!=='남은 수량')label.textContent='남은 수량';
 }
 // 폰 품목: 목록 ↔ 상세(‹ 품목) — 상세가 열리면 목록·머리 줄을 숨기고 카드 맨 위에 '‹ 품목' 한 줄(견적서 '‹ 견적서'와 같은 모양).
 // 입금·출금(시안 확정 2026-10): 말은 입금·출금·차액 하나로, 목록의 X 대신 줄을 누르면 기록 창 → [삭제].
 function payTidy(){
  const v=document.getElementById('view-payments');if(!v)return;
  const setT=(el,t)=>{if(el&&el.textContent!==t)el.textContent=t;};
  const ym=/^(\d{4})-(\d{2}) /,thisYear=String(new Date().getFullYear());
  for(const id of ['paySumIn','paySumOut']){const l=document.getElementById(id)?.previousElementSibling;if(l&&ym.test(l.textContent))setT(l,l.textContent.replace(ym,(m,y,mo)=>(y===thisYear?'':y+'년 ')+(+mo)+'월 '));}
  const net=document.getElementById('paySumNet');setT(net?.previousElementSibling,'차액 (입금 − 출금)');setT(net?.parentElement.querySelector('.hint'),'직접 기록한 입금·출금만');
  const card=document.getElementById('payByCo')?.closest('.card');setT(card?.querySelector('h3'),'거래처별 집계');setT(card?.querySelector('.legend'),'차액 = 입금 − 출금');
  v.querySelectorAll('#payByCo td .sub').forEach(x=>{if(x.textContent.trim()==='—')x.textContent='0';});
  v.querySelectorAll('#payTbl tbody tr').forEach(tr=>{
   const rm=tr.querySelector('.rm');if(!rm)return;
   if(tr.dataset.ndPay!==rm.dataset.id){tr.dataset.ndPay=rm.dataset.id;tr.tabIndex=0;tr.setAttribute('aria-label','기록 보기');}
   const kind=tr.children[4]?.textContent.trim()==='출금'?'out':'in';if(tr.dataset.kind!==kind)tr.dataset.kind=kind;
   const memo=tr.children[2]?.textContent.trim(),none=!memo||memo==='—';if(tr.classList.contains('nd-nomemo')!==none)tr.classList.toggle('nd-nomemo',none);
   const qn=tr.children[3]?.textContent.trim(),noq=!qn||qn==='—';if(tr.classList.contains('nd-noquote')!==noq)tr.classList.toggle('nd-noquote',noq);
  });
  // 거래처별 차액: 받은 쪽이 많으면 +를 붙여 목록 금액(+입금 · −출금)과 같은 읽기 방식
  v.querySelectorAll('#payByCo tbody tr>td:nth-child(5)').forEach(td=>{const t=td.textContent.trim();if(/^[1-9][\d,]*$/.test(t))td.textContent='+'+t;else if(/^-[\d,]+$/.test(t))td.textContent='−'+t.slice(1);});
 }
 // Mobile records-first presentation. Original controls, form nodes and handlers are retained;
 // no payment data, calculation or persistence is implemented in this adapter.
 const PAY_PHONE=matchMedia('(max-width:780px)');let payPhoneUI=null;
 PAY_PHONE.addEventListener('change',()=>paymentsMobile());
 function paymentsMobile(){
  const v=document.getElementById('view-payments');if(!v)return;
  if(!PAY_PHONE.matches){if(payPhoneUI?.dialog.open)payPhoneUI.dialog.close();return;}
  const head=v.querySelector(':scope>.page-head'),summary=v.querySelector('.ops-summary'),entry=document.getElementById('payEntry'),results=document.getElementById('payResults'),byCo=document.getElementById('payByCo')?.closest('.card');
  if(!head||!summary||!entry||!results||!byCo||!head.querySelector('.nd-tools'))return;
  if(!payPhoneUI){
   const create=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;return el;};
   const add=create('button','nd-pay-mobile nd-pay-record');add.type='button';add.textContent='기록하기';head.append(add);
   add.onclick=()=>{closePop();document.getElementById('payInbound')?.click();};
   const period=create('p','nd-pay-mobile nd-pay-period-label');summary.before(period);
   const tabs=create('div','nd-pay-mobile nd-pay-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','입출금 구분');
   for(const [value,label] of [['','전체'],['수금','입금'],['지급','출금']]){const b=create('button','');b.type='button';b.dataset.kind=value;b.textContent=label;b.onclick=()=>{const select=document.getElementById('payFilter');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));paymentsMobile();};tabs.append(b);}results.before(tabs);
   const toggle=create('button','nd-pay-mobile nd-pay-company');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','payByCo');
   toggle.innerHTML='<span>거래처별 집계</span>'+svgI('<path d="m9 5 7 7-7 7"/>');byCo.prepend(toggle);byCo.classList.add('nd-pay-company-card');
   toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));byCo.classList.toggle('nd-pay-company-open',open);};
   const note=create('p','nd-pay-mobile nd-pay-note');note.textContent='직접 기록한 입금·출금만 표시합니다.';byCo.after(note);
   const dialog=create('dialog','nd-pay-entry-sheet');dialog.setAttribute('aria-labelledby','ndPayEntryTitle');
   dialog.innerHTML='<div class="nd-pay-entry-head"><h3 id="ndPayEntryTitle">입금·출금 기록</h3><button type="button" aria-label="기록 입력 닫기">×</button></div>';v.append(dialog);
   let marker=null;
   const restore=()=>{if(marker){marker.replaceWith(entry);marker=null;}entry.open=false;};
   const dismiss=()=>{restore();dialog.close();};
   dialog.querySelector('button').onclick=dismiss;dialog.addEventListener('close',()=>{restore();if(PAY_PHONE.matches&&!v.classList.contains('hidden'))add.focus({preventScroll:true});});
   dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
   dialog.addEventListener('click',e=>{if(e.target===dialog)dismiss();});
   const syncEntry=()=>{if(PAY_PHONE.matches&&entry.open&&!dialog.open){marker=document.createComment('payment-entry-home');entry.before(marker);dialog.append(entry);dialog.showModal();document.getElementById('payCo')?.focus();}else if(!entry.open&&dialog.open)dialog.close();};
   new MutationObserver(syncEntry).observe(entry,{attributes:true,attributeFilter:['open']});
   payPhoneUI={dialog,period,tabs,syncEntry};
  }
  const {period,tabs,syncEntry}=payPhoneUI,get=id=>document.getElementById(id)?.value||'';
  const mode=get('payPeriod'),month=get('payMonth'),from=get('payFrom'),to=get('payTo');
  const label=mode==='all'?'전체 기간':mode==='range'?`${from||'시작일'} – ${to||'종료일'}`:month?month.replace('-','년 ')+'월':'조회 월 선택';
  if(period.textContent!==label)period.textContent=label;
  for(const b of tabs.children){const pressed=String(b.dataset.kind===get('payFilter'));if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);}
  syncEntry();
 }
 // 글자 기호(+ ＋ ‹)는 글꼴마다 높이·크기가 달라(맥에서 처짐) 버튼 글자와 어긋난다 → 기호를 떼고 CSS로 그린 아이콘을 붙인다(nd-gi-plus / nd-gi-back).
 function glyphTidy(){
  const root=document.getElementById('appView');if(!root)return;
  // 검색 돋보기는 앱 전체 한 모양(.nd-tsearch와 같은 선 1.8·원 r7) — 옛 .search 아이콘(선 2·r8)을 바꿔 둔다
  root.querySelectorAll('.search>svg:not([data-nd-mag])').forEach(g=>{g.setAttribute('data-nd-mag','');g.setAttribute('stroke-width','1.8');g.setAttribute('aria-hidden','true');g.innerHTML='<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>';});
  const md=document.getElementById('mm_detail');if(md){if(md.getAttribute('aria-label')!=='상세 입력')md.setAttribute('aria-label','상세 입력');const want=matchMedia('(max-width:780px)').matches?'상세':'상세 입력';if(md.textContent!==want)md.textContent=want;} // 폰 아래 바는 좁아 '상세'
  for(const b of root.querySelectorAll('button,a,.btn')){
   const t=b.firstChild;if(!t||t.nodeType!==3)continue;
   const m=/^\s*([+＋‹])\s*/.exec(t.nodeValue);if(!m||!t.nodeValue.slice(m[0].length).trim())continue;
   t.nodeValue=t.nodeValue.slice(m[0].length);
   const kind=m[1]==='‹'?'nd-gi-back':'nd-gi-plus';if(!b.classList.contains(kind))b.classList.add(kind);
   const d=getComputedStyle(b).display;const f=/^inline/.test(d)?'nd-gi-i':'nd-gi-f';if(!b.classList.contains(f))b.classList.add(f);
  }
 }
 // 재고 입력(A안 확정): 입고·출고는 입력 칸 맨 위 탭으로 고른다(구분 = 탭, 버튼 아님). 확인 버튼 글자·색이 구분을 따라간다.
 // 재고 조정(시안 확정): 실제로 센 수량을 적으면 사이즈마다 차이만큼 입고(+)/출고(−) 기록을 '재고 조정' 표시와 사유로 남긴다.
 // 지난 기록은 고치지 않는다(앱의 재고 장부 규칙과 같음). 저장은 앱의 최종 확인 창(openStockReview)을 그대로 거친다.
 let stockAdj=false,stockAdjReason='재고 조사';
 const ADJ_REASONS=['재고 조사','분실','파손·불량','잘못 입력'];
 function stockAdjLabel(changed,diff){
  const b=document.getElementById('ivAddBtn');if(!b)return;
  const t=changed?`조정 확인 · ${changed}개 사이즈 ${diff>0?'+':diff<0?'−':''}${Math.abs(diff).toLocaleString('ko-KR')}`:'조정 확인';
  if(b.textContent!==t)b.textContent=t;if(b.dataset.kind!=='adj')b.dataset.kind='adj';
 }
 function stockAdjEntries(){
  const get=id=>document.getElementById(id)?.value||'',item_id=get('ivItem'),color=get('ivColor'),date=get('ivDate'),memo=get('ivMemo').trim(),cur=currentStocks();
  const nowOf=spec=>cur[stockKeyOf({item_id,color,spec})]||0;
  const pairs=document.querySelector('#stockQuickEntry .nd-sz')?Object.entries(stockQuickValues).filter(([,v])=>String(v).trim()!==''):[[get('ivSpec'),get('ivQty').replace(/,/g,'')]].filter(([,v])=>v.trim()!=='');
  const out=[];
  for(const [spec,raw] of pairs){const act=stockStrictQty(raw,true),now=nowOf(spec),d=act-now;if(!d)continue;
   out.push({item_id,color,date,spec,kind:d>0?'입고':'출고',qty:Math.abs(d),memo:`재고 조정 · ${stockAdjReason} · 장부 ${now} → 실제 ${act}`+(memo?` · ${memo}`:''),adjust:{reason:stockAdjReason,book:now,actual:act}});}
  return out;
 }
 function setStockAdj(on){
  if(stockAdj===on)return;stockAdj=on;
  try{stockQuickValues={};}catch{} const q=document.getElementById('ivQty');if(q)q.value='';
  const area=document.getElementById('stockQuickEntry');if(area){area.querySelector('.nd-sz')?.remove();delete area.dataset.ndKey;}
  if(on){const k=document.getElementById('ivKind');if(k&&k.value!=='입고'){k.value='입고';k.dispatchEvent(new Event('change',{bubbles:true}));}}
  stockKindTabs();stockMatrix();
 }
 document.addEventListener('click',e=>{
  if(e.target.closest?.('#ivAddBtn')&&stockAdj){e.preventDefault();e.stopImmediatePropagation();
   try{const entries=stockAdjEntries();if(!entries.length){toast?.('바뀌는 수량이 없어요. 실제로 센 수량을 적어 주세요.');return;}
    openStockReview({kind:'add',entries});const d=document.getElementById('stockReviewDialog');if(d){const h=d.querySelector('#stockReviewTitle');if(h)h.textContent='재고 조정 최종 확인';const p=h?.nextElementSibling;if(p)p.textContent=p.textContent.replace(/ · (입고|출고)$/,' · 재고 조정 · '+stockAdjReason);}
   }catch(err){toast?.(err.message);}return;}
  if(e.target.closest?.('#stockAdjust')){e.preventDefault();e.stopImmediatePropagation();document.getElementById('stockRegister')?.click();setStockAdj(true);requestAnimationFrame(()=>document.querySelector('#view-stock .stock-add')?.scrollIntoView({block:'start'}));return;}
  if(e.target.closest?.('#stockRegister,#stockOutbound'))setStockAdj(false);
 },true);
 function stockBtnLabel(total){
  const b=document.getElementById('ivAddBtn'),k=document.getElementById('ivKind');if(!b)return;if(stockAdj){stockAdjLabel(0,0);return;}
  const out=k?.value==='출고',t=`${out?'출고':'입고'} ${total?(Math.round(total).toLocaleString('ko-KR')+'개 '):''}확인`;
  if(b.textContent!==t)b.textContent=t;const kd=out?'out':'in';if(b.dataset.kind!==kd)b.dataset.kind=kd;
 }
 function stockKindTabs(){
  const add=document.querySelector('#view-stock .stock-add'),sel=document.getElementById('ivKind');if(!add||!sel)return;
  let bar=add.querySelector(':scope>.nd-sk-tabs');
  if(!bar){bar=document.createElement('div');bar.className='nd-sk-tabs';
   bar.innerHTML='<div class="nd-sk-tl" role="tablist" aria-label="구분"><button type="button" role="tab" data-v="입고"><i class="nd-sk-ic p" aria-hidden="true"></i>입고</button><button type="button" role="tab" data-v="출고"><i class="nd-sk-ic m" aria-hidden="true"></i>출고</button><button type="button" role="tab" data-v="조정"><i class="nd-sk-ic eq" aria-hidden="true"></i>조정</button></div><span class="nd-sk-hint"></span>';
   add.prepend(bar);
   bar.addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b)return;if(b.dataset.v==='조정'){setStockAdj(true);return;}setStockAdj(false);if(sel.value===b.dataset.v){stockKindTabs();return;}sel.value=b.dataset.v;sel.dispatchEvent(new Event('change',{bubbles:true}));stockKindTabs();});
   const rs=document.createElement('div');rs.className='nd-sk-reason';rs.innerHTML='<span class="nd-sk-rl">조정 사유</span><div class="nd-sk-rc" role="radiogroup" aria-label="조정 사유">'+ADJ_REASONS.map(r=>`<button type="button" role="radio" data-r="${r}">${r}</button>`).join('')+'</div>';add.append(rs);
   rs.addEventListener('click',e=>{const b=e.target.closest('button[data-r]');if(!b)return;stockAdjReason=b.dataset.r;stockKindTabs();});
   sel.closest('label')?.classList.add('nd-sk-src');}
  const v=stockAdj?'조정':sel.value==='출고'?'출고':'입고',kd=stockAdj?'adj':v==='출고'?'out':'in';
  add.querySelectorAll('.nd-sk-rc>button').forEach(b=>{const on=String(b.dataset.r===stockAdjReason);if(b.getAttribute('aria-checked')!==on)b.setAttribute('aria-checked',on);});
  const ql=document.querySelector('#view-stock .stock-add>label:has(#ivQty)');if(ql){const tn=ql.firstChild;const want=stockAdj?'실제 수량':'수량';if(tn&&tn.nodeType===3&&tn.nodeValue.trim()!==want)tn.nodeValue=want;}
  if(bar.dataset.kind!==kd)bar.dataset.kind=kd;if(add.dataset.kind!==kd)add.dataset.kind=kd;
  bar.querySelectorAll('button[data-v]').forEach(b=>{const on=String(b.dataset.v===v);if(b.getAttribute('aria-selected')!==on){b.setAttribute('aria-selected',on);b.tabIndex=on==='true'?0:-1;}});
  const h=bar.querySelector('.nd-sk-hint'),ht=stockAdj?'실제로 센 수량에 맞춰요':v==='출고'?'나간 수량을 빼요':'들어온 수량을 더해요';if(h.textContent!==ht)h.textContent=ht;
  // 최근 입출고 내역: 조정 기록은 [조정] 꼬리표 + 부호 있는 수량(+ 늘어남 · − 줄어듦)
  document.querySelectorAll('#view-stock .stock-history-title+.tbl-wrap tbody tr').forEach(tr=>{
   const memo=tr.querySelector('.ledger-memo');if(!memo||!/^재고 조정 · /.test(memo.textContent.trim()))return;
   const pill=tr.querySelector('.pill'),num=tr.querySelector('td.num');if(!pill||!num)return;
   const out=pill.classList.contains('out')||pill.textContent.trim()==='출고';
   if(!pill.classList.contains('adj')){pill.classList.add('adj');pill.textContent='조정';}
   const q=num.textContent.replace(/^[+−-]/,''),t=(out?'−':'+')+q;if(num.textContent!==t){num.textContent=t;num.classList.toggle('neg',out);num.classList.toggle('pos',!out);}
  });
  // 아래 품목 표 제목 '셰프복 [JK_01]' → 이름 + 얇은 회색 품번(품번 규칙)
  const oh=document.querySelector('#stockOverview>.stock-overview-heading>h3');
  if(oh&&!oh.querySelector('.nd-code')){const m=/^(.*?)\s*\[([^\]]+)\]\s*$/.exec(oh.textContent);if(m){oh.textContent=m[1]+' ';const c=document.createElement('span');c.className='nd-code';c.textContent=m[2];oh.append(c);}}
  if(!add.querySelector('.nd-sz')){if(stockAdj){let ch=0,df=0;try{const es=stockAdjEntries();ch=es.length;df=es.reduce((t,e)=>t+(e.kind==='입고'?1:-1)*e.qty,0);}catch{}stockAdjLabel(ch,df);}else stockBtnLabel(Number(String(document.getElementById('ivQty')?.value||'').replace(/[^\d.]/g,''))||0);}
 }
 document.addEventListener('input',e=>{if(e.target?.id==='ivQty')stockKindTabs();});
 // 입금·출금 · 업체 제공 자재 기록도 재고와 같은 규칙: 구분은 맨 위 탭, 저장 버튼 글자·색이 구분을 따라간다.
 function kindSaveLabels(){
  const pk=document.getElementById('payKind'),pb=document.getElementById('payAddBtn');
  if(pk&&pb){const out=pk.value==='지급',t=(out?'출금':'입금')+' 기록 저장',kd=out?'out':'in';if(pb.textContent!==t)pb.textContent=t;if(pb.dataset.kind!==kd)pb.dataset.kind=kd;}
  const mk=document.getElementById('mm_kind'),mb=document.getElementById('mm_save');
  if(mk&&mb){const lab=({'받음':'받음','작업 완료':'사용','반환':'반환','불량/분실':'불량·분실'})[mk.value]||mk.value,t=lab+' 기록 저장',kd=mk.value==='받음'?'in':'out';if(mb.textContent!==t)mb.textContent=t;if(mb.dataset.kind!==kd)mb.dataset.kind=kd;}
 }
 // 요약 칸(.stats) 구분선 규칙: 칸 사이 선은 위아래(가로선은 좌우) 14px 띄운다 — 원래 테두리가 있는 칸만 골라 테두리를 투명하게 두고 같은 자리에 짧은 선을 그린다.
 function statDividers(){
  // 선은 화면에 놓인 자리로 정한다: 같은 줄 옆 칸 사이 = 세로선(위아래 14px 띄움), 새 줄의 첫 칸·아래 칸 = 가로선(좌우 14px 띄움).
  // 원래 구분선이 있는 묶음(테두리가 하나라도 있는 칸)만 대상 — 카드 모양 묶음은 건드리지 않는다.
  document.querySelectorAll('#appView :is(.stats,.sl-metrics,#dashStats)').forEach(g=>{
   const kids=[...g.children].filter(k=>k.getClientRects().length);if(kids.length<2)return;
   if(!g.dataset.ndDiv){const has=kids.some(k=>{const c=getComputedStyle(k);return (parseFloat(c.borderLeftWidth)>0&&c.borderLeftStyle!=='none')||(parseFloat(c.borderTopWidth)>0&&c.borderTopStyle!=='none');});if(!has)return;g.dataset.ndDiv='1';}
   const top0=kids[0].getBoundingClientRect().top;
   kids.forEach((k,i)=>{const r=k.getBoundingClientRect(),p=i?kids[i-1].getBoundingClientRect():null;
    const sameRow=p&&Math.abs(r.top-p.top)<4,l=!!sameRow,t=r.top-top0>4; // 둘째 줄부터는 칸마다 위 가로선(줄 전체가 이어진다)
    if(k.classList.contains('nd-dl')!==l)k.classList.toggle('nd-dl',l);if(k.classList.contains('nd-dt')!==t)k.classList.toggle('nd-dt',t);
    if(!k.classList.contains('nd-div'))k.classList.add('nd-div');});
  });
 }
 addEventListener('resize',()=>{clearTimeout(statDividers.t);statDividers.t=setTimeout(statDividers,150);});
 // 폰 재고 입력 창: 아래 [입력 닫기][확인] 두 버튼을 한 줄 바로 묶는다(불투명 배경 + 위 구분선, 뒤 내용이 비치지 않게).
 function stockActBar(){
  const add=document.querySelector('#view-stock .stock-add'),c=document.getElementById('ivCancelBtn'),a=document.getElementById('ivAddBtn');if(!add||!c||!a)return;
  let bar=add.querySelector(':scope>.nd-sk-act');if(!bar){bar=document.createElement('div');bar.className='nd-sk-act';add.append(bar);}
  if(c.parentElement!==bar||a.parentElement!==bar||bar.firstElementChild!==c)bar.append(c,a);
 }
 // 폰 재고 입력 창 닫기: [입력 닫기] 뒤 바로 창·어두운 배경을 거둔다 / 창 밖(어두운 곳)을 눌러도 [입력 닫기]와 같게(저장 안 한 내용 확인 포함)
 document.addEventListener('click',e=>{
  const v=document.getElementById('view-stock');if(!v)return;
  if(e.target.closest?.('#ivCancelBtn')){setTimeout(()=>{stockMobile();},0);return;}
  if(v.classList.contains('nd-st-sheet')&&v.contains(e.target)&&!e.target.closest('.stock-add')&&e.target.closest('.cols>.card:nth-child(2)')){e.preventDefault();e.stopPropagation();document.getElementById('ivCancelBtn')?.click();}
 },true);
 // 창 밖을 누르면 닫힌다(모든 화면 공통): <dialog> 창의 바깥(어두운 곳)을 누르면 Esc와 같은 '취소'를 보낸다 —
 // 창마다 붙어 있는 닫기 규칙(저장 안 한 내용 확인 등)을 그대로 따르고, 막지 않으면 닫는다.
 document.addEventListener('click',e=>{
  const d=e.target;if(!(d instanceof HTMLDialogElement)||!d.open)return;
  const r=d.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)return;
  const ev=new Event('cancel',{cancelable:true});d.dispatchEvent(ev);if(!ev.defaultPrevented&&d.open)d.close();
 });
 // 폰 업체 제공 자재 '상세 기록' 창: 창 밖(어두운 곳)을 누르면 [닫기]와 같게
 document.addEventListener('click',e=>{
  const card=document.getElementById('materialEntryCard');if(!card||card.hidden||!matchMedia('(max-width:780px)').matches)return;
  const form=e.target.closest?.('#view-materials .material-detail-form');if(!form||card.contains(e.target))return;
  e.preventDefault();e.stopPropagation();document.getElementById('mm_edit_cancel')?.click();
 },true);
 // Safari can retain :focus-visible when a dialog returns focus to a tapped row.
 // Track input modality, not viewport/hover capability: touch devices can use keyboards too.
 function paymentFocusMode(doc=document){
  doc.addEventListener('pointerdown',()=>{
   const view=doc.getElementById('view-payments');
   if(view&&view.dataset.ndPayInput!=='pointer')view.dataset.ndPayInput='pointer';
  },true);
  doc.addEventListener('keydown',ev=>{
   if(ev.isComposing||['Shift','Control','Alt','Meta'].includes(ev.key))return;
   const view=doc.getElementById('view-payments');
   if(view)delete view.dataset.ndPayInput;
  },true);
 }
 paymentFocusMode();
 let paySheetEl=null;
 function openPaySheet(id){
  const p=(db.payments||[]).find(x=>x.id===id);if(!p)return;
  const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const out=p.kind==='지급',co=(db.companies||[]).find(c=>c.id===p.company_id)?.name||'',q=p.quote_id?(db.quotes||[]).find(x=>x.id===p.quote_id)?.no||'':'';
  const amt=Math.round(Number(p.amount)||0).toLocaleString('ko-KR');
  if(!paySheetEl){paySheetEl=document.createElement('dialog');paySheetEl.className='nd-pay-sheet';paySheetEl.setAttribute('aria-labelledby','ndPayTtl');
   paySheetEl.addEventListener('click',ev=>{if(ev.target===paySheetEl)paySheetEl.close();});(document.getElementById('appView')||document.body).append(paySheetEl);}
  const d=paySheetEl;
  d.innerHTML=`<div class="nd-ps-hd"><b id="ndPayTtl">${out?'출금':'입금'} 기록</b></div>
   <dl class="nd-ps-kv"><dt>거래처</dt><dd>${e(co)}</dd><dt>금액</dt><dd class="${out?'out':'in'}">${out?'−':'+'}${amt}원</dd><dt>날짜</dt><dd>${e(p.date)}</dd><dt>결제 방법</dt><dd>${e(p.method||'—')}</dd>${q?`<dt>연결 견적</dt><dd>${e(q)}</dd>`:''}${p.memo?`<dt>메모</dt><dd>${e(p.memo)}</dd>`:''}</dl>
   <div class="nd-ps-act"><button type="button" class="nd-ps-del" data-ps="del">삭제</button><button type="button" class="nd-ps-close" data-ps="close">닫기</button></div>`;
  d.querySelectorAll('[data-ps="close"]').forEach(b=>b.onclick=()=>d.close());
  d.querySelector('[data-ps="del"]').onclick=()=>{d.close();if(typeof deletePayment==='function')deletePayment(id);};
  d.tabIndex=-1;d.showModal();d.focus(); // 첫 초점은 창 자체 — 버튼에 테두리가 생기지 않고 Enter로 삭제되는 일도 없다
 }
 // 왼쪽 목록(PC)을 눌러도 같은 기록 창 — 원래 동작(줄 강조)이 끝난 뒤 강조된 줄의 기록을 연다.
 document.addEventListener('click',ev=>{if(!ev.target.closest?.('#view-payments .panel-b-index button'))return;setTimeout(()=>{const tr=document.querySelector('#payTbl tbody tr.panel-b-selected[data-nd-pay]');if(tr)openPaySheet(tr.dataset.ndPay);},0);});
 document.addEventListener('click',ev=>{const tr=ev.target.closest?.('#payTbl tbody tr[data-nd-pay]');if(!tr||ev.target.closest('a,button,input,select'))return;openPaySheet(tr.dataset.ndPay);});
 document.addEventListener('keydown',ev=>{if(ev.key!=='Enter'&&ev.key!==' ')return;const tr=ev.target.closest?.('#payTbl tbody tr[data-nd-pay]');if(tr&&ev.target===tr){ev.preventDefault();openPaySheet(tr.dataset.ndPay);}});
 const IT_PHONE=matchMedia('(max-width:780px)');IT_PHONE.addEventListener('change',()=>itemsMobile());
 function itemsMobile(){
  const cb=document.getElementById('coBackToList');if(cb&&cb.textContent!=='거래처'){cb.textContent='거래처';cb.classList.add('nd-gi-back','nd-gi-i');}
  const v=document.getElementById('view-items');if(!v||typeof itSel==='undefined')return;
  // mobile-record-open: 거래처·재고·자재와 같은 폰 상세 규칙(하단 메뉴 숨김 + 저장 영역 하단 고정)을 그대로 쓴다.
  const open=!!itSel&&IT_PHONE.matches;if(v.classList.contains('nd-it-open')!==open){v.classList.toggle('nd-it-open',open);v.classList.toggle('mobile-record-open',open);}
  const card=v.querySelector(':scope>.cols>.card:nth-child(2)');if(!card)return;
  let bar=card.querySelector(':scope>.nd-it-bar');
  if(!bar){bar=document.createElement('div');bar.className='nd-it-bar';bar.innerHTML='<button type="button" class="nd-it-back nd-gi-back nd-gi-i">품목</button>';card.prepend(bar);
   bar.querySelector('.nd-it-back').onclick=()=>{
    if(typeof masterHasUnsavedChanges==='function'&&masterHasUnsavedChanges('items')&&!confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'))return;
    itSel=null;itEditing=null;itFormBaseline='';renderers.items();requestAnimationFrame(()=>{v.scrollTop=0;});
   };}
 }
 const v5Again=()=>{if(v5Queued)return;v5Queued=true;requestAnimationFrame(()=>{v5Queued=false;try{railDocs();chips();actions();retireCsv();supplierAddress();settingsPolish();tools();stockMatrix();periodPresets();dashHover();navIcons();mobileNavPreferences();materialsMobile();colorTags();stockMobile();tableAlign();payKindChips();itemPickers();quoteAddRow();shortageTidy();advancePaid();jumpMarks();statLinks();saveState();payTidy();paymentsMobile();statDividers();stockActBar();stockKindTabs();kindSaveLabels();glyphTidy();itemsMobile();phoneListState();materialDedupe();materialHeadTools();window.NaroOrderImportUI?.ensure();vatIncLegend();watchMaterials();watchSettings();eyebrows();}catch(e){}});};
 const v5Watch=()=>{const main=document.querySelector('#appView');if(main&&!main.dataset.ndV5){main.dataset.ndV5='1';new MutationObserver(v5Again).observe(main,{childList:true,subtree:true});
  // 화면 상태(목록↔상세 등)는 class만 바뀌고 내용은 그대로일 때가 있다 → 화면(.view)의 class 변화에도 다시 맞춘다(거래처 뒤로 가기 뒤 회색 배경이 남던 것)
  const vo=new MutationObserver(v5Again);document.querySelectorAll('#appView .view,#qtCols').forEach(v=>vo.observe(v,{attributes:true,attributeFilter:['class','hidden']}));}};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{v5();v5Watch();}):(v5(),v5Watch());
 desk.addEventListener?.('change',scope);
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',scope):scope();
 document.readyState==='complete'?darkAuto():addEventListener('load',darkAuto,{once:true});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
 addEventListener('resize',()=>{try{tableAlign();}catch{}});
})();
