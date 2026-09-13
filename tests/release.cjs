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
assert(html.includes('v1.158')&&sw.includes('erp-shell-v68-v158'),'Release version mismatch');
const css=fs.readFileSync(path.join(root,'workspace-system.css'),'utf8');
assert(html.includes('--ok:#1DAD53')&&html.includes('--ok-ink:var(--ok)'), 'Shared green token mismatch');
assert(!/#13823d/i.test(html), 'Legacy dark green remains');
assert(css.includes('meter::-webkit-meter-optimum-value {background:var(--ok)')&&css.includes('meter::-moz-meter-bar {background:var(--ok)'), 'Meter must use shared green');
assert(css.includes('.tax-unissued,.attention,.out,.buy,.work'), 'Amber badges must share their style');
assert(/#view-stock \.stock-item b \{[^}]*text-align:right;justify-self:end/.test(css), 'Stock quantities must align right');
console.log('PASS: script syntax, linked assets, cache versions, no production fixture injection, shared colors and stock alignment');
