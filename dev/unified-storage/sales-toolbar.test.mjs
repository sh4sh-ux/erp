import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const start=source.indexOf("  sales:{search:"),end=source.indexOf("  ar:{",start);
const sales=source.slice(start,end);
test('sales toolbar uses the shared compact filter, not a wide calendar or add button',()=>{
 assert.ok(start>=0&&end>start);
 assert.match(sales,/ph:'거래처 검색'/);
 assert.match(sales,/filter:'#view-sales \.workspace-left>\.filter-bar,#view-sales>\.filter-bar'/);
 assert.doesNotMatch(sales,/\bperiod:|\badd:/);
 assert.match(source,/if\(c.filter&&!c.period\)\{const b=toolBtn\(ICON_FILTER,'필터'\)/);
});
test('original date inputs and search remain connected; popup restores original nodes',()=>{
 assert.match(source,/o.value=input.value;o.dispatchEvent\(new Event\('input'/);
 assert.match(source,/if\(pop\?\.btn===b\)\{closePop\(\);return;\}const block=document.querySelector\(c.filter\)/);
 assert.match(source,/el.append\(block\);\},\(\)=>mark.replaceWith\(block\),'필터'/);
 assert.match(source,/setv\('slFrom',f\);setv\('slTo',t\);fire\('slFrom'\)/);
});
test('sales reset clears company/status and uses the existing all-period action without clearing search',()=>{
 const handler=source.match(/reset.onclick=\(\)=>\{setv\('slCo'[\s\S]*?\};/)?.[0];
 assert.ok(handler);assert.match(handler,/setv\('slCo',''\);setv\('slStatus','all'\);sc.apply\('all'\);fire\('slStatus'\);periodPresets\(\)/);
 assert.doesNotMatch(handler,/search|saveTable|localStorage|fetch/);
 assert.match(source,/!host.querySelector\('\.nd-sales-reset'\)/);
});
test('period highlighting and reset still work while original sales fields live outside their view',()=>{
 assert.match(source,/anchor:'slFrom'/);
 assert.match(source,/document.getElementById\(sc.anchor\)\?\.closest\('\.filter-bar'\)/);
});
