import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('./naro-design.css',import.meta.url),'utf8');
test('all search variants share a font size; mobile retains 16px native input text',()=>{
 assert.match(css,/--nd-search-font-size:14px/);
 assert.match(css,/@media screen and \(max-width:1023px\)\{#appView\{--nd-search-font-size:16px/);
 const rule=css.split('\n').find(x=>x.includes('font:400 var(--nd-search-font-size)'));
 for(const selector of ['#qtSearch','#coSearch','#itSearch','input[type="search"]','.search input','.nd-tsearch input','.ip-pop>input'])assert.ok(rule.includes(selector));
 assert.match(rule,/\/20px var\(--sans\)!important/);
 assert.doesNotMatch(rule,/input\[type="number"\]|textarea|input\[type="date"\]/);
});
test('placeholders inherit the same typography as typed search text',()=>{
 assert.match(css,/::placeholder\{font:inherit!important;letter-spacing:inherit!important;color:var\(--nd-ink-3\)!important;opacity:1!important/);
});
