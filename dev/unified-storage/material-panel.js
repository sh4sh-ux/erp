/* 업체 제공 자재 화면(10/15 시안 승인 — 견적서와 같은 틀). 화면만 바꾼다: 저장 규칙·함수는 원래 것 그대로
   (buildMaterialMove → persistMaterialMove / updateMaterialMove / voidMaterialMove, 재고내역서 previewMaterialStatement).
   왼쪽: 검색 아래 [업체 · 자재 · 견적 · 기록] + 칩 [보유 중 · 오래 보관 · 다 씀 · 전체].
   오른쪽: 머리(업체 · 남은 수량) → 받음 막대 → 탭 [자재 · 기록 · 견적 · 정보] → 아래 [재고내역서] … [＋ 기록].
   기록 창은 견적서 납품 창과 같은 부품(.nd-qa-sheet). 고치기는 원래처럼 materialDraft/materialEditingId를 써서
   '저장됨' 규칙(naro-design saveState의 mm_save)이 그대로 동작한다. */
(()=>{
 if(typeof renderMaterials!=='function'||typeof materialBalances!=='function')return;
 const STALE_DAYS=90;
 const ui={lt:'company',showDone:false,tab:'materials',open:new Set(),rec:'all',flash:''};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n0=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
 const WD='일월화수목금토',wd=d=>{const t=Date.parse((d||'')+'T00:00:00Z');return Number.isFinite(t)?WD[new Date(t).getUTCDay()]:'';};
 const md=d=>{const m=/^\d{4}-(\d{2})-(\d{2})/.exec(d||'');return m?`${Number(m[1])}.${m[2]}`:'';};
 const KIND={'받음':'받음','작업 완료':'사용','반환':'반환','불량/분실':'불량·분실'};
 const KCLS={'받음':'in','작업 완료':'use','반환':'ret','불량/분실':'ret'};
 const DOTS='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3.5" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="12.5" r="1.4"/></svg>';
 const MI={edit:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  undo:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>'};
 const today=()=>localDate();
 const daysSince=d=>d?Math.floor((Date.parse(today()+'T00:00:00Z')-Date.parse(d+'T00:00:00Z'))/864e5):0;
 const act=()=>(db.material_moves||[]).filter(m=>!m.void_at);
 const quoteOf=id=>(db.quotes||[]).find(q=>q.id===id);
 // 주문 = 견적 또는 네이버(스마트스토어) 주문. 네이버는 주문번호로, 번호가 없으면 날짜로 묶는다(하루치 한 줄 기록).
 const isNaver=m=>m.source==='스마트스토어';
 const orderKey=m=>m.quote_id&&quoteOf(m.quote_id)?'q:'+m.quote_id:(m.kind==='작업 완료'&&isNaver(m))?'n:'+(m.order_no||'@'+m.date):null;
 const NAVER='<span class="mp-naver">네이버</span>';
 /* 업체별 집계: 자재마다 받음·사용·반환·불량, 남음, 최근 기록. */
 function companyStats(cid){
  const mats=new Map();let last='';const quotes=new Set();
  for(const m of act().filter(m=>m.company_id===cid)){
   const g=mats.get(m.material)||{name:m.material,received:0,used:0,returned:0,lost:0,last:''};
   const q=Number(m.qty)||0;
   if(m.kind==='받음')g.received+=q;else if(m.kind==='작업 완료')g.used+=q;else if(m.kind==='반환')g.returned+=q;else g.lost+=q;
   if((m.date||'')>g.last)g.last=m.date||'';if((m.date||'')>last)last=m.date||'';
   const ok=orderKey(m);if(ok)quotes.add(ok);mats.set(m.material,g);
  }
  const list=[...mats.values()].map(g=>({...g,balance:g.received-g.used-g.returned-g.lost})).sort((a,b)=>b.balance-a.balance||a.name.localeCompare(b.name,'ko'));
  const sum=k=>list.reduce((s,g)=>s+g[k],0);
  return {cid,list,last,quotes,received:sum('received'),used:sum('used'),out:sum('returned')+sum('lost'),balance:sum('balance')};
 }
 const companyIds=()=>[...new Set((db.material_moves||[]).map(m=>m.company_id))].filter(id=>coById(id));
 const isStale=s=>s.balance>0&&daysSince(s.last)>=STALE_DAYS;
 const bar=(s,cls='mp-mini')=>{const t=Math.max(1,s.received);const w=v=>Math.max(0,v/t*100).toFixed(2)+'%';return `<span class="${cls}" aria-hidden="true">${s.balance>0?`<i class="h" style="width:${w(s.balance)}"></i>`:''}${s.used>0?`<i class="u" style="width:${w(s.used)}"></i>`:''}${s.out>0?`<i class="o" style="width:${w(s.out)}"></i>`:''}</span>`;};
 const srcText=(m,withMemo=true)=>{const q=m.quote_id?quoteOf(m.quote_id):null,parts=[];
  if(isNaver(m)&&!q)parts.push(`${NAVER}${m.order_no?` ${esc(m.order_no)}`:''}`);
  else if(m.kind==='받음')parts.push([m.source,m.order_no].filter(Boolean).map(esc).join(' · '));
  if(m.kind==='작업 완료')parts.push(`${esc(m.work_name||'작업')}${m.work_qty?` ${n0(m.work_qty)}개${Number(m.per_unit)>1?` × ${n0(m.per_unit)}`:''}`:''}`);
  if(withMemo&&m.memo)parts.push(esc(m.memo));
  return `${parts.filter(Boolean).join(' · ')}${q?` <button type="button" class="mp-qlink" data-mp-quote="${esc(q.id)}">${esc(q.no||'견적')}</button>`:''}`;};
 const signed=m=>`${m.kind==='받음'?'+':'−'}${n0(m.qty)}`;

 /* ── 왼쪽 목록 ── */
 function leftHtml(ids,cid){
  const stats=ids.map(companyStats);
  const counts={holding:stats.filter(s=>s.balance>0).length,stale:stats.filter(isStale).length,done:stats.filter(s=>s.balance<=0).length,all:stats.length};
  const tabs=[['company','업체'],['material','자재']].map(([k,l])=>`<button type="button" role="tab" data-mp-lt="${k}" aria-selected="${ui.lt===k}">${l}</button>`).join('');
  const chips='';
  let rows='';
  const row=(attrs,on,title,value,meta,tag,extra,search)=>`<button type="button" class="material-owner mp-row${on?' active':''}" ${attrs}><span class="mp-r1"><b>${title}</b><span class="mp-v num">${value}</span></span><span class="mp-r2"><small>${meta}</small>${tag||''}</span>${extra||''}<span class="mp-find" hidden>${esc(search||'')}</span></button>`;
  if(ui.lt==='company'){
   const crow=s=>{const days=daysSince(s.last);
    const tag=isStale(s)?`<span class="mp-tag warn">${n0(days)}일째 보관</span>`:s.balance<=0?'<span class="mp-tag">다 씀</span>':'';
    return row(`data-mm-owner="${esc(s.cid)}" data-mp-pick="company"`,s.cid===cid,esc(coName(s.cid)),`${n0(s.balance)}개`,`자재 ${s.list.length}종${s.last?` · 최근 ${md(s.last)}`:''}`,tag,'',s.list.map(g=>g.name).join(' '));};
   const byLast=(a,b)=>(b.last||'').localeCompare(a.last||'');const live=stats.filter(s=>s.balance>0).sort(byLast),done=stats.filter(s=>s.balance<=0).sort(byLast);
   rows=live.map(crow).join('')+(done.length?`<button type="button" class="mp-done" data-mp-done aria-expanded="${ui.showDone}">다 씀 ${done.length}곳 <span aria-hidden="true">${ui.showDone?'⌃':'›'}</span></button>${ui.showDone?done.map(crow).join(''):''}`:'');
  }else if(ui.lt==='material'){
   const all=stats.flatMap(s=>s.list.map(g=>({...g,cid:s.cid,out:g.returned+g.lost}))).sort((a,b)=>(b.balance>0)-(a.balance>0)||(b.last||'').localeCompare(a.last||''));
   const mrow=g=>{
    const tag=isStale(g)?`<span class="mp-tag warn">${n0(daysSince(g.last))}일째 보관</span>`:g.balance<=0?'<span class="mp-tag">다 씀</span>':'';
    return row(`data-mm-owner="${esc(g.cid)}" data-mp-pick="material" data-mp-name="${esc(g.name)}"`,g.cid===cid&&materialSelectedName===g.name,esc(g.name),`${n0(g.balance)}개`,`${esc(coName(g.cid))}${g.last?` · 최근 ${md(g.last)}`:''}`,tag,'',coName(g.cid));};
   const mDone=all.filter(g=>g.balance<=0);rows=all.filter(g=>g.balance>0).map(mrow).join('')+(mDone.length?`<button type="button" class="mp-done" data-mp-done aria-expanded="${ui.showDone}">다 씀 ${mDone.length}종 <span aria-hidden="true">${ui.showDone?'⌃':'›'}</span></button>${ui.showDone?mDone.map(mrow).join(''):''}`:'');
  }
  const empty={company:'보관 중인 업체가 없어요',material:'자재가 없어요'}[ui.lt];
  return `<aside class="material-owners mp-left"><div class="material-owners-head"><h3>보유 업체</h3><span class="hint">${counts.holding}곳</span></div>
   <div class="mp-ltabs" role="tablist" aria-label="찾는 기준">${tabs}</div>${chips}
   <div class="material-owner-list mp-list">${rows||`<p class="mp-empty">${empty}</p>`}<button type="button" class="btn ghost material-new-owner" id="mm_new_receipt" hidden>+ 자재 받음</button></div></aside>`;
 }

 /* ── 오른쪽 상세 ── */
 function detailHtml(cid){
  if(!cid)return `<main class="material-detail mp-detail mp-none"><div class="mp-blank"><b>업체 제공 자재</b><span>고객 제공 자재의 입고·사용을 업체별로 관리합니다.</span><button type="button" class="btn save" data-mp-new="받음">자재 받음</button></div></main>`;
  const s=companyStats(cid),co=coById(cid)||{};
  const rows=(db.material_moves||[]).filter(m=>m.company_id===cid).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created_at||'').localeCompare(a.created_at||''));
  const live=rows.filter(m=>!m.void_at);
  const tabs=[['materials','자재',s.list.length],['history','기록',live.length],['info','정보','']].map(([k,l,c])=>`<button type="button" role="tab" class="qp-tab" data-material-panel="${k}" aria-selected="${ui.tab===k}">${l}${c!==''?`<em>${n0(c)}</em>`:''}</button>`).join('');
  const t=Math.max(1,s.received),w=v=>(v/t*100).toFixed(2)+'%';
  const sum=`<div class="mp-sum"><div class="mp-sum-bar"><div class="mp-sum-top"><span>받은 수량 <b class="num">${n0(s.received)}개</b></span></div>
   <span class="mp-track" aria-hidden="true">${s.balance>0?`<i class="h" style="width:${w(s.balance)}"></i>`:''}${s.used>0?`<i class="u" style="width:${w(s.used)}"></i>`:''}${s.out>0?`<i class="o" style="width:${w(s.out)}"></i>`:''}</span>
   <span class="mp-leg"><span><i class="h"></i>보유 <b class="num">${n0(s.balance)}</b></span><span><i class="u"></i>사용 <b class="num">${n0(s.used)}</b></span><span><i class="o"></i>반환·불량 <b class="num">${n0(s.out)}</b></span></span></div></div>`;
  let body='';
  if(ui.tab==='materials'){
   const head=`<div class="mp-row-t mp-th mp-g6" aria-hidden="true"><span>자재</span><span class="num">받음</span><span class="num">사용·반환</span><span class="num">남음</span><span>남은 비율</span><span></span></div>`;
   body=`<div class="mp-sec"><span class="qt-sec-t">자재<span class="cnt">${s.list.length}종 · 남음 ${n0(s.balance)}개</span></span></div>`+(s.list.length?head+s.list.map(g=>{
    const on=ui.open.has(g.name),pct=g.received?Math.round(g.balance/g.received*100):0;
    const recs=live.filter(m=>m.material===g.name).slice(0,6);
    const sub=recs.map(m=>`<div class="mp-sub"><span class="num">${md(m.date)}</span><span class="mp-k ${KCLS[m.kind]}">${KIND[m.kind]||esc(m.kind)}</span><span class="mp-src">${srcText(m)}</span><span class="num">${signed(m)}</span></div>`).join('');
    const more=live.filter(m=>m.material===g.name).length>6?`<button type="button" class="mp-more-link" data-mp-tab="history">기록 탭에서 모두 보기</button>`:'';
    return `<div class="mp-rec${on?' on':''}"><div class="mp-row-t mp-g6 mp-main" data-mp-open="${esc(g.name)}" role="button" tabindex="0" aria-expanded="${on}"><span class="mp-nm">${esc(g.name)}</span><span class="num">${n0(g.received)}</span><span class="num">${n0(g.used+g.returned+g.lost)}</span><span class="num mp-b">${n0(g.balance)}</span><span class="mp-pct" title="${g.balance>0?`${pct}% 남음`:'다 씀'}">${bar({received:g.received,balance:g.balance,used:g.used,out:g.returned+g.lost},'mp-mini')}${g.balance>0?'':'<small>다 씀</small>'}</span><span class="mp-act"><button type="button" class="mp-dots" data-mp-mat="${esc(g.name)}" aria-label="${esc(g.name)} 메뉴" aria-expanded="false">${DOTS}</button></span></div>${on?`<div class="mp-x">${sub||'<p class="mp-empty">기록이 없어요</p>'}${more}</div>`:''}</div>`;}).join(''):`<p class="mp-empty mp-line">아직 자재가 없어요</p>`);
  }else if(ui.tab==='history'){
   const pass=m=>ui.rec==='all'||(ui.rec==='받음'&&m.kind==='받음')||(ui.rec==='사용'&&m.kind==='작업 완료')||(ui.rec==='반환'&&(m.kind==='반환'||m.kind==='불량/분실'))||(ui.rec==='네이버'&&isNaver(m));
   const chips=[['all','전체'],['받음','받음'],['사용','사용'],['반환','반환·불량'],['네이버','네이버']].map(([k,l])=>`<button type="button" data-mp-rf="${k}" aria-pressed="${ui.rec===k}">${l}</button>`).join('');
   const list=rows.filter(pass);let month='';
   const items=list.map(m=>{const mo=(m.date||'').slice(0,7),hd=mo!==month?`<div class="mp-month">${Number(mo.slice(5,7))||''}월<span>${mo.slice(0,4)}</span></div>`:'';month=mo;
    return hd+`<div class="mp-row-t mp-g5 mp-hrow${m.void_at?' gone':''}${ui.flash===m.id?' flash':''}" data-mp-hrow="${esc(m.id)}"><span class="num mp-d"><b>${Number((m.date||'').slice(8,10))||''}</b><small>${wd(m.date)}</small></span><span class="mp-kind"><i class="mp-dot ${KCLS[m.kind]||'ret'}"></i>${KIND[m.kind]||esc(m.kind)}<small class="mp-pd">${md(m.date)}${m.quote_id&&quoteOf(m.quote_id)?` · ${esc(quoteOf(m.quote_id).no||'')}`:''}</small>${m.void_at?'<small>취소됨</small>':''}</span><span class="mp-nmc"><span class="mp-nm">${esc(m.material)}</span><span class="mp-src">${srcText(m,false)}</span></span><span class="mp-memo" title="${esc(m.memo||'')}">${esc(m.memo||'')}</span><span class="num mp-b">${signed(m)}</span><span class="mp-act">${m.void_at?'':`<button type="button" class="mp-dots" data-mp-rm="${esc(m.id)}" aria-label="이 기록 메뉴" aria-expanded="false">${DOTS}</button>`}</span></div>`;}).join('');
   body=`<div class="mp-sec"><span class="qt-sec-t">기록<span class="cnt">${n0(live.length)}건</span></span><div class="mp-rchips" role="group" aria-label="기록 구분">${chips}</div></div>`+(items?`<div class="mp-row-t mp-th mp-g5" aria-hidden="true"><span>날짜</span><span>구분</span><span>자재 · 출처</span><span>메모</span><span class="num">수량</span><span></span></div>${items}`:`<p class="mp-empty mp-line">기록이 없어요</p>`);
  }else{
   const kv=[['전화',co.phone],['이메일',co.email],['담당',co.manager||co.contact],['주소',co.address]].filter(([,v])=>v);
   body=`<div class="mp-sec"><span class="qt-sec-t">재고내역서</span></div>
    <div class="mp-info"><label>조회 기준일<input type="date" id="mm_statement_date" value="${esc(materialStatementDate||today())}"></label><button type="button" class="btn ghost" data-mp-statement>재고내역서 보기</button></div>
    <div class="mp-sec"><span class="qt-sec-t">거래처</span><button type="button" class="nd-record-action" data-mp-company>거래처 열기</button></div>
    ${kv.length?`<dl class="mp-kv">${kv.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:'<p class="mp-empty mp-line">등록된 연락처가 없어요</p>'}`;
  }
  return `<main class="material-detail mp-detail"><div class="material-detail-head"><div><div class="material-eyebrow">업체 제공 자재</div><h3>${esc(co.name||coName(cid))}</h3><div class="mp-meta">자재 ${s.list.length}종${s.last?` · 최근 기록 ${md(s.last)}`:''}</div></div>
   <div class="material-balance-hero"><span>남은 수량</span><strong>${n0(s.balance)}개</strong></div></div>
   <div class="qp-tabs nd-material-tabs" role="tablist" aria-label="자재 상세">${tabs}</div>
   <div class="mp-body">${sum}<section class="mp-panel" role="tabpanel">${body}</section></div>
   <div class="mp-bar"><button type="button" class="btn ghost" data-mp-statement>재고내역서</button><span class="mp-sp"></span><button type="button" class="btn save" data-mp-new="">기록 추가</button></div></main>`;
 }

 function render(){
  const root=document.getElementById('materialContent');if(!root)return;
  root.dataset.mp='1';
  const ids=companyIds(),stats=ids.map(companyStats);
  if(!ids.includes(materialSelectedCompanyId)){const pick=stats.filter(s=>s.balance>0).sort((a,b)=>(b.last||'').localeCompare(a.last||''))[0]||stats[0];materialSelectedCompanyId=pick?.cid||'';ui.open.clear();}
  if(!materialStatementDate)materialStatementDate=today();
  const scroll=root.querySelector('.mp-list')?.scrollTop||0;
  root.innerHTML=`<div class="card material-master mp-master">${leftHtml(ids,materialSelectedCompanyId)}${detailHtml(materialSelectedCompanyId)}</div>`;
  const list=root.querySelector('.mp-list');if(list)list.scrollTop=scroll;
  if(ui.flash){const el=root.querySelector(`[data-mp-hrow="${CSS.escape(ui.flash)}"]`);el?.scrollIntoView({block:'center'});setTimeout(()=>{ui.flash='';el?.classList.remove('flash');},1600);}
 }
 renderMaterials=render;

 /* ── 메뉴(⋮): UI-RULES 'More menus' — 오른쪽 끝 = 표의 오른쪽 끝, 버튼 아래 4px ── */
 let menu=null;
 const closeMenu=()=>{if(!menu)return;menu.btn.setAttribute('aria-expanded','false');menu.el.remove();menu=null;};
 function openMenu(btn,items){
  const same=menu&&menu.btn===btn;closeMenu();if(same)return;
  const row=btn.closest('.mp-row-t');const el=document.createElement('div');el.className='mp-menu';el.setAttribute('role','menu');
  el.innerHTML=items.map((it,i)=>`<button type="button" role="menuitem" data-i="${i}" class="${it.danger?'danger':''}">${MI[it.icon||'edit']}<span><b>${esc(it.t)}</b>${it.sub?`<small>${esc(it.sub)}</small>`:''}</span></button>`).join('');
  el.addEventListener('click',ev=>{const b=ev.target.closest('[data-i]');if(!b)return;ev.stopPropagation();const it=items[Number(b.dataset.i)];closeMenu();it.fn();});
  row.append(el);const rr=row.getBoundingClientRect(),br=btn.getBoundingClientRect();el.style.top=Math.round(br.bottom-rr.top+4)+'px';btn.setAttribute('aria-expanded','true');menu={btn,el};
 }
 document.addEventListener('click',ev=>{if(menu&&!ev.target.closest?.('.mp-menu')&&!ev.target.closest?.('.mp-dots'))closeMenu();},true);

 /* ── 기록 창 ── */
 let sheet=null;
 function openSheet(html){
  if(!sheet){sheet=document.createElement('dialog');sheet.className='nd-pay-sheet nd-qa-sheet mp-sheet';sheet.addEventListener('click',ev=>{if(ev.target===sheet)sheet.close();});sheet.addEventListener('close',()=>{if(materialEditingId){materialEditingId='';materialDraft=newMaterialDraft(materialSelectedCompanyId);}});(document.getElementById('appView')||document.body).append(sheet);}
  sheet.innerHTML=html;if(!sheet.open){sheet.tabIndex=-1;sheet.showModal();sheet.focus({preventScroll:true});}
  sheet.querySelector('[data-x]')?.addEventListener('click',()=>sheet.close());return sheet;
 }
 function recordSheet(opts={}){
  const edit=opts.editId?(db.material_moves||[]).find(m=>m.id===opts.editId&&!m.void_at):null;
  if(opts.editId&&!edit)return;
  if(edit){materialEditingId=edit.id;materialDraft={...newMaterialDraft(edit.company_id),...edit,qty:String(edit.qty||''),work_qty:String(edit.work_qty||(edit.kind==='작업 완료'?edit.qty:'')),per_unit:String(edit.per_unit||1),order_no:edit.order_no||'',quote_id:edit.quote_id||'',work_item_id:edit.work_item_id||'',memo:edit.memo||'',source:edit.source||'직접 주문'};}
  else{materialEditingId='';const latest=act().filter(m=>m.company_id===materialSelectedCompanyId&&m.material===opts.material).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
   materialDraft={...newMaterialDraft(opts.company??materialSelectedCompanyId),kind:opts.kind||(materialSelectedCompanyId&&companyStats(materialSelectedCompanyId).balance>0?'작업 완료':'받음'),material:opts.material||'',source:latest?.source||'직접 주문',work_qty:'',per_unit:'1'};}
  const d=materialDraft;
  // 어디에 썼나요? (작업에 사용만): 견적 · 네이버 주문 · 기타 — 저장은 원래 칸(quote_id · source · order_no)에만 담는다.
  let use=d.quote_id?'quote':isNaver(d)&&(edit||opts.use==='naver')?'naver':edit&&d.source==='기타'?'etc':(opts.use||'quote');
  let hint='';
  const autofill=()=>{hint='';if(edit||use!=='quote'||!d.quote_id)return;const q=quoteOf(d.quote_id);
   const sup=(q?.lines||[]).filter(l=>l.supplied_material);if(!sup.length){hint='이 견적에는 쓰는 자재가 지정돼 있지 않아요 — 수량을 직접 넣어 주세요.';return;}
   const l=sup.find(x=>x.supplied_material===d.material)||sup[0];
   const done=act().filter(m=>m.quote_id===d.quote_id&&m.material===l.supplied_material&&m.kind==='작업 완료').reduce((a,m)=>a+(Number(m.work_qty)||0),0);
   const left=Math.max(0,(Number(l.qty)||0)-done);
   d.material=l.supplied_material;d.work_item_id=l.item_id&&l.item_id!=='__free__'?l.item_id:'';d.per_unit=String(Number(l.supplied_per_unit)||1);d.work_qty=left?String(left):'';
   hint=`견적의 쓰는 자재로 채웠어요: ${esc(l.name||'작업')} ${n0(l.qty)}개 × ${n0(d.per_unit)}개씩${done?` · 이미 ${n0(done)}개 기록`:''}`;};
  if(opts.quote){d.kind='작업 완료';d.quote_id=opts.quote;use='quote';autofill();}
  const paint=()=>{
   if(!edit&&d.kind==='작업 완료'&&use==='quote'&&isNaver(d))d.source='직접 주문';
   const totals=materialBalances(),bal=Number(totals[materialKey(d)])||0;
   const kinds=[['받음','받음'],['작업 완료','작업에 사용'],['반환','반환'],['불량/분실','불량·분실']];
   const holding=materialHoldingCompanyIds(totals);
   const cos=d.kind==='받음'||edit?db.companies:db.companies.filter(c=>holding.includes(c.id));
   const opt=(v,l,s)=>`<option value="${esc(v)}" ${v===s?'selected':''}>${esc(l)}</option>`;
   let choices=materialChoices(d.company_id,totals,d.kind!=='받음');if(edit&&d.material&&!choices.some(x=>x.name===d.material))choices.push({name:d.material,balance:bal});
   const qty=d.kind==='작업 완료'?(Number(d.work_qty)||0)*(Number(d.per_unit)||0):(Number(d.qty)||0);
   const base=edit&&edit.material===d.material&&edit.company_id===d.company_id?bal+(edit.kind==='받음'?-edit.qty:edit.qty):bal;
   const after=d.kind==='받음'?base+qty:base-qty;
   const quotes=(db.quotes||[]).filter(q=>q.company_id===d.company_id&&q.status!=='취소');
   const works=(db.items||[]).filter(i=>typeof isWork==='function'&&isWork(i));
   const field=(id,label,inner,wide)=>`<label class="${wide?'nd-qa-wide':''}">${label}${inner}</label>`;
   const input=(key,label,attrs='')=>field('',label,`<input data-mm="${key}" ${attrs} value="${esc(d[key])}">`);
   const verb=KIND[d.kind]||d.kind;
   const label=edit?'수정 내용 저장':qty>0&&d.material?`${n0(qty)}개 ${verb} 기록`:`${verb} 기록`;
   const s=openSheet(`<div class="nd-ps-hd"><b>${edit?'자재 기록 수정':'자재 기록'}</b><span class="nd-qa-sub">${esc(d.company_id?coName(d.company_id):'업체를 선택해 주세요')}</span></div>
    <div class="nd-qa-body">
     <div class="nd-qa-seg" role="tablist" aria-label="기록 구분">${kinds.map(([k,l])=>`<button type="button" role="tab" data-mp-kind="${esc(k)}" aria-selected="${d.kind===k}">${l}</button>`).join('')}</div>
     <div class="nd-qa-fields">
      ${!materialSelectedCompanyId||opts.pickCompany||edit?field('','업체',`<select data-mm="company_id">${opt('','업체 선택',d.company_id)}${cos.map(c=>opt(c.id,c.name,d.company_id)).join('')}</select>`):''}
      ${d.kind==='받음'?field('','자재',`<input data-mm="material" list="mp_names" value="${esc(d.material)}" placeholder="예: 모자 (검정)"><datalist id="mp_names">${materialChoices(d.company_id,totals).map(x=>opt(x.name,x.name,'')).join('')}</datalist>`)
       :field('','자재',`<select data-mm="material">${opt('','자재 선택',d.material)}${choices.map(x=>opt(x.name,`${x.name} — ${n0(x.balance)}개 남음`,d.material)).join('')}</select>`)}
      ${d.kind==='작업 완료'?`<div class="nd-qa-wide mp-use"><span class="nd-qa-label">어디에 썼나요?</span><div class="nd-qa-seg" role="tablist" aria-label="쓴 곳">${[['quote','견적'],['naver','네이버 주문'],['etc','기타']].map(([k,l])=>`<button type="button" role="tab" data-mp-use="${k}" aria-selected="${use===k}">${l}</button>`).join('')}</div></div>
        ${use==='quote'?field('','견적',`<select data-mm="quote_id">${opt('','견적 선택',d.quote_id)}${quotes.map(q=>opt(q.id,`${q.no||'견적'}${q.status?` · ${q.status}`:''}`,d.quote_id)).join('')}</select>`):use==='naver'?input('order_no','네이버 주문번호 (선택)','inputmode="numeric" placeholder="여러 건을 묶으면 비워 두세요"'):''}
        ${field('','작업 품목 (선택)',`<select data-mm="work_item_id">${opt('','지정 안 함',d.work_item_id)}${works.map(i=>opt(i.id,typeof itemLabel==='function'?itemLabel(i.name,i.code):i.name,d.work_item_id)).join('')}</select>`)}
        ${input('work_qty','작업 수량','inputmode="numeric" placeholder="예: 10"')}${input('per_unit','작업 1개당 자재','inputmode="numeric"')}`
       :input('qty','수량 (개)','inputmode="numeric" placeholder="예: 10"')}
      ${input('date','날짜','type="date"')}
      ${d.kind==='받음'?`${field('','주문 경로',`<select data-mm="source">${['직접 주문','스마트스토어','기타'].map(k=>opt(k,k==='스마트스토어'?'네이버 스마트스토어':k,d.source)).join('')}</select>`)}${input('order_no','주문번호 / 회차 (선택)')}`:''}
      ${input('memo','메모 (선택)',`placeholder="${d.kind==='작업 완료'&&use==='naver'?'예: 셰프복 3벌 패치 부착 · 7건':'예: 1차 작업, 불량 사유'}"`).replace('<label class="">','<label class="nd-qa-wide">')}
     </div>
     ${hint?`<p class="nd-qa-note mp-hint">${hint}</p>`:''}
     ${d.company_id&&d.material?`<p class="nd-qa-after">${qty>0?`<b>${esc(d.material)} ${n0(qty)}개</b>를 ${verb}(으)로 기록해요. 남은 수량 ${n0(base)} → <b>${n0(after)}개</b>`:`지금 남은 수량 <b>${n0(base)}개</b>`}${after<0?' · <b class="mp-warn">남은 수량보다 많아요</b>':''}</p>`:''}
    </div>
    <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" id="mm_save" ${materialSaving?'disabled':''}>${label}</button></div>`);
   s.querySelectorAll('[data-mp-use]').forEach(b=>b.onclick=()=>{if(use===b.dataset.mpUse)return;use=b.dataset.mpUse;hint='';
    if(use==='quote'){if(isNaver(d)||d.source==='기타')d.source='직접 주문';d.order_no='';}else{d.quote_id='';d.source=use==='naver'?'스마트스토어':'기타';if(use==='etc')d.order_no='';}paint();});
   s.querySelectorAll('[data-mp-kind]').forEach(b=>b.onclick=()=>{if(d.kind===b.dataset.mpKind)return;d.kind=b.dataset.mpKind;if(d.kind!=='작업 완료'){d.work_qty='';d.per_unit='1';d.quote_id='';d.work_item_id='';}if(!edit&&d.kind!=='받음'&&!materialChoices(d.company_id,materialBalances(),true).some(x=>x.name===d.material))d.material='';paint();});
   s.querySelectorAll('[data-mm]').forEach(el=>{
    const k=el.dataset.mm;
    el.addEventListener('input',()=>{d[k]=el.value;if(['qty','work_qty','per_unit'].includes(k)){const go=s.querySelector('#mm_save');const q=d.kind==='작업 완료'?(Number(d.work_qty)||0)*(Number(d.per_unit)||0):(Number(d.qty)||0);if(!edit&&go)go.textContent=q>0&&d.material?`${n0(q)}개 ${KIND[d.kind]} 기록`:`${KIND[d.kind]} 기록`;}});
    if(el.tagName==='SELECT'||k==='date'||['qty','work_qty','per_unit','material'].includes(k))el.addEventListener('change',()=>{d[k]=el.value;if(k==='company_id'){d.material='';d.quote_id='';}if(k==='quote_id')autofill();const keep=k;paint();if(['qty','work_qty','per_unit'].includes(keep))s.querySelector(`[data-mm="${keep}"]`)?.focus();});
   });
   s.querySelector('#mm_save').onclick=async()=>{
    if(materialSaving)return;setMaterialSaving(true);
    try{const move=buildMaterialMove(d);const ok=edit?await updateMaterialMove(edit.id,move):await persistMaterialMove(move);
     if(ok){materialSelectedCompanyId=move.company_id;materialSelectedName=move.material;const id=edit?edit.id:move.id;materialEditingId='';materialDraft=newMaterialDraft(move.company_id);sheet.close();ui.tab='history';ui.flash=id;setMaterialSaving(false);render();toast(edit?'자재 기록을 고쳤어요':`${move.material} ${n0(move.qty)}개 ${KIND[move.kind]}을(를) 기록했어요`);}}
    catch(err){toast(err.message);}finally{setMaterialSaving(false);}
   };
  };
  paint();
 }
 // 자재 이름 바꾸기: 이 업체의 같은 이름 기록(취소된 것 제외)을 한 번에. 이 업체 견적의 '쓰는 자재' 이름도 같이 바꾼다.
 function renameSheet(cid,name){
  const recs=act().filter(m=>m.company_id===cid&&m.material===name);if(!recs.length)return;
  const others=new Set(act().filter(m=>m.company_id===cid&&m.material!==name).map(m=>m.material));
  const s=openSheet(`<div class="nd-ps-hd"><b>자재 이름 바꾸기</b><span class="nd-qa-sub">${esc(coName(cid))} · 기록 ${n0(recs.length)}건</span></div>
   <div class="nd-qa-body"><div class="nd-qa-fields"><label class="nd-qa-wide"><span class="nd-qa-label">새 이름</span><input id="mp_rename" value="${esc(name)}" maxlength="200" autocomplete="off"></label></div>
   <p class="nd-qa-note mp-rn-note">기록 ${n0(recs.length)}건의 자재 이름이 함께 바뀌어요. 수량·날짜는 그대로예요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go" id="mp_rename_go">이름 바꾸기</button></div>`);
  const inp=s.querySelector('#mp_rename'),go=s.querySelector('#mp_rename_go'),note=s.querySelector('.mp-rn-note');
  const sync=()=>{const v=inp.value.trim();go.disabled=!v||v===name;note.innerHTML=v&&others.has(v)?`이미 있는 <b>${esc(v)}</b>와 합쳐져요(남은 수량도 더해져요).`:`기록 ${n0(recs.length)}건의 자재 이름이 함께 바뀌어요. 수량·날짜는 그대로예요.`;};
  inp.addEventListener('input',sync);sync();setTimeout(()=>{inp.focus();inp.select();},0);
  inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.isComposing&&!go.disabled){ev.preventDefault();go.click();}});
  go.onclick=async()=>{const to=inp.value.trim();if(!to||to===name||materialSaving)return;setMaterialSaving(true);go.disabled=true;go.textContent='저장 중…';
   try{const at=new Date().toISOString(),ids=new Set(recs.map(m=>m.id));
    const next=db.material_moves.map(m=>ids.has(m.id)?{...m,material:to,updated_at:at}:m);validateMaterialLedger(next);
    if(!await saveTable('material_moves',next)){go.disabled=false;go.textContent='다시 시도';return;}
    db.material_moves=next;
    // 견적 작업 줄의 '쓰는 자재'도 새 이름으로(이 업체 견적만). 실패해도 자재 기록은 이미 바뀌었으니 알려만 준다.
    const qs=(db.quotes||[]).filter(q=>q.company_id===cid&&(q.lines||[]).some(l=>l.supplied_material===name));let qNote='';
    if(qs.length){const qids=new Set(qs.map(q=>q.id)),nq=db.quotes.map(q=>qids.has(q.id)?{...q,lines:q.lines.map(l=>l.supplied_material===name?{...l,supplied_material:to}:l)}:q);
     if(await saveTable('quotes',nq))db.quotes=nq;else qNote=' · 견적의 쓰는 자재는 직접 바꿔 주세요';}
    materialSelectedName=to;if(ui.open.delete(name))ui.open.add(to);sheet.close();setMaterialSaving(false);render();toast(`이름을 '${to}'(으)로 바꿨어요${qNote}`);}
   catch(err){toast(err.message);go.disabled=false;go.textContent='이름 바꾸기';}finally{setMaterialSaving(false);}};
 }
 async function cancelRecord(id){
  const m=(db.material_moves||[]).find(x=>x.id===id&&!x.void_at);if(!m)return;
  const s=openSheet(`<div class="nd-ps-hd"><b>이 기록을 취소할까요?</b><span class="nd-qa-sub">${md(m.date)} · ${esc(m.material)} · ${KIND[m.kind]||esc(m.kind)} ${n0(m.qty)}개</span></div>
   <div class="nd-qa-body"><p class="nd-qa-note">기록은 '취소됨'으로 남고 남은 수량이 다시 계산돼요.</p></div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-x>닫기</button><button type="button" class="nd-qa-go nd-qa-del">기록 취소</button></div>`);
  s.querySelector('.nd-qa-del').onclick=async ev=>{const b=ev.currentTarget;if(materialSaving)return;setMaterialSaving(true);b.disabled=true;b.textContent='저장 중…';
   try{if(await voidMaterialMove(id)){sheet.close();setMaterialSaving(false);render();toast('기록을 취소했어요');}else{b.disabled=false;b.textContent='다시 시도';}}catch(err){toast(err.message);b.disabled=false;b.textContent='기록 취소';}finally{setMaterialSaving(false);}};
 }

 /* ── 이벤트 ── */
 document.addEventListener('click',ev=>{
  const root=document.getElementById('materialContent');if(!root||!root.contains(ev.target)||root.dataset.mp!=='1')return;
  // 기록 줄을 누르면 바로 수정 창(10/17 — ⋮ 메뉴 안의 '수정'을 찾기 어려웠다). 취소된 기록·버튼·링크는 제외
  const hr=ev.target.closest('[data-mp-hrow]');if(hr&&!ev.target.closest('button,a')&&!hr.classList.contains('gone')){recordSheet({editId:hr.dataset.mpHrow});return;}
  const t=ev.target.closest('button,[data-mp-open]');if(!t)return;
  if(t.matches('[data-mp-lt]')){ui.lt=t.dataset.mpLt;render();return;}
  if(t.matches('[data-mp-done]')){ui.showDone=!ui.showDone;render();return;}
  if(t.matches('[data-mp-pick]')){materialSelectedCompanyId=t.dataset.mmOwner;const p=t.dataset.mpPick;
   if(p==='material'){materialSelectedName=t.dataset.mpName;ui.tab='materials';ui.open=new Set([t.dataset.mpName]);}
   else{ui.open.clear();}
   render();return;}
  if(t.matches('[data-material-panel]')){ui.tab=t.dataset.materialPanel;render();return;}
  if(t.matches('[data-mp-tab]')){ui.tab=t.dataset.mpTab;render();return;}
  if(t.matches('[data-mp-rf]')){ui.rec=t.dataset.mpRf;render();return;}
  if(t.matches('#mm_new_receipt')){recordSheet({kind:'받음',pickCompany:true,company:''});return;}
  if(t.matches('[data-mp-new]')){const k=t.dataset.mpNew;recordSheet(k?{kind:k,pickCompany:!materialSelectedCompanyId}:{});return;}
  if(t.matches('[data-mp-statement]')){const d=document.getElementById('mm_statement_date');if(d?.value)materialStatementDate=d.value;previewMaterialStatement(materialSelectedCompanyId);return;}
  if(t.matches('[data-mp-company]')){try{switchView('companies');coSel=materialSelectedCompanyId;renderCoList?.();renderCoDetail();}catch{}return;}
  if(t.matches('[data-mp-quote]')){ev.stopPropagation();try{switchView('quotes');qtSel=t.dataset.mpQuote;renderQtList();renderQtDetail();}catch{}return;}
  if(t.matches('[data-mp-mat]')){ev.stopPropagation();const name=t.dataset.mpMat;openMenu(t,[{t:'받음 기록',sub:'더 받은 수량',icon:'plus',fn:()=>recordSheet({kind:'받음',material:name})},{t:'사용 기록',sub:'작업에 쓴 수량',icon:'plus',fn:()=>recordSheet({kind:'작업 완료',material:name})},{t:'반환·불량 기록',sub:'돌려준 수량 · 불량·분실',icon:'undo',fn:()=>recordSheet({kind:'반환',material:name})},{t:'이름 바꾸기',sub:'이 업체의 기록 모두',fn:()=>renameSheet(materialSelectedCompanyId,name)}]);return;}
  if(t.matches('[data-mp-rm]')){ev.stopPropagation();const id=t.dataset.mpRm;openMenu(t,[{t:'수정',sub:'수량 · 날짜 · 메모 · 연결 견적',fn:()=>recordSheet({editId:id})},{t:'기록 취소',sub:'남은 수량이 다시 계산돼요',icon:'undo',danger:true,fn:()=>cancelRecord(id)}]);return;}
  const open=t.closest('[data-mp-open]');if(open&&!ev.target.closest('button')){const n=open.dataset.mpOpen;ui.open.has(n)?ui.open.delete(n):ui.open.add(n);materialSelectedName=n;render();}
 });
 document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('#materialContent [data-mp-open]')){ev.preventDefault();ev.target.click();}});
 document.addEventListener('change',ev=>{if(ev.target.id==='mm_statement_date'&&ev.target.closest('#materialContent'))materialStatementDate=ev.target.value||today();});
 /* ── 견적서 작업 줄: '업체 제공 자재' 칸 (사용자 결정 A, 10/15) ──
    작업 줄 아래에 [쓰는 자재 ▾] × [1]개씩. line.supplied_material · line.supplied_per_unit로 저장(견적 저장 그대로, 비우면 예전과 같음).
    거래처가 맡긴 자재가 있거나 이미 지정된 줄에만 보인다. 자재 화면 기록 창에서 이 견적을 고르면 수량이 채워진다. */
 const qtQuote=()=>{try{return qtEditing||null;}catch{return null;}};
 function supBox(host,l,view,mats,totals,q,append){
  const it=l&&(db.items||[]).find(x=>x.id===l.item_id);
  let box=append?host.querySelector(':scope>.mp-qsup'):(host.nextElementSibling?.classList.contains('mp-qsup')?host.nextElementSibling:null);
  const show=l&&it&&typeof isWork==='function'&&isWork(it)&&(mats.length||l.supplied_material)&&(!view||l.supplied_material);
  if(!show){box?.remove();return;}
  const per=Number(l.supplied_per_unit)||1,need=(Number(l.qty)||0)*per,bal=Number(totals[materialKey({company_id:q.company_id,material:l.supplied_material})])||0;
  const key=JSON.stringify([view,l.id,l.supplied_material||'',per,l.qty,mats.map(m=>m.name+m.balance)]);
  if(box&&box.dataset.key===key)return;
  if(!box){box=document.createElement('div');box.className='mp-qsup';append?host.append(box):host.after(box);}
  box.dataset.key=key;box.classList.toggle('view',view);box.classList.toggle('in-card',!!append);
  const id=esc(l.id),names=[...new Set([...mats.map(m=>m.name),l.supplied_material].filter(Boolean))];
  box.innerHTML=view?`<span class="mp-qsup-k">업체 제공 자재</span><span><b>${esc(l.supplied_material)}</b> × ${n0(per)}개씩 = ${n0(need)}개 <span class="mp-qsup-bal">· 보유 ${n0(bal)}개</span></span>`
   :`<span class="mp-qsup-k">업체 제공 자재</span><select data-sup-mat="${id}" aria-label="업체 제공 자재"><option value="">없음 (우리 자재 사용)</option>${names.map(n=>{const m=mats.find(x=>x.name===n);return `<option value="${esc(n)}" ${n===l.supplied_material?'selected':''}>${esc(n)}${m?` — ${n0(m.balance)}개 보유`:''}</option>`;}).join('')}</select>
    ${l.supplied_material?`<span class="mp-qsup-x">×</span><input data-sup-per="${id}" inputmode="numeric" value="${per}" aria-label="작업 1개당 자재 수"><span class="mp-qsup-r">개씩 = <b>${n0(need)}개</b></span>${need>bal?`<span class="mp-qsup-bal warn">보유 ${n0(bal)}개</span>`:''}`:''}`;
 }
 function decorateQuote(){
  const f=document.getElementById('qtForm'),q=qtQuote();if(!f||!q||!Array.isArray(q.lines))return;
  const view=f.classList.contains('nd-view'),totals=materialBalances();
  const mats=q.company_id?materialChoices(q.company_id,totals):[];
  f.querySelectorAll('.qlines>.qline[data-idx]:not(.head)').forEach(row=>supBox(row,q.lines[Number(row.dataset.idx)],view,mats,totals,q,false));
  f.querySelectorAll('.qp-card').forEach(card=>{const lid=card.querySelector('[data-qp-edit]')?.dataset.qpEdit;supBox(card,q.lines.find(x=>x.id===lid),view,mats,totals,q,true);});
 }
 document.addEventListener('change',ev=>{const t=ev.target,q=qtQuote();if(!q||!t.matches?.('[data-sup-mat],[data-sup-per]'))return;
  const l=q.lines.find(x=>x.id===(t.dataset.supMat??t.dataset.supPer));if(!l)return;
  if(t.matches('[data-sup-mat]')){if(t.value){l.supplied_material=t.value;l.supplied_per_unit=Number(l.supplied_per_unit)||1;}else{delete l.supplied_material;delete l.supplied_per_unit;}}
  else l.supplied_per_unit=Math.max(1,Math.floor(Number(String(t.value).replace(/[^\d]/g,''))||1));
  decorateQuote();});
 let qtObs=null;const watchQuote=()=>{const v=document.getElementById('view-quotes');if(!v||qtObs)return;qtObs=new MutationObserver(()=>{if(!qtQueued){qtQueued=true;requestAnimationFrame(()=>{qtQueued=false;try{decorateQuote();}catch{}});}});qtObs.observe(v,{childList:true,subtree:true});};
 let qtQueued=false;watchQuote();document.addEventListener('DOMContentLoaded',watchQuote);
 if(document.getElementById('view-materials')?.classList.contains('active')||document.getElementById('materialContent')?.childElementCount)render();
})();
