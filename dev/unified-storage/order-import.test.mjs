import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const src=await readFile(new URL('./order-import.js',import.meta.url),'utf8');
const ctx={document:{getElementById:()=>null,querySelector:()=>null},window:{},localStorage:{getItem:()=>null}};vm.createContext(ctx);
vm.runInContext(src+';this.M=NaroOrderImport;',ctx);const M=ctx.M;
const plain=x=>JSON.parse(JSON.stringify(x)); // vm 안에서 만든 배열은 프로토타입이 달라 deepEqual 전에 평범한 값으로
const items=[{id:'a',code:'JK_3SB-LS',name:'셰프복',unit:'EA',colors:['WH','BK'],variants:['M','XL','2XL','3XL'].map(spec=>({spec}))},{id:'b',code:'JK_3SB',name:'다른 품목',colors:[],variants:[]},{id:'w',type:'작업',name:'배송비',code:'Delivery Charge'}];
// 실제 내보내기와 같은 열 이름(가짜 값). 개인정보 열은 들어 있어도 읽지 않는다.
const NH=['상품주문번호','주문번호','결제일','구매자명','수취인연락처1','통합배송지','상품명','옵션정보','수량','최종 상품별 총 주문금액','배송비 묶음번호','배송비 합계'];
const naver=[NH,['1','N1','46302.65','홍길동','010-0000-0000','서울시 어딘가','셰프복','모델명: JK_3SB-LS(7부) / 컬러: 화이트(WHITE) / 사이즈: 3XL','1','22000','B','3000'],['2','N1','46302.65','홍길동','010-0000-0000','서울시 어딘가','셰프복','모델명: JK_3SB-LS(7부) / 컬러: 화이트(WHITE) / 사이즈: XXL','4','88000','B','3000']];
const CH=['묶음배송번호','주문번호','주문일','구매자','수취인 주소','등록상품명','등록옵션명','노출상품명(옵션명)','결제액','배송비','구매수(수량)','옵션판매가(판매단가)'];
const coupang=[CH,['7','C1','2026-10-07 07:46:37','김아무개','부산','Chef Jacket','JK_3SB-LS 블랙(BLACK) M','','29700','3000','1','29700']];
test('스마트스토어·쿠팡 파일을 알아보고, 같은 주문번호는 한 건으로 묶는다',()=>{
 const n=M.orders(naver,{items});assert.equal(n.kind,'naver');assert.equal(n.orders.length,1);
 const o=n.orders[0];assert.equal(o.date,'2026-10-07');assert.equal(o.ship,3000);assert.equal(o.total,113000);assert.equal(o.ready,true);
 assert.deepEqual(plain(o.lines.map(l=>[l.item.code,l.color,l.spec,l.qty])),[['JK_3SB-LS','WH','3XL',1],['JK_3SB-LS','WH','2XL',4]]);
 const c=M.orders(coupang,{items});assert.equal(c.kind,'coupang');assert.deepEqual(plain(c.orders[0].lines.map(l=>[l.item.code,l.color,l.spec])),[['JK_3SB-LS','BK','M']]);
 assert.equal(M.orders([['아무','열']],{items}),null);
});
test('긴 품번 우선 — JK_3SB가 JK_3SB-LS 안에서 잘못 잡히지 않는다',()=>{assert.equal(M.findItem('모델명: JK_3SB-LS / 컬러',items).id,'a');assert.equal(M.findItem('JK_3SB 화이트',items).id,'b');});
test('견적서: 수주 · 부가세 뺀 단가 · 배송비 줄 · 주문번호 기록, 개인정보는 없다',()=>{
 const o=M.orders(naver,{items}).orders[0];let i=0;
 const q=M.quote(o,{companyId:'co',no:'Q-1',uuid:()=>'id'+(i++),now:'t',shipItem:items[2]});
 assert.equal(q.status,'수주');assert.equal(q.order_ref,'naver:N1');assert.equal(q.no_tax,true);assert.deepEqual(plain(q.deliveries),[]);
 assert.deepEqual(plain(q.lines.map(l=>[l.qty,l.price,l.vat_inc])),[[1,22000,true],[4,22000,true],[1,3000,true]]);assert.equal(q.lines[2].item_id,'w');
 assert.equal(new Set(q.lines.map(l=>l.id)).size,q.lines.length);
 const json=JSON.stringify(q);for(const p of ['홍길동','010-0000-0000','서울시'])assert.ok(!json.includes(p));
 assert.equal(M.quoteTotal(o),113000);
 const odd={lines:[{qty:2,gross:19600},{qty:1,gross:9800}],ship:3000,total:32400};assert.equal(M.quoteTotal(odd),32400); // 부가세 포함 단가라 반올림 차이 없음
});
test('이미 가져온 주문은 표시되고, 고른 색은 기억된다',()=>{
 const n=M.orders(naver,{items,quotes:[{order_ref:'naver:N1'}]});assert.equal(n.orders[0].exists,true);
 const r=M.matchColor('퍼플',items[0],{[M.memKey('JK_3SB-LS','color','퍼플')]:'BK'});assert.deepEqual(plain({...r}),{color:'BK',ok:true});
 assert.equal(M.matchColor('퍼플',items[0],{}).ok,false);assert.equal(M.matchSize('XXL',items[0]).spec,'2XL');
});
test('index.html에 String.replace로 끼워 넣는 파일에는 치환 특수 문자열이 없다',async()=>{
 for(const f of ['order-import.js','quote-actions.js','quote-actions.css','naro-design.js','sales-analysis.js','order-import.css','naro-design.css','sales-analysis.css'])
  assert.doesNotMatch(await readFile(new URL('./'+f,import.meta.url),'utf8'),/\$[&'`]/,f);
});
