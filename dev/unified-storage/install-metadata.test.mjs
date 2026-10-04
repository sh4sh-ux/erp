import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installMetadataConfig} from '../../naro-workspace/outputs/naro-redesign/install-metadata.mjs';
const base=JSON.parse(await readFile(new URL('../../naro-workspace/outputs/general-public-readiness/candidate/hosting-config.json',import.meta.url),'utf8'));
test('Dropbox auxiliary pages have absolute install metadata on both HTML and nested OAuth routes',async()=>{
 for(const name of ['dropbox-callback','dropbox-waiting']){
  const html=await readFile(new URL(`../personal-cloud-onboarding/${name}.html`,import.meta.url),'utf8');
  assert.match(html,/<title>NARO Biz<\/title>/);
  assert.match(html,/<meta name="apple-mobile-web-app-title" content="NARO Biz">/);
  assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\/erp\/icons\/icon-180.png">/);
  assert.match(html,/<link rel="manifest" href="\/manifest.webmanifest">/);
  assert.doesNotMatch(html,/href="\.\//);
  if(name==='dropbox-callback')assert.match(html,/<script type="module" src="\/dropbox-callback.mjs"><\/script>/);
  else assert.doesNotMatch(html,/<script/);
 }
});
test('install metadata CSP changes exactly four headers, not OAuth, network, framing or referrer policy',()=>{
 const before=JSON.stringify(base),next=installMetadataConfig(base.config);
 assert.equal(JSON.stringify(base),before);assert.deepEqual(next.rewrites,base.config.rewrites);
 let changed=0;
 for(let i=0;i<next.headers.length;i++){
  const a=base.config.headers[i],b=next.headers[i];
  if(JSON.stringify(a)===JSON.stringify(b))continue;
  changed++;assert.match(b.glob,/dropbox/);
  const extra=b.headers['Content-Security-Policy'].slice(a.headers['Content-Security-Policy'].length);
  assert.equal(extra,"; img-src https://naro-biz.web.app/naro-symbol.png https://naro-biz.web.app/erp/icons/; manifest-src https://naro-biz.web.app/manifest.webmanifest");
  assert.deepEqual({...b.headers,'Content-Security-Policy':a.headers['Content-Security-Policy']},a.headers);
 }
 assert.equal(changed,4);
 const bad=structuredClone(base.config);bad.headers.find(r=>r.glob==='/oauth/dropbox/callback').headers['Content-Security-Policy']="default-src *";
 assert.throws(()=>installMetadataConfig(bad));
});
test('root install manifest launches main app, not callback, using enlarged existing PNG icons',async()=>{
 const root=new URL('../../naro-workspace/outputs/naro-redesign/candidate/release/',import.meta.url);
 const m=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
 assert.equal(m.name,'NARO Biz');assert.equal(new URL(m.start_url,'https://naro-biz.web.app/manifest.webmanifest').href,'https://naro-biz.web.app/');
 for(const size of [180,192,512]){
  const icon=await readFile(new URL(`erp/icons/icon-${size}.png`,root));
  assert.equal(icon.readUInt32BE(16),size);assert.equal(icon.readUInt32BE(20),size);
  assert.deepEqual(icon,await readFile(new URL(`./naro-icons/icon-${size}.png`,import.meta.url)));
 }
});
