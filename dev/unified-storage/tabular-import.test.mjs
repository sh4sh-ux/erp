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
