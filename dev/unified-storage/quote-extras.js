/* 견적서 안내문 · 건별 마진(10/17 시안 — 사용자 확정).
   안내문 = 모든 견적서 비고 아래. 고치는 곳은 공급자 정보 한 곳(settings.quote_notice_runs — 글자 조각마다 굵게·색 4가지, 없으면 기본 문구, 빈 글 = 안내문 없음).
   견적서 정보 탭에는 '이 견적서에 안내문 넣기' 스위치(quote.no_notice)와 [공급자 정보에서 바꾸기 ›]만 둔다.
   건별 마진 = 견적에 연결된 매입(purchase.quote_id, 매입 화면 '견적 연결')을 원가로, 진행 탭 맨 위에 매출 − 원가 = 마진. 출력물에는 나오지 않는다. */
(()=>{
 // 안내문 = 줄마다 조각 [{t:글자, c:색, b:굵게}] — 색은 4가지(검정·빨강·파랑·회색), 꾸미지 않은 글자는 빨강(10/17 2차, 사용자 확정).
 // settings.quote_notice_runs(꾸민 글) · settings.quote_notice(같은 내용의 글자만 — 옛 버전·검색용). 둘 다 없으면 기본 문구.
 const COLORS={ink:'#0B1220',red:'#D32F2F',blue:'#2F54EB',gray:'#8A94A6'},CNAME={ink:'검정',red:'빨강',blue:'파랑',gray:'회색'};
 const R=(t,c='red',b)=>({t,c,...(b?{b:1}:{})});
 const DEFAULT_RUNS=[[R('자수 제품은 '),R('주문 제작 상품','red',1),R('으로, 제작 진행 후에는 '),R('교환·환불·반품이 불가','red',1),R('합니다.')],
  [R('주문 제작 상품은 영업일 기준 약 ','ink'),R('20일','blue',1),R(' 정도 소요될 수 있으니 주문 시 참고 부탁드립니다.','ink')]];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const won=n=>Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
 const D=()=>{try{return db;}catch{return null;}};
 const fn=(name,...a)=>{try{const f=globalThis[name];return typeof f==='function'?f(...a):undefined;}catch{return undefined;}};
 // 조각 정리: 모르는 색 → 빨강, 같은 모양 이웃은 합치고, 글자 없는 줄은 뺀다(최대 40줄 · 2000자)
 function normRuns(lines){
  const out=[];let n=0;
  for(const line of Array.isArray(lines)?lines:[]){const L=[];
   for(const r of Array.isArray(line)?line:[]){let t=String(r?.t??'').replace(/\r?\n/g,' ');if(!t)continue;if(n+t.length>2000)t=t.slice(0,2000-n);if(!t)break;n+=t.length;
    const c=COLORS[r.c]?r.c:'red',b=!!r.b,last=L[L.length-1];if(last&&last.c===c&&!!last.b===b)last.t+=t;else L.push(R(t,c,b));}
   if(L.length&&L.some(r=>r.t.trim())){L[0].t=L[0].t.replace(/^\s+/,'');const z=L[L.length-1];z.t=z.t.replace(/\s+$/,'');out.push(L.filter(r=>r.t));}
   if(out.length>=40)break;}
  return out;
 }
 const plain=runs=>runs.map(l=>l.map(r=>r.t).join('')).join('\n');
 function noticeRuns(){const s=D()?.settings||{};
  if(Array.isArray(s.quote_notice_runs))return normRuns(s.quote_notice_runs);
  if(typeof s.quote_notice==='string')return normRuns(s.quote_notice.split('\n').map(t=>[R(t.trim())]));
  return normRuns(DEFAULT_RUNS);}
 const noticeText=()=>plain(noticeRuns());
 const runsFor=q=>q?.no_notice?[]:noticeRuns();
 const runHtml=r=>`<span class="nq-${r.c}">${r.b?'<b>':''}${esc(r.t)}${r.b?'</b>':''}</span>`;
 window.naroQuoteNoticeText=noticeText;
 window.naroQuoteNoticeLines=q=>runsFor(q).map(l=>l.map(r=>r.t).join(''));
 window.naroQuoteNoticeHtml=q=>{const ls=runsFor(q);return ls.length?`<div class="notice">${ls.map(l=>l.map(runHtml).join('')).join('<br>')}</div>`:'';};
 // 견적서 이미지(drawQuoteCanvas): 조각마다 글꼴·색을 바꿔 가며 줄을 나누고 그린다
 window.naroNoticeCanvasLines=(mc,q,maxW,F)=>{const out=[];
  for(const line of runsFor(q)){let cur=[],w=0;
   for(const r of line){mc.font=F(r.b?700:400,12.5);
    for(const ch of r.t){const cw=mc.measureText(ch).width;
     if(w+cw>maxW&&w>0){out.push(cur);cur=[];w=0;if(ch===' ')continue;}
     const last=cur[cur.length-1];if(last&&last.c===r.c&&!!last.b===!!r.b)last.t+=ch;else cur.push(R(ch,r.c,r.b));w+=cw;}}
   out.push(cur);}
  return out;};
 window.naroNoticeDrawLine=(ctx,ln,x,y,F)=>{let cx=x;for(const r of ln){ctx.font=F(r.b?700:400,12.5);ctx.fillStyle=COLORS[r.c]||COLORS.red;ctx.fillText(r.t,cx,y);cx+=ctx.measureText(r.t).width;}ctx.font=F(400,12.5);};

 // ── 공급자 정보: '견적서 안내문' 꾸미기 칸(굵게 · 색 4가지 · 꾸밈 지우기). 저장은 build.mjs가 renderSettings/saveSettings에 넣은 몇 줄 ──
 function readEditor(el){
  const lines=[[]];const cur=()=>lines[lines.length-1];
  const push=(t,st)=>{if(t)cur().push(R(t,st.c,st.b));};
  const walk=(node,st)=>{for(const ch of node.childNodes){
   if(ch.nodeType===3){push(ch.nodeValue.replace(/ /g,' ').replace(/[\r\n]+/g,' '),st);continue;}
   if(ch.nodeType!==1)continue;const tag=ch.tagName;
   if(tag==='BR'){lines.push([]);continue;}
   const block=/^(DIV|P|LI)$/.test(tag);if(block&&cur().length)lines.push([]);
   const ns={...st},k=[...ch.classList].find(x=>/^nq-(ink|red|blue|gray)$/.test(x));if(k)ns.c=k.slice(3);
   const fw=ch.style?.fontWeight;if(tag==='B'||tag==='STRONG'||fw==='bold'||Number(fw)>=600)ns.b=true;if(ch.classList.contains('nq-unb'))ns.b=false; // 굵게 풀기 · 꾸밈 지우기 표시
   walk(ch,ns);if(block)lines.push([]);}};
  walk(el,{c:'red',b:false});return normRuns(lines);
 }
 const editorHtml=runs=>runs.map(l=>l.map(runHtml).join('')).join('<br>');
 window.naroNoticeToEditor=el=>{if(el)el.innerHTML=editorHtml(noticeRuns());};
 window.naroNoticeFromEditor=()=>{const el=document.getElementById('st_quote_notice');if(!el)return {};const runs=readEditor(el);return {quote_notice:plain(runs),quote_notice_runs:runs};};
 window.naroNoticeEditorClean=()=>{const el=document.getElementById('st_quote_notice');return !el||JSON.stringify(readEditor(el))===JSON.stringify(noticeRuns());};
 window.naroNoticeColors=CNAME;
 const changed=el=>el.dispatchEvent(new Event('input',{bubbles:true}));
 function inEditor(){const el=document.getElementById('st_quote_notice'),s=getSelection();if(!el||!s.rangeCount)return null;const r=s.getRangeAt(0);return el.contains(r.commonAncestorContainer)?{el,s,r}:null;}
 // 고른 글자를 꺼내 새 모양으로 다시 넣는다(안쪽의 옛 색·굵게는 벗긴다)
 function restyle(fnWrap){const x=inEditor();if(!x||x.r.collapsed)return;const frag=x.r.extractContents();
  frag.querySelectorAll('span[class^="nq-"]').forEach(n=>n.replaceWith(...n.childNodes));
  const node=fnWrap(frag);x.r.insertNode(node);x.s.removeAllRanges();const nr=document.createRange();nr.selectNodeContents(node);x.s.addRange(nr);
  x.el.innerHTML=editorHtml(readEditor(x.el));changed(x.el);}
 document.addEventListener('mousedown',e=>{if(e.target.closest?.('.nd-qn-tb button'))e.preventDefault();});
 document.addEventListener('click',e=>{
  const d=e.target.closest?.('[data-nd-qn-default]');
  if(d){const el=document.getElementById('st_quote_notice');if(!el)return;el.innerHTML=editorHtml(normRuns(DEFAULT_RUNS));changed(el);el.focus();return;}
  const b=e.target.closest?.('.nd-qn-tb button');if(!b)return;
  if(b.hasAttribute('data-qn-b')){const x=inEditor();if(!x||x.r.collapsed)return;
   const allBold=readEditor((()=>{const w=document.createElement('div');w.append(x.r.cloneContents());return w;})()).every(l=>l.every(r=>r.b));
   const anc=n=>{for(;n&&n!==x.el;n=n.parentNode)if(n.nodeType===1&&/^(B|STRONG)$/.test(n.tagName))return true;return false;};
   const insideB=anc(x.r.startContainer)&&anc(x.r.endContainer);
   restyle(frag=>{frag.querySelectorAll('b,strong').forEach(n=>n.replaceWith(...n.childNodes));if(allBold||insideB){const sp=document.createElement('span');sp.className='nq-unb';sp.append(frag);return sp;}const w=document.createElement('b');w.append(frag);return w;});return;}
  if(b.dataset.qnC){const c=b.dataset.qnC;restyle(frag=>{const sp=document.createElement('span');sp.className='nq-'+c;sp.append(frag);return sp;});return;}
  if(b.hasAttribute('data-qn-clear')){restyle(frag=>{const sp=document.createElement('span');sp.className='nq-red nq-unb';sp.textContent=frag.textContent;return sp;});}
 });
 // 붙여넣기는 글자만(다른 곳의 글꼴·크기·색은 따라오지 않게)
 document.addEventListener('paste',e=>{const el=e.target.closest?.('#st_quote_notice');if(!el)return;e.preventDefault();const t=(e.clipboardData||window.clipboardData)?.getData('text/plain')||'';document.execCommand('insertText',false,t);});

 // ── 견적서 정보 탭: 안내문 넣기 스위치 ──
 function noticeToggle(form){
  const memo=form.querySelector('#fq_memo');const field=memo?.closest('.field');if(!field)return;
  let box=form.querySelector('.nd-qn');
  if(!box){box=document.createElement('div');box.className='nd-qn';
   box.innerHTML='<label class="nd-qn-sw"><input type="checkbox" id="fq_notice"><span class="nd-qn-t">안내문 넣기 <small>모든 견적서 공통</small></span></label><button type="button" class="nd-qn-go">공급자 정보에서 바꾸기 ›</button>';
   box.querySelector('#fq_notice').addEventListener('change',ev=>{let e;try{e=qtEditing;}catch{}if(!e)return;if(ev.target.checked)delete e.no_notice;else e.no_notice=true;form.dispatchEvent(new Event('input',{bubbles:true}));});
   box.querySelector('.nd-qn-go').addEventListener('click',()=>{if(fn('switchView','settings')===false)return;setTimeout(()=>{const t=document.getElementById('st_quote_notice');t?.scrollIntoView({block:'center'});t?.focus();},60);});
   field.after(box);}
  let e;try{e=qtEditing;}catch{}
  const cb=box.querySelector('#fq_notice');const on=!e?.no_notice;if(cb.checked!==on)cb.checked=on;
  const empty=!noticeText().trim();box.classList.toggle('is-empty',empty);
  const sm=box.querySelector('.nd-qn-t small');const st=empty?'공급자 정보의 안내문이 비어 있어요':'모든 견적서 공통';if(sm.textContent!==st)sm.textContent=st;
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
  const linked=new Set(links.flatMap(l=>l.items||[])),named=new Set(links.flatMap(l=>l.names||[]));let extra=0;const zero=[];
  for(const l of e.lines||[]){const qty=Number(l.qty)||0;if(!(l.name||'').trim()||!qty)continue;
   const it=l.item_id&&l.item_id!=='__free__'?(D()?.items||[]).find(x=>x.id===l.item_id):null;
   if(it&&linked.has(it.id))continue;
   if(!it&&named.has(String((window.naroSplitName?window.naroSplitName(l).name:l.name)||l.name||'').trim()))continue;
   const buy=it?Number(fn('itemBuy',it,l.spec))||0:0;
   if(buy)extra+=qty*buy;else zero.push((window.naroSplitName?window.naroSplitName(l).name:l.name)||'품목');}
  const cost=links.reduce((s,l)=>s+l.cost,0)+Math.round(extra),margin=supply-cost,rate=supply>0?Math.round(margin/supply*100):null;
  const html=`<div class="nd-qm-k"><div><span>매출 (공급가)</span><b>${won(supply)}</b></div><div><span>원가</span><b>${won(cost)}</b><em>매입 ${links.length}건${extra?' + 재고 품목':''}</em></div><div class="${margin<0?'neg':'pos'}"><span>마진</span><b>${margin<0?'−':''}${won(Math.abs(margin))}</b><em>${rate===null?'—':rate+'%'}</em></div></div>
   <div class="nd-qm-h">원가 내역</div>
   ${links.map(l=>`<button type="button" class="nd-qm-r" data-pu="${esc(l.id)}"><span class="d">${esc((l.date||'').slice(5).replace('-','.'))}</span><span class="n">${esc([l.vendor,l.title].filter(Boolean).join(' · '))}<small>매입 ${esc(l.no)}${l.all===false?` · 이 견적 줄 ${l.lines}개`:''}</small></span><span class="a">${won(l.cost)}</span></button>`).join('')}
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
 window.NaroQuoteExtras={enhance,noticeText,noticeRuns};
})();
