// 10/26 택배사 순서: 직접 정한 순서 → 없으면 많이 쓴 순, 맨 앞이 새 송장의 기본값. 공급자 정보 [저장]으로 settings.carrier_order.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const src=await readFile(new URL('./quote-actions.js',import.meta.url),'utf8');
const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
// 순서 계산만 따로 떼어 실행(시험 데이터)
const pick=name=>{const i=src.indexOf(' function '+name+'(');assert.ok(i>0,name);let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&!--d)break;}return src.slice(i,j+1);};
const carriers=src.slice(src.indexOf(' const CARRIERS='),src.indexOf(';',src.indexOf(' const CARRIERS='))+1);
const safe=src.slice(src.indexOf(' const safeUrl='),src.indexOf('\n',src.indexOf(' const safeUrl=')));const naver=src.slice(src.indexOf(' const naverLookup='),src.indexOf('\n',src.indexOf(' const naverLookup=')));
function run(db,expr){const ctx={db};vm.createContext(ctx);vm.runInContext(carriers.replace('const CARRIERS','var CARRIERS')+safe.replace('const safeUrl','var safeUrl')+';'+naver.replace('const naverLookup','var naverLookup')+';'+pick('customCarriers')+pick('carriers')+pick('parcelsOf')+pick('carrierUsage')+pick('carrierOrder')+pick('trackingUrl')+';this.r='+expr,ctx);return JSON.parse(JSON.stringify(ctx.r));}
function order(db,manual){return run(db,'carrierOrder('+JSON.stringify(manual)+')');}
function _unused(ctx){return JSON.parse(JSON.stringify(ctx.r));}
const del=(c,n)=>({deliveries:Array.from({length:n},(_,i)=>({id:c+i,shipping:{method:'택배',carrier:c,tracking:'1234567'+i}}))});
test('자동: 많이 쓴 택배사가 앞(같으면 기본 순서), 취소한 납품은 세지 않는다',()=>{
 const db={settings:{schema:3},quotes:[del('lotte',3),del('hanjin',1),{deliveries:[{void_at:'x',shipping:{method:'택배',carrier:'kd',tracking:'12345678'}}]}]};
 assert.deepEqual(order(db).slice(0,3),['lotte','hanjin','cj']);
 assert.deepEqual(order({settings:{schema:3},quotes:[]})[0],'cj','기록이 없으면 예전 순서 그대로');
});
test('직접 정한 순서가 우선, 모르는 이름은 빼고 빠진 택배사는 뒤에 붙인다',()=>{
 const db={settings:{schema:3,carrier_order:['kd','nope','post']},quotes:[del('lotte',5)]};
 const o=order(db);assert.deepEqual(o.slice(0,2),['kd','post']);assert.equal(o.length,13);assert.ok(o.includes('lotte'));
});
test('송장 목록·기본값·공급자 정보 저장이 같은 순서를 쓴다',()=>{
 assert.match(src,/o=carrierOrder\(\);if\(p\.carrier&&!all\[p\.carrier\]\)o\.push\(p\.carrier\);const opt=k=>`<option value="\$\{e\(k\)\}"/);
 // 주로 쓰는 5곳만 먼저, 나머지는 '그 외 택배사' 묶음(10/26)
 assert.match(src,/const TOP_CARRIERS=5;/);assert.match(src,/o\.slice\(0,TOP_CARRIERS\)\.map\(opt\)[^\n]*<optgroup label="그 외 택배사">/);
 assert.match(src,/carrier:v\.carrier\|\|defCarrier\(\)/);
 assert.match(build,/naroCarrierFromSettings\?window\.naroCarrierFromSettings\(\):\{\}/);
 assert.match(build,/naroCarrierToSettings\)window\.naroCarrierToSettings\(\)/);
 assert.match(build,/<div id="st_carriers" class="nd-cr"><\/div>/);
});

test('많이 쓰는 택배사(대신·일양·합동·건영·천일·CU·GS25)와 직접 추가한 택배사 · 조회 주소',()=>{
 const db={settings:{schema:3,carriers_custom:[{id:'u_ab12',name:'한덕택배',url:'https://example.test/track?no='},{id:'u_cd34',name:'동네택배'},{id:'u_bad',name:'나쁜주소',url:'javascript:alert(1)'},{id:'bad id',name:'x'}]},quotes:[]};
 const o=order(db);for(const k of ['daesin','ilyang','hapdong','kunyoung','chunil','cu','gs','u_ab12','u_cd34','u_bad'])assert.ok(o.includes(k),k);assert.ok(!o.includes('bad id'));
 const url=(c,no='123456789012')=>run(db,'trackingUrl('+JSON.stringify({method:'택배',carrier:c,tracking:no})+')');
 assert.equal(url('u_ab12'),'https://example.test/track?no=123456789012');
 assert.equal(url('daesin'),'https://search.naver.com/search.naver?query='+encodeURIComponent('대신택배 123456789012'),'공식 주소가 없으면 네이버 검색');
 assert.equal(url('u_bad'),'https://search.naver.com/search.naver?query='+encodeURIComponent('나쁜주소 123456789012'),'https가 아닌 주소는 쓰지 않는다');
 assert.equal(url('kd'),'https://kdexp.com/service/delivery/etc/delivery.do?barcode=123456789012','경동 새 조회 주소');
 assert.equal(url('cj','abc'),'');
});

test('계산서 미발행: 삭제(취소)한 견적 · 삭제(숨김)한 거래처는 빼고, 받을 금액 화면도 같은 규칙(10/26)',()=>{
 assert.match(build,/function needsTax\(q\)\{ const hid=db\.settings&&db\.settings\.hidden[^\n]*q\.status!=="취소" && !hid\.includes\(q\.company_id\)/);
 assert.match(build,/if\(needsTax\(q\)\)\{ r\.untaxed\+=deliveredAmount\(q\); r\.untaxedCount\+\+; \}/);
});
