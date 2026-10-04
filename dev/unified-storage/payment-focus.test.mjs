import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./naro-design.js',import.meta.url),'utf8');
const css=await readFile(new URL('./naro-design.css',import.meta.url),'utf8');
const start=source.indexOf(' function paymentFocusMode('),end=source.indexOf('\n paymentFocusMode();',start);
assert(start>=0&&end>start);
function fixture(present=true){
 const events={},view={dataset:{}},document={getElementById:id=>present&&id==='view-payments'?view:null,
  addEventListener:(type,fn,capture)=>{assert.equal(capture,true);events[type]=fn;}};
 vm.runInNewContext(source.slice(start,end)+'\npaymentFocusMode();',{document});
 return {events,view};
}
test('mouse, touch and pen focus remains suppressed through dialog focus restoration',()=>{
 for(const pointerType of ['mouse','touch','pen']){
  const {events,view}=fixture();events.pointerdown({pointerType});
  assert.equal(view.dataset.ndPayInput,'pointer');
  // A close/focus event does not clear pointer modality or blur the returning row.
  assert.deepEqual(Object.keys(events).sort(),['keydown','pointerdown']);
  events.keydown({key:'Shift'});assert.equal(view.dataset.ndPayInput,'pointer');
 }
});
test('keyboard navigation and activation restore focus indication even on touch devices',()=>{
 for(const key of ['Tab','Enter',' ','Escape','ArrowDown']){
  const {events,view}=fixture();events.pointerdown({pointerType:'touch'});
  events.keydown({key});assert.equal(view.dataset.ndPayInput,undefined);
  events.pointerdown({pointerType:'mouse'});assert.equal(view.dataset.ndPayInput,'pointer');
 }
 const {events}=fixture(false);assert.doesNotThrow(()=>{events.pointerdown({});events.keydown({key:'Tab'});});
});
test('CSS suppresses only pointer-focused payment rows while retaining focus-visible style',()=>{
 assert.match(css,/#view-payments #payTbl tbody tr\[data-nd-pay\]:focus-visible\{outline:2px solid var\(--nd-blue\)/);
 assert.match(css,/#view-payments\[data-nd-pay-input="pointer"\] #payTbl tbody tr\[data-nd-pay\]:focus\{outline:none\}/);
 assert.doesNotMatch(source.slice(start,end),/\.blur\(|\.focus\(|localStorage|sessionStorage|fetch\(|preventDefault|stopPropagation/);
});
