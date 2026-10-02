import {fault,folders,tables,boundedRead} from './core.mjs';
import {canonical} from './company-contract.mjs';
import {createAssetStore} from './asset-store.mjs';
const paths=new Set([...tables,'settings'].map(k=>`NARO Biz/Data/${k}.json`));
const api='https://api.dropboxapi.com/2/files/';
const content='https://content.dropboxapi.com/2/files/';
// Dropbox content_hash: 4MB 블록마다 SHA-256, 이어 붙여 다시 SHA-256 (hex). 저장 응답과 비교해 다시 내려받지 않고 확인한다.
export async function dropboxContentHash(bytes,subtle=globalThis.crypto?.subtle){
 if(!subtle)return null;const BLOCK=4194304,parts=[];
 for(let i=0;i<bytes.length;i+=BLOCK)parts.push(new Uint8Array(await subtle.digest('SHA-256',bytes.subarray(i,i+BLOCK))));
 const all=new Uint8Array(parts.length*32);parts.forEach((p,i)=>all.set(p,i*32));
 return [...new Uint8Array(await subtle.digest('SHA-256',all))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function createDropboxBackend({oauth,signal,fetcher=fetch,now=Date.now,businessWrite=false,locks=globalThis.navigator?.locks,subtle=globalThis.crypto?.subtle}){
 let token=null,expires=0,disposed=false,prepared=false;
 let windowStart=now(),requests=0;
 const metrics={readRequests:0,datasetCreateRequests:0,businessWriteRequests:0,blockedWrites:0};
 const check=()=>{if(disposed||signal?.aborted)throw fault('CANCELLED');if(!token||now()>=expires)throw fault('RECONNECT_REQUIRED');};
 const assets=createAssetStore({provider:'dropbox',auth:()=>{check();return token;},fetcher,signal,enabled:businessWrite,now});
 const pathArg=path=>{if(!paths.has(path)&&!folders.includes(path))throw fault('WRITE_BLOCKED');return '/'+path;};
 async function request(url,arg,{upload,download=false,allowMissing=false,onDispatch}={}){
  check();let response;
  if(now()-windowStart>=60000){windowStart=now();requests=0;}if(++requests>120)throw fault('QUOTA_LIMIT');
  if(upload!==undefined){metrics.businessWriteRequests++;if(arg.mode==='add')metrics.datasetCreateRequests++;}else metrics.readRequests++;
  const headers={Authorization:'Bearer '+token};
  if(upload!==undefined||download){headers['Dropbox-API-Arg']=JSON.stringify(arg);if(upload!==undefined)headers['Content-Type']='application/octet-stream';}
  else headers['Content-Type']='application/json';
  try{onDispatch?.();response=await fetcher(url,{method:'POST',headers,body:upload!==undefined?JSON.stringify(upload):download?undefined:JSON.stringify(arg),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal});}
  catch{throw fault(signal?.aborted?'CANCELLED':'NETWORK_ERROR');}
  check();
  if(!response.ok){
   let data;try{data=await response.json();}catch{}
   const error=data?.error;
   if(allowMissing&&response.status===409&&error?.['.tag']==='path'&&error.path?.['.tag']==='not_found')return null;
   const code=response.status===401?'RECONNECT_REQUIRED':response.status===429?'RATE_LIMIT':response.status===507||error?.['.tag']==='insufficient_space'||error?.reason?.['.tag']==='insufficient_space'?'QUOTA_LIMIT':response.status===409?'STORAGE_CONFLICT':response.status>=500?'NETWORK_ERROR':'UNAVAILABLE';
   throw Object.assign(fault(code),{writeRejected:response.status<500||response.status===507});
  }
  // Bootstrap JSON only. Reject oversized content before parsing where possible.
  if(download&&Number(response.headers?.get('content-length'))>1048576)throw fault('STORAGE_INVALID');
  let data;try{const text=await response.text();if(text.length>1048576)throw Error();data=JSON.parse(text);}catch{throw fault('STORAGE_INVALID');}
  check();return data;
 }
 async function load(path){return request(content+'download',{path:pathArg(path)},{download:true});}
 async function identity(path){
  if(!paths.has(path))throw fault('WRITE_BLOCKED');
  const m=await request(api+'get_metadata',{path:pathArg(path)});
  if(m?.['.tag']!=='file'||!m.id||!m.rev||m.path_lower!==('/'+path).toLowerCase())throw fault('STORAGE_CONFLICT');
  return {provider:'dropbox',logicalKey:path.split('/').pop().replace('.json',''),fileId:m.id,path:m.path_lower,revision:m.rev,revisionKind:'dropbox.rev',etag:null};
 }
 return {
  async connect(){if(disposed)throw fault('CANCELLED');const result=await oauth.authorize(signal);if(disposed||signal?.aborted)throw fault('CANCELLED');token=result.accessToken;expires=result.expiresAt;},
  async disconnect(){disposed=true;token=null;expires=0;prepared=false;oauth.close();},
  async exists(path){return !!await request(api+'get_metadata',{path:pathArg(path)},{allowMissing:true});},
  load,identity,metrics:()=>({...metrics}),
  async updateDataset(key,before,next,expected,{recoveryOnly=false}={}){
   const path=`NARO Biz/Data/${key}.json`;
   if(!businessWrite||!paths.has(path))throw fault('WRITE_BLOCKED');
   if(expected?.provider!=='dropbox'||expected.logicalKey!==key||!expected.fileId||!expected.revision)throw fault('STORAGE_CONFLICT');
   if(JSON.stringify(next).length>1048576)throw fault('STORAGE_INVALID');
   if(!locks?.request)throw fault('UNAVAILABLE');
   return locks.request('naro-dropbox:'+expected.fileId,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw fault('BUSY');
    const read=fn=>boundedRead(fn,{signal});
    if(!recoveryOnly){
     // 빠른 저장(왕복 1번): 마지막으로 확인한 rev를 조건으로 바로 올린다 — rev가 바뀌었으면 Dropbox가 거절한다(409, 덮어쓰지 않음).
     // 저장된 내용은 응답의 content_hash와 직접 계산한 해시로 확인한다. 확인값이 없거나 다르면 예전처럼 다시 읽어 확인한다.
     const body=JSON.stringify(next),hash=await dropboxContentHash(new TextEncoder().encode(body),subtle);
     let dispatched=false,committed;
     try{committed=await request(content+'upload',{path:pathArg(path),mode:{'.tag':'update',update:expected.revision},autorename:false,strict_conflict:true,mute:true},{upload:next,onDispatch:()=>{dispatched=true;}});}
     catch(e){if(!dispatched||e.writeRejected)throw e;throw fault('SAVE_UNCONFIRMED');}
     const same=committed?.id===expected.fileId&&typeof committed.rev==='string'&&!!committed.rev&&committed.path_lower===('/'+path).toLowerCase();
     if(same&&hash&&committed.content_hash===hash)return {rows:JSON.parse(body),identity:{provider:'dropbox',logicalKey:key,fileId:committed.id,path:committed.path_lower,revision:committed.rev,revisionKind:'dropbox.rev',etag:null},recovered:false};
     try{
      const value=await read(()=>load(path)),after=await read(()=>identity(path));
      if(!same||after.fileId!==committed.id||after.revision!==committed.rev||canonical(value)!==canonical(next))throw Error();
      return {rows:value,identity:after,recovered:false};
     }catch{throw fault('SAVE_UNCONFIRMED');}
    }
    const a=await read(()=>identity(path)),current=await read(()=>load(path)),b=await read(()=>identity(path));
    if(a.fileId!==expected.fileId||a.fileId!==b.fileId||a.revision!==b.revision)throw fault('STORAGE_CONFLICT');
    if(canonical(current)===canonical(next))return {rows:current,identity:b,recovered:true};
    if(recoveryOnly){if(b.revision===expected.revision&&canonical(current)===canonical(before))throw fault('SAVE_NOT_OBSERVED');throw fault('STORAGE_CONFLICT');}
    if(b.revision!==expected.revision||canonical(current)!==canonical(before))throw fault('STORAGE_CONFLICT');
    let dispatched=false,committed;
    try{committed=await request(content+'upload',{path:pathArg(path),mode:{'.tag':'update',update:b.revision},autorename:false,strict_conflict:true,mute:true},{upload:next,onDispatch:()=>{dispatched=true;}});}
    catch(e){if(!dispatched||e.writeRejected)throw e;throw fault('SAVE_UNCONFIRMED');}
    try{
     const value=await read(()=>load(path)),after=await read(()=>identity(path));
     if(committed.id!==expected.fileId||after.fileId!==committed.id||after.revision!==committed.rev||canonical(value)!==canonical(next))throw Error();
     return {rows:value,identity:after,recovered:false};
    }catch{throw fault('SAVE_UNCONFIRMED');}
   });
  },
  async list(){
   const root=await request(api+'get_metadata',{path:'/NARO Biz'},{allowMissing:true});
   if(!root)return [];
   if(root['.tag']!=='folder')throw fault('STORAGE_CONFLICT');
   // Existing empty/partial root must never be mistaken for a new workspace.
   const result=['NARO Biz/'];let page=await request(api+'list_folder',{path:'/NARO Biz',recursive:true,include_deleted:false,limit:2000});
   for(let i=0;i<10;i++){
    if(!Array.isArray(page.entries))throw fault('STORAGE_INVALID');
    for(const entry of page.entries){const path=entry.path_display?.replace(/^\//,'');if(entry['.tag']==='file'&&paths.has(path))result.push(path);}
    if(!page.has_more)return result;
    if(i===9||typeof page.cursor!=='string')throw fault('STORAGE_CONFLICT');
    page=await request(api+'list_folder/continue',{cursor:page.cursor});
   }
  },
  async prepareFolders(requested){
   if(prepared||JSON.stringify(requested)!==JSON.stringify(folders))throw fault('WRITE_BLOCKED');
   // autorename:false gives conflict instead of creating a second workspace.
   for(const path of folders)await request(api+'create_folder_v2',{path:pathArg(path),autorename:false});
   prepared=true;
  },
  async createOnly(path,value){
   if(!prepared||!paths.has(path))throw fault('WRITE_BLOCKED');
   const name=path.split('/').pop().replace(/\.json$/,'');
   if(name==='settings'?JSON.stringify(value)!=='{"schema":3}':!Array.isArray(value)||value.length!==0)throw fault('WRITE_BLOCKED');
   await request(content+'upload',{path:pathArg(path),mode:'add',autorename:false,strict_conflict:true,mute:true},{upload:value});
   // Read-back proof; no retry of this mutation even if the response/read is lost.
   const persisted=await load(path);
   if(JSON.stringify(persisted)!==JSON.stringify(value))throw fault('STORAGE_INVALID');
  },
  uploadAsset:(kind,bytes)=>assets.upload(kind,bytes),
  downloadAsset:path=>assets.download(path)
 };
}
