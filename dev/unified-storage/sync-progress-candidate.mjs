// Scoped candidate derivation: retain pinned runtime/auth and replace only progress presentation.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../../naro-workspace/outputs/naro-redesign');
const candidate=resolve(out,'candidate'),release=resolve(candidate,'release'),manifestPath=resolve(candidate,'manifest.json'),deployPath=resolve(out,'deploy.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(manifestPath,'utf8')),deploy=await readFile(deployPath,'utf8');
assert.equal(sha(JSON.stringify(manifest.files)),manifest.aggregate,'Existing manifest aggregate');
const pin=/const PIN=\{files:(\d+),aggregate:'([a-f0-9]{64})'/.exec(deploy);
assert(pin,'Deployment pin');assert.equal(Number(pin[1]),manifest.files.length);assert.equal(pin[2],manifest.aggregate);
const actual=[];async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink(),'Symlink');if(e.isDirectory())await walk(resolve(dir,e.name),prefix+e.name+'/');else actual.push(prefix+e.name);}}
await walk(release);assert.deepEqual(actual.sort(),manifest.files.map(f=>f.path).sort(),'Candidate file set');
for(const f of manifest.files)assert.equal(sha(await readFile(resolve(release,f.path))),f.sha256,'Existing pinned bytes: '+f.path);
const htmlPath=resolve(release,'erp/index.html');let html=await readFile(htmlPath,'utf8');
for(const [file,next] of [['quote-actions.css','purchase-ui.css'],['quote-actions.js','trash-actions.js']]){
 const source=await readFile(resolve(here,file),'utf8'),following=await readFile(resolve(here,next),'utf8');
 const marker=source.slice(0,100),a=html.indexOf(marker);assert(a>=0&&html.indexOf(marker,a+1)<0,file+' unique boundary');
 const b=html.indexOf(following.slice(0,100),a);assert(b>a,next+' boundary');
 html=html.slice(0,a)+source.trimEnd()+'\n\n'+html.slice(b);
}
const tag='<style id="naro-ui-contract">',a=html.indexOf(tag),b=html.indexOf('</style>',a);assert(a>=0&&b>a,'Style contract');
html=html.slice(0,a+tag.length)+await readFile(resolve(here,'ui-contract.css'),'utf8')+html.slice(b);
const target=manifest.files.find(f=>f.path==='erp/index.html');assert(target);target.sha256=sha(html);manifest.aggregate=sha(JSON.stringify(manifest.files));
const refreshed=deploy.replace(pin[0],`const PIN={files:${manifest.files.length},aggregate:'${manifest.aggregate}'`);
await writeFile(htmlPath,html);await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');await writeFile(deployPath,refreshed);
console.log(JSON.stringify({files:manifest.files.length,changedReleaseFiles:['erp/index.html'],aggregate:manifest.aggregate}));
