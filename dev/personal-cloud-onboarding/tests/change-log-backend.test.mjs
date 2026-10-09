// Dropbox 변경 기록 파일: 달마다 하나, 없으면 새로(add), 있으면 rev 조건으로 덧붙이고, 같은 기록은 두 번 넣지 않는다. 데이터 파일 목록과 섞이지 않는다.
import test from 'node:test';import assert from 'node:assert/strict';
import {createDropboxBackend} from '../dropbox-backend.mjs';
const res=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('기록 덧붙이기·읽기',async()=>{
 let file=null,rev=0;const calls=[];
 const fetcher=async(url,o)=>{const arg=JSON.parse(o.headers['Dropbox-API-Arg']||o.body||'{}');calls.push([url.split('/').pop(),arg.path,arg.mode?.['.tag']]);
  if(url.endsWith('get_metadata'))return file?res({'.tag':'file',rev:'r'+rev}):res({error:{'.tag':'path',path:{'.tag':'not_found'}}},409);
  if(url.endsWith('download'))return res(file);
  if(url.endsWith('upload')){if(arg.mode['.tag']==='update'&&arg.mode.update!=='r'+rev)return res({error:{'.tag':'path'}},409);file=JSON.parse(o.body);rev++;return res({rev:'r'+rev});}
  throw Error(url);};
 const b=createDropboxBackend({oauth:{authorize:async()=>({accessToken:'t',expiresAt:Date.now()+3600e3}),close(){}},fetcher,businessWrite:true,locks:null});
 await b.connect();
 assert.deepEqual(await b.readLog('2026-10'),[]);
 const e1={id:'a',at:'2026-10-09T01:00:00.000Z',key:'quotes',action:'수정',label:'x',changes:[]};
 await b.appendLog(e1);await b.appendLog({...e1,id:'b'});await b.appendLog(e1);
 assert.deepEqual((await b.readLog('2026-10')).map(r=>r.id),['a','b']);
 assert.ok(calls.every(c=>!c[1]||c[1]==='/NARO Biz/Logs/2026-10.json'));
 assert.deepEqual(calls.filter(c=>c[0]==='upload').map(c=>c[2]),['add','update']);
 await assert.rejects(b.readLog('../x'),{code:'VALIDATION'});
});
