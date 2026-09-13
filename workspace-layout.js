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
    materialHeaderRestore=()=>{if(balanceMarker.isConnected){balanceMarker.replaceWith(balance);controlsMarker.replaceWith(controls);}};
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
    ['#dashHero','#dashStats'].forEach(s => relocate(dash?.querySelector(s), dash?.querySelector('.workspace-right')));
    relocate(chart, dash?.querySelector('.workspace-right'));
    panel('payments', '거래 기록', ['#payMonth', '.scr-hero', '.stats', '.card:has(#payByCo)'], ['.card:has(#payTbl)']);
    panel('stock', '입출고 기록', ['.stats', '.card:has(#ivTbl)'], ['.card:has(#ivHist)']);
    panel('sales', '매출 상세', ['.filter-bar', '.sl-summary'], ['#slBody']);
    panel('ar', '미수금 상세', ['.filter-bar', '.scr-hero', '.stats'], ['.card:has(#arTbl)']);
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
})();
