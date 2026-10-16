import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const js=await readFile(new URL('./sales-analysis.js',import.meta.url),'utf8');
const css=await readFile(new URL('./sales-analysis.css',import.meta.url),'utf8');
test('sales follows the payments/receivables layout: count beside title, period-only third line, toolbar in the table head',()=>{
 assert.match(js,/className='count nd-sa-tcount'/);assert.match(css,/#view-sales \.nd-sa-count\{display:none!important\}/);
 assert.match(js,/headEl\.append\(header\.querySelector\('\.nd-sa-toolbar'\)\)/);
 assert.match(js,/견적일 기준<\/span><span>\$\{value\('slStatus'\)==='all'\?'모든 상태':'수주·부분납품·납품'\}/);
});
test('KPIs: 예상 마진 first with its rate below, no span around numbers; selection drops the duplicate count',()=>{
 assert.match(js,/<span>예상 마진<\/span>\$\{mgCell\}/);assert.match(js,/마진율 \$\{/);assert.match(js,/원가 미등록<\/em>/);
 assert.doesNotMatch(js,/<strong><span class="nd-sa-kpi/);
 assert.match(js,/\$\{p\.selected\?'':`<div><span>\$\{labels\[p\.detailMode\]\}/);
});
test('table uses line rules without a header fill; bottom bar offers export and the matching record screen',()=>{
 assert.match(css,/\.nd-sa-table th\{background:none;border-bottom:1\.5px solid #D4D4D8/);
 assert.match(js,/data-sa-act=\\"export\\">내보내기|data-sa-act="export">내보내기/);assert.match(js,/'거래처 보기'/);assert.match(js,/'품목 보기'/);assert.doesNotMatch(js,/보기 ›/);
 assert.match(css,/\.nd-sales-analysis \.nd-sa-abar\{position:sticky;bottom:0/);
});
