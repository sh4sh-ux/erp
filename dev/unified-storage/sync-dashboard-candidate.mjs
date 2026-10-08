// Presentation-only release derivation. Never rebuild pinned authentication files.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {installMetadataConfig} from '../../naro-workspace/outputs/naro-redesign/install-metadata.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(here,'../../naro-workspace/outputs/naro-redesign');
const candidate=resolve(out,'candidate'),file=resolve(candidate,'release/erp/index.html');
const sha=s=>createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(await readFile(resolve(candidate,'manifest.json'),'utf8'));
// Before touching a candidate, validate every currently pinned byte.
for(const item of manifest.files)assert.equal(sha(await readFile(resolve(candidate,'release',item.path))),item.sha256,item.path);
let html=await readFile(file,'utf8');
const start=html.indexOf('<style id="naro-design">');
assert(start>=0,'Missing design layer');
const end=html.indexOf('</script>',html.indexOf('</style><script>',start));
assert(end>start,'Missing design script end');
const design=`<style id="naro-design">${await readFile(resolve(here,'naro-design.css'),'utf8')}\n${await readFile(resolve(here,'sales-analysis.css'),'utf8')}</style><script>${await readFile(resolve(here,'naro-design.js'),'utf8')}\n${await readFile(resolve(here,'sales-analysis.js'),'utf8')}</script>`;
html=html.slice(0,start)+design+html.slice(end+'</script>'.length);
const dashboard=`<style id="naro-dashboard-style">${await readFile(resolve(here,'dashboard-refined.css'),'utf8')}</style><script id="naro-dashboard-script">${await readFile(resolve(here,'dashboard-refined.js'),'utf8')}</script>`;
html=html.replace(/<style id="naro-dashboard-style">[\s\S]*?<\/script>/,'');
assert.equal(html.split('</body>').length,2,'One body close required');
html=html.replace('</body>',dashboard+'</body>');
await writeFile(file,html);
manifest.files.find(f=>f.path==='erp/index.html').sha256=sha(html);
// Optional, explicitly scoped icon refresh; never copy authentication/runtime sources.
const changedReleaseFiles=['erp/index.html'];
if(process.argv.includes('--install-metadata')){
 for(const path of ['dropbox-callback.html','dropbox-waiting.html']){
  const entry=manifest.files.find(f=>f.path===path);assert(entry,`Unpinned metadata: ${path}`);
  const bytes=await readFile(resolve(here,'../personal-cloud-onboarding',path));
  await writeFile(resolve(candidate,'release',path),bytes);entry.sha256=sha(bytes);changedReleaseFiles.push(path);
 }
 const baseline=JSON.parse(await readFile(resolve(out,'../general-public-readiness/candidate/hosting-config.json'),'utf8'));
 assert.equal(baseline.site,'naro-biz');
 await writeFile(resolve(candidate,'hosting-config.json'),JSON.stringify({...baseline,config:installMetadataConfig(baseline.config)},null,2)+'\n');
}
if(process.argv.includes('--icons')){
 const assets=[['style.css',resolve(here,'../personal-cloud-onboarding/style.css')],
  ...[180,192,512].map(size=>[`erp/icons/icon-${size}.png`,resolve(here,`naro-icons/icon-${size}.png`)])];
 for(const [path,source] of assets){
  const entry=manifest.files.find(f=>f.path===path);assert(entry,`Unpinned asset: ${path}`);
  const bytes=await readFile(source);await writeFile(resolve(candidate,'release',path),bytes);
  entry.sha256=sha(bytes);changedReleaseFiles.push(path);
 }
}
manifest.aggregate=sha(JSON.stringify(manifest.files));
await writeFile(resolve(candidate,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const deploy=resolve(out,'deploy.mjs');
const source=await readFile(deploy,'utf8');
assert.match(source,/const PIN=\{files:67,aggregate:'[a-f0-9]{64}'/);
await writeFile(deploy,source.replace(/(const PIN=\{files:67,aggregate:')[a-f0-9]{64}/,'$1'+manifest.aggregate));
console.log(JSON.stringify({changedReleaseFiles,files:manifest.files.length,aggregate:manifest.aggregate}));
