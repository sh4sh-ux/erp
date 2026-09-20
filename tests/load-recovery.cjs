const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {harness,fixtures}=require('./storage-contract.cjs');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const base=cp.execFileSync('git',['show','d1c4b88bc9c824a71de1833b9ed8020618cc1af4:index.html'],{cwd:root,encoding:'utf8'});
const migration=/async function runMigrations\(\)\{[\s\S]*?(?=\n\/\* 예전 버전)/;
assert.equal(html.match(migration)[0],base.match(migration)[0],'migration unchanged');
assert.ok(html.indexOf('id="loadRecovery"')<html.indexOf('id="appView"'),'recovery outside inert workspace');
(async()=>{
 for(const failure of ['quotes','settings','read']){
  const h=harness(),classes=new Set();let reloads=0,focused=false;
  h.document.getElementById('appView').classList={add:n=>classes.add(n),remove:n=>classes.delete(n)};
  h.document.getElementById('loadRecoveryReload').focus=()=>{focused=true;};
  h.ctx.window.location.reload=()=>{reloads++;};
  for(const [name,value] of Object.entries(fixtures))h.files.set(h.root+'/'+name+'.json',JSON.stringify(name==='settings'?{schema:2}:value));
  if(failure==='read')h.ctx.failRead=h.root+'/items.json';else h.ctx.failWrite=h.root+'/'+failure+'.json';
  assert.equal(await h.run('loadAll()'),false);
  assert.equal(h.document.getElementById('loadRecovery').hidden,false);assert.equal(h.document.getElementById('appView').inert,true);assert.ok(classes.has('load-blocked'));assert.ok(focused);
  h.document.getElementById('loadRecoveryReload').onclick();assert.equal(reloads,1,'browser reload action');
  h.ctx.failRead=null;h.ctx.failWrite=null;await h.run('loadAll()');
  assert.equal(h.document.getElementById('loadRecovery').hidden,true);assert.equal(h.document.getElementById('appView').inert,false);assert.ok(!classes.has('load-blocked'));
  console.log('PASS: '+failure+' failure notice/focus/blocking/browser reload and recovery cleanup');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
