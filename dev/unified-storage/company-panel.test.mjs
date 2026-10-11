import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const here=new URL('.',import.meta.url);
const js=await readFile(new URL('company-panel.js',here),'utf8');
const build=await readFile(new URL('build.mjs',here),'utf8');
test('company panel is bundled after the trash layer, with its stylesheet',()=>{
 assert.match(build,/trash-actions\.js'\),'utf8'\)\}\\n\$\{await readFile\(resolve\(here,'company-panel\.js'\)/);
 assert.match(build,/company-panel\.css/);
});
test('company panel only rearranges the form: it never saves, deletes or rebuilds inputs',()=>{
 assert.doesNotMatch(js,/saveTable|Table\.save|deleteCompany/);
 assert.doesNotMatch(js,/\beval\(/);
 // 입력 칸은 원래 노드를 옮긴다(id·이벤트·변경 감지 유지)
 for(const id of ['f_name','f_type','f_contact','f_email','f_address','f_address_detail','f_memo','f_qmemo'])assert.match(js,new RegExp(`unit\\('${id}'\\)`));
});
test('vendors show 줄 금액 and sales customers 받을 금액',()=>{
 assert.match(js,/amtLabel:'받을 금액'/);
 assert.match(js,/amtLabel:'줄 금액'/);
});
