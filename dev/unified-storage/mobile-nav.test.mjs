import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const css=await readFile(new URL('./naro-design.css',import.meta.url),'utf8');
test('menu select chevron has an explicit inset and reserved text space on mobile browsers',()=>{
 const rule=css.match(/\.nd-mn-row select\{([^}]+)\}/)?.[1];assert.ok(rule);
 for(const declaration of ['-webkit-appearance:none','appearance:none','padding:0 40px 0 12px','background-position:right 12px center','background-size:16px','height:44px'])assert.ok(rule.includes(declaration),declaration);
});
const start=source.indexOf(' function mobileNavModel()'),end=source.indexOf('\n let mobileNavController=',start);
assert(start>=0&&end>start);
const context=vm.createContext({});vm.runInContext(source.slice(start,end)+'\nglobalThis.model=mobileNavModel();',context);
const model=context.model,plain=v=>JSON.parse(JSON.stringify(v));
test('only three unique allowed middle tabs, never home or more or injected labels',()=>{
 for(const input of [null,{},'',[],['dash','more','__proto__'],['items','items','stock','companies'],['<script>','payments',5]]){
  const result=plain(model.normalize(input));assert.equal(result.length,3);assert.equal(new Set(result).size,3);
  assert(result.every(v=>Object.hasOwn(model.labels,v)));
 }
 assert.deepEqual(plain(model.normalize(['companies','items','stock'])),['companies','items','stock']);
});
test('selecting an existing menu cannot duplicate it or silently reorder other slots',()=>{
 const input=['quotes','payments','materials'];
 assert.deepEqual(plain(model.assign(input,0,'materials')),input);
 assert.deepEqual(plain(model.assign(input,1,'companies')),['quotes','companies','materials']);
 assert.deepEqual(input,['quotes','payments','materials']);
 assert.deepEqual(plain(model.assign(input,8,'companies')),input);
});
test('all replacement and move combinations preserve uniqueness and unrelated slots',()=>{
 const values=Object.keys(model.labels);
 for(const a of values)for(const b of values)for(const c of values){
  if(new Set([a,b,c]).size!==3)continue;
  const slots=[a,b,c];
  for(let i=0;i<3;i++)for(const value of values){const next=plain(model.assign(slots,i,value));assert.equal(new Set(next).size,3);for(let j=0;j<3;j++)if(i!==j)assert.equal(next[j],slots[j]);}
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const next=plain(model.move(slots,i,j));assert.equal(next[j],slots[i]);assert.deepEqual([...next].sort(),[...slots].sort());}
 }
});
test('native picker nodes stay mounted and changes never refocus or reopen a select',()=>{
 const render=source.slice(source.indexOf('  const renderDraft='),source.indexOf('  edit.onclick='));
 assert.match(render,/if\(!list.children.length\)list.innerHTML=/);
 assert.match(render,/option.disabled=option.value!==draft\[i\]&&draft.includes\(option.value\)/);
 assert.doesNotMatch(render,/\.focus\(|replaceWith|outerHTML\s*=/);
 const changeStart=source.indexOf("dialog.addEventListener('change'");
 const change=source.slice(changeStart,source.indexOf('\n',changeStart));
 assert.doesNotMatch(change,/\.focus\(|showPicker|showModal|innerHTML/);
 assert.match(css,/\[data-mn-pointer="true"\] button:focus\{outline:none;box-shadow:none\}/);
 assert.match(css,/\.nd-mobile-nav-dialog button:focus-visible\{outline:2px solid/);
 assert.match(source,/delete dialog.dataset.mnPointer/);
 assert.doesNotMatch(css,/\.nd-mn-target\{outline:/);
});
test('move supports arrow actions with boundaries',()=>{
 const input=['quotes','payments','materials'];
 assert.deepEqual(plain(model.move(input,0,2)),['payments','materials','quotes']);
 assert.deepEqual(plain(model.move(input,2,0)),['materials','quotes','payments']);
 for(const [from,to] of [[0,-1],[2,3],[NaN,1]])assert.deepEqual(plain(model.move(input,from,to)),input);
 assert.deepEqual(input,['quotes','payments','materials']);
});
test('dedicated versioned local key only; corrupt and blocked storage safely fall back',()=>{
 const map=new Map([['business-data','unchanged']]),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 assert.deepEqual(plain(model.read(storage)),plain(model.defaults));
 assert.equal(model.write(storage,['companies','stock','items']),true);
 assert.deepEqual(plain(model.read(storage)),['companies','stock','items']);
 assert.equal(map.get('business-data'),'unchanged');assert.equal(map.size,2);
 for(const raw of ['{bad','null','{"version":99,"slots":["items"]}']){map.set(model.key,raw);assert.deepEqual(plain(model.read(storage)),plain(model.defaults));}
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.deepEqual(plain(model.read(blocked)),plain(model.defaults));assert.equal(model.write(blocked,['stock']),false);
});
test('presentation integration preserves existing navigation handlers and business write boundary',()=>{
 const code=source.slice(end,source.indexOf(' /* 업체 제공 자재',end));
 assert.doesNotMatch(code,/Table\.|StorageRepository|db\.|fetch\(|postMessage|\.onclick\s*=\s*.*switchView/);
 assert.match(code,/slots=\[\.\.\.draft\];sync\(\);dialog.close\(\)/);
 assert.match(code,/!slots.includes\(view\)/);
 assert.match(code,/data-move/);assert.match(code,/storage/);
 assert.match(source,/const COMPANY_ICON='<path d="M6 22V4/);
 assert.match(source,/companies:COMPANY_ICON/);
});
test('editor uses only arrow controls without drag handles, pointer capture or drag highlights',()=>{
 const code=source.slice(end,source.indexOf(' /* 업체 제공 자재',end));
 assert.doesNotMatch(code,/nd-mn-handle|clearDrag|setPointerCapture|pointermove|pointerup|손잡이/);
 assert.doesNotMatch(css,/nd-mn-handle|nd-mn-dragging|nd-mn-target/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 44px 44px/);
 assert.match(code,/오른쪽 위·아래 화살표/);
});
