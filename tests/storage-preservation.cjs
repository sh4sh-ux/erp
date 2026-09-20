// Exact baseline comparison: only the Table boundary and schema-preservation line may differ.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),base='91184412a9abb8a45ab1104661f94652ddc83e1d';
const before=execFileSync('git',['show',base+':index.html'],{cwd:root,encoding:'utf8'});
let after=fs.readFileSync(path.join(root,'index.html'),'utf8');
after=after.replace(/\/\* Load recovery: visible only[\s\S]*?\/\* End load recovery\. \*\/\n/,'').replace(/<!-- Load recovery stays outside[\s\S]*?<!-- End load recovery\. -->\n/,'');
// STEP 2 permits only these two additional function changes, behavior-tested separately.
for(const pattern of [/async function loadAll\(\)\{[\s\S]*?(?=\n\/\* 데이터가)/,/async function runMigrations\(\)\{[\s\S]*?(?=\n\/\* 예전 버전)/]){
 assert.ok(before.match(pattern)&&after.match(pattern));
 after=after.replace(pattern,()=>before.match(pattern)[0]);
}
const start=before.indexOf('const Table = {'),end=before.indexOf('\n/* ── 옛 앱 폴더',start);
const newStart=after.indexOf('// Snapshot contract:'),newEnd=after.indexOf('\n/* ── 옛 앱 폴더',newStart);
assert.ok(start>0&&end>start&&newStart>0&&newEnd>newStart);
const schemaLine='    ...(Object.prototype.hasOwnProperty.call(db.settings||{},"schema") ? {schema:db.settings.schema} : {}),\n';
assert.equal(after.split(schemaLine).length,2);
assert.equal(after.slice(0,newStart)+before.slice(start,end)+after.slice(newEnd).replace(schemaLine,''),before,'every byte outside the two approved changes preserved, including all protected business functions and HTML/CSS');
for(const file of ['stock-entry.js','quote-presentation.js','quote-presentation.css','workspace-system.css','workspace-layout.js','mobile-workspace.css','navigation-layout.css','stock-entry.css','sw.js']){
 assert.equal(fs.readFileSync(path.join(root,file),'utf8'),execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}),file+' unchanged');
}
console.log('PASS: baseline UI/business functions unchanged outside adapter, schema fix, loadAll and runMigrations');
