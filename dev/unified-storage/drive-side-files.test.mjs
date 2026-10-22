// Google Drive 선택 파일(10/22): 매입 파일 · 변경 기록 — Dropbox와 같은 약속(없으면 '시작 전', 조건부 저장, 끊겨도 두 번 만들지 않음).
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createGoogleBackend} from '../personal-cloud-onboarding/google-backend.mjs';
import {createDropboxBackend} from '../personal-cloud-onboarding/dropbox-backend.mjs';
import {backendFeatures,BACKEND_FEATURES} from '../personal-cloud-onboarding/backend-contract.mjs';
import {emptyData,folders} from '../personal-cloud-onboarding/core.mjs';
import {GoogleDriveProvider,createStorageRepository,keys,datasetPath} from './storage.mjs';
import {base,domestic,doc} from './purchase-fixtures.mjs';

// 가짜 Drive: 폴더·파일 목록, id 미리 받기, 새로 만들기(POST), 내용, v2 확인값(ETag), 조건부 덮어쓰기(PUT If-Match).
async function drive({lostCreate=false}={}){
 const seed={...emptyData(),...base()},paths=[...folders,...keys.map(datasetPath)],content=new Map(),calls=[];let gen=0;
 const nodes=paths.map((path,i)=>({id:'syn-'+i,name:path.split('/').pop(),mimeType:folders.includes(path)?'application/vnd.google-apps.folder':'application/json',appProperties:{naroPersonalCloud:'1'},parents:[path.includes('/')?'syn-'+paths.indexOf(path.slice(0,path.lastIndexOf('/'))):'root'],version:'1',etag:'"e1"',trashed:false}));
 keys.forEach(k=>content.set(nodes[paths.indexOf(datasetPath(k))].id,seed[k]));
 const make=(meta,value)=>{if(nodes.some(n=>n.id===meta.id))return null;const n={...meta,version:'1',etag:'"e1"',trashed:false};nodes.push(n);if(value!==undefined)content.set(n.id,value);return n;};
 const fetcher=async(url,o)=>{
  const u=new URL(url),method=o.method||'GET';
  if(u.pathname.endsWith('/files/generateIds')){calls.push('generateIds');return Response.json({ids:['gen-'+(++gen)]});}
  if(method==='POST'){
   let meta,value;
   if(u.searchParams.get('uploadType')==='multipart'){const parts=o.body.split('--naro_bootstrap_boundary');meta=JSON.parse(parts[1].split('\r\n\r\n')[1]);value=JSON.parse(parts[2].split('\r\n\r\n')[1]);}
   else meta=JSON.parse(o.body);
   calls.push('create:'+meta.name);const n=make(meta,value);if(!n)return new Response('{}',{status:409});
   if(lostCreate){lostCreate=false;throw TypeError('lost reply');}
   return Response.json({id:n.id});
  }
  if(u.pathname.endsWith('/files')){const q=u.searchParams.get('q');
   return Response.json({files:nodes.filter(n=>!n.trashed&&q.includes("name = '"+n.name+"'")&&(!q.includes(' in parents')||q.includes("'"+n.parents[0]+"' in parents")))});}
  const n=nodes.find(x=>u.pathname.endsWith('/'+x.id));if(!n)return new Response('{}',{status:404});
  if(method==='PUT'){calls.push('PUT:'+n.name);if(o.headers['If-Match']!==n.etag)return new Response('{}',{status:412});
   content.set(n.id,JSON.parse(o.body));n.version=String(+n.version+1);n.etag=`"e${n.version}"`;
   return Response.json({id:n.id,version:n.version,etag:n.etag,headRevisionId:'h'+n.version,md5Checksum:createHash('md5').update(o.body).digest('hex')});}
  if(u.pathname.startsWith('/drive/v2/'))return Response.json({id:n.id,version:n.version,etag:n.etag});
  if(u.searchParams.get('alt')==='media')return Response.json(content.get(n.id));
  return Response.json(n);
 };
 const backend=createGoogleBackend({readOnly:true,businessWrite:true,extendedWrite:true,fetcher,locks:{request:async(_k,_o,fn)=>fn({})},oauth:{authorize:async()=>({accessToken:'syn',expiresAt:Date.now()+60000}),close(){}}});
 const provider=new GoogleDriveProvider(backend);await provider.connect();
 const repo=createStorageRepository(provider,{businessWrite:true,extendedWrite:true});await repo.loadAll();calls.length=0;
 const find=name=>nodes.filter(n=>n.name===name&&!n.trashed);
 return {repo,backend,calls,content,find,
  // 다른 기기가 매입 파일을 바꾼 것처럼
  touch(name,value){const n=find(name)[0];content.set(n.id,value);n.version=String(+n.version+1);n.etag=`"e${n.version}"`;}};
}

test('백엔드 약속: Dropbox와 Google Drive가 같은 기능 묶음(연결·저장·매입·변경 기록·사진)을 모두 갖춘다',()=>{
 const oauth={authorize:async()=>({}),close(){}};
 const g=backendFeatures(createGoogleBackend({oauth,fetcher:async()=>{throw Error('no network');}}));
 const d=backendFeatures(createDropboxBackend({oauth,fetcher:async()=>{throw Error('no network');}}));
 for(const name of Object.keys(BACKEND_FEATURES)){assert.equal(g[name],true,'Drive '+name);assert.equal(d[name],true,'Dropbox '+name);}
});

test('Drive 매입: 없으면 시작 전 → [매입 시작하기]로 빈 파일 → 저장 → 다시 불러와도 같다',async()=>{
 const f=await drive();
 assert.equal((await f.repo.loadPurchases()).status,'absent');
 assert.equal((await f.repo.startPurchases()).status,'ready');
 assert.equal(f.find('purchases.json').length,1);
 await f.repo.savePurchases(doc([domestic()]));
 assert.ok(f.calls.some(c=>c==='PUT:purchases.json'),'조건부 덮어쓰기(PUT If-Match)로 저장');
 await f.repo.loadAll();const st=await f.repo.loadPurchases();
 assert.equal(st.status,'ready');assert.deepEqual(f.repo.loadPurchasesDoc().rows.map(p=>p.id),['p1']);
 // 백엔드에 다시 만들라고 해도 이미 있으면 그대로 쓴다(덮지 않음)
 const again=await f.backend.createPurchases(doc([]));assert.equal(again.created,false);assert.deepEqual(again.value.rows.map(p=>p.id),['p1']);assert.equal(f.find('purchases.json').length,1);
});

test('Drive 매입: 다른 기기가 그 사이 바꿨으면 덮어쓰지 않는다(412 → 다시 확인 → 거절)',async()=>{
 const f=await drive();await f.repo.loadPurchases();await f.repo.startPurchases();await f.repo.savePurchases(doc([domestic()]));
 const theirs=doc([domestic({id:'p9',no:'PO-2026-1010-9'})]);f.touch('purchases.json',theirs);
 await assert.rejects(f.repo.savePurchases(doc([domestic(),domestic({id:'p2',no:'PO-2026-1010-2'})])),e=>e.code==='STORAGE_CONFLICT');
 assert.deepEqual(f.content.get(f.find('purchases.json')[0].id).rows.map(p=>p.id),['p9'],'다른 기기 내용 그대로');
});

test('Drive 매입: 만들기 응답을 못 받아도 다시 찾아 확인하고 두 번 만들지 않는다',async()=>{
 const f=await drive({lostCreate:true});await f.repo.loadPurchases();
 assert.equal((await f.repo.startPurchases()).status,'ready');
 assert.equal(f.find('purchases.json').length,1);
 assert.equal(f.calls.filter(c=>c==='create:purchases.json').length,1,'만들기 요청은 한 번만');
});

test('Drive 변경 기록: 첫 줄은 Logs 폴더·그 달 파일을 만들고, 이어서 더하고, 같은 id는 한 번만',async()=>{
 const f=await drive();
 assert.deepEqual(await f.repo.readLog('2026-10'),[],'없으면 빈 목록(만들지 않음)');
 assert.equal(f.find('Logs').length,0);
 const e1={id:'log1',at:'2026-10-22T01:00:00.000Z',kind:'quotes',text:'합성 기록 1'},e2={...e1,id:'log2',text:'합성 기록 2'};
 await f.repo.appendLog(e1);await f.repo.appendLog(e2);await f.repo.appendLog(e1);
 assert.equal(f.find('Logs').length,1);assert.equal(f.find('2026-10.json').length,1);
 assert.deepEqual((await f.repo.readLog('2026-10')).map(r=>r.id),['log1','log2']);
 await assert.rejects(f.repo.appendLog({id:'x',at:'nope'}),e=>e.code==='VALIDATION');
});

test('Drive 변경 기록: 다른 기기가 같은 달 파일에 먼저 썼으면 다시 읽어 더한다(덮어쓰지 않음)',async()=>{
 const f=await drive();const e1={id:'log1',at:'2026-10-22T01:00:00.000Z',text:'1'};
 await f.repo.appendLog(e1);
 f.touch('2026-10.json',[e1,{id:'other',at:'2026-10-22T02:00:00.000Z',text:'다른 기기'}]);
 // 다음 더하기는 최신 확인값으로 다시 읽어 붙인다
 await f.repo.appendLog({id:'log3',at:'2026-10-22T03:00:00.000Z',text:'3'});
 assert.deepEqual((await f.repo.readLog('2026-10')).map(r=>r.id),['log1','other','log3']);
});
