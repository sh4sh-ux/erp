import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const js=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const css=await readFile(new URL('./naro-design.css',import.meta.url),'utf8');
const start=js.indexOf(' const PAY_PHONE='),end=js.indexOf(' // 글자 기호',start);
const adapter=js.slice(start,end);
test('mobile payments never calculate or write business records',()=>{
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(adapter,/\bdb\b|saveTable|addPayment\(|deletePayment\(|fetch\(|localStorage|\.amount\b/);
 assert.match(adapter,/getElementById\('payInbound'\)\?\.click\(\)/);
 assert.match(adapter,/select\.dispatchEvent\(new Event\('change'/);
});
test('mobile input sheet moves original form, preserves handlers, and restores on close',()=>{
 assert.match(adapter,/marker=document\.createComment\('payment-entry-home'\)/);
 assert.match(adapter,/entry\.before\(marker\);dialog\.append\(entry\)/);
 assert.match(adapter,/marker\.replaceWith\(entry\)/);
 assert.match(adapter,/attributeFilter:\['open'\]/);
 assert.match(adapter,/dialog\.addEventListener\('cancel'/);
 assert.doesNotMatch(adapter,/cloneNode|entry\.innerHTML|payAddBtn.*onclick/);
});
test('desktop payment controls remain untouched and mobile sheet closes at desktop breakpoint',()=>{
 assert.match(adapter,/max-width:780px/);
 assert.match(adapter,/if\(!PAY_PHONE\.matches\)\{if\(payPhoneUI\?\.dialog\.open\)payPhoneUI\.dialog\.close\(\);return;/);
 assert.match(css,/\.nd-pay-mobile\{display:none!important\}/);
 const block=css.slice(css.indexOf('/* Records-first is phone-only.'));
 assert.match(block,/@media screen and \(max-width:780px\)/);
 assert.match(block,/\.nd-tools \.nd-tadd\{display:none!important\}/);
 assert.doesNotMatch(adapter,/head\.innerHTML|\.remove\(\)|payInbound.*onclick\s*=/);
});
test('record amounts omit signs only on mobile; net and desktop signs are preserved',()=>{
 const block=css.slice(css.indexOf('/* Records-first is phone-only.'));
 assert.match(block,/#payTbl tbody tr\[data-nd-pay\]>td:nth-child\(7\)::before\{content:none!important\}/);
 assert.match(css,/#payTbl tbody tr\[data-kind="in"\]>td:nth-child\(7\)::before\{content:"\+"\}/);
 assert.doesNotMatch(adapter,/paySumNet|paySumIn|paySumOut/);
});
test('company disclosure is independent of existing table, keyboard-usable and collapsed initially',()=>{
 assert.match(adapter,/toggle\.setAttribute\('aria-expanded','false'\)/);
 assert.match(adapter,/toggle\.setAttribute\('aria-controls','payByCo'\)/);
 assert.match(adapter,/byCo\.classList\.toggle\('nd-pay-company-open',open\)/);
 assert.match(adapter,/for\(const b of tabs\.children\)/);
 assert.match(adapter,/aria-pressed/);
});
test('mobile period is a plain caption, leaving a single filter entry point',()=>{
 assert.match(adapter,/create\('p','nd-pay-mobile nd-pay-period-label'\)/);
 assert.doesNotMatch(adapter,/period\.onclick|조회 기간 · 필터|period\.innerHTML/);
 assert.match(adapter,/period\.textContent=label/);
 assert.match(adapter,/from\|\|'시작일'/);
});
test('company summary has only its right disclosure arrow; navigation keeps company icon',()=>{
 assert.match(js,/companies:COMPANY_ICON/);
 assert.match(adapter,/toggle\.innerHTML='<span>거래처별 집계<\/span>'\+svgI/);
 assert.doesNotMatch(adapter,/svgI\(COMPANY_ICON\)/);
 assert.equal((js.match(/const COMPANY_ICON=/g)||[]).length,1);
});
test('filter toggles close before looking for controls moved into the popup',()=>{
 for(const expr of ['c.filter','c.filterSelect']){
  assert.ok(js.includes(`b.onclick=()=>{if(pop?.btn===b){closePop();return;}const ${expr==='c.filter'?'block':'sel'}=document.querySelector(${expr});`));
 }
 assert.match(css,/\.nd-pay-filter \.date-control>\.date-control-display\{[^}]*border:0!important/);
 assert.match(css,/\.nd-pay-filter \.nd-pop-body\.nd-pop-filter\{display:flex;flex-direction:column;gap:14px\}/);
});
