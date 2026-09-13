const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
new vm.Script(fs.readFileSync(path.join(root,'workspace-layout.js'),'utf8'));
new vm.Script(sw);
const assets=[...html.matchAll(/(?:href|src)="\.\/([^"?#]+)(\?[^"#]*)?"/g)];
for(const [,file,query=''] of assets){
  assert(fs.existsSync(path.join(root,file)),`Missing asset: ${file}`);
  if(file.endsWith('.css')||file.endsWith('.js'))assert(sw.includes('./'+file+query),`Cache asset mismatch: ${file}`);
}
assert(!html.includes('Synthetic volume only')&&!html.includes("id:'c1',name:'샘플 거래처'"),'Fixture leaked into production');
assert(html.includes('v1.157')&&sw.includes('erp-shell-v67-v157'),'Release version mismatch');
console.log('PASS: script syntax, linked assets, cache versions, no production fixture injection');
