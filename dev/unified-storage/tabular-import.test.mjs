import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,tableToBackup,safeJSON,readImport} from './tabular-import.mjs';
import {planMerge} from '../personal-cloud-onboarding/extended-contract.mjs';
const empty=()=>({companies:[],items:[],quotes:[],payments:[],stock_moves:[],material_moves:[],settings:{schema:3}});
test('CSV quoted commas, escaped quotes, BOM, CRLF and multiline',()=>{
 assert.deepEqual(parseCSV('\uFEFFa,b\r\n"one,two","a""b\nc"\r\n'),[['a','b'],['one,two','a"b\nc']]);
});
test('malformed and oversized CSV fail closed',()=>{
 for(const text of ['a\n"b','a\nb"c','a\n"b"c','x'.repeat(10001)])assert.throws(()=>parseCSV(text));
});
test('companies CSV uses existing merge and stable IDs; reimport adds zero',()=>{
 const backup=tableToBackup(parseCSV('dataset,id,name,type\ncompanies,fixture-c,Synthetic,매출'));
 const plan=planMerge(empty(),backup);assert.equal(plan.steps.length,1);assert.equal(planMerge(plan.merged,backup).steps.length,0);
 backup.companies[0].name='Changed';assert.throws(()=>planMerge(plan.merged,backup),{code:'STORAGE_CONFLICT'});
});
test('required headers, duplicate headers and forbidden dataset rejected',()=>{
 for(const text of ['dataset,name\ncompanies,X','dataset,id,id\ncompanies,x,x','dataset,id\nsettings,x','dataset,id\ncompanies,'])assert.throws(()=>tableToBackup(parseCSV(text)));
 assert.throws(()=>safeJSON('{"__proto__":{"x":1}}'));
});
test('numeric values and nested arrays; no formula evaluation',()=>{
 const backup=tableToBackup([['id','name','components','variants'],['i','Item','[]','[]']],'items');assert.deepEqual(backup.items[0].components,[]);
 assert.throws(()=>tableToBackup([['dataset','id','amount'],['payments','p','=1+2']]));
 assert.throws(()=>tableToBackup([['dataset','id','prices'],['companies','c','{}']]));
});
test('bad references fail merge preview before persistence',()=>{
 const backup=tableToBackup([['dataset','id','company_id','kind','amount'],['payments','p','missing','수금','100']]);
 assert.throws(()=>planMerge(empty(),backup),{code:'VALIDATION'});
});
test('unsupported extension and oversize rejected before reading',async()=>{
 await assert.rejects(readImport({name:'macro.xlsm',size:1}));await assert.rejects(readImport({name:'large.xlsx',size:8*1048576}));
});
test('v1.186 backups: companies without prices and moves of deleted quotes import unchanged otherwise',async()=>{
 const {upgradeLegacyBackup}=await import('./tabular-import.mjs');
 const {planMerge}=await import('../personal-cloud-onboarding/extended-contract.mjs');
 const raw={app:'erp',format:1,settings:{name:'synthetic'},
  companies:[{id:'c1',name:'가',type:'매출'},{id:'c2',name:'나',type:'매출',prices:[]}],
  items:[{id:'i1',name:'품목',type:'단품',components:[],variants:[]}],
  quotes:[{id:'q1',no:'Q-1',date:'2026-07-01',company_id:'c1',status:'작성중',lines:[{id:'l1',item_id:'i1',name:'품목',qty:1,price:1000}],deliveries:[]}],
  payments:[],material_moves:[],
  stock_moves:[{id:'s1',date:'2026-07-02',item_id:'i1',kind:'출고',qty:2,quote_id:'gone'},{id:'s2',date:'2026-07-03',item_id:'i1',kind:'입고',qty:2,quote_id:'gone'},{id:'s3',date:'2026-07-04',item_id:'i1',kind:'입고',qty:5,quote_id:'q1'}]};
 const empty={companies:[],items:[],quotes:[],payments:[],stock_moves:[],material_moves:[],settings:{}};
 assert.throws(()=>planMerge(empty,raw),{code:'VALIDATION'});
 const {backup,notes}=upgradeLegacyBackup(raw);
 assert.equal(notes.length,2);
 assert.equal(raw.companies[0].prices,undefined);
 assert.deepEqual(backup.companies[0].prices,[]);
 assert.equal(backup.stock_moves[0].quote_id,undefined);assert.equal(backup.stock_moves[0].deleted_quote_id,'gone');
 assert.equal(backup.stock_moves[2].quote_id,'q1');
 assert.deepEqual(backup.stock_moves.map(m=>[m.id,m.kind,m.qty]),raw.stock_moves.map(m=>[m.id,m.kind,m.qty]));
 const plan=planMerge(empty,backup);assert.equal(plan.steps.length,7);
 assert.equal(planMerge(plan.merged,backup).steps.length,0);
});
