/* Personal NARO presentation only: move original nodes, keep IDs/listeners.
   No repository access, network, persisted state, or cloned form controls. */
(() => {
 const app=document.getElementById('appView');if(!app)return;
 app.dataset.layoutSystem='b';
 const desktop=matchMedia('(min-width:1024px)');let undo=[];
 function move(node,target){if(!node||!target)return;const marker=document.createComment('panel-b-origin');node.before(marker);target.append(node);undo.push(()=>marker.replaceWith(node));}
 function split(id,title,leftSelectors,rightSelectors){
  const view=document.getElementById('view-'+id);if(!view||view.classList.contains('workspace-split'))return;
  const left=document.createElement('div'),right=document.createElement('div'),head=document.createElement('div');
  left.className='workspace-left';right.className='workspace-right';head.className='workspace-heading';
  left.setAttribute('aria-label',title+' 검색 및 목록');right.setAttribute('aria-label',title+' 상세');
  const label=document.createElement('span'),heading=document.createElement('h3');label.className='workspace-caption';label.textContent='NARO BIZ';heading.textContent=title;head.append(label,heading);
  const leftNodes=leftSelectors.map(s=>view.querySelector(s)),rightNodes=rightSelectors.map(s=>view.querySelector(s));
  leftNodes.forEach(n=>move(n,left));rightNodes.forEach(n=>move(n,right));
  view.append(left,head,right);view.classList.add('workspace-split','panel-b-split');
  undo.push(()=>{left.remove();head.remove();right.remove();view.classList.remove('workspace-split','panel-b-split');});
 }
 function mount(){
  if(!desktop.matches||undo.length)return;
  // Dashboard deliberately keeps its full-width overview; all other rail views split.
  split('stock','재고 상세',['.stock-tools','#stockItems'],['.stats','.stock-add','#stockOverview','.stock-history-title','.tbl-wrap:has(#ivHist)']);
  split('payments','입금·출금 상세',['.ops-actions','.ops-filters'],['.ops-summary','.card:has(#payTbl)','.card:has(#payByCo)']);
  // Read the already-rendered rows. Index navigation never changes filters or data.
  // Ledger row → list row (same anatomy as quote rows): counterparty + amount, then date · kind · method · note.
  function paymentRow(button,row){
   const cells=[...row.querySelectorAll('td')].map(c=>c.textContent.trim()),blank=v=>!v||v==='—'||v==='-';
   const pill=row.querySelector('.pill'),kind=pill?.textContent.trim()||'',out=pill?.classList.contains('out')||/지급|출금/.test(kind);
   const part=(cls,text)=>{const s=document.createElement('span');s.className=cls;s.textContent=text;return s;};
   const top=part('pbr-top',''),sub=part('pbr-sub',[cells[0],kind,cells[5],cells[2],cells[3]].filter(v=>!blank(v)).join(' · '));
   top.append(part('pbr-name',blank(cells[1])?'거래처 없음':cells[1]),part('pbr-amt'+(out?' out':' in'),(out?'−':'+')+(cells[6]||'')));
   button.classList.add('pbr');button.append(top,sub);
  }
  function index(id,sourceSelector,rowSelector,label){
   const view=document.getElementById('view-'+id),left=view?.querySelector('.workspace-left'),source=view?.querySelector(sourceSelector);
   if(!left||!source)return;
   const list=document.createElement('div');list.className='panel-b-index';list.setAttribute('aria-label',label+' 목록');left.append(list);
   let query='';
   if(id!=='payments'){const search=document.createElement('input');search.type='search';search.className='panel-b-search';search.placeholder=label+' 검색';search.setAttribute('aria-label',search.placeholder);list.before(search);search.oninput=()=>{query=search.value.trim();list.querySelectorAll('button').forEach(b=>b.hidden=!b.textContent.includes(query));};undo.push(()=>search.remove());}
   const refresh=()=>{
    const rows=[...source.querySelectorAll(rowSelector)].filter(row=>!row.querySelector('.empty')&&row.textContent.trim());
    list.replaceChildren();
    if(!rows.length){const note=document.createElement('p');note.className='hint';note.textContent='표시할 '+label+' 내역이 없습니다.';list.append(note);return;}
    rows.forEach(row=>{const button=document.createElement('button');button.type='button';
     if(id==='payments')paymentRow(button,row);
     else button.textContent=id==='sales'?row.querySelector('h3')?.textContent: id==='settings'?row.querySelector('h3')?.textContent:[...row.querySelectorAll('td')].slice(0,4).map(c=>c.textContent.trim()).filter(Boolean).join(' · ');
     if(!button.textContent)return;button.hidden=!button.textContent.includes(query);
     button.onclick=()=>{source.querySelectorAll('.panel-b-selected').forEach(n=>n.classList.remove('panel-b-selected'));row.classList.add('panel-b-selected');list.querySelectorAll('button').forEach(n=>n.classList.toggle('on',n===button));row.scrollIntoView({block:'nearest',behavior:'smooth'});};list.append(button);
    });
   };
   const observer=new MutationObserver(refresh);observer.observe(source,{childList:true,subtree:true});refresh();
   undo.push(()=>{observer.disconnect();source.querySelectorAll('.panel-b-selected').forEach(n=>n.classList.remove('panel-b-selected'));list.remove();});
  }
  index('payments','#payTbl','tbody tr','입출금');
  index('sales','#slBody',':scope>.card:has(h3)','거래처별 매출');
  index('settings','.sup-form','.sup-sec','설정');
  const settings=document.getElementById('view-settings');
  const collectSettingsCards=()=>{const body=settings?.querySelector('.workspace-right>.card');if(body)settings.querySelectorAll(':scope>.card').forEach(card=>move(card,body));};
  if(settings){const observer=new MutationObserver(collectSettingsCards);observer.observe(settings,{childList:true});collectSettingsCards();undo.push(()=>observer.disconnect());}
  const materials=document.getElementById('materialContent');
  const ownerSearch=()=>{const owners=materials?.querySelector('.material-owners');if(!owners||owners.querySelector('.panel-b-search'))return;
   const search=document.createElement('input');search.type='search';search.className='panel-b-search';search.placeholder='업체 검색';search.setAttribute('aria-label','자재 보유 업체 검색');owners.prepend(search);
   search.oninput=()=>owners.querySelectorAll('.material-owner').forEach(row=>row.hidden=!row.textContent.includes(search.value.trim()));
  };
  if(materials){const observer=new MutationObserver(ownerSearch);observer.observe(materials,{childList:true,subtree:true});ownerSearch();undo.push(()=>{observer.disconnect();materials.querySelectorAll('.panel-b-search').forEach(n=>n.remove());materials.querySelectorAll('.material-owner').forEach(n=>n.hidden=false);});}
  // Compact secondary controls without recreating any original input or handler.
  function fold(container,selector,title){
   if(!container)return;const nodes=[...container.querySelectorAll(selector)];if(!nodes.length)return;
   const details=document.createElement('details'),summary=document.createElement('summary');details.className='panel-b-more';summary.textContent=title;details.append(summary);container.append(details);
   const positions=nodes.map(node=>{const marker=document.createComment('compact-control-origin');node.before(marker);details.append(node);return [marker,node];});
   undo.push(()=>{positions.forEach(([marker,node])=>marker.replaceWith(node));details.remove();});
  }
  fold(document.querySelector('#view-payments .ops-filters'),':scope>label:not(.ops-search),:scope>#payClear','필터 더보기');
  fold(document.querySelector('#view-stock .stock-tools'),':scope>.ops-category','필터 더보기');
  // Quote pilot: one fixed work header, original search/actions above the divider.
  const quoteView=document.getElementById('view-quotes'),quoteHead=quoteView?.querySelector(':scope>.page-head');
  const quoteForm=document.getElementById('qtForm');
  if(quoteHead&&quoteForm){
   move(quoteView.querySelector('.list-head'),quoteHead);
   move(quoteView.querySelector('.quote-filters'),quoteHead);
   const filterButton=document.getElementById('qtFilterBtn');
   const closeFilters=()=>{quoteView.classList.remove('qfilters-open');document.getElementById('qtFilterBackdrop').hidden=true;};
   const outside=e=>{if(!quoteHead.contains(e.target))closeFilters();};
   const escape=e=>{if(e.key==='Escape'&&quoteView.classList.contains('qfilters-open')){closeFilters();filterButton.focus();}};
   const syncExpanded=()=>filterButton.setAttribute('aria-expanded',String(quoteView.classList.contains('qfilters-open')));
   const filterObserver=new MutationObserver(syncExpanded);filterObserver.observe(quoteView,{attributes:true,attributeFilter:['class']});syncExpanded();
   document.addEventListener('pointerdown',outside);quoteView.addEventListener('keydown',escape);
   let headerRestore=()=>{};
   const arrangeQuoteHeader=()=>{
    const body=quoteForm.querySelector(':scope>.workspace-form-body');
    const summary=body?.querySelector(':scope>.quote-summary'),tabs=body?.querySelector(':scope>.qp-tabs');
    if(!summary||!tabs)return;
    const header=document.createElement('div');header.className='panel-b-work-header';
    const positions=[summary,tabs].map(node=>{const marker=document.createComment('quote-work-header-origin');node.before(marker);header.append(node);return [marker,node];});
    body.before(header);
    headerRestore=()=>{positions.forEach(([marker,node])=>{if(marker.isConnected)marker.replaceWith(node);});header.remove();};
   };
   const headerObserver=new MutationObserver(arrangeQuoteHeader);headerObserver.observe(quoteForm,{childList:true,subtree:true});arrangeQuoteHeader();
   undo.push(()=>{headerObserver.disconnect();headerRestore();filterObserver.disconnect();document.removeEventListener('pointerdown',outside);quoteView.removeEventListener('keydown',escape);closeFilters();filterButton.removeAttribute('aria-expanded');});
  }
  fold(document.querySelector('#view-settings .settings-utils'),':scope>*','백업·가져오기');
  // Danger actions stay accessible, separated from the primary save action.
  const actionRoots=['coForm','itForm','qtForm'].map(id=>document.getElementById(id)).filter(Boolean);
  const separateDelete=()=>actionRoots.forEach(root=>root.querySelectorAll('.form-actions>.btn.del').forEach(button=>{
   const menu=document.createElement('details'),summary=document.createElement('summary');menu.className='panel-b-danger';summary.textContent='더보기';menu.append(summary);button.before(menu);menu.append(button);
  }));
  const actionsObserver=new MutationObserver(separateDelete);actionRoots.forEach(root=>actionsObserver.observe(root,{childList:true,subtree:true}));separateDelete();
  undo.push(()=>{actionsObserver.disconnect();actionRoots.forEach(root=>root.querySelectorAll('.panel-b-danger').forEach(menu=>{menu.replaceWith(...menu.querySelectorAll('button'));}));});
  ['companies','items','quotes'].forEach(id=>{
   const view=document.getElementById('view-'+id),card=view?.querySelector('.cols>.card:last-child');if(!card)return;
   const head=document.createElement('div');head.className='panel-b-empty-heading';
   const label=document.createElement('span'),title=document.createElement('h3');label.className='workspace-caption';label.textContent='NARO BIZ';title.textContent={companies:'거래처 상세',items:'품목 상세',quotes:'견적서 상세'}[id];head.append(label,title);card.prepend(head);undo.push(()=>head.remove());
  });
 }
 function update(){if(desktop.matches)mount();else{const tasks=undo;undo=[];tasks.forEach(fn=>fn());}}
 desktop.addEventListener('change',update);update();
})();
