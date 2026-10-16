/* 정보 칸 묶음(10/16 시안, UI-RULES 'Information groups'): 견적서 정보 탭 · 품목을 거래처·공급자 정보와 같은
   '왼쪽 묶음 이름 + 한 줄 설명 / 오른쪽 칸' 모양(.cp-grp)으로 모은다. 기본 앱이 그린 입력 칸을 그대로 옮길 뿐이라
   id · 이벤트 · 저장 규칙은 바뀌지 않는다. 기본 앱이 다시 그리면 다시 모은다(이미 모였으면 아무것도 하지 않는다).
   매입 정보 탭은 purchase-ui.mjs가 처음부터 같은 모양으로 그린다. */
(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const D=()=>{try{return db;}catch{return null;}};
 const num=n=>Math.round(Number(n)||0).toLocaleString('ko-KR');
 const grp=(key,title,desc)=>{const g=document.createElement('section');g.className='cp-grp nd-ig-'+key;g.innerHTML=`<div class="cp-grph"><h4>${esc(title)}</h4>${desc?`<p>${esc(desc)}</p>`:''}</div><div class="cp-grpb"></div>`;return g;};
 const body=g=>g.querySelector(':scope>.cp-grpb');
 const field=el=>el?.closest('.field')||null;
 const setText=(el,t)=>{if(el&&el.textContent!==t)el.textContent=t;};
 const hint=(host,cls,text)=>{if(!host)return;let h=host.querySelector(':scope>.'+cls);if(!h){h=document.createElement('div');h.className='hint '+cls;host.append(h);}setText(h,text);};
 const pair=(...nodes)=>{const r=document.createElement('div');r.className='grid2 nd-ig-pair';nodes.filter(Boolean).forEach(n=>r.append(n));return r;};

 // ── 견적서 정보 탭: 기본 정보(거래처 → 견적일자 · 유효기간) / 비고 / 관리(상태 직접 바꾸기 · 변경 기록) ──
 function quote(){
  const panel=document.getElementById('qp-panel-basic');if(!panel)return;
  const log=panel.querySelector('.nd-log-link');
  if(panel.classList.contains('nd-info')&&panel.querySelector(':scope>.nd-ig-basic')){
   // 기본 앱이 링크만 다시 붙였으면 '관리' 묶음 맨 아래로
   const mg=panel.querySelector(':scope>.nd-ig-manage>.cp-grpb');if(log&&mg&&log.parentElement!==mg)mg.append(log);
   return;
  }
  const co=field(document.getElementById('fq_co')),date=field(document.getElementById('fq_date')),valid=field(document.getElementById('fq_valid'));
  const memo=field(document.getElementById('fq_memo')),status=panel.querySelector('.qp-status-manual');
  if(!co||!date)return;
  const g1=grp('basic','기본 정보','견적서 표시'),g2=grp('memo','비고','견적서 하단 표시'),g3=grp('manage','관리','진행 탭에서 자동 변경');
  body(g1).append(co,pair(date,valid));
  if(memo){body(g2).append(memo);hint(memo,'nd-ig-hint',"거래처의 '견적서 기본 비고'가 새 견적에 먼저 채워져요");}
  if(status){setText(status.querySelector('label'),'상태 직접 바꾸기');hint(status,'nd-ig-hint','취소·복원 시에만 사용');body(g3).append(status);}
  if(log)body(g3).append(log);
  panel.replaceChildren(g1,g2,...(status||log?[g3]:[]));
  panel.classList.add('nd-info');
 }

 // ── 품목: 기본 정보 / 가격 / 옵션 / 사진·메모 / 관리, 머리 오른쪽 = 매출단가 · 셋째 줄 = 코드 · 유형 · 카테고리 · 옵션 수 ──
 function item(){
  const form=document.getElementById('itForm');if(!form||form.classList.contains('hidden'))return;
  const fb=form.querySelector(':scope>.workspace-form-body')||form;
  head(form);
  const photo=fb.querySelector(':scope>.nd-photo-itembox,.nd-photo-itembox');
  if(fb.classList.contains('nd-info')&&fb.querySelector(':scope>.nd-ig-basic')){
   const pm=fb.querySelector(':scope>.nd-ig-media>.cp-grpb');if(photo&&pm&&pm.firstElementChild!==photo)pm.prepend(photo); // 사진 먼저, 메모 다음(asset-ui는 메모가 있는 묶음 안이면 옮기지 않는다)
   logLink(fb,'item');return;
  }
  const $=id=>document.getElementById(id);
  const name=field($('fi_name')),code=field($('fi_code')),codeHint=$('fi_codeHint'),type=field($('fi_type')),unit=field($('fi_unit')),cat=field($('fi_category'));
  const spec=field($('fi_spec')),buy=field($('fi_buy')),sell=field($('fi_sell')),margin=$('fi_margin'),colors=field($('fi_colors')),opts=field($('fi_quick')),memo=field($('fi_memo'));
  const comps=field($('fi_addComp')),note=fb.querySelector(':scope>.copy-note');
  if(!name||!buy||!sell)return;
  // 글: 묶음 이름이 '기본'을 말해 주니 칸 이름은 짧게(작업 품목의 '작업 …'은 그대로)
  const lb=(f,t)=>{const l=f?.querySelector(':scope>label');if(!l)return;const v=typeof t==='function'?t(l.textContent):t;if(l.textContent!==v)l.textContent=v;};
  const short=t=>t.replace(/\s*\(기본\)\s*$/,'');
  lb(buy,short);lb(sell,short);lb(colors,'색상 · 쉼표로 구분');lb(opts,'규격/옵션 · 단가가 다를 때만');lb(cat,'카테고리');lb(spec,'기본 규격/옵션');
  cat?.querySelector(':scope>.hint')?.remove();const ci=$('fi_category');if(ci&&!/미분류/.test(ci.placeholder))ci.placeholder=(ci.placeholder||'기존 분류 선택 또는 새 카테고리 입력')+' — 비우면 미분류';
  const set=!!comps;
  const g1=grp('basic','기본 정보','견적서·거래명세서 표시'),g2=grp('price','가격',set?'미입력 시 구성품 합계 적용':'옵션 단가 미입력 시 적용');
  const g3=set?grp('opts','구성품','세트 구성 품목'):grp('opts','옵션','견적서에서 선택'),g4=grp('media','사진 · 메모','');
  if(note)body(g1).append(note);
  body(g1).append(pair(name,code));if(codeHint)body(g1).append(codeHint);body(g1).append(pair(type,unit));if(cat)body(g1).append(cat);
  body(g2).append(pair(buy,sell));if(margin&&!set)body(g2).append(margin);
  [comps,colors,opts,spec].forEach(n=>n&&body(g3).append(n));
  if(photo)body(g4).append(photo);if(memo)body(g4).append(memo);
  // 위에서 옮기지 않은 칸은 버리지 않고 옵션(구성품) 묶음 끝에 둔다. 빈 줄·옛 소제목만 지운다.
  const keep=[...fb.children].filter(n=>n.matches?.('.workspace-record-heading,.back-btn,.panel-b-back,[data-keep]'));
  for(const n of [...fb.children]){if(keep.includes(n))continue;if(n.matches('.ops-section-title')||(n.matches('.grid2')&&!n.querySelector('input,select,textarea,button')))continue;body(g3).append(n);}
  fb.replaceChildren(...keep,g1,g2,g3,g4);
  fb.classList.add('nd-info');form.classList.add('nd-info-form');
  logLink(fb,'item');
 }
 function logLink(fb,kind){
  let sel=null;try{sel=itSel;}catch{}
  const it=(D()?.items||[]).find(x=>x.id===sel);
  let g=fb.querySelector(':scope>.nd-ig-manage');
  if(!it||!window.NaroChangeLog){g?.remove();return;}
  if(!g){g=grp('manage','관리','');body(g).innerHTML='<button type="button" class="nd-log-link nd-ig-log">이 품목의 변경 기록 보기</button>';fb.append(g);}
  const b=g.querySelector('.nd-ig-log');if(b.dataset.ref!==it.id){b.dataset.ref=it.id;b.onclick=()=>window.NaroChangeLog.open({ref:it.id,title:it.name||'품목',noun:'품목'});}
  if(g.nextElementSibling)fb.append(g);
 }
 function head(form){
  const h=form.querySelector('.workspace-record-heading');if(!h)return;
  let sel=null;try{sel=itSel;}catch{}
  const it=(D()?.items||[]).find(x=>x.id===sel);
  let amt=h.querySelector(':scope>.nd-ig-amt'),meta=h.querySelector(':scope>.nd-ig-meta');
  if(!it){amt?.remove();meta?.remove();return;}
  const opts=(it.variants||[]).length;
  // 세트는 판매가를 비워 두면 구성품 합계를 쓴다(기본 앱 setCompSums와 같은 값).
  let sell=Number(it.sell_price)||0,k='매출단가 (기본)';
  if(!sell&&it.type==='세트'){try{sell=setCompSums(it).sell||0;k='세트 판매가 · 구성 합계';}catch{}}
  const a=`<div class="k">${k}</div><div class="v">${num(sell)}원</div>`;
  const m=[it.code,it.type||'단품',(it.category||'').trim()||'미분류',opts?`옵션 ${opts}개`:''].filter(Boolean).map(esc).join('<i class="dot">·</i>');
  if(!amt){amt=document.createElement('div');amt.className='nd-ig-amt';h.append(amt);}
  if(!meta){meta=document.createElement('div');meta.className='nd-ig-meta';h.append(meta);}
  if(amt.innerHTML!==a)amt.innerHTML=a;if(meta.innerHTML!==m)meta.innerHTML=m;
  h.classList.add('nd-ig-head');
 }

 let queued=false;
 const run=()=>{queued=false;try{quote();item();}catch(e){console.error(e);}};
 const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(run);};
 function mount(){
  for(const id of ['qtForm','itForm']){const el=document.getElementById(id);if(el)new MutationObserver(schedule).observe(el,{childList:true,subtree:true});}
  document.addEventListener('input',e=>{if(e.target?.closest?.('#itForm'))schedule();},true);
  schedule();
 }
 window.NaroInfoGroups={run:schedule};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
