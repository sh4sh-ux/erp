import test from 'node:test';import assert from 'node:assert/strict';
import {emptyData,fault} from '../personal-cloud-onboarding/core.mjs';
import {validateExtendedChange as validate,planMerge} from '../personal-cloud-onboarding/extended-contract.mjs';
import {createMergeImport} from './merge-import.mjs';
const c={id:'c',name:'합성',type:'매출',prices:[]};
const s=()=>({...emptyData(),companies:[c]});
const m={id:'m',company_id:'c',kind:'받음',material:'합성 자재',qty:5,date:'2026-09-29',created_at:'2026-09-29T00:00:00Z'};
test('schema 3 supplier settings preserve schema; executable URLs and prototype payload rejected',()=>{
 assert.equal(validate('settings',{schema:3},{schema:3,name:'합성 공급자'},s()).name,'합성 공급자');
 for(const value of [{schema:2},{schema:3,business_card_url:'javascript:alert(1)'},JSON.parse('{"schema":3,"__proto__":{}}')])assert.throws(()=>validate('settings',{schema:3},value,s()),{code:'VALIDATION'});
});
test('material receipt, usage, amendment and audit cancellation; negative holdings rejected',()=>{
 const data=s();assert.deepEqual(validate('material_moves',[],[m],data),[m]);
 const use={...m,id:'use',kind:'반환',qty:2,created_at:'2026-09-29T01:00:00Z'};
 assert.equal(validate('material_moves',[m],[m,use],data).length,2);
 assert.throws(()=>validate('material_moves',[m],[m,{...use,qty:6}],data),{code:'VALIDATION'});
 assert.equal(validate('material_moves',[m],[{...m,void_at:'2026-09-29T02:00:00Z'}],data)[0].void_at,'2026-09-29T02:00:00Z');
 assert.throws(()=>validate('material_moves',[m,use],[{...m,void_at:'x'},use],data),{code:'VALIDATION'});
 assert.throws(()=>validate('material_moves',[m],[],data),{code:'WRITE_BLOCKED'});
});
test('single delete allowed only without references; no hidden cascade or batch delete',()=>{
 assert.deepEqual(validate('companies',[c],[],s()),[]);
 assert.throws(()=>validate('companies',[c],[],{...s(),payments:[{company_id:'c'}]}),{code:'VALIDATION'});
 assert.throws(()=>validate('companies',[c,{...c,id:'c2'}],[],s()),{code:'VALIDATION'});
 assert.deepEqual(validate('payments',[{id:'p'}],[],s()),[]);
});
test('merge is add-only and rejects ID collisions before writes; settings retained',()=>{
 const data=s(),backup={app:'erp',format:1,companies:[c,{...c,id:'c2'}],settings:{schema:3,name:'not imported'}};
 assert.equal(planMerge(data,backup).steps.length,1);assert.deepEqual(planMerge(data,backup).merged.settings,{schema:3});
 assert.throws(()=>planMerge(data,{...backup,companies:[{...c,name:'overwrite'}]}),{code:'STORAGE_CONFLICT'});
});
test('partial merge resumes from verified index, never repeats successful rows',async()=>{
 const data=s();let calls=0,fail=true;
 const repo={loadCollection:k=>structuredClone(data[k]),loadObject:k=>structuredClone(data[k]),async saveTable(k,v){calls++;if(calls===2&&fail){fail=false;throw fault('QUOTA_LIMIT');}data[k]=v;}};
 const session=createMergeImport(repo);const backup={app:'erp',format:1,companies:[{...c,id:'a'},{...c,id:'b'}]};
 await assert.rejects(session.run(backup),{code:'QUOTA_LIMIT'});assert.equal(data.companies.length,2);
 assert.equal((await session.run()).completed,2);assert.equal(calls,3);assert.equal(data.companies.length,3);
});
test('ambiguous merge recovery is read-only before progressing',async()=>{
 const data=s();let writes=0,recovered=0;
 const repo={loadCollection:k=>structuredClone(data[k]),loadObject:k=>structuredClone(data[k]),async saveTable(k,v,o){if(o?.recover){recovered++;return;}data[k]=v;writes++;throw fault('SAVE_UNCONFIRMED');}};
 const session=createMergeImport(repo);await assert.rejects(session.run({app:'erp',format:1,companies:[{...c,id:'a'}]}),{code:'SAVE_UNCONFIRMED'});
 await session.run();assert.equal(writes,1);assert.equal(recovered,1);
});
