/* Presentation only. Move existing controls, never copy IDs or modify records.
   Placeholders restore the original DOM when leaving desktop. */
(() => {
  const desktop = matchMedia('(min-width:1024px)');
  let restore = [];
  // Dynamic forms are re-rendered by the app. Keep their action bar outside
  // the scrolling body without replacing controls or their event listeners.
  const formRoots = ['qtForm','coForm','itForm'];
  const headerRestores = new WeakMap();
  let materialHeaderRestore = null;
  function arrangeMaterialHeader() {
    if (!desktop.matches) { materialHeaderRestore?.(); materialHeaderRestore=null; return; }
    const detail=document.querySelector('#materialContent .material-detail');
    const head=detail?.querySelector('.material-detail-head');
    const balance=detail?.querySelector(':scope > .material-balance-hero');
    const controls=head?.querySelector('.material-statement-controls');
    if (!head || !balance || !controls) return;
    const balanceMarker=document.createComment('balance-position');
    const controlsMarker=document.createComment('controls-position');
    balance.before(balanceMarker); controls.before(controlsMarker);
    head.append(balance); head.after(controls);
    const note=document.createElement('p');note.className='material-header-note';
    note.textContent=document.querySelector('#view-materials>.copy-note')?.textContent||'';
    head.append(note);
    materialHeaderRestore=()=>{note.remove();if(balanceMarker.isConnected){balanceMarker.replaceWith(balance);controlsMarker.replaceWith(controls);}};
  }
  const materialObserver=new MutationObserver(arrangeMaterialHeader);
  const materialRoot=document.getElementById('materialContent');
  if(materialRoot) materialObserver.observe(materialRoot,{childList:true,subtree:true});
  function arrangeForms() {
    formRoots.forEach(id => {
      const form = document.getElementById(id);
      if (!form) return;
      const body = form.querySelector(':scope > .workspace-form-body');
      if (!desktop.matches) {
        headerRestores.get(form)?.(); headerRestores.delete(form);
        if (body) body.replaceWith(...body.childNodes);
        form.classList.remove('workspace-form');
        return;
      }
      if (body || !form.querySelector(':scope > .form-actions')) return;
      const scroll = document.createElement('div');
      scroll.className = 'workspace-form-body';
      [...form.childNodes].forEach(node => {
        if (node.nodeType === 1 && node.matches('.quote-summary,.form-actions')) return;
        scroll.append(node);
      });
      const actions = form.querySelector(':scope > .form-actions');
      actions.before(scroll);
      if (id === 'coForm') {
        const title=scroll.querySelector('.co-title'), amount=scroll.querySelector('.scr-hero');
        if(title && amount) {
          const header=document.createElement('div'); header.className='workspace-record-heading';
          const label=document.createElement('div'); label.className='workspace-caption';label.textContent='거래처';
          const info=document.createElement('div');info.append(label);
          const markers=[title,amount].map(node=>{const marker=document.createComment('header-origin');node.before(marker);return marker;});
          info.append(title);header.append(info,amount);form.prepend(header);
          headerRestores.set(form,()=>{markers[0].replaceWith(title);markers[1].replaceWith(amount);header.remove();});
        }
      }
      if(id === 'itForm') {
        const input=scroll.querySelector('#fi_name');
        if(input) {
          const header=document.createElement('div');header.className='workspace-record-heading';
          const info=document.createElement('div'),label=document.createElement('div'),title=document.createElement('div');
          label.className='workspace-caption';label.textContent='품목';title.className='co-title-name';
          const sync=()=>{title.textContent=input.value||'새 품목';};sync();input.addEventListener('input',sync);
          info.append(label,title);header.append(info);form.prepend(header);
          headerRestores.set(form,()=>{input.removeEventListener('input',sync);header.remove();});
        }
      }
      form.classList.add('workspace-form');
    });
  }
  const formObserver = new MutationObserver(arrangeForms);
  formRoots.forEach(id => { const form=document.getElementById(id); if(form) formObserver.observe(form,{childList:true}); });
  function mount() {
    if (!desktop.matches || restore.length) return;
    function panel(id, title, leftSelectors, rightSelectors) {
      const view = document.getElementById('view-' + id);
      if (!view) return;
      const left = document.createElement('div'), right = document.createElement('div');
      const header = document.createElement('div');
      left.className = 'workspace-left'; right.className = 'workspace-right';
      header.className = 'workspace-heading';
      const label = document.createElement('span'), heading = document.createElement('h3');
      label.className = 'workspace-caption'; label.textContent = '업무 정보';
      heading.textContent = title; header.append(label, heading);
      function move(selectors, target) {
        selectors.forEach(selector => {
          const node = view.querySelector(selector);
          if (!node) return;
          const marker = document.createComment('desktop-layout-position');
          node.before(marker); target.append(node);
          restore.push(() => { marker.replaceWith(node); });
        });
      }
      move(leftSelectors, left); move(rightSelectors, right);
      view.append(left, header, right); view.classList.add('workspace-split');
      restore.push(() => { left.remove(); header.remove(); right.remove(); view.classList.remove('workspace-split'); });
    }
    panel('dash', '업무 현황', [], []);
    // Explicit existing containers, rather than renderer or state changes.
    const dash = document.getElementById('view-dash');
    const recent = dash?.querySelector('#dashRecent')?.closest('.card');
    const chart = dash?.querySelector('#dashChart')?.closest('.card');
    function relocate(node, target) {
      if (!node || !target) return;
      const marker = document.createComment('desktop-layout-position'); node.before(marker); target.append(node);
      // Restore before the surrounding pane is removed.
      restore.unshift(() => marker.replaceWith(node));
    }
    relocate(recent, dash?.querySelector('.workspace-left'));
    relocate(dash?.querySelector('.head-actions'), dash?.querySelector('.workspace-left'));
    dash?.querySelector('.workspace-left')?.prepend(dash.querySelector('.head-actions'));
    relocate(dash?.querySelector('#dashHero'),dash?.querySelector('.workspace-heading'));
    relocate(dash?.querySelector('#dashStats'),dash?.querySelector('.workspace-right'));
    relocate(chart, dash?.querySelector('.workspace-right'));
    relocate(dash?.querySelector('#salesInsight'),dash?.querySelector('.workspace-right'));
    panel('payments', '수금/지급 현황', ['#payMonth', '.card:has(#payByCo)'], ['.stats', '.card:has(#payTbl)']);
    const payLeft=document.querySelector('#view-payments .workspace-left');
    const payTools=document.createElement('div');payTools.className='workspace-list-tools';
    const payMonth=document.getElementById('payMonth');
    payLeft.prepend(payTools);payTools.append(payMonth);
    const paySearch=document.createElement('input');paySearch.type='search';paySearch.placeholder='거래처 검색';paySearch.setAttribute('aria-label','입출금 집계 거래처 검색');payTools.append(paySearch);
    const filterPayList=()=>{document.querySelectorAll('#payByCo tbody tr').forEach(row=>{row.hidden=!row.querySelector('.empty')&&row.cells[0]?.textContent.trim()!=='합계'&&!row.cells[0]?.textContent.includes(paySearch.value.trim());});};
    paySearch.oninput=filterPayList;
    const payObserver=new MutationObserver(filterPayList);payObserver.observe(document.getElementById('payByCo'),{childList:true,subtree:true});
    restore.push(()=>{payObserver.disconnect();document.querySelectorAll('#payByCo tr').forEach(row=>row.hidden=false);});
    panel('stock', '재고 현황', ['.card:has(#ivTbl)'], ['.card:has(#ivHist)']);
    relocate(document.querySelector('#view-stock > .stats'),document.querySelector('#view-stock .workspace-heading'));
    panel('sales', '매출 현황', ['.filter-bar'], ['#slBody']);
    relocate(document.querySelector('#view-sales .sl-hero'),document.querySelector('#view-sales .workspace-heading'));
    relocate(document.querySelector('#view-sales .sl-metrics'),document.querySelector('#view-sales .workspace-right'));
    const salesMetrics=document.querySelector('#view-sales .workspace-right .sl-metrics');salesMetrics.parentElement.prepend(salesMetrics);
    panel('ar', '미수금 현황', ['.filter-bar'], ['.stats', '.card:has(#arTbl)']);
    ['payments','ar'].forEach(id=>{
      const view=document.getElementById('view-'+id);
      relocate(view.querySelector(':scope > .scr-hero'),view.querySelector('.workspace-heading'));
    });
    // A narrow navigation index; financial columns remain in the right pane.
    const arTable=document.getElementById('arTbl');
    const arIndex=document.createElement('div');arIndex.className='workspace-record-index';
    document.querySelector('#view-ar .workspace-left').append(arIndex);
    let arQuery='';
    const refreshIndex=()=>{
      arIndex.replaceChildren();
      const all=document.createElement('button');all.type='button';all.textContent='전체 내역';all.dataset.all='true';all.className='on';
      all.onclick=()=>{arTable.querySelectorAll('tbody tr').forEach(r=>r.hidden=false);arIndex.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===all));};
      arIndex.append(all);
      arTable.querySelectorAll('tbody tr').forEach(row=>{
        if(row.querySelector('.empty') || row.style.background) return;
        const cells=row.querySelectorAll('td');if(!cells.length)return;
        const button=document.createElement('button');button.type='button';button.textContent=cells[0].textContent;
        button.hidden=!button.textContent.includes(arQuery);
        button.onclick=()=>{arTable.querySelectorAll('tbody tr').forEach(r=>r.hidden=r!==row);arIndex.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===button));};
        arIndex.append(button);
      });
    };
    const arIndexObserver=new MutationObserver(refreshIndex);arIndexObserver.observe(arTable,{childList:true,subtree:true});refreshIndex();
    restore.push(()=>arIndexObserver.disconnect());
    const arSearch=document.createElement('input');arSearch.type='search';arSearch.placeholder='거래처 검색';arSearch.setAttribute('aria-label','받을 금액 거래처 검색');
    document.querySelector('#view-ar .filter-bar').prepend(arSearch);
    arSearch.oninput=()=>{arQuery=arSearch.value.trim();arIndex.querySelectorAll('button').forEach(b=>b.hidden=!b.dataset.all&&!b.textContent.includes(arQuery));};
    restore.push(()=>{arSearch.remove();arTable.querySelectorAll('tr').forEach(r=>r.hidden=false);});
    panel('settings', '공급자 정보', ['.settings-utils'], [':scope > .card']);
    const settingsRight = document.querySelector('#view-settings .workspace-right');
    relocate(document.getElementById('stSaveBtn')?.closest('.form-actions'), settingsRight);
    const csv = document.getElementById('qtCsvBtn');
    const listHead = document.querySelector('#view-quotes .list-head');
    if (csv && listHead) {
      const menu = document.createElement('details'), summary = document.createElement('summary');
      menu.className = 'workspace-export'; summary.textContent = '⋯'; summary.setAttribute('aria-label','견적 목록 더보기');
      menu.append(summary); listHead.append(menu); relocate(csv,menu);
      restore.push(() => menu.remove());
    }
  }
  function update() {
    if (desktop.matches) mount();
    else { const actions = restore; restore = []; actions.forEach(fn => fn()); }
    arrangeForms();
    arrangeMaterialHeader();
  }
  desktop.addEventListener('change', update); update();
  // Display vocabulary only. Persisted payment kinds remain 수금/지급.
  const displayRoot=document.getElementById('appView');
  const friendlyText=text=>text.replace(/순현금/g,'입출금 차액').replace(/수금\/지급/g,'입금·출금').replace(/미수금/g,'받을 금액').replace(/수금/g,'입금').replace(/지급/g,'출금').replace(/이달 입금/g,'이번 달 입금').replace(/이달 출금/g,'이번 달 출금');
  function updateVocabulary(){
    // Options without a value attribute derive their value from visible text.
    displayRoot.querySelectorAll('option:not([value])').forEach(option=>option.setAttribute('value',option.value));
    const walker=document.createTreeWalker(displayRoot,NodeFilter.SHOW_TEXT);
    const changes=[];let node;
    while((node=walker.nextNode())){
      if(node.parentElement?.closest('script,style,textarea,[contenteditable]'))continue;
      const next=friendlyText(node.nodeValue);if(next!==node.nodeValue)changes.push([node,next]);
    }
    changes.forEach(([node,next])=>{node.nodeValue=next;});
    displayRoot.querySelectorAll('[aria-label],[title]').forEach(el=>['aria-label','title'].forEach(attr=>{const text=el.getAttribute(attr);if(text&&friendlyText(text)!==text)el.setAttribute(attr,friendlyText(text));}));
  }
  if(displayRoot){
    const paymentSummary=document.getElementById('paySumNet')?.parentElement;
    if(paymentSummary){const note=document.createElement('div');note.className='hint';note.textContent='직접 기록한 내역 기준';paymentSummary.append(note);}
    const vocabularyObserver=new MutationObserver(updateVocabulary);
    vocabularyObserver.observe(displayRoot,{childList:true,subtree:true,characterData:true});
    updateVocabulary();
  }
})();
