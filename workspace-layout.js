/* Presentation only. Move existing controls, never copy IDs or modify records.
   Placeholders restore the original DOM when leaving desktop. */
(() => {
  const desktop = matchMedia('(min-width:1024px)');
  let restore = [];
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
  }
  desktop.addEventListener('change', update); update();
})();
