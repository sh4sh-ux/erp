import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('scoped progress rebuild is repeatable and rejects corrupted pinned inputs before writing',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'naro-progress-'));
 try{
  await cp(new URL('.',import.meta.url),resolve(root,'dev/unified-storage'),{recursive:true});
  await cp(new URL('../../naro-workspace/outputs/naro-redesign',import.meta.url),resolve(root,'naro-workspace/outputs/naro-redesign'),{recursive:true});
  const base=resolve(root,'naro-workspace/outputs/naro-redesign'),html=resolve(base,'candidate/release/erp/index.html'),manifest=resolve(base,'candidate/manifest.json'),script=resolve(root,'dev/unified-storage/sync-progress-candidate.mjs');
  const run=()=>execFileSync(process.execPath,[script],{stdio:'pipe'});
  run();const first=[await readFile(html),await readFile(manifest),await readFile(resolve(base,'deploy.mjs'))].map(sha);
  run();assert.deepEqual([await readFile(html),await readFile(manifest),await readFile(resolve(base,'deploy.mjs'))].map(sha),first);
  const before=await readFile(manifest);await writeFile(resolve(base,'candidate/release/dropbox-oauth.mjs'),'corrupt');
  assert.throws(run,/Existing pinned bytes: dropbox-oauth.mjs/);assert.deepEqual(await readFile(manifest),before);assert.equal(sha(await readFile(html)),first[0]);
 }finally{await rm(root,{recursive:true,force:true});}
});
