import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// 화면 글자 규칙(UI-RULES 'Wording'): 고치기 → 수정, 글자 버튼·링크에 ＋ · › 기호를 붙이지 않는다. 주석은 검사하지 않는다.
const files=['payment-panel.js','quote-actions.js','material-panel.js','purchase-ui.mjs','naro-design.js','ar-panel.js','company-panel.js','sales-analysis.js','info-groups.js'];
const code=async f=>(await readFile(new URL('./'+f,import.meta.url),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
test('no 고치기 wording on screen; edits say 수정',async()=>{
 for(const f of files){const s=await code(f);assert.doesNotMatch(s,/['"`>]고치기|고치는 중|고친 내용|고치거나|고칠 수 없|고쳐서/,f);}
 assert.match(await code('payment-panel.js'),/data-pp="edit">수정</);
});
test('text buttons and links carry no ＋ or trailing › glyphs; the icon-only item add button keeps its drawn plus',async()=>{
 for(const f of files){const s=await code(f);assert.doesNotMatch(s,/[>'"`]＋ /,f);assert.doesNotMatch(s,/ ›['"`<]/,f);}
 const css=await readFile(new URL('./ui-contract.css',import.meta.url),'utf8');
 assert.match(css,/\.nd-gi-plus:not\(#itNewBtn\)::before\{display:none!important/);
 assert.match(await readFile(new URL('./build.mjs',import.meta.url),'utf8'),/qp=qp\.replaceAll\("'편집 ›'","'편집'"\)/);
});
test('supplier address splits into base and detail for display and joins once on save',async()=>{
 const s=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
 const src=s.match(/function splitAddress\(v\)\{[\s\S]*?return m\?\[m\[1\]\.trim\(\),m\[2\]\.trim\(\)\]:\[t,''\];\}/)[0];
 const splitAddress=new Function(src+';return splitAddress;')();
 assert.deepEqual(splitAddress('경기 하남시 미사강변서로 25 미사 테스타타워 지식산업센터 SB104호'),['경기 하남시 미사강변서로 25','미사 테스타타워 지식산업센터 SB104호']);
 assert.deepEqual(splitAddress('경기 성남시 분당구 판교역로235번길 7 2층'),['경기 성남시 분당구 판교역로235번길 7','2층']);
 assert.deepEqual(splitAddress('서울 강남구 테헤란로 152, 12층'),['서울 강남구 테헤란로 152','12층']);
 assert.deepEqual(splitAddress('서울 종로구 청운동 12-3 101호'),['서울 종로구 청운동 12-3','101호']);
 assert.deepEqual(splitAddress('부산 해운대구 센텀중앙로 97'),['부산 해운대구 센텀중앙로 97','']);
 assert.match(s,/input\.value=v\.endsWith\(d\)\?v:\(v\+' '\+d\)\.trim\(\)/); // 이미 합쳐져 있으면 두 번 붙이지 않는다
});
