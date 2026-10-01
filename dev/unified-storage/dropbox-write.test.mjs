import test from 'node:test';import assert from 'node:assert/strict';
import {createDropboxBackend} from '../personal-cloud-onboarding/dropbox-backend.mjs';
import {emptyData} from '../personal-cloud-onboarding/core.mjs';
import {DropboxProvider,createStorageRepository,keys} from './storage.mjs';
async function setup({lost=false,reject=0,conflict=false}={}){
 const data=emptyData(),revs=Object.fromEntries(keys.map(k=>[k,1]));let writes=0;
 const metadata=k=>({'.tag':'file',id:'synthetic-'+k,rev:String(revs[k]),path_lower:`/naro biz/data/${k}.json`,path_display:`/NARO Biz/Data/${k}.json`});
 const fetcher=async(url,o)=>{
  const arg=JSON.parse(o.headers['Dropbox-API-Arg']||o.body),key=arg.path?.split('/').pop().replace('.json','');
  if(url.endsWith('get_metadata'))return Response.json(arg.path==='/NARO Biz'?{'.tag':'folder'}:metadata(key));
  if(url.endsWith('list_folder'))return Response.json({entries:keys.map(metadata),has_more:false});
  if(url.endsWith('download'))return Response.json(data[key]);
  if(url.endsWith('upload')){
   writes++;assert.deepEqual(arg.mode,{'.tag':'update',update:String(revs[key])});assert.equal(arg.autorename,false);assert.equal(arg.strict_conflict,true);
   if(conflict)return Response.json({},{status:409});if(reject)return Response.json({},{status:reject});
   data[key]=JSON.parse(o.body);revs[key]++;if(lost)throw Error('synthetic response loss');return Response.json(metadata(key));
  }
  throw Error('Unexpected endpoint');
 };
 const backend=createDropboxBackend({oauth:{authorize:async()=>({accessToken:'synthetic',expiresAt:Date.now()+60000}),close(){}},businessWrite:true,fetcher,locks:{request:async(_n,_o,fn)=>fn({})}});
 const provider=new DropboxProvider(backend);await provider.connect();const repo=createStorageRepository(provider,{businessWrite:true,extendedWrite:true});await repo.loadAll();
 return {repo,backend,data,writes:()=>writes};
}
test('Dropbox same seven-file repository: settings and material use rev-conditional same-file update',async()=>{
 const f=await setup();await f.repo.saveTable('settings',{schema:3,name:'합성 공급자'});
 await f.repo.saveTable('companies',[{id:'c',name:'합성 거래처',type:'매출',prices:[]}]);
 await f.repo.saveTable('material_moves',[{id:'m',company_id:'c',material:'합성 자재',kind:'받음',qty:1,date:'2026-09-29'}]);
 const ids=f.repo.identities().map(i=>i.fileId);await f.repo.loadAll();assert.deepEqual(f.repo.identities().map(i=>i.fileId),ids);assert.equal(f.repo.loadCollection('material_moves').length,1);assert.equal(f.backend.metrics().datasetCreateRequests,0);
});
test('Dropbox response loss locks all writes; recovery never repeats upload',async()=>{
 const f=await setup({lost:true});await assert.rejects(f.repo.saveTable('settings',{schema:3,name:'합성'}),{code:'SAVE_UNCONFIRMED'});
 await assert.rejects(f.repo.loadAll(),{code:'BUSY'});
 await f.repo.saveTable('settings',null,{recover:true});assert.equal(f.writes(),1);assert.equal(f.repo.loadObject('settings').name,'합성');
});
for(const [options,code] of [[{conflict:true},'STORAGE_CONFLICT'],[{reject:429},'RATE_LIMIT'],[{reject:401},'RECONNECT_REQUIRED'],[{reject:507},'QUOTA_LIMIT']])test('Dropbox rejection '+code+' does not overwrite or trigger retry',async()=>{
 const f=await setup(options);await assert.rejects(f.repo.saveTable('settings',{schema:3,name:'합성'}),{code});assert.equal(f.writes(),1);assert.deepEqual(f.data.settings,{schema:3});await assert.rejects(f.repo.saveTable('settings',null,{recover:true}),{code:'STORAGE_INVALID'});
});
