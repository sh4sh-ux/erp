import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const js=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const css=await readFile(new URL('./naro-design.css',import.meta.url),'utf8');
const fn=js.slice(js.indexOf(' function filterDates(){'),js.indexOf(' function periodPresets(){'));
test('sales and quote date fields retain native inputs and explicit labels',()=>{
 for(const id of ['slFrom','slTo','qtFrom','qtTo'])assert.ok(fn.includes(id));
 assert.match(fn,/field.htmlFor=id/);
 assert.match(fn,/field.append\(wrap\)/);
 assert.doesNotMatch(fn,/innerHTML|cloneNode|input.type\s*=|input.value\s*=|saveTable|fetch/);
});
test('date display is isolated from core date enhancement and updates for input/change',()=>{
 assert.match(fn,/replaceAll\('-','\.'\)/);
 assert.match(fn,/'날짜 선택'/);
 assert.match(fn,/if\(value.textContent!==text\)value.textContent=text/);
 for(const event of ['input','change'])assert.ok(fn.includes(`addEventListener('${event}'`));
 assert.match(js,/filterDates\(\);\s*}\s*\/\* 월별 매출/);
});
test('one border, identical 44px height, full native picker target and keyboard focus',()=>{
 assert.match(css,/\.nd-filter-date\{[^}]*height:44px!important;min-height:44px!important/);
 assert.match(css,/\.nd-filter-date>\.nd-filter-date-value\{[^}]*border:0!important/);
 assert.match(css,/\.nd-filter-date>:is\(\.date-control-display,\.date-control-icon\)\{display:none!important/);
 assert.match(css,/\.nd-filter-date>input\[type=date\]\{[^}]*width:100%!important[^}]*font-size:16px!important/);
 assert.match(css,/\.nd-filter-date:has\(>input:focus-visible\)/);
});
