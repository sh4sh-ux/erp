import test from 'node:test';
import assert from 'node:assert/strict';
import {safeStorageFailure,safeStorageDiagnostic} from './business-workspace.mjs';
test('storage diagnostics preserve safe codes without provider payloads',()=>{
 for(const code of ['RATE_LIMIT','NETWORK_ERROR','STORAGE_INVALID','CANCELLED','UNAVAILABLE','STORAGE_CONFLICT'])assert.equal(safeStorageFailure({code,message:'must-not-leak',token:'synthetic-private'}),code);
 assert.equal(safeStorageFailure(new TypeError('must-not-leak')),'INTERNAL_ERROR');
 assert.equal(safeStorageFailure({code:'private arbitrary value'}),'INTERNAL_ERROR');
 assert.equal(safeStorageFailure(null),'INTERNAL_ERROR');
});
test('diagnostic stage is allowlisted and cannot carry URLs, IDs or payloads',()=>{
 assert.deepEqual(safeStorageDiagnostic({code:'NETWORK_ERROR',stage:'CONTENT_READ',transport:'FETCH_REJECTED',message:'secret'}),{code:'NETWORK_ERROR',stage:'CONTENT_READ',transport:'FETCH_REJECTED'});
 assert.deepEqual(safeStorageDiagnostic({stage:'private URL',transport:'private response'}),{code:'INTERNAL_ERROR',stage:'',transport:''});
});

test('VALIDATION reason is a short allowlisted code (no values)',async()=>{
 const {safeStorageDiagnostic}=await import('./business-workspace.mjs');
 assert.deepEqual(safeStorageDiagnostic(Object.assign(Error('x'),{code:'VALIDATION',reason:'EDITED_1_quote_id'})).reason,'EDITED_1_quote_id');
 assert.equal(safeStorageDiagnostic(Object.assign(Error('x'),{code:'VALIDATION',reason:'https://x/모자'})).reason,undefined);
 const {explainValidation}=await import('./storage.mjs');
 const items=[{id:'i1'}],before=[{id:'a',item_id:'i1',kind:'입고',qty:1}];
 assert.equal(explainValidation('stock_moves',before,[...before,{id:'b',item_id:'zz',kind:'입고',qty:1}],{items},null),'ITEM');
 assert.equal(explainValidation('stock_moves',before,[{...before[0],quote_id:null},{id:'b',item_id:'i1',kind:'입고',qty:1}],{items},null),'EDITED_1_quote_id');
 assert.equal(explainValidation('stock_moves',before,[...before,{id:'b',item_id:'i1',kind:'입고',qty:1,purchase_id:'p'}],{items},null),'PURCHASE_NOT_READY');
});
