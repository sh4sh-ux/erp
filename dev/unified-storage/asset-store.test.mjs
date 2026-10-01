import test from 'node:test';import assert from 'node:assert/strict';
import {createAssetStore,assetPath,validateAssetPath,pngDigest} from '../personal-cloud-onboarding/asset-store.mjs';
import {validateExtendedChange} from '../personal-cloud-onboarding/extended-contract.mjs';
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
function fixture(provider,{loss=false,quota=false,corrupt=false}={}){
 const files=new Map();let writes=0,reads=0;
 const fetcher=async(url,options)=>{
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-'+provider);
  if(quota)return json({},429);
  if(url.includes('generateIds'))return json({ids:['synthetic-asset-id']});
  if(url.includes('/upload/drive/')){writes++;const raw=await options.body.arrayBuffer();assert.ok(raw.byteLength>png.length);files.set('synthetic-asset-id',png);if(loss)throw Error();return json({id:'synthetic-asset-id'});}
  if(url.includes('/drive/v3/files?'))return json({files:files.size?[{id:'synthetic-asset-id',mimeType:'image/png',appProperties:{naroPersonalCloud:'1'}}]:[]});
  if(url.includes('/drive/v3/files/synthetic-asset-id')){reads++;return new Response(corrupt?new Uint8Array([1]):png);}
  const arg=options.headers['Dropbox-API-Arg']?JSON.parse(options.headers['Dropbox-API-Arg']):JSON.parse(options.body);
  if(url.endsWith('/get_metadata'))return files.has(arg.path)?json({'.tag':'file',id:'synthetic-file',rev:'1',path_lower:arg.path.toLowerCase()}):json({error:{'.tag':'path',path:{'.tag':'not_found'}}},409);
  if(url.endsWith('/upload')){assert.equal(arg.mode,'add');assert.equal(arg.autorename,false);writes++;files.set(arg.path,options.body);if(loss)throw Error();return json({id:'synthetic-file'});}
  if(url.endsWith('/download')){reads++;return new Response(corrupt?new Uint8Array([1]):files.get(arg.path));}
  throw Error('Unexpected request');
 };
 const store=createAssetStore({provider,auth:()=> 'synthetic-'+provider,folderId:()=> 'synthetic-folder',fetcher,enabled:true});return {store,files,get writes(){return writes;},get reads(){return reads;}};
}
for(const provider of ['drive','dropbox']){
 test(provider+' private PNG immutable reuse, read-back and one create',async()=>{
  const f=fixture(provider),result=await f.store.upload('card',png);assert.equal(result.path,assetPath('card',await pngDigest(png)));assert.equal(f.writes,1);
  await f.store.upload('card',png);assert.equal(f.writes,1);assert.deepEqual(await f.store.download(result.path),png);
 });
 test(provider+' lost reply reconciles existing content without duplicate POST',async()=>{
  const f=fixture(provider,{loss:true});await assert.rejects(f.store.upload('card',png),{code:'SAVE_UNCONFIRMED'});await f.store.upload('card',png);assert.equal(f.writes,1);
 });
 test(provider+' quota and corrupt readback fail closed',async()=>{
  const quota=fixture(provider,{quota:true});await assert.rejects(quota.store.upload('card',png),{code:'QUOTA_LIMIT'});assert.equal(quota.writes,0);
  const corrupt=fixture(provider,{corrupt:true});await assert.rejects(corrupt.store.upload('card',png));assert.equal(corrupt.writes,1);
 });
}
test('private paths, non-raster and disabled feature rejected',async()=>{
 for(const path of ['https://example.test/a.png','NARO Biz/Images/Products/../x','/other'])assert.throws(()=>validateAssetPath(path));
 await assert.rejects(pngDigest(new TextEncoder().encode('<svg/>')),{code:'VALIDATION'});
 const store=createAssetStore({enabled:false});await assert.rejects(store.upload('card',png),{code:'WRITE_BLOCKED'});
});
test('asset references remain optional schema 3, public/malformed references rejected',async()=>{
 const path=assetPath('card',await pngDigest(png));assert.equal(validateExtendedChange('settings',{schema:3},{schema:3,assets:{card:path}},{}).schema,3);
 assert.throws(()=>validateExtendedChange('settings',{schema:3},{schema:3,assets:{card:'https://example.test/private.png'}},{}));
});
test('different active provider sessions do not reuse another session files',async()=>{
 const a=fixture('dropbox'),b=fixture('dropbox');const {path}=await a.store.upload('card',png);await assert.rejects(b.store.download(path),{code:'STORAGE_INVALID'});assert.equal(b.writes,0);
});
