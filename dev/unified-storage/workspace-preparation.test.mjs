import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWorkspace,openWorkspace,closeWorkspace} from './business-workspace.mjs';

function fixture(){
 const saved=Object.fromEntries(['window','document','location','MessageChannel'].map(k=>[k,globalThis[k]]));
 const listeners=new Set(),frames=[],sent=[],main={hidden:false};
 globalThis.location={origin:'https://synthetic.invalid'};
 globalThis.window={addEventListener:(_t,fn)=>listeners.add(fn),removeEventListener:(_t,fn)=>listeners.delete(fn)};
 globalThis.document={title:'',documentElement:{dataset:{}},querySelector:()=>main,body:{append:f=>frames.push(f)},createElement:()=>({style:{},setAttribute(){},removeAttribute(){},remove(){this.removed=true;},contentWindow:{postMessage:m=>sent.push(m)}})};
 globalThis.MessageChannel=class{constructor(){this.port1={close(){}};this.port2={};}};
 const signal=(target,origin=location.origin)=>{for(const fn of [...listeners])fn({origin,source:target.contentWindow,data:{type:'NARO_READ_READY'}});};
 const repo={identities:()=>[{provider:'drive'}]};
 return {frames,sent,signal,repo,main,cleanup(){closeWorkspace();for(const [k,v]of Object.entries(saved)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
test('preparation sends no data; authenticated ready frame is reused once on open',()=>{
 const f=fixture();try{
  prepareWorkspace();prepareWorkspace();assert.equal(f.frames.length,1);const target=f.frames[0];assert.equal(target.hidden,true);assert.equal(f.main.hidden,false);
  f.signal(target);assert.equal(f.sent.length,0);
  const data={settings:{schema:3}};openWorkspace(data,()=>{},f.repo);
  assert.equal(f.frames.length,1);assert.equal(target.hidden,false);assert.equal(target.removed,undefined);assert.equal(f.sent.length,1);assert.equal(f.sent[0].data,data);
  f.signal(target);assert.equal(f.sent.length,1);
 }finally{f.cleanup();}
});
test('cold or unfinished frame waits for trusted ready before handing over data',()=>{
 const f=fixture();try{
  prepareWorkspace();const target=f.frames[0];f.signal(target,'https://wrong.invalid');
  openWorkspace({},()=>{},f.repo);assert.equal(f.sent.length,0);
  f.signal(target,'https://wrong.invalid');assert.equal(f.sent.length,0);
  f.signal(target);assert.equal(f.sent.length,1);
 }finally{f.cleanup();}
});
test('logout discards prepared frame and ignores stale ready messages',()=>{
 const f=fixture();try{
  prepareWorkspace();const stale=f.frames[0];closeWorkspace();f.signal(stale);assert.equal(stale.removed,true);assert.equal(f.sent.length,0);
  openWorkspace({},()=>{},f.repo);f.signal(stale);assert.equal(f.sent.length,0);f.signal(f.frames[1]);assert.equal(f.sent.length,1);
 }finally{f.cleanup();}
});
