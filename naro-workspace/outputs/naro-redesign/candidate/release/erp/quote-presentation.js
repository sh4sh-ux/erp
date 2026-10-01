/* Quotation presentation only. All edits go through the existing line controls.
   UI state stays here; no fields are added to quotes or item master records. */
(() => {
  const mobile = matchMedia('(max-width:820px)');
  let key, tab = 'items', sheet = null, dialog = null, focusAfter = null;
  let listPosition = null;
  const $ = (s, root = document) => root.querySelector(s);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  function button(text, action, cls = '') {
    const b = el('button', cls, text); b.type = 'button'; b.onclick = action; return b;
  }
  function beforeRender() {
    if (dialog) { dialog.close(); dialog.remove(); dialog = null; }
    const form = $('#qtForm'); if (form) { form.oninput = null; form.onchange = null; }
  }
  function redraw() { renderQtDetail(); }
  function finish(cancel = false) {
    if (cancel && sheet?.before) qtEditing.lines = JSON.parse(sheet.before);
    if (!cancel && sheet?.dirty) {
      // Some input/keyboard paths reach Apply without a native change event.
      // Commit only edited fields through their original change handlers.
      for (const f of [...sheet.dirty]) $('#qp-edit-' + f)?.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sheet = null; redraw();
    requestAnimationFrame(() => $(focusAfter || '.qp-tabs button[aria-selected="true"]')?.focus());
  }
  function openEdit(line, before = JSON.stringify(qtEditing.lines)) {
    focusAfter = `[data-qp-edit="${line.id}"]`;
    sheet = { mode: 'edit', id: line.id, before }; redraw();
  }
  function openSearch(work = false, index = null) {
    const before = sheet?.before || JSON.stringify(qtEditing.lines);
    sheet = { mode: 'search', work, index, before }; redraw();
  }
  function changeQty(index, delta) {
    const input = $(`[data-f="qty"][data-idx="${index}"]`, $('#qtForm'));
    if (!input) return;
    input.value = String(Math.max(0, parseNum(input.value) + delta));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function stepper(index, qty) {
    const wrap = el('div', 'qp-stepper');
    const minus = button('−', () => changeQty(index, -1)); minus.setAttribute('aria-label', '수량 줄이기');
    const plus = button('+', () => changeQty(index, 1)); plus.setAttribute('aria-label', '수량 늘리기');
    wrap.append(minus, el('span', '', fmt(qty)), plus); return wrap;
  }
  function showSheet(title) {
    dialog = el('dialog', 'qp-sheet'); dialog.setAttribute('aria-label', title);
    const head = el('div', 'qp-sheet-head');
    const close = button('닫기', () => finish(true), 'naro-sheet-close'); close.setAttribute('aria-label', '편집 취소하고 닫기');
    head.append(el('h3', '', title), close);
    const body = el('div', 'qp-sheet-body');
    dialog.append(head, body); $('#qtForm').append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(true); });
    dialog.showModal();
    return body;
  }
  function editSheet(q) {
    const index = q.lines.findIndex(l => l.id === sheet.id);
    if (index < 0) { sheet = null; return; }
    const line = q.lines[index], item = db.items.find(i => i.id === line.item_id);
    const body = showSheet(isWork(item) || Number(line.price) < 0 ? '작업 편집' : '품목 편집');
    const row = $(`.qline[data-idx="${index}"]`, $('#qtForm'));
    // Move the original controls, preserving their bound closures and data-idx.
    const fields = [['item', '품목'], ['name', '품명'], ['lcolor', '색상'], ['vspec', '규격/옵션'], ['spec', '규격/내용'], ['qty', '수량'], ['price', '단가']];
    fields.forEach(([f, label]) => {
      const control = $(`[data-f="${f}"]`, row); if (!control) return;
      const field = el('div', 'qp-field'), caption = el('label', '', label);
      control.id = `qp-edit-${f}`; caption.htmlFor = control.id;
      if (f === 'qty' || f === 'spec') {
        const change = control.onchange;
        control.onchange = event => { sheet?.dirty?.delete(f); change?.call(control, event); };
      }
      field.append(caption, control); body.append(field);
      if (f === 'item') control.onclick = () => openSearch(false, index);
      if (f === 'lcolor' || f === 'vspec') {
        const chips = el('div', 'qp-chips option-chip-grid'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', label);
        Array.from(control.options).forEach(option => {
          const chip = button(option.text, () => { control.value = option.value; control.dispatchEvent(new Event('change', { bubbles: true })); });
          chip.setAttribute('aria-pressed', String(option.value === control.value)); chips.append(chip);
        });
        control.hidden = true; field.append(chips);
        // Presentation measurement only: longest actual label sets the shared
        // minimum; CSS still decides column count and caps it to the container.
        const measure = document.createElement('canvas').getContext('2d');
        if (measure) {
          const widths = Array.from(chips.children, chip => {
            const style = getComputedStyle(chip);
            measure.font = style.font;
            return measure.measureText(chip.textContent).width
              + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
              + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          });
          chips.style.setProperty('--option-chip-min', `${Math.ceil(Math.max(0, ...widths)) + 2}px`);
        }
      }
      if (f === 'qty') {
        const wrap = el('div', 'qp-edit-stepper');
        const minus = button('−', () => changeQty(index, -1)); minus.setAttribute('aria-label', '수량 줄이기');
        const plus = button('+', () => changeQty(index, 1)); plus.setAttribute('aria-label', '수량 늘리기');
        control.before(wrap); wrap.append(minus, control, plus);
      }
    });
    const amount = el('div', 'qp-edit-amount', '금액'); amount.append($('[data-amt]', row)); body.append(amount);
    const footer = el('div', 'qp-sheet-footer');
    const remove = button('행 삭제', () => {
      if (remove.dataset.confirm !== 'yes') { remove.dataset.confirm = 'yes'; remove.textContent = '삭제 확인'; return; }
      sheet = null; $('[data-rm]', row).click();
    }, 'qp-delete');
    footer.append(remove, button('적용', () => finish(), 'qp-primary'));
    dialog.append(footer);
  }
  function searchSheet(q) {
    showSheet(sheet.work ? '작업 추가' : '품목 검색');
    dialog.classList.add('qp-search-sheet');
    const body = $('.qp-sheet-body', dialog), input = el('input', 'qp-search');
    input.type = 'search'; input.placeholder = '품목명 / 품목코드 검색'; input.setAttribute('aria-label', '품목명 또는 품목코드 검색');
    const results = el('div', 'qp-results'); body.replaceWith(input, results);
    const pick = value => {
      const before = sheet.before;
      const index = sheet.index == null ? q.lines.length : sheet.index;
      if (index === q.lines.length) q.lines.push(blankLine());
      sheet = { mode: 'edit', id: q.lines[index].id, before };
      applyItemPick(q, index, value);
    };
    const draw = () => {
      const term = input.value.trim().toLowerCase(); results.replaceChildren();
      const matches = db.items.filter(i => (!sheet.work || isWork(i)) && `${i.name || ''} ${i.code || ''}`.toLowerCase().includes(term)).sort((a,b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      matches.forEach(item => {
        const b = button('', () => pick(item.id), 'qp-result');
        const info = el('span'); info.append(el('strong', '', `${isWork(item) ? '[작업] ' : ''}${item.name || ''}`), el('small', '', item.code || ''));
        b.append(info, el('span', '', won(itemSell(item)))); results.append(b);
      });
      if (!matches.length) results.append(el('p', '', '검색 결과가 없습니다.'));
      results.append(button('직접 입력', () => pick('__free__'), 'qp-result'));
    };
    input.oninput = draw; draw();
  }
  function cards(q, section) {
    const container = el('div', 'qp-cards');
    const groups = [el('section', 'qp-products'), el('section', 'qp-work')];
    const rows = [[], []];
    q.lines.forEach((line, index) => {
      const item = db.items.find(i => i.id === line.item_id);
      rows[isWork(item) || Number(line.price) < 0 ? 1 : 0].push({ line, index, item });
    });
    groups.forEach((group, n) => {
      group.append(el('h3', '', `${n ? '작업' : '품목'} ${rows[n].length}건`));
      if (n) group.append(el('p', 'qp-muted', '견적 전체 작업 항목 · 개별 품목에 종속되지 않습니다.'));
      rows[n].forEach(({ line, index, item }) => {
        const card = el('article', 'qp-card');
        const edit = button('', () => openEdit(line), 'qp-card-edit'); edit.dataset.qpEdit = line.id;
        const name = item ? `${item.name || ''} ${item.code || ''}` : line.name || '품목 선택';
        edit.append(el('strong', '', name), el('span', 'qp-muted', '편집 ›'));
        card.append(edit, el('p', 'qp-muted', [line.color, line.spec].filter(Boolean).join(' · ')));
        const bottom = el('div', 'qp-card-bottom');
        if (!n) bottom.append(stepper(index, line.qty));
        else bottom.append(el('span', 'qp-muted', `${fmt(line.qty)}${line.unit || '개'}${isDecorationWorkLine(line) ? line.auto_qty === false ? ' · 수동 수량' : ' · 전체 수량 연동' : ''}`));
        const amount = el('div', 'qp-card-amount');
        amount.append(el('strong', '', `${$(`[data-amt="${index}"]`).textContent}원`), el('small', 'qp-muted', `${won(line.price)} / ${line.unit || '개'}`));
        bottom.append(amount); card.append(bottom); group.append(card);
      });
      group.append(button(n ? '+ 작업 추가' : '+ 품목 추가', () => openSearch(!!n), 'qp-add'));
      container.append(group);
    });
    section.insertBefore(container, $('.qlines', section));
    // Preserve the existing multi-option entry action as well as the new search.
    const batch = $('#fq_sizeBtn'); if (batch) { batch.classList.add('qp-add'); container.append(batch); }
  }
  function mount(q) {
    const form = $('#qtForm');
    if (key !== qtSel) { key = qtSel; sheet = null; tab = qtSel === '__new__' ? 'basic' : 'items'; }
    const sections = Array.from(form.querySelectorAll(':scope > .qt-sec'));
    const panels = [sections[0], sections[1], sections[2]];
    const tabs = el('div', 'qp-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '견적 상세');
    const ids = ['basic', 'items', 'memo'];
    ['기본정보', '품목', '메모'].forEach((name, i) => {
      const b = button(name, () => select(ids[i])); b.id = `qp-tab-${ids[i]}`;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', `qp-panel-${ids[i]}`); tabs.append(b);
      panels[i].id = `qp-panel-${ids[i]}`; panels[i].setAttribute('role', 'tabpanel'); panels[i].setAttribute('aria-labelledby', b.id);
    });
    // Delivery/payment stay reachable with the unchanged basic-information controls.
    form.querySelectorAll(':scope > .quote-flow').forEach(node => panels[0].append(node));
    panels[0].before(tabs);
    function select(next) {
      tab = next;
      panels.forEach((panel, i) => { panel.hidden = ids[i] !== tab; });
      Array.from(tabs.children).forEach((b, i) => { b.setAttribute('aria-selected', String(ids[i] === tab)); b.tabIndex = ids[i] === tab ? 0 : -1; });
    }
    tabs.onkeydown = event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return; event.preventDefault(); select(ids[(ids.indexOf(tab) + step + ids.length) % ids.length]); $('.qp-tabs [aria-selected="true"]').focus();
    };
    select(tab);
    const hero = $('.quote-summary', form), info = $('.qs-info', hero);
    const companyRow = $('.qs-row:has(.co)', info);
    const metadata = el('div', 'qp-metadata');
    const syncHeader = () => {
      $('.co', companyRow).textContent = coName(q.company_id) || '거래처 미선택';
      metadata.replaceChildren(el('span', '', q.no || '새 견적'),
        el('span', '', (q.date || '').replaceAll('-', '.')),
        el('span', 'pill ' + (QT_STATUS_CLASS[q.status] || 'st-draft'), q.status || ''));
    };
    info.replaceChildren(companyRow); hero.append(metadata); syncHeader();
    form.onchange = syncHeader;
    if (mobile.matches) {
      const nav = el('div', 'qp-mobile-actions');
      nav.append(button('‹ 견적서', closeQuoteDetail), button('저장', () => $('#qtSaveBtn').click(), 'qp-primary naro-compact-action'));
      hero.before(nav);
      cards(q, panels[1]);
      const actions = $('.form-actions', form), more = el('details', 'qp-more'); more.append(el('summary', '', '··· 더보기'));
      ['fq_doc', 'qtCopyBtn', 'qtPrintBtn', 'qtImgBtn', 'qtShareBtn', 'qtMailBtn', 'qtDelBtn'].forEach(id => { const node = $('#'+id); if (node) more.append(node); });
      if (more.children.length > 1) actions.append(more);
      form.oninput = event => {
        if (sheet?.mode === 'edit' && ['qty','spec'].includes(event.target.dataset.f)) {
          sheet.dirty ||= new Set(); sheet.dirty.add(event.target.dataset.f);
        }
      };
      // DOM is rebuilt by the legacy renderer; assigning avoids accumulated listeners.
      if (sheet?.mode === 'edit') editSheet(q);
      else if (sheet?.mode === 'search') searchSheet(q);
    }
  }
  // Opt-in presentation patterns; original controls and handlers remain intact.
  function listPolish() {
    const view = $('#view-quotes'), csv = $('#qtCsvBtn'), filters = $('.quote-filters', view);
    const csvHome = document.createComment('CSV header position'); $('.page-head', view).append(csvHome);
    const more = el('details', 'naro-secondary-menu qp-list-more');
    const summary = el('summary', '', '···'); summary.setAttribute('aria-label', '견적 목록 더보기');
    more.append(summary); csvHome.parentNode.append(more);
    csv.addEventListener('click', () => { more.open = false; });
    $('.list-head', view).classList.add('naro-search-toolbar');
    const all = $('#qtAllDates'), home = document.createComment('Period desktop position'); all.before(home);
    const period = el('div', 'naro-period-selector'); period.setAttribute('role', 'group'); period.setAttribute('aria-label', '검색 기간');
    const dates = [$('#qtFrom'), $('#qtTo')];
    const range = button('기간 지정', () => sync(true));
    period.append(range); home.parentNode.append(period);
    const close = button('닫기', () => { $('#qtFilterBackdrop').click(); $('#qtFilterBtn').focus(); }, 'naro-sheet-close qp-filter-close');
    close.setAttribute('aria-label', '필터 닫기'); filters.prepend(close);
    function sync(expanded = dates.some(input => !!input.value)) {
      all.setAttribute('aria-pressed', String(!expanded)); range.setAttribute('aria-pressed', String(expanded));
      dates.forEach(input => input.closest('label').classList.toggle('qp-date-hidden', mobile.matches && !expanded));
      // Reflect committed filter values, not the date editor's expanded state.
      const count = Number(!!$('#qtStatus').value) + Number(dates.some(input => !!input.value));
      const badge = $('#qtFilterBadge'); badge.textContent = count || ''; badge.hidden = !count;
      $('#qtFilterBtn').classList.toggle('on', !!count);
    }
    all.addEventListener('click', () => sync(false));
    $('#qtClearFilters').addEventListener('click', () => sync(false));
    dates.forEach(input => input.addEventListener('change', () => sync()));
    $('#qtStatus').addEventListener('change', () => sync());
    $('#qtFilterBtn').addEventListener('click', () => sync());
    function layout() {
      if (mobile.matches) { more.append(csv); period.prepend(all); }
      else {
        const desktopMenu = $('.workspace-export', view);
        if (desktopMenu) desktopMenu.append(csv); else csvHome.after(csv);
        home.after(all); more.open = false; $('#qtFilterBackdrop').click();
      }
      sync();
    }
    mobile.addEventListener('change', layout); layout();
  }
  listPolish();
  mobile.addEventListener('change', () => { beforeRender(); sheet = null; if (qtEditing) redraw(); });
  function fitSheet() {
    if (!dialog) return;
    const vv = window.visualViewport;
    const keyboard = Math.max(0, innerHeight - ((vv?.height || innerHeight) + (vv?.offsetTop || 0)));
    const nav = keyboard > 100 ? 0 : ($('#bottomNav')?.getBoundingClientRect().height || 0);
    dialog.style.maxHeight = `${Math.max(160, (vv?.height || innerHeight) - nav - 16)}px`;
    dialog.style.bottom = `${keyboard + nav}px`;
  }
  window.visualViewport?.addEventListener('resize', fitSheet);
  window.visualViewport?.addEventListener('scroll', fitSheet);
  window.QuotePresentation = {
    beforeRender,
    mount(q) { mount(q); fitSheet(); },
    rememberList() { listPosition = { list: $('#qtList').scrollTop, main: $('.main').scrollTop, window: scrollY }; },
    restoreList() { if (mobile.matches && listPosition) requestAnimationFrame(() => { $('#qtList').scrollTop = listPosition.list; $('.main').scrollTop = listPosition.main; window.scrollTo({ top: listPosition.window, behavior: 'instant' }); }); }
  };
})();
