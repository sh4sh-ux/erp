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
