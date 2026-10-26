// 10/26 택배사 순서: 직접 정한 순서 → 없으면 많이 쓴 순, 맨 앞이 새 송장의 기본값. 공급자 정보 [저장]으로 settings.carrier_order.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const src=await readFile(new URL('./quote-actions.js',import.meta.url),'utf8');
const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
// 순서 계산만 따로 떼어 실행(시험 데이터)
const pick=name=>{const i=src.indexOf(' function '+name+'(');assert.ok(i>0,name);let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&!--d)break;}return src.slice(i,j+1);};
const carriers=src.slice(src.indexOf(' const CARRIERS='),src.indexOf(';',src.indexOf(' const CARRIERS='))+1);
function order(db,manual){const ctx={db};vm.createContext(ctx);vm.runInContext(carriers.replace('const CARRIERS','var CARRIERS')+pick('parcelsOf')+pick('carrierUsage')+pick('carrierOrder')+';this.r=carrierOrder('+JSON.stringify(manual)+')',ctx);return JSON.parse(JSON.stringify(ctx.r));}
const del=(c,n)=>({deliveries:Array.from({length:n},(_,i)=>({id:c+i,shipping:{method:'택배',carrier:c,tracking:'1234567'+i}}))});
test('자동: 많이 쓴 택배사가 앞(같으면 기본 순서), 취소한 납품은 세지 않는다',()=>{
 const db={settings:{schema:3},quotes:[del('lotte',3),del('hanjin',1),{deliveries:[{void_at:'x',shipping:{method:'택배',carrier:'kd',tracking:'12345678'}}]}]};
 assert.deepEqual(order(db).slice(0,3),['lotte','hanjin','cj']);
 assert.deepEqual(order({settings:{schema:3},quotes:[]})[0],'cj','기록이 없으면 예전 순서 그대로');
});
test('직접 정한 순서가 우선, 모르는 이름은 빼고 빠진 택배사는 뒤에 붙인다',()=>{
 const db={settings:{schema:3,carrier_order:['kd','nope','post']},quotes:[del('lotte',5)]};
 const o=order(db);assert.deepEqual(o.slice(0,2),['kd','post']);assert.equal(o.length,6);assert.ok(o.includes('lotte'));
});
test('송장 목록·기본값·공급자 정보 저장이 같은 순서를 쓴다',()=>{
 assert.match(src,/carrierOrder\(\)\.map\(k=>`<option value="\$\{k\}"/);
 assert.match(src,/carrier:v\.carrier\|\|defCarrier\(\)/);
 assert.match(build,/naroCarrierFromSettings\?window\.naroCarrierFromSettings\(\):\{\}/);
 assert.match(build,/naroCarrierToSettings\)window\.naroCarrierToSettings\(\)/);
 assert.match(build,/<div id="st_carriers" class="nd-cr"><\/div>/);
});
