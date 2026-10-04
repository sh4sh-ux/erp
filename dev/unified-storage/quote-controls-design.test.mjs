import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('./naro-design.css',import.meta.url),'utf8');
const quote=css.slice(css.indexOf('/* Quote item actions are secondary controls:'));
test('mobile quote add actions share neutral text, size and centered alignment',()=>{
 assert.match(quote,/@media screen and \(max-width:780px\)/);
 assert.match(quote,/:is\(\.qp-add,#fq_sizeBtn\):not\(\[hidden\]\)/);
 assert.match(quote,/justify-content:center!important/);
 assert.match(quote,/color:var\(--nd-ink-2\)!important;font:600 14px\/20px var\(--sans\)!important/);
 assert.match(quote,/\.qp-add\.nd-gi-plus::before\{width:10px;height:10px/);
});
test('quote quantity glyphs shrink without reducing the 44px touch target',()=>{
 assert.match(quote,/\.qp-stepper>button\{min-width:44px;min-height:44px/);
 assert.match(quote,/::before\{width:12px!important;height:1\.5px!important/);
 assert.match(quote,/::after\{width:1\.5px!important;height:12px!important/);
 assert.doesNotMatch(quote,/\.material-stepper|data-step/);
});
