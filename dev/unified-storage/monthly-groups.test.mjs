// 달마다 묶은 입금·출금(.nd-mon · .pp-mg)의 숫자도 공통 글자 규칙(ui-contract.css)을 따른다 — 기능 파일에서 크기·굵기를 따로 주지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('.',import.meta.url);
const read=f=>readFileSync(new URL(f,here),'utf8');

test('month group money and labels use the shared number rules',()=>{
 const contract=read('ui-contract.css');
 const money=contract.slice(contract.indexOf('List and ledger money'),contract.indexOf('Record names and muted'));
 for(const sel of ['.nd-mon-h>.s','.nd-mon-r .a','.pp-mg em'])assert.ok(money.includes(sel),`${sel} must be in the shared money rule`);
 const names=contract.slice(contract.indexOf('Record names and muted'),contract.indexOf('Rail labels'));
 for(const sel of ['.nd-mon-h>b','.nd-mon-h>.n','.nd-mon-r .d'])assert.ok(names.includes(sel),`${sel} must be in the shared name/label rules`);
});

test('feature css does not restyle month group numbers',()=>{
 const css=read('naro-design.css')+read('payment-panel.css');
 for(const sel of ['.nd-mon-h>.s','.nd-mon-r .a','.pp-mg em','.nd-mon-h>b']){
  const re=new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^{]*\\{[^}]*(font-size|font-weight|font:)');
  assert.ok(!re.test(css),`${sel} must not set its own font size/weight`);
 }
});
