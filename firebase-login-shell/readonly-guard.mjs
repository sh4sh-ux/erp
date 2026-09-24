const filters=new Set(['coSearch','coType','itSearch','qtSearch','qtStatus','qtFrom','qtTo','payMonth','paySearch','payFilter','payFrom','payTo','payKindFilter','slFrom','slTo','slCo','slStatus','arFilter','arView','stockSearch','stockCategory','stockFilter']);
const ids=new Set(['logoutBtn','refreshBtn','brandBtn','menuBtn','closeNavBtn','moreNavBtn','navBackdrop','qtBackBtn','coBackToList','qtAllDates','qtClearFilters','qtFilterBtn','qtFilterBackdrop']);
export function installReadOnly({Table,StorageRepository}){
 const blocked=()=>{throw Object.assign(Error('READ_ONLY'),{code:'read-only'});};
 for(const key of Object.keys(Table))Table[key]=blocked;
 for(const key of Object.keys(StorageRepository))if(typeof StorageRepository[key]==='function')StorageRepository[key]=blocked;
 Object.freeze(Table);Object.freeze(StorageRepository);
 const observed=new WeakSet(),observers=[],shadows=[];
 function allowed(el){
  if(!el||el.nodeType!==1)return true;
  if(el.closest('#foundationLogin'))return true;
  if(ids.has(el.id)||filters.has(el.id))return true;
  if(el.getRootNode() instanceof ShadowRoot){
   if(el.closest('.actions,.facts .setting,.movelink'))return false;
   return !!el.closest('.seg,.kpi,.search,.filters,.pages,.inventory tbody,.headicons,.tabs,.movement .link');
  }
  return el.matches('.nav-item,.mobile-nav-item,[role="tab"],[data-view],[data-stock-filter],[data-mm-owner],[data-mm-material-tab]')||!!el.closest('#coList,#itList,#qtList')||el.matches('[data-stock-id]');
 }
 function scan(root){
  if(!observed.has(root)){observed.add(root);const observer=new MutationObserver(()=>scan(root));observer.observe(root,{childList:true,subtree:true});observers.push(observer);if(root instanceof ShadowRoot)shadows.push(root);}
  for(const el of root.querySelectorAll('*')){
   if(el.shadowRoot)scan(el.shadowRoot);
   if(el.matches('button,input,select,textarea,[role="button"]')&&!allowed(el)){
    if('disabled' in el)el.disabled=true;el.setAttribute('aria-disabled','true');el.title='READ ONLY';
   }
  }
 }
 for(const type of ['click','input','change','submit'])document.addEventListener(type,e=>{
  const path=e.composedPath();
  if(path.some(n=>n?.id==='foundationLogin'))return;
  const el=path.find(n=>n?.matches?.('button,input,select,textarea,[role="button"],form'));
  if(el&&!allowed(el)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 scan(document.getElementById('appView'));
 const refresh=()=>scan(document.getElementById('appView'));
 refresh.dispose=()=>{observers.forEach(o=>o.disconnect());shadows.forEach(s=>s.replaceChildren());};
 return refresh;
}
