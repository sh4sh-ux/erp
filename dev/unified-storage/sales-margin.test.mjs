import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const js=await readFile(new URL('./sales-analysis.js',import.meta.url),'utf8');
const css=await readFile(new URL('./sales-analysis.css',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(js.slice(0,js.indexOf('/* UI only.'))+';globalThis.m=NaroSalesAnalysis;',ctx);
const m=ctx.m;
const items=[{id:'a',buy_price:60,variants:[{spec:'L',buy_price:70}]},{id:'b',buy_price:80}];
const groups={c:{a:{item_id:'a',name:'A',qty:2,price:100,spec:'L'},b:{item_id:'b',name:'B',qty:1,price:200}}};
const rows=()=>m.rows(groups,items,[]);
test('margin uses supply before VAT and registered option cost',()=>{
 const s=m.summary(rows());assert.equal(s.total,440);assert.equal(s.supply,400);assert.equal(s.cost,220);assert.equal(s.margin,180);assert.equal(s.marginRate,45);
 assert.equal(m.marginLabel(s),'마진 180원 · 45.0%');
});
test('company/item/category and searched totals use weighted margin, not average rates',()=>{
 for(const mode of ['company','item','category']){
  const gs=m.group(rows(),mode),s=m.summary(gs);assert.equal(s.margin,180);assert.equal(s.marginRate,45);
 }
 const p=m.project(rows(),{mode:'item',query:'A'});assert.equal(m.summary(p.details).margin,60);assert.equal(m.summary(p.details).marginRate,30);
});
test('unregistered, deleted and free-text costs never masquerade as zero cost',()=>{
 const r=m.rows({c:{...groups.c,unknown:{item_id:'deleted',name:'Unknown',qty:1,price:50}}},items,[]);
 const s=m.summary(r);assert.equal(s.total,495);assert.equal(s.unknownCost,1);assert.equal(s.margin,null);assert.equal(s.marginRate,null);
 assert.equal(m.marginLabel(s),'마진 — · 원가 미등록');
 assert.equal(m.group(r,'item').find(g=>g.name==='A').margin,60);
});
test('zero, negative, blank and invalid purchase prices follow unknown cost policy',()=>{
 for(const buy_price of [0,-1,'',null,'abc',Infinity])assert.equal(m.unitCost({id:'x',buy_price},'',new Map()),null);
 assert.equal(m.unitCost({id:'x',buy_price:60,variants:[{spec:'L',buy_price:0}]},'L',new Map()),60);
});
test('set costs require every recursive component; cycles and missing components are unknown',()=>{
 const set={id:'set',type:'세트',components:[{item_id:'a',spec:'L',qty:2},{item_id:'b',qty:1}]};
 const im=new Map([...items,set].map(i=>[i.id,i]));assert.equal(m.unitCost(set,'',im),220);
 im.delete('b');assert.equal(m.unitCost(set,'',im),null);
 assert.equal(m.unitCost({...set,buy_price:150},'',im),150);
 im.set('a',{id:'a',type:'세트',components:[{item_id:'set',qty:1}]});assert.equal(m.unitCost(set,'',im),null);
});
test('loss, zero-revenue and negative-quantity rows do not divide by zero',()=>{
 const line=price=>m.summary(m.rows({c:{a:{item_id:'a',qty:1,price}}},items,[]));
 assert.equal(line(50).margin,-10);assert.equal(line(50).marginRate,-20);
 assert.equal(m.marginLabel(line(0)),'마진 -60원 · —');
 const refund=m.summary(m.rows({c:{a:{item_id:'a',qty:-1,price:100}}},items,[]));assert.equal(refund.margin,-40);assert.equal(refund.marginRate,null);
 const empty=m.summary(m.rows({c:{a:{qty:0,price:100}}},items,[]));assert.equal(empty.unknownCost,0);assert.equal(empty.marginRate,null);
});
test('source objects remain unchanged and margin exposes no persistence',()=>{
 const before=JSON.stringify({groups,items});m.project(rows(),{mode:'company'});assert.equal(JSON.stringify({groups,items}),before);
 assert.doesNotMatch(js,/saveTable|fetch\(|localStorage|sessionStorage/);
 assert.match(js,/현재 등록 매입원가/);
});
test('list and detail place smaller margin below right-aligned same-line sale amount',()=>{
 assert.match(js,/nd-sa-entry-amount[^`]*\$\{margin\(g\)\}/);
 assert.match(js,/nd-sa-sale[^`]*\$\{margin\(r\)\}/);
 assert.match(css,/nd-sa-entry-name\{grid-column:1;grid-row:1/);
 assert.match(css,/nd-sa-entry-amount\{grid-column:2;grid-row:1/);
 assert.match(css,/nd-sa-entry>\.nd-sa-margin\{grid-column:2;grid-row:2/);
 assert.match(css,/nd-sa-margin\{[^}]*font:400 11px\/18px[^}]*text-align:right/);
 assert.match(css,/nd-sa-table \.nd-sa-money\{[^}]*align-self:start/);
 assert.match(css,/nd-sa-margin.is-negative\{color:var\(--danger/);
});
