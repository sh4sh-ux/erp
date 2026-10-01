import {readFile,mkdir,writeFile,copyFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {Script} from 'node:vm';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'outputs/unified-storage-read'),release=resolve(root,'release');
const erp=await readFile(resolve(release,'erp/index.html'),'utf8');
for(const match of erp.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(match[1]);
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
let imports=0;
for(const f of manifest.files){
 if(!/\.(mjs|js)$/.test(f.path))continue;
 const source=await readFile(resolve(release,f.path),'utf8');
 for(const m of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)){await readFile(resolve(release,f.path,'..',m[2]));imports++;}
}
assert.ok(!erp.includes('companiesCreate:true'));
assert.ok(!erp.includes('https://api.dropboxapi.com'));
assert.ok(!erp.includes('https://content.dropboxapi.com'));
const stock=await readFile(resolve(release,'erp/stock-entry.js'),'utf8');assert.ok(!stock.includes('fetch('));
await mkdir(resolve(root,'regression/tests'),{recursive:true});
await writeFile(resolve(root,'regression/index.html'),erp);
await writeFile(resolve(root,'regression/stock-entry.js'),stock);
const suites=['sales-insight.cjs','stock-planning.cjs','materials.cjs','quote-workflow.cjs'];
for(const name of suites){
 await copyFile(resolve('work/erp-login-shell-v186-release/tests',name),resolve(root,'regression/tests',name));
 const run=spawnSync(process.execPath,[resolve(root,'regression/tests',name)],{encoding:'utf8'});
 if(run.status!==0){console.error(name,run.stderr,run.stdout);process.exitCode=1;}else console.log(name,run.stdout.trim());
}
console.log(JSON.stringify({moduleGraph:'PASS',imports,inlineSyntax:'PASS',pilot:false,providerEndpointsInBusiness:false}));
