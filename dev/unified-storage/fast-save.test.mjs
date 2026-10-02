// 빠른 저장(왕복 1번): 조건부 저장 + 응답 확인값(Dropbox content_hash / Drive md5Checksum).
// 확인값이 없거나 다르면 예전처럼 다시 읽고, 그 사이 다른 기기가 바꿨으면 덮어쓰지 않는다.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createDropboxBackend,dropboxContentHash} from '../personal-cloud-onboarding/dropbox-backend.mjs';
import {createGoogleBackend,md5Hex} from '../personal-cloud-onboarding/google-backend.mjs';
import {emptyData,folders} from '../personal-cloud-onboarding/core.mjs';
import {DropboxProvider,GoogleDriveProvider,createStorageRepository,keys,datasetPath} from './storage.mjs';
const company={id:'c1',name:'합성 거래처',type:'매출',prices:[]};
const dbxHash=text=>{const b=Buffer.from(text,'utf8'),parts=[];for(let i=0;i<b.length;i+=4194304)parts.push(createHash('sha256').update(b.subarray(i,i+4194304)).digest());return createHash('sha256').update(Buffer.concat(parts)).digest('hex');};

test('Dropbox content_hash와 MD5 계산이 표준과 같다',async()=>{
 for(const t of ['{}',JSON.stringify([company]),'한글 '.repeat(5000)]){assert.equal(await dropboxContentHash(new TextEncoder().encode(t)),dbxHash(t));assert.equal(md5Hex(t),createHash('md5').update(t,'utf8').digest('hex'));}
});

async function dropbox({hash='ok'}={}){
 const data=emptyData(),revs=Object.fromEntries(keys.map(k=>[k,1]));const calls=[];
 const metadata=k=>({'.tag':'file',id:'syn-'+k,rev:'r'+revs[k],path_lower:`/naro biz/data/${k}.json`,path_display:`/NARO Biz/Data/${k}.json`});
 const fetcher=async(url,o)=>{
  const arg=JSON.parse(o.headers['Dropbox-API-Arg']||o.body),key=arg.path?.split('/').pop().replace('.json','');calls.push(url.split('/').pop());
  if(url.endsWith('get_metadata'))return Response.json(arg.path==='/NARO Biz'?{'.tag':'folder'}:metadata(key));
  if(url.endsWith('list_folder'))return Response.json({entries:keys.map(metadata),has_more:false});
  if(url.endsWith('download'))return Response.json(data[key]);
  if(url.endsWith('upload')){
   if(arg.mode.update!==metadata(key).rev)return Response.json({error:{'.tag':'path',path:{reason:{'.tag':'conflict'}}}},{status:409});
   data[key]=JSON.parse(o.body);revs[key]++;
   return Response.json({...metadata(key),content_hash:hash==='ok'?dbxHash(o.body):hash==='bad'?'0'.repeat(64):undefined});
  }
  throw Error('unexpected');
 };
 const backend=createDropboxBackend({oauth:{authorize:async()=>({accessToken:'syn',expiresAt:Date.now()+60000}),close(){}},businessWrite:true,fetcher,locks:{request:async(_n,_o,fn)=>fn({})}});
 const provider=new DropboxProvider(backend);await provider.connect();const repo=createStorageRepository(provider,{businessWrite:true,extendedWrite:true});await repo.loadAll();calls.length=0;
 return {repo,data,calls,revs};
}
test('Dropbox: 저장 1번 = 요청 1번(올리기), 이어서 저장해도 1번씩, 다시 불러와도 같다',async()=>{
 const f=await dropbox();
 await f.repo.saveTable('companies',[company]);assert.deepEqual(f.calls,['upload']);
 await f.repo.saveTable('companies',[{...company,name:'수정'}]);assert.deepEqual(f.calls,['upload','upload']);
 assert.equal(f.repo.identities().find(i=>i.logicalKey==='companies').revision,'r3');
 await f.repo.loadAll();assert.equal(f.repo.loadCollection('companies')[0].name,'수정');
});
test('Dropbox: 확인값이 없거나 다르면 예전처럼 다시 읽어 확인한다',async()=>{
 const missing=await dropbox({hash:'none'});await missing.repo.saveTable('companies',[company]);assert.deepEqual(missing.calls,['upload','download','get_metadata']);
 const bad=await dropbox({hash:'bad'});await bad.repo.saveTable('companies',[company]);assert.deepEqual(bad.calls,['upload','download','get_metadata']);
});
test('Dropbox: 그 사이 다른 기기가 바꿨으면 덮어쓰지 않는다',async()=>{
 const f=await dropbox();f.revs.companies=9;f.data.companies=[{...company,name:'다른 기기'}];
 await assert.rejects(f.repo.saveTable('companies',[company]),{code:'STORAGE_CONFLICT'});assert.equal(f.data.companies[0].name,'다른 기기');
});

async function drive({md5='ok'}={}){
 const data=emptyData(),paths=[...folders,...keys.map(datasetPath)],calls=[];
 const nodes=paths.map((path,i)=>({id:'syn-'+i,name:path.split('/').pop(),mimeType:folders.includes(path)?'application/vnd.google-apps.folder':'application/json',appProperties:{naroPersonalCloud:'1'},parents:[path.includes('/')?'syn-'+paths.indexOf(path.slice(0,path.lastIndexOf('/'))):'root'],version:'1',etag:'"e1"',trashed:false}));
 const fetcher=async(url,o)=>{
  const u=new URL(url);let body;
  if(u.pathname.endsWith('/files')){const q=u.searchParams.get('q');body={files:nodes.filter(n=>(!q.includes(' in parents')||q.includes("'"+n.parents[0]+"' in parents"))&&q.includes("name = '"+n.name+"'")&&!n.trashed)};return new Response(JSON.stringify(body));}
  const n=nodes.find(n=>u.pathname.endsWith('/'+n.id)),key=n.name.replace('.json','');
  if(o.method==='PUT'){calls.push('PUT');
   if(o.headers['If-Match']!==n.etag)return new Response('{}',{status:412});
   data[key]=JSON.parse(o.body);n.version=String(+n.version+1);n.etag=`"e${n.version}"`;
   body={id:n.id,version:n.version,etag:n.etag,headRevisionId:'h'+n.version,md5Checksum:md5==='ok'?createHash('md5').update(o.body).digest('hex'):md5==='bad'?'0'.repeat(32):undefined};
  }else if(u.pathname.startsWith('/drive/v2/')){calls.push('validator');body={id:n.id,version:n.version,etag:n.etag};}
  else if(u.searchParams.get('alt')==='media'){calls.push('content');body=data[key];}
  else{calls.push('identity');body=n;}
  return new Response(JSON.stringify(body));
 };
 const backend=createGoogleBackend({readOnly:true,businessWrite:true,extendedWrite:true,fetcher,locks:{request:async(_k,_o,fn)=>fn({})},oauth:{authorize:async()=>({accessToken:'syn',expiresAt:Date.now()+60000}),close(){}}});
 const provider=new GoogleDriveProvider(backend);await provider.connect();const repo=createStorageRepository(provider,{businessWrite:true,extendedWrite:true});await repo.loadAll();calls.length=0;
 return {repo,data,calls,node:k=>nodes.find(n=>n.name===k+'.json')};
}
test('Drive: 첫 저장은 예전 방식, 그다음부터는 요청 1번(PUT)',async()=>{
 const f=await drive();
 await f.repo.saveTable('companies',[company]);assert.deepEqual(f.calls,['identity','content','validator','PUT','content','identity']);
 f.calls.length=0;await f.repo.saveTable('companies',[{...company,name:'수정'}]);assert.deepEqual(f.calls,['PUT']);
 f.calls.length=0;await f.repo.saveTable('companies',[{...company,name:'또 수정'}]);assert.deepEqual(f.calls,['PUT']);
 const id=f.repo.identities().find(i=>i.logicalKey==='companies');assert.equal(id.revision,'4');
 await f.repo.loadAll();assert.equal(f.repo.loadCollection('companies')[0].name,'또 수정');
});
test('Drive: md5가 없거나 다르면 다시 읽어 확인',async()=>{
 for(const md5 of ['none','bad']){const f=await drive({md5});await f.repo.saveTable('companies',[company]);f.calls.length=0;
  await f.repo.saveTable('companies',[{...company,name:'수정'}]);assert.deepEqual(f.calls,['PUT','content','identity']);}
});
test('Drive: 다른 기기가 바꿨으면 412 → 예전 방식으로 다시 확인 → 덮어쓰지 않음',async()=>{
 const f=await drive();await f.repo.saveTable('companies',[company]);
 const n=f.node('companies');n.version='9';n.etag='"e9"';f.data.companies=[{...company,name:'다른 기기'}];f.calls.length=0;
 await assert.rejects(f.repo.saveTable('companies',[{...company,name:'수정'}]),{code:'STORAGE_CONFLICT'});
 assert.equal(f.data.companies[0].name,'다른 기기');assert.deepEqual(f.calls,['PUT','identity','content']);
});
test('Drive: 내용은 그대로인데 ETag만 바뀌었으면(412) 예전 방식으로 다시 확인해 저장',async()=>{
 const f=await drive();await f.repo.saveTable('companies',[company]);
 f.node('companies').etag='"meta-only"';f.calls.length=0;
 await f.repo.saveTable('companies',[{...company,name:'수정'}]);assert.equal(f.data.companies[0].name,'수정');
 assert.deepEqual(f.calls,['PUT','identity','content','validator','PUT','content','identity']);
});
