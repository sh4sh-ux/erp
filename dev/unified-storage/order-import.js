/* 쇼핑몰 주문 가져오기 (스마트스토어·쿠팡 주문 엑셀 → 수주 견적서). 무료 · 파일은 이 기기에서만 읽는다.
   구매자·수취인 이름·연락처·주소·ID는 읽지도 저장하지도 않는다 — 주문번호만 메모로 남긴다.
   저장 규칙상 견적서는 한 번에 1건씩만 바뀌므로 주문마다 차례로 저장한다(saveTable).
   주의: build.mjs가 String.replace로 index.html에 끼워 넣으므로, 코드에 달러+앰퍼샌드 같은 치환 특수 문자열을 쓰지 말 것(스크립트가 통째로 깨진다). */
const NaroOrderImport=(()=>{
 const text=v=>String(v??'').trim();
 const num=v=>{const n=Number(String(v??'').replace(/[,원\s]/g,''));return Number.isFinite(n)?n:0;};
 const KINDS={
  naver:{label:'스마트스토어',company:'스마트스토어',need:['상품주문번호','주문번호','상품명','옵션정보','수량','최종 상품별 총 주문금액']},
  coupang:{label:'쿠팡',company:'쿠팡',need:['묶음배송번호','주문번호','등록옵션명','구매수(수량)','옵션판매가(판매단가)','결제액']}
 };
 // 제목 줄을 찾아 어느 쇼핑몰 파일인지 알아낸다(위에 안내 줄이 몇 줄 있어도 된다).
 function detect(rows){
  for(let i=0;i<Math.min(rows.length,10);i++){const h=rows[i].map(text);
   for(const [kind,k] of Object.entries(KINDS))if(k.need.every(n=>h.includes(n)))return {kind,header:i};}
  return null;
 }
 // 엑셀 날짜(일련번호, 1900 기준 · 현지 시각) 또는 '2026-10-07 07:46:37' / '2026.10.07' → 'YYYY-MM-DD'
 function day(v){
  const s=text(v);
  if(/^\d+(\.\d+)?$/.test(s)&&Number(s)>20000&&Number(s)<80000){const d=new Date(Math.round((Number(s)-25569)*864e5));return d.toISOString().slice(0,10);}
  const m=s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';
 }
 const SIZE=/^(X{0,3}S|M|X{0,4}L|\d?XL|\d{2,3}|F|FREE|ONE ?SIZE)$/i;
 // 옵션 글자 → {color,size}. 네이버: '모델명: … / 컬러: 화이트(WHITE) / 사이즈: 3XL', 쿠팡: 'JK_HSB-LS 블랙(BLACK) M'
 function option(kind,raw,code){
  const s=text(raw);let color='',size='';
  if(s.includes(':')){for(const part of s.split('/')){const [k,...v]=part.split(':');const key=text(k),val=text(v.join(':'));
    if(/컬러|색상|색깔|colou?r/i.test(key))color=val;else if(/사이즈|크기|규격|size/i.test(key))size=val;}}
  else{let toks=s.split(/\s+/).filter(Boolean);if(code)toks=toks.filter(t=>t.toUpperCase()!==code.toUpperCase());
   if(toks.length&&SIZE.test(toks.at(-1)))size=toks.pop();color=toks.join(' ');}
  return {color,size};
 }
 // 품번: 옵션·상품명 글자 안에 NARO 품목의 품번이 들어 있으면 그 품목(가장 긴 품번 우선).
 function findItem(hay,items){
  const H=text(hay).toUpperCase();let best=null;
  for(const it of items){const c=text(it.code).toUpperCase();if(c.length<3)continue;
   const i=H.indexOf(c);if(i<0)continue;const after=H[i+c.length]||' ',before=H[i-1]||' ';
   if(/[A-Z0-9]/.test(after)||/[A-Z0-9_-]/.test(before))continue; // JK_3SB가 JK_3SB-LS 안에서 잡히지 않게
   if(!best||c.length>text(best.code).length)best=it;}
  return best;
 }
 const KO={'화이트':'WHITE','흰색':'WHITE','블랙':'BLACK','검정':'BLACK','검정색':'BLACK','네이비':'NAVY','곤색':'NAVY','그레이':'GRAY','회색':'GRAY','차콜':'CHARCOAL','베이지':'BEIGE','아이보리':'IVORY','레드':'RED','빨강':'RED','블루':'BLUE','파랑':'BLUE','브라운':'BROWN','갈색':'BROWN','카키':'KHAKI','그린':'GREEN','초록':'GREEN','옐로우':'YELLOW','노랑':'YELLOW','오렌지':'ORANGE','핑크':'PINK','퍼플':'PURPLE','보라':'PURPLE','와인':'WINE','민트':'MINT','스카이블루':'SKYBLUE','하늘색':'SKYBLUE'};
 const CODES={WHITE:['WH','WT','W'],BLACK:['BK','BL','B'],NAVY:['NV','NY','N'],GRAY:['GY','GR','G'],GREY:['GY','GR'],CHARCOAL:['CH','CC','CG'],BEIGE:['BE','BG'],IVORY:['IV','IY'],RED:['RD','RE','R'],BLUE:['BU','BL'],BROWN:['BR','BN'],KHAKI:['KH','KK'],GREEN:['GN','GR'],YELLOW:['YE','YL'],ORANGE:['OR','OG'],PINK:['PK','PI'],PURPLE:['PP','PU'],WINE:['WI','WN'],MINT:['MT','MI'],SKYBLUE:['SB','SK']};
 const memKey=(code,what,raw)=>`${text(code).toUpperCase()}|${what}|${text(raw)}`;
 function matchColor(raw,item,memory={}){
  const colors=(item?.colors||[]).map(text).filter(Boolean);
  if(!colors.length)return {color:text(raw),ok:true};
  const r=text(raw);if(!r&&colors.length===1)return {color:colors[0],ok:true};
  const remembered=memory[memKey(item.code,'color',r)];if(remembered&&colors.includes(remembered))return {color:remembered,ok:true};
  const up=r.toUpperCase();const direct=colors.find(c=>c.toUpperCase()===up||new RegExp(`(^|[^A-Z])${c.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g,ch=>'\\'+ch)}([^A-Z]|$)`).test(up));if(direct)return {color:direct,ok:true};
  const words=new Set([...(up.match(/[A-Z]+/g)||[])]);for(const [ko,en] of Object.entries(KO))if(r.includes(ko))words.add(en);
  for(const w of words)for(const code of CODES[w]||[]){const hit=colors.find(c=>c.toUpperCase()===code);if(hit)return {color:hit,ok:true};}
  if(colors.length===1)return {color:colors[0],ok:true};
  return {color:'',ok:false,raw:r};
 }
 function matchSize(raw,item,memory={}){
  const specs=(item?.variants||[]).map(v=>text(v.spec)).filter(Boolean);
  const r=text(raw);if(!specs.length)return {spec:r,ok:true};
  const remembered=memory[memKey(item.code,'size',r)];if(remembered&&specs.includes(remembered))return {spec:remembered,ok:true};
  const norm=s=>s.toUpperCase().replace(/\s+/g,'').replace(/^XXXXL$/,'4XL').replace(/^XXXL$/,'3XL').replace(/^XXL$/,'2XL').replace(/^FREE$|^ONESIZE$/,'F');
  const hit=specs.find(s=>norm(s)===norm(r));if(hit)return {spec:hit,ok:true};
  if(specs.length===1)return {spec:specs[0],ok:true};
  return {spec:'',ok:false,raw:r};
 }
 // 엑셀 줄 → 주문 목록(같은 주문번호는 한 건으로). 개인정보 열은 아예 꺼내지 않는다.
 function orders(rows,{items=[],quotes=[],memory={}}={}){
  const found=detect(rows);if(!found)return null;
  const {kind,header}=found,h=rows[header].map(text),col=n=>h.indexOf(n),get=(r,n)=>col(n)<0?'':r[col(n)];
  const done=new Set(quotes.map(q=>q.order_ref).filter(Boolean));
  const map=new Map(),ship=new Map();
  for(const r of rows.slice(header+1)){
   if(!r.some(v=>text(v)))continue;
   const no=text(get(r,'주문번호'));if(!no)continue;
   const naver=kind==='naver';
   const optRaw=naver?get(r,'옵션정보'):(text(get(r,'등록옵션명'))||text(get(r,'노출상품명(옵션명)')));
   const product=naver?text(get(r,'상품명')):text(get(r,'등록상품명'));
   const item=findItem(optRaw+' '+product+' '+text(get(r,naver?'판매자 상품코드':'업체상품코드')),items);
   const o=option(kind,optRaw,item?.code);
   const qty=num(get(r,naver?'수량':'구매수(수량)'));if(!(qty>0))continue;
   const gross=naver?num(get(r,'최종 상품별 총 주문금액')):num(get(r,'결제액'))||num(get(r,'옵션판매가(판매단가)'))*qty;
   const c=matchColor(o.color,item,memory),z=matchSize(o.size,item,memory);
   if(!map.has(no))map.set(no,{kind,label:KINDS[kind].label,no,ref:kind+':'+no,date:day(get(r,naver?'결제일':'주문일'))||day(get(r,'주문일시')),lines:[],ship:0,exists:done.has(kind+':'+no)});
   map.get(no).lines.push({item,product,option:text(optRaw),rawColor:o.color,rawSize:o.size,color:c.color,spec:z.spec,colorOk:c.ok,sizeOk:z.ok,qty,gross});
   // 배송비는 묶음마다 한 번(네이버는 같은 묶음의 줄마다 같은 합계가 반복된다)
   const bundle=text(get(r,naver?'배송비 묶음번호':'묶음배송번호'))||no,fee=num(get(r,naver?'배송비 합계':'배송비'));
   if(fee>0&&!ship.has(bundle)){ship.set(bundle,true);map.get(no).ship+=fee;}
  }
  return {kind,label:KINDS[kind].label,orders:[...map.values()].map(o=>({...o,total:o.lines.reduce((s,l)=>s+l.gross,0)+o.ship,ready:o.lines.every(l=>l.item&&l.colorOk&&l.sizeOk)}))};
 }
 // 주문 → 수주 견적서. 쇼핑몰 금액은 부가세 포함이라 단가는 ÷1.1(견적서는 공급가 + 부가세 10%).
 function quote(order,{companyId,no,uuid,now,shipItem}){
  const supply=g=>Math.round(g/1.1);
  const lines=order.lines.map(l=>({id:uuid(),item_id:l.item.id,name:l.item.name||l.product,color:l.color||'',spec:l.spec||'',unit:l.item.unit||'EA',qty:l.qty,price:supply(l.gross/l.qty)}));
  if(order.ship>0)lines.push({id:uuid(),item_id:shipItem?.id||'',name:shipItem?.name||'배송비',color:'',spec:'',unit:shipItem?.unit||'',qty:1,price:supply(order.ship)});
  return {id:uuid(),no,date:order.date,company_id:companyId,status:'수주',valid:'',lines,deliveries:[],memo:`${order.label} 주문 ${order.no}`,sent_at:'',delivered_at:'',tax_at:'',created_at:now,order_ref:order.ref};
 }
 // 견적서로 만들었을 때 합계(공급가 반올림 때문에 결제액과 몇 원 다를 수 있다)
 function quoteTotal(order){const sup=order.lines.reduce((s,l)=>s+l.qty*Math.round(l.gross/l.qty/1.1),0)+(order.ship>0?Math.round(order.ship/1.1):0);return sup+Math.round(sup*.1);}
 return {detect,day,option,findItem,matchColor,matchSize,orders,quote,quoteTotal,memKey,KINDS};
})();

/* 화면: 견적서 머리 [가져오기] 버튼(+ 견적서 목록에 끌어다 놓기) → 미리보기 창 → 수주 견적서로 차례로 저장 */
(()=>{
 'use strict';
 const M=NaroOrderImport,MEM='naroOrderMap';
 const mem=()=>{try{return JSON.parse(localStorage.getItem(MEM)||'{}')||{};}catch{return {};}};
 const remember=o=>{try{localStorage.setItem(MEM,JSON.stringify({...mem(),...o}));}catch{}};
 const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const won=v=>Math.round(v).toLocaleString('ko-KR');
 const say=t=>typeof toast==='function'?toast(t):alert(t);
 const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
 let input=null,sheet=null,state=null;
 async function rowsOf(file){
  if(!/\.xlsx$/i.test(file.name))throw Error('스마트스토어·쿠팡에서 내려받은 .xlsx 파일을 올려 주세요.');
  if(file.size>7*1048576)throw Error('파일은 7MB 이하여야 해요.');
  if(!window.JSZip)throw Error('엑셀 읽기 도구를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
  const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
  const xml=async n=>{const f=zip.file(n);return f?new DOMParser().parseFromString(await f.async('string'),'application/xml'):null;};
  const shared=[...((await xml('xl/sharedStrings.xml'))?.getElementsByTagName('si')||[])].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join(''));
  const name=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];if(!name)throw Error('엑셀에 시트가 없어요.');
  const doc=await xml(name),rows=[];
  for(const row of doc.getElementsByTagName('row')){
   const vals=[];if(rows.length>5000)throw Error('한 번에 5,000줄까지 가져올 수 있어요.');
   for(const c of row.getElementsByTagName('c')){
    const ref=/^([A-Z]{1,3})\d+$/.exec(c.getAttribute('r')||'');if(!ref)continue;
    const col=[...ref[1]].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;if(col>200)continue;
    const t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent??'';
    vals[col]=t==='s'?(shared[Number(v)]??''):t==='inlineStr'?[...c.getElementsByTagName('t')].map(x=>x.textContent).join(''):v;
   }
   rows.push(Array.from({length:vals.length},(_,i)=>vals[i]??''));
  }
  return rows;
 }
 async function open(file){
  try{
   const rows=await rowsOf(file);
   const r=M.orders(rows,{items:db.items||[],quotes:db.quotes||[],memory:mem()});
   if(!r)throw Error('스마트스토어 또는 쿠팡 주문 엑셀이 아니에요. 판매자센터에서 내려받은 원본 파일을 올려 주세요.');
   if(!r.orders.length)throw Error('파일에 가져올 주문이 없어요.');
   r.orders.forEach(o=>o.pick=!o.exists);
   state=r;paint();
  }catch(err){say(err.message||'파일을 읽지 못했어요.');}
 }
 function issue(l){return !l.item?'NARO 품목을 찾지 못했어요':!l.colorOk?`색상 '${l.rawColor||'없음'}'을 고르세요`:!l.sizeOk?`사이즈 '${l.rawSize||'없음'}'을 고르세요`:'';}
 function paint(){
  if(!sheet){sheet=document.createElement('dialog');sheet.className='nd-pay-sheet nd-oi-sheet';sheet.setAttribute('aria-labelledby','ndOiTtl');
   sheet.addEventListener('click',ev=>{if(ev.target===sheet)sheet.close();});(document.getElementById('appView')||document.body).append(sheet);}
  const s=state,picked=s.orders.filter(o=>o.pick),blocked=picked.some(o=>!o.lines.every(l=>l.item&&l.colorOk&&l.sizeOk));
  sheet.innerHTML=`<div class="nd-ps-hd"><b id="ndOiTtl">${e(s.label)} 주문 가져오기</b><span class="nd-oi-cnt">${s.orders.length}건</span></div>
   <p class="nd-oi-note">수주 견적서로 만들어요. 구매자 이름·연락처·주소는 가져오지 않아요. 금액은 부가세 포함 결제액 기준이에요.</p>
   <div class="nd-oi-list">${s.orders.map((o,i)=>`<section class="nd-oi-ord${o.exists?' done':''}">
    <label class="nd-oi-hd"><input type="checkbox" data-o="${i}" ${o.pick?'checked':''} ${o.exists?'disabled':''}><span class="nd-oi-t"><b>${e(o.date||'날짜 없음')}</b><small>주문 ${e(o.no)}${o.exists?' · 이미 가져왔어요':''}${!o.exists&&M.quoteTotal(o)!==o.total?` · 견적서 ${won(M.quoteTotal(o))}원(반올림 ${won(Math.abs(M.quoteTotal(o)-o.total))}원 차이)`:''}</small></span><strong>${won(o.total)}원</strong></label>
    ${o.lines.map((l,j)=>{const bad=issue(l);return `<div class="nd-oi-ln${bad?' bad':''}">
     <div class="nd-oi-nm"><span>${l.item?e(l.item.name):e(l.product)}${l.item?.code?` <small class="nd-oi-cd">${e(l.item.code)}</small>`:''}</span><span class="nd-oi-q">${[l.color,l.spec].filter(Boolean).map(e).join(' · ')}${l.color||l.spec?' · ':''}${l.qty}개</span></div>
     <span class="nd-oi-amt">${won(l.gross)}원</span>
     ${bad?`<div class="nd-oi-fix"><span>${e(bad)}</span>${!l.item?`<button type="button" class="nd-oi-pick" data-o="${i}" data-l="${j}">품목 고르기</button>`:!l.colorOk?`<select data-o="${i}" data-l="${j}" data-k="color"><option value="">색상</option>${(l.item.colors||[]).map(c=>`<option>${e(c)}</option>`).join('')}</select>`:`<select data-o="${i}" data-l="${j}" data-k="spec"><option value="">사이즈</option>${(l.item.variants||[]).map(v=>`<option>${e(v.spec)}</option>`).join('')}</select>`}</div>`:''}
    </div>`;}).join('')}
    ${o.ship?`<div class="nd-oi-ln"><div class="nd-oi-nm"><span>배송비</span></div><span class="nd-oi-amt">${won(o.ship)}원</span></div>`:''}
   </section>`).join('')}</div>
   <div class="nd-ps-act"><button type="button" class="nd-ps-close" data-oi="close">닫기</button><button type="button" class="nd-oi-go" data-oi="go" ${!picked.length||blocked?'disabled':''}>${picked.length?`${picked.length}건 수주로 가져오기`:'가져올 주문 없음'}</button></div>`;
  sheet.querySelector('[data-oi="close"]').onclick=()=>sheet.close();
  sheet.querySelector('[data-oi="go"]').onclick=run;
  sheet.querySelectorAll('input[data-o]').forEach(c=>c.onchange=()=>{s.orders[+c.dataset.o].pick=c.checked;paint();});
  sheet.querySelectorAll('select[data-o]').forEach(sel=>sel.onchange=()=>{const l=s.orders[+sel.dataset.o].lines[+sel.dataset.l];if(!sel.value)return;
   if(sel.dataset.k==='color'){l.color=sel.value;l.colorOk=true;l.learnColor=true;}else{l.spec=sel.value;l.sizeOk=true;l.learnSize=true;}paint();});
  sheet.querySelectorAll('.nd-oi-pick').forEach(b=>b.onclick=()=>{if(typeof openItemPicker!=='function')return;openItemPicker(b,id=>{const it=(db.items||[]).find(x=>x.id===id);if(!it)return;
   const l=s.orders[+b.dataset.o].lines[+b.dataset.l];l.item=it;const c=M.matchColor(l.rawColor,it,mem()),z=M.matchSize(l.rawSize,it,mem());Object.assign(l,{color:c.color,colorOk:c.ok,spec:z.spec,sizeOk:z.ok});paint();});});
  if(!sheet.open){sheet.tabIndex=-1;sheet.showModal();sheet.focus({preventScroll:true});}
 }
 async function company(label){
  let c=(db.companies||[]).find(x=>x.name===label);if(c)return c;
  c={id:crypto.randomUUID(),name:label,type:'매출',contact:'',phone:'',email:'',memo:'쇼핑몰 주문 가져오기로 만든 거래처',prices:[]};
  const next=[...db.companies,c];if(!await saveTable('companies',next))return null;db.companies=next;return c;
 }
 async function run(){
  const s=state,go=sheet.querySelector('[data-oi="go"]'),list=s.orders.filter(o=>o.pick&&!o.exists);if(!list.length)return;
  go.disabled=true;const learned={};
  for(const o of list)for(const l of o.lines){if(l.learnColor)learned[M.memKey(l.item.code,'color',l.rawColor)]=l.color;if(l.learnSize)learned[M.memKey(l.item.code,'size',l.rawSize)]=l.spec;}
  remember(learned);
  const co=await company(M.KINDS[s.kind].company);if(!co){go.disabled=false;return;}
  const shipItem=(db.items||[]).find(i=>i.type==='작업'&&/배송비/.test(i.name||''));
  let n=0;
  for(const o of list){
   if((db.quotes||[]).some(q=>q.order_ref===o.ref)){o.exists=true;continue;}
   go.textContent=`가져오는 중… ${n+1}/${list.length}`;
   const q=M.quote(o,{companyId:co.id,no:nextQuoteNo(o.date),uuid:()=>crypto.randomUUID(),now:new Date().toISOString(),shipItem});
   const next=[...db.quotes,q];if(!await saveTable('quotes',next))break;db.quotes=next;o.exists=true;o.pick=false;n++;
  }
  if(typeof renderQtList==='function')renderQtList();
  say(n?`${n}건을 수주 견적서로 가져왔어요.`:'가져오지 못했어요. 잠시 후 다시 시도해 주세요.');
  if(n===list.length)sheet.close();else paint();
 }
 function pickFile(){if(!input){input=document.createElement('input');input.type='file';input.accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';input.hidden=true;input.onchange=()=>{const f=input.files?.[0];input.value='';if(f)open(f);};document.body.append(input);}input.click();}
 // 견적서 머리 도구 줄에 [가져오기]. 앱이 머리를 다시 그려도 디자인 패스가 다시 부른다.
 function ensure(){
  const head=document.querySelector('#view-quotes .list-head');if(!head||head.querySelector('.nd-oi-btn'))return;
  const b=document.createElement('button');b.type='button';b.className='nd-tool nd-oi-btn';b.title='쇼핑몰 주문 가져오기';b.setAttribute('aria-label','쇼핑몰 주문 가져오기 (스마트스토어·쿠팡 엑셀)');b.innerHTML=ICON;b.onclick=pickFile;
  head.insertBefore(b,head.querySelector('.btn-add'));
 }
 const view=document.getElementById('view-quotes');
 view?.addEventListener('dragover',ev=>{if([...(ev.dataTransfer?.items||[])].some(i=>i.kind==='file')){ev.preventDefault();view.classList.add('nd-oi-drop');}});
 view?.addEventListener('dragleave',ev=>{if(!view.contains(ev.relatedTarget))view.classList.remove('nd-oi-drop');});
 view?.addEventListener('drop',ev=>{const f=ev.dataTransfer?.files?.[0];view.classList.remove('nd-oi-drop');if(f&&/\.xlsx$/i.test(f.name)){ev.preventDefault();open(f);}});
 window.NaroOrderImportUI={ensure,open};
 ensure();
})();
