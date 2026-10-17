/* 견적서 안내문 · 건별 마진(10/17 시안 — 사용자 확정).
   안내문 = 모든 견적서 비고 아래 빨간 글씨. 고치는 곳은 공급자 정보 한 곳(settings.quote_notice, 없으면 기본 문구, 빈 글 = 안내문 없음).
   견적서 정보 탭에는 '이 견적서에 안내문 넣기' 스위치(quote.no_notice)와 [공급자 정보에서 바꾸기 ›]만 둔다.
   건별 마진 = 견적에 연결된 매입(purchase.quote_id, 매입 화면 '견적 연결')을 원가로, 진행 탭 맨 위에 매출 − 원가 = 마진. 출력물에는 나오지 않는다. */
(()=>{
 const NOTICE_DEFAULT='자수 제품은 주문 제작 상품으로, 제작 진행 후에는 교환·환불·반품이 불가합니다.\n주문 제작 상품은 영업일 기준 약 20일 정도 소요될 수 있으니 주문 시 참고 부탁드립니다.';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const won=n=>Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
 const D=()=>{try{return db;}catch{return null;}};
 const fn=(name,...a)=>{try{const f=globalThis[name];return typeof f==='function'?f(...a):undefined;}catch{return undefined;}};
 const norm=v=>String(v??'').replace(/\r\n?/g,'\n').split('\n').map(x=>x.trim()).join('\n').replace(/^\n+|\n+$/g,'');
 const noticeText=()=>{const s=D()?.settings||{};return typeof s.quote_notice==='string'?s.quote_notice:NOTICE_DEFAULT;};
 const noticeLines=q=>q?.no_notice?[]:noticeText().split('\n').map(x=>x.trim()).filter(Boolean);
 window.naroQuoteNoticeText=noticeText;
 window.naroNormNotice=norm;
 window.naroQuoteNoticeLines=noticeLines;
 window.naroQuoteNoticeHtml=q=>{const ls=noticeLines(q);return ls.length?`<div class="notice">${ls.map(esc).join('<br>')}</div>`:'';};
 window.naroQuoteNoticeDefault=NOTICE_DEFAULT;

 // ── 공급자 정보: '견적서 안내문' 칸(값 채우기 · 저장은 build.mjs가 renderSettings/saveSettings에 넣은 몇 줄) ──
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-nd-qn-default]');if(!b)return;
  const t=document.getElementById('st_quote_notice');if(!t)return;t.value=NOTICE_DEFAULT;t.dispatchEvent(new Event('input',{bubbles:true}));t.focus();
 });

 // ── 견적서 정보 탭: 안내문 넣기 스위치 ──
 function noticeToggle(form){
  const memo=form.querySelector('#fq_memo');const field=memo?.closest('.field');if(!field)return;
  let box=form.querySelector('.nd-qn');
  if(!box){box=document.createElement('div');box.className='nd-qn';
   box.innerHTML='<label class="nd-qn-sw"><input type="checkbox" id="fq_notice"><span class="nd-qn-t">안내문 넣기 <small>모든 견적서 공통 · 빨간 글씨</small></span></label><button type="button" class="nd-qn-go">공급자 정보에서 바꾸기 ›</button>';
   box.querySelector('#fq_notice').addEventListener('change',ev=>{let e;try{e=qtEditing;}catch{}if(!e)return;if(ev.target.checked)delete e.no_notice;else e.no_notice=true;form.dispatchEvent(new Event('input',{bubbles:true}));});
   box.querySelector('.nd-qn-go').addEventListener('click',()=>{if(fn('switchView','settings')===false)return;setTimeout(()=>{const t=document.getElementById('st_quote_notice');t?.scrollIntoView({block:'center'});t?.focus();},60);});
   field.after(box);}
  let e;try{e=qtEditing;}catch{}
  const cb=box.querySelector('#fq_notice');const on=!e?.no_notice;if(cb.checked!==on)cb.checked=on;
  const empty=!noticeText().trim();box.classList.toggle('is-empty',empty);
  const sm=box.querySelector('.nd-qn-t small');const st=empty?'공급자 정보의 안내문이 비어 있어요':'모든 견적서 공통 · 빨간 글씨';if(sm.textContent!==st)sm.textContent=st;
 }

 // ── 진행 탭: 건별 마진(연결된 매입이 있을 때만) ──
 let asked=false;
 function marginCard(form){
  const flow=form.querySelector('.qp-flow');let e;try{e=qtEditing;}catch{}
  const old=form.querySelector('.nd-qm');
  const P=globalThis.NaroPurchases;
  if(!flow||!e?.id||!P?.byQuote){old?.remove();return;}
  let links=P.byQuote(e.id);
  if(links===null){if(!asked&&P.load){asked=true;P.load(false,true).then(()=>{try{marginCard(document.getElementById('qtForm'));}catch{}}).catch(()=>{});}old?.remove();return;}
  if(!links.length){old?.remove();return;}
  let supply=0;try{supply=fn('quoteTotals',e)?.supply||0;}catch{}
  // 원가 = 연결된 매입 + 연결 매입에 없는 등록 품목의 매입단가(재고에서 나간 것). 매입단가 없는 줄(직접 입력·작업)은 0원.
  const linked=new Set(links.flatMap(l=>l.items||[]));let extra=0;const zero=[];
  for(const l of e.lines||[]){const qty=Number(l.qty)||0;if(!(l.name||'').trim()||!qty)continue;
   const it=l.item_id&&l.item_id!=='__free__'?(D()?.items||[]).find(x=>x.id===l.item_id):null;
   if(it&&linked.has(it.id))continue;
   const buy=it?Number(fn('itemBuy',it,l.spec))||0:0;
   if(buy)extra+=qty*buy;else if(!links.some(x=>(x.items||[]).includes(l.item_id)))zero.push((window.naroSplitName?window.naroSplitName(l).name:l.name)||'품목');}
  const cost=links.reduce((s,l)=>s+l.cost,0)+Math.round(extra),margin=supply-cost,rate=supply>0?Math.round(margin/supply*100):null;
  const html=`<div class="nd-qm-k"><div><span>매출 (공급가)</span><b>${won(supply)}</b></div><div><span>원가</span><b>${won(cost)}</b><em>매입 ${links.length}건${extra?' + 재고 품목':''}</em></div><div class="${margin<0?'neg':'pos'}"><span>마진</span><b>${margin<0?'−':''}${won(Math.abs(margin))}</b><em>${rate===null?'—':rate+'%'}</em></div></div>
   <div class="nd-qm-h">원가 내역</div>
   ${links.map(l=>`<button type="button" class="nd-qm-r" data-pu="${esc(l.id)}"><span class="d">${esc((l.date||'').slice(5).replace('-','.'))}</span><span class="n">${esc([l.vendor,l.title].filter(Boolean).join(' · '))}<small>매입 ${esc(l.no)}</small></span><span class="a">${won(l.cost)}</span></button>`).join('')}
   ${extra?`<div class="nd-qm-r is-static"><span class="d">—</span><span class="n">재고 품목<small>등록 매입단가 기준</small></span><span class="a">${won(extra)}</span></div>`:''}
   ${zero.length?`<p class="nd-qm-note">${esc(zero.slice(0,3).join(' · '))}${zero.length>3?` 외 ${zero.length-3}개`:''} · 원가 없음(0원)</p>`:''}`;
  // 진행 탭의 납품 · 입금 · 계산서 카드(.nd-rec-card)와 같은 모양으로 맨 위에
  const host=flow.querySelector('.nd-rec')||flow;
  let box=old;if(!box){box=document.createElement('section');box.className='nd-rec-card nd-qm';box.innerHTML='<div class="nd-rec-hd"><div><h3>마진</h3><span>연결된 매입 기준 · 내부 확인용(출력 안 됨)</span></div></div><div class="nd-qm-b"></div>';
   box.addEventListener('click',ev=>{const r=ev.target.closest('[data-pu]');if(r)globalThis.NaroPurchases?.open?.(r.dataset.pu);});}
  if(box.parentElement!==host||host.firstElementChild!==box)host.prepend(box);
  const b=box.querySelector('.nd-qm-b');if(b.dataset.html!==html){b.innerHTML=html;b.dataset.html=html;}
 }

 function enhance(){const form=document.getElementById('qtForm');if(!form||form.classList.contains('hidden'))return;try{noticeToggle(form);}catch(e){console.error('[quote-notice]',e);}try{marginCard(form);}catch(e){console.error('[quote-margin]',e);}}
 if(typeof renderQtDetail==='function'){const orig=renderQtDetail;renderQtDetail=function(){const r=orig.apply(this,arguments);enhance();return r;};}
 // 다른 화면 코드가 견적서 폼을 직접 다시 그릴 때도(이 함수를 거치지 않음) 스위치·마진이 다시 붙게 폼을 지켜본다. 붙이는 일은 이미 있으면 아무것도 안 한다.
 let queued=false;const later=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance();});};
 const watch=()=>{const form=document.getElementById('qtForm');if(!form||form.dataset.ndQx)return;form.dataset.ndQx='1';new MutationObserver(later).observe(form,{childList:true,subtree:true});later();};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',watch):watch();
 window.NaroQuoteExtras={enhance,noticeText,noticeLines};
})();
