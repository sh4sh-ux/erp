// Exact baseline comparison: only the Table boundary and schema-preservation line may differ.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),base='91184412a9abb8a45ab1104661f94652ddc83e1d';
const before=execFileSync('git',['show',base+':index.html'],{cwd:root,encoding:'utf8'});
const after=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=before.indexOf('const Table = {'),end=before.indexOf('\n/* ── 옛 앱 폴더',start);
const newStart=after.indexOf('// Snapshot contract:'),newEnd=after.indexOf('\n/* ── 옛 앱 폴더',newStart);
assert.ok(start>0&&end>start&&newStart>0&&newEnd>newStart);
const schemaLine='    ...(Object.prototype.hasOwnProperty.call(db.settings||{},"schema") ? {schema:db.settings.schema} : {}),\n';
assert.equal(after.split(schemaLine).length,2);
assert.equal(after.slice(0,newStart)+before.slice(start,end)+after.slice(newEnd).replace(schemaLine,''),before,'every byte outside the two approved changes preserved, including all protected business functions and HTML/CSS');
for(const file of ['stock-entry.js','quote-presentation.js','quote-presentation.css','workspace-system.css','workspace-layout.js','mobile-workspace.css','navigation-layout.css','stock-entry.css','sw.js']){
 assert.equal(fs.readFileSync(path.join(root,file),'utf8'),execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}),file+' unchanged');
}
console.log('PASS: all baseline business functions/UI unchanged outside storage boundary and settings.schema fix');
