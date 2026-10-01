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
  ICON_DOC='<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>';
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
  const nodes=[sec,act('bizCardBtn','명함 보내기',ICON_CARD),act('bizCertBtn','사업자등록증',ICON_DOC)];
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
 function v5(){railDocs();chips();actions();
  const roots=['coForm','itForm','qtForm'].map(id=>document.getElementById(id)).filter(Boolean);
  if(roots.length){const mo=new MutationObserver(()=>{mo.disconnect();actions();roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));});roots.forEach(r=>mo.observe(r,{childList:true,subtree:true}));}}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',v5):v5();
 desk.addEventListener?.('change',scope);
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',scope):scope();
 document.readyState==='complete'?darkAuto():addEventListener('load',darkAuto,{once:true});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
