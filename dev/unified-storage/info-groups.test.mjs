import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const r=f=>readFile(new URL('./'+f,import.meta.url),'utf8');
const [js,css,co,pu,log,qa,build]=await Promise.all(['info-groups.js','info-groups.css','company-panel.css','purchase-ui.mjs','log-ui.mjs','quote-actions.js','build.mjs'].map(r));
test('quote info tab: 기본 정보 (거래처 first) / 비고 / 관리, moving the original fields so ids and handlers stay',()=>{
 assert.match(js,/grp\('basic','기본 정보','견적서 표시'\),g2=grp\('memo','비고','견적서 하단 표시'\),g3=grp\('manage','관리','진행 탭에서 자동 변경'\)/);
 assert.match(js,/body\(g1\)\.append\(co,pair\(date,valid\)\)/);
 assert.match(js,/getElementById\('fq_co'\)/);assert.doesNotMatch(js,/innerHTML=[^;]*fq_/);
 // quote-actions keeps a single log link wherever the groups put it
 assert.match(qa,/info\?\.querySelector\('\.nd-log-link'\)/);
});
test('item: groups keep every field (set components, work notes and unknown leftovers are moved, never dropped)',()=>{
 assert.match(js,/grp\('opts','구성품','세트 구성 품목'\)/);assert.match(js,/body\(g3\)\.append\(n\)/);
 assert.match(js,/short=t=>t\.replace\(\/\\s\*\\\(기본\\\)\\s\*\$\/,''\)/);
 assert.match(js,/setCompSums\(it\)\.sell/);
});
test('purchase info tab renders the same groups and a change-log link; memo typing enables 저장 without a redraw',()=>{
 assert.match(pu,/grp\('basic','기본 정보','매입 장부 기록'/);assert.match(pu,/grp\('memo','비고','내부 메모\(출력 안 됨\)'/);
 assert.match(pu,/data-act="log">이 매입의 변경 기록 보기/);assert.match(pu,/noun:'매입'/);
 assert.match(pu,/#pu_memo'\)\?\.addEventListener\('input',e=>\{edit\(p=>\{p\.memo=e\.target\.value;\},false\)/);
});
test('change log titles name the record kind',()=>{
 assert.match(log,/이 \$\{esc\(noun\)\}의 변경 기록/);assert.match(log,/noun=opts\.noun\|\|'견적서'/);
 assert.match(js,/noun:'품목'/);
});
test('styles: company group anatomy is shared, fields are filled without borders, item form itself may carry nd-info',()=>{
 assert.match(co,/:is\(#coForm\.cp,#view-settings,\.nd-info\) \.cp-grp\{display:grid;grid-template-columns:180px/);
 assert.match(css,/\.nd-info :is\(input:not\(\[type=checkbox\]\)/);assert.match(css,/#itForm\.nd-info,#itForm \.nd-info/);
 assert.ok(build.indexOf('naro-info-groups')>build.indexOf('naro-ar-panel')&&build.indexOf('naro-info-groups')<build.indexOf('naro-ui-contract'));
});
