import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=new URL(process.argv.includes('--features')?'../personal-all-features-candidate/':'./candidate/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',dir)));
const results=[];
for(const f of manifest.files){const r=await fetch('https://naro-biz.web.app/'+f.path,{headers:{'Cache-Control':'no-cache'}});results.push({path:f.path,status:r.status,hashMatch:createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')===f.sha256});}
const headers=[];
for(const p of ['/','/privacy.html','/about.html','/erp/index.html','/oauth/dropbox/callback','/oauth/dropbox/waiting']){
 const r=await fetch('https://naro-biz.web.app'+p,{headers:{'Cache-Control':'no-cache'}});
 const csp=r.headers.get('content-security-policy'),coop=r.headers.get('cross-origin-opener-policy');
 assert.equal(r.status,200);assert(csp);assert.equal(coop,p.startsWith('/oauth/')?'unsafe-none':'same-origin-allow-popups');
 headers.push({path:p,status:r.status,csp,coop});
}
const initial=JSON.parse(await readFile(new URL('public-verification.json',dir)));
const report={status:results.every(r=>r.status===200&&r.hashMatch)?'PASS':'PENDING',results,headers,rulesUnchanged:initial.rulesUnchanged};
await writeFile(new URL('public-verification-final.json',dir),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,files:results.length,mismatches:results.filter(r=>!r.hashMatch||r.status!==200),routes:headers.length,rulesUnchanged:report.rulesUnchanged}));
assert.equal(report.status,'PASS');
