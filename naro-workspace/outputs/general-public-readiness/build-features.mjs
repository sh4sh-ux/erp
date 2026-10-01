// Prepare a separate candidate. Does not deploy or touch the pinned releases.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';import assert from 'node:assert/strict';
const base=resolve('outputs/personal-business-extended-candidate'),out=resolve('outputs/personal-all-features-candidate');
const source=JSON.parse(await readFile(resolve(base,'manifest.json'))),files=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function put(path,bytes){await mkdir(dirname(resolve(out,'release',path)),{recursive:true});await writeFile(resolve(out,'release',path),bytes);files.push({path,sha256:sha(bytes)});}
for(const file of source.files){
 let bytes=await readFile(resolve(base,'release',file.path));assert.equal(sha(bytes),file.sha256);
 assert(!/fixture|mock|synthetic|\.test\.|diagnostic|draft/.test(file.path));
 if(file.path==='index.html'){const text=bytes.toString(),needle='<footer class="page-footer"></footer>';assert(text.includes(needle));bytes=Buffer.from(text.replace(needle,'<footer class="page-footer"><a href="./about.html" target="_blank" rel="noopener">서비스 안내</a> · <a href="./privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></footer>'));}
 if(/\.(mjs|js|html)$/.test(file.path))assert(!/-----BEGIN [A-Z ]*PRIVATE KEY|ya29\.[A-Za-z0-9_-]{20,}|naro-step6-user-a@example\.test|synthetic-token/.test(bytes.toString()),'release secret/fixture gate '+file.path);
 await put(file.path,bytes);
}
for(const name of ['about.html','privacy.html','about.css'])await put(name,await readFile(resolve('outputs/general-public-readiness/site',name)));
files.sort((a,b)=>a.path<b.path?-1:1);
const actual=[];async function walk(dir,p=''){for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());if(e.isDirectory())await walk(resolve(dir,e.name),p+e.name+'/');else actual.push(p+e.name);}}await walk(resolve(out,'release'));assert.deepEqual(actual.sort(),files.map(f=>f.path));
await writeFile(resolve(out,'hosting-config.json'),await readFile('outputs/general-public-readiness/candidate/hosting-config.json'));
const report={mode:'FEATURE_CANDIDATE_NOT_DEPLOYED',files,aggregate:sha(JSON.stringify(files)),previousPublicAggregate:'8dbad392efacbd02631f22c9d70bd2f8f5be5f4cdf11622e16d0c297881e23ce',cloudWrites:0,liveNewFeatureVerification:false};await writeFile(resolve(out,'manifest.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({files:files.length,aggregate:report.aggregate,cloudWrites:0}));
