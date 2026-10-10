// 매입 화면이 견적서 스타일 규칙을 이름만 바꿔 '원래 규칙 바로 뒤에' 한 벌 더 넣는지(순서가 같아야 이기는 규칙도 같다).
import test from 'node:test';import assert from 'node:assert/strict';
import {mirrorQuoteStyles} from './purchase-ui.mjs';
const rule=(sel,css)=>({selectorText:sel,style:{cssText:css}});
function sheet(rules){
 const s={cssRules:rules,insertRule(text,i){const m=/^(.*?)\{(.*)\}$/s.exec(text);rules.splice(i,0,rule(m[1],m[2]));return i;}};
 return s;
}
function media(rules){return {cssRules:rules,insertRule(text,i){const m=/^(.*?)\{(.*)\}$/s.exec(text);rules.splice(i,0,rule(m[1],m[2]));return i;}};}
test('견적서 규칙만 복사, 원래 규칙 바로 뒤, 미디어 규칙 안쪽도',()=>{
 const inner=[rule('#view-quotes .qline','height: 48px;')];
 const rs=[rule('.btn','color: red;'),rule('#view-quotes .qt-hero, #view-companies .x','padding: 1px;'),rule('#qtForm.nd-view .qp-stepper>button','display: none !important;'),media(inner),rule('#qtFormX .a','color: blue;'),rule('#view-quotes-old .b','color: blue;')];
 const s=sheet(rs);
 const n=mirrorQuoteStyles({styleSheets:[s]});
 assert.equal(n,3);
 const sels=rs.map(r=>r.selectorText||'@media');
 assert.deepEqual(sels,['.btn','#view-quotes .qt-hero, #view-companies .x','#view-purchases .qt-hero, #view-companies .x','#qtForm.nd-view .qp-stepper>button','#puForm.nd-view .qp-stepper>button','@media','#qtFormX .a','#view-quotes-old .b']);
 assert.equal(rs[4].style.cssText,'display: none !important;');
 assert.deepEqual(inner.map(r=>r.selectorText),['#view-quotes .qline','#view-purchases .qline']);
 // 같은 시트를 다시 처리하지 않는다
 assert.equal(mirrorQuoteStyles({styleSheets:[s]}),0);
});
test('읽을 수 없는 시트·빈 시트는 건너뛰고 나중에 다시 본다',()=>{
 const bad={get cssRules(){throw Error('SecurityError');}};
 const empty=sheet([]);
 assert.equal(mirrorQuoteStyles({styleSheets:[bad,empty]}),0);
 empty.cssRules.push(rule('#qtList .list-item','height: 90px;'));
 assert.equal(mirrorQuoteStyles({styleSheets:[empty]}),1);
 assert.equal(empty.cssRules[1].selectorText,'#puList .list-item');
});
