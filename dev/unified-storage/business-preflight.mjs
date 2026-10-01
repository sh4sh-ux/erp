import {readFile,readdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root='outputs/personal-business-candidate',sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(root+'/manifest.json'));
const paths=[];async function walk(dir,prefix=''){for(const f of await readdir(dir,{withFileTypes:true})){assert.ok(!f.isSymbolicLink());if(f.isDirectory())await walk(dir+'/'+f.name,prefix+f.name+'/');else paths.push(prefix+f.name);}}await walk(root+'/release');
assert.deepEqual(paths.sort(),manifest.files.map(f=>f.path).sort());assert.equal(sha(JSON.stringify(manifest.files)),manifest.aggregate);
const images=[];
for(const f of manifest.files){
 assert.ok(!/fixture|mock|debug|\.env|credential|\.map$/.test(f.path));const bytes=await readFile(root+'/release/'+f.path);assert.equal(sha(bytes),f.sha256);
 if(f.path.endsWith('.png')){
  const reference=f.path.startsWith('erp/')?'outputs/privacy-safe-companies-pilot/source/app/'+f.path.slice(4):'outputs/personal-cloud-onboarding-public-release/release/'+f.path;
  assert.equal(sha(await readFile(reference)),f.sha256);images.push(f.path);
 }else{
  const text=bytes.toString();
  for(const pattern of [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/"type"\s*:\s*"service_account"/,/ya29\.[A-Za-z0-9_-]{20,}/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}/,/(?:sh4sh|onlysh4sh)@|support@d-edit\.com/i,/(?<!\d)01[016789][- ]?\d{3,4}[- ]?\d{4}(?!\d)/,/(?:access_token|refresh_token|password|client_secret)\s*[:=]\s*['"][A-Za-z0-9_+\/-]{16,}['"]/,/business-card-gownii|naro-step6-user-a|policy-v1-[a-f0-9]{12}/])assert.ok(!pattern.test(text),'PRIVATE_LITERAL_FOUND');
 }
}
const previous=JSON.parse(await readFile('outputs/personal-companies-public-release/manifest.json'));
for(const f of previous.files)assert.equal(sha(await readFile('outputs/personal-companies-public-release/release/'+f.path)),f.sha256);
const report={status:'LOCAL_PREFLIGHT_PASS',files:paths.length,aggregate:manifest.aggregate,privateLiteralScan:'PASS',images:'UNCHANGED_FROM_REVIEWED_ARTIFACTS',imageFiles:images,previousPublishedCandidate:'UNCHANGED',cloudAccess:false,liveBusinessWrite:false,deploy:false};
await writeFile(root+'/preflight.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
