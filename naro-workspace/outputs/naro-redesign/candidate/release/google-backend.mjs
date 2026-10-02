import {fault,folders,tables,boundedRead,parallelRead} from './core.mjs';
import {providerFailure} from './providers.mjs';
import {validateCompany,canonical} from './company-contract.mjs';
import {writableDatasets} from './business-contract.mjs';
import {extendedDatasets} from './extended-contract.mjs';
import {createAssetStore} from './asset-store.mjs';
const filePaths=[...tables,'settings'].map(k=>`NARO Biz/Data/${k}.json`);
const allowed=new Set([...folders,...filePaths]);
const folderMime='application/vnd.google-apps.folder';
const marker={naroPersonalCloud:'1'};
const api='https://www.googleapis.com/drive/v3/';
const escapeQuery=value=>value.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
// Drive md5Checksum 확인용 MD5(보안 용도 아님 — 저장된 내용이 보낸 내용과 같은지 비교만). 브라우저 WebCrypto에 MD5가 없어 직접 계산한다.
export function md5Hex(input){
 const bytes=typeof input==='string'?new TextEncoder().encode(input):input,n=bytes.length,words=new Uint32Array(((n+8>>>6)+1)*16);
 for(let i=0;i<n;i++)words[i>>2]|=bytes[i]<<(i%4*8);
 words[n>>2]|=0x80<<(n%4*8);words[words.length-2]=n*8>>>0;words[words.length-1]=Math.floor(n/0x20000000);
 const K=new Uint32Array(64).map((_,i)=>Math.floor(Math.abs(Math.sin(i+1))*2**32)),R=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 for(let o=0;o<words.length;o+=16){
  let a=a0,b=b0,c=c0,d=d0;
  for(let i=0;i<64;i++){
   const r=i>>4;let f,g;
   if(r===0){f=(b&c)|(~b&d);g=i;}else if(r===1){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(r===2){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=7*i%16;}
   const t=d;d=c;c=b;const x=(a+f+K[i]+words[o+g])>>>0,sh=R[r*4+i%4];b=(b+((x<<sh)|(x>>>(32-sh))))>>>0;a=t;
  }
  a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
 }
 return [a0,b0,c0,d0].map(v=>[0,8,16,24].map(s=>((v>>>s)&255).toString(16).padStart(2,'0')).join('')).join('');
}
export function createGoogleBackend({oauth,signal,fetcher=fetch,now=Date.now,locks=globalThis.navigator?.locks,readOnly=false,companiesCreate=false,businessWrite=false,extendedWrite=false,initializeNew=false}){
 // 마지막 저장 응답의 버전·ETag(파일별). 다음 저장은 이 ETag를 조건으로 바로 올린다(빠른 저장).
 const savedEtags=new Map();
 let token=null,expires=0,disposed=false,prepared=false,requests=0,releaseLock=null,accountBinding=null;
 let windowStart=now(),windowRequests=0;
 const nodes=new Map(),reserved=new Map(),attempted=new Set();
 let discoveryIdentities=null;const discoveryMetadata=new Map();
 const uncertain=new Set();
 const metrics={readRequests:0,datasetCreateRequests:0,businessWriteRequests:0,blockedWrites:0};
 const check=()=>{if(disposed||signal?.aborted)throw fault('CANCELLED');if(!token||now()>=expires)throw fault('RECONNECT_REQUIRED');accountBinding?.assertCurrent();};
 const assets=createAssetStore({provider:'drive',auth:()=>{check();return token;},folderId:path=>nodes.get(path),fetcher,signal,enabled:businessWrite&&extendedWrite,now});
 const validPath=path=>{if(!allowed.has(path))throw fault('WRITE_BLOCKED');};
 async function request(route,{method='GET',body,upload=false,companyPatch=false,datasetPatch=false,etag,version=3,onDispatch,bootstrap=false}={}){
  const initialCreate=initializeNew&&bootstrap&&method==='POST'&&version===3;
  if(readOnly&&method!=='GET'&&!initialCreate&&!((companiesCreate&&companyPatch||businessWrite&&datasetPatch)&&method==='PUT'&&version===2)){metrics.blockedWrites++;throw fault('WRITE_BLOCKED');}
  check();
  if(businessWrite){
   if(now()-windowStart>=60000){windowStart=now();windowRequests=0;}
   if(++windowRequests>120)throw fault('QUOTA_LIMIT');
  }else if(++requests>100)throw fault('QUOTA_LIMIT');
  if(method==='GET')metrics.readRequests++;
  else {metrics.businessWriteRequests++;if(upload&&method==='POST')metrics.datasetCreateRequests++;}
  const headers={Authorization:'Bearer '+token};if(body!==undefined)headers['Content-Type']=upload&&!companyPatch&&!datasetPatch?'multipart/related; boundary=naro_bootstrap_boundary':'application/json';
  if(companyPatch||datasetPatch){if(!strongEtag(etag))throw fault('CONCURRENCY_UNAVAILABLE');headers['If-Match']=etag;}
  const base=version===2?(upload?'https://www.googleapis.com/upload/drive/v2/':'https://www.googleapis.com/drive/v2/'):(upload?'https://www.googleapis.com/upload/drive/v3/':api);
  let response;try{onDispatch?.();response=await fetcher(base+route,{method,headers,body:body===undefined?undefined:upload?body:JSON.stringify(body),signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});}
  catch{throw Object.assign(fault(signal?.aborted?'CANCELLED':'NETWORK_ERROR'),{transport:'FETCH_REJECTED'});}check();
  if(!response.ok){let error;try{error=await response.json();}catch{}
   if(response.status===409||response.status===412)throw fault('STORAGE_CONFLICT');
   throw Object.assign(providerFailure(response.status,error?.error?.errors?.[0]?.reason),{transport:response.status>=500?'HTTP_5XX':'HTTP_REJECTED',writeRejected:[400,401,403,404,405,413,415,422,429].includes(response.status)});
  }
  try{if(Number(response.headers?.get('content-length'))>1048576)throw Error();const text=await response.text();if(text.length>1048576)throw Error();const data=JSON.parse(text);check();return data;}
  catch(e){if(e?.code)throw e;throw fault('STORAGE_INVALID');}
 }
 async function children(parent,name){
  const q=`'${escapeQuery(parent)}' in parents and name = '${escapeQuery(name)}' and trashed = false`;
  const data=await request('files?'+new URLSearchParams({q,spaces:'drive',pageSize:'100',fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,appProperties)'}));
  if(!Array.isArray(data.files)||data.nextPageToken||data.incompleteSearch||data.files.length>1)throw fault('STORAGE_CONFLICT');
  return data.files[0]||null;
 }
 function validateNode(node,isFolder){
  if(!node||typeof node.id!=='string'||!node.id||node.appProperties?.naroPersonalCloud!=='1'||node.mimeType!==(isFolder?folderMime:'application/json'))throw fault('STORAGE_CONFLICT');
 }
 async function childrenMany(parent,paths,{register=true}={}){
  const names=paths.map(path=>path.split('/').pop());
  const q=`'${escapeQuery(parent)}' in parents and (${names.map(name=>`name = '${escapeQuery(name)}'`).join(' or ')}) and trashed = false`;
  const data=await request('files?'+new URLSearchParams({q,spaces:'drive',pageSize:'100',fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,appProperties,parents,trashed,version,headRevisionId)'}));
  if(!Array.isArray(data.files)||data.nextPageToken||data.incompleteSearch)throw fault('STORAGE_CONFLICT');
  return registerChildren(parent,paths,data.files,{register});
 }
 function registerChildren(parent,paths,files,{register=true}={}){
  if(files.length!==paths.length||new Set(files.map(n=>n.id)).size!==paths.length)throw fault('STORAGE_CONFLICT');
  for(const path of paths){
   const matches=files.filter(node=>node.name===path.split('/').pop());
   if(matches.length!==1)throw fault('STORAGE_CONFLICT');const node=matches[0];
   validateNode(node,folders.includes(path));
   if(node.trashed||!node.parents?.includes(parent))throw fault('STORAGE_CONFLICT');if(register){nodes.set(path,node.id);if(filePaths.includes(path))discoveryMetadata.set(path,node);}
  }
  return paths.map(path=>files.find(node=>node.name===path.split('/').pop()));
 }
 async function discoveryCandidates(){
  // Names, not the marker, are the query filter: an unmarked duplicate inside
  // the verified workspace must remain visible so validation can reject it.
  // drive.file still limits visibility; unrelated matches are never read.
  const names=[...new Set([...folders.slice(1),...filePaths].map(path=>path.split('/').pop()))];
  const q=`(${names.map(name=>`name = '${escapeQuery(name)}'`).join(' or ')}) and trashed = false`;
  const data=await request('files?'+new URLSearchParams({q,spaces:'drive',corpora:'user',pageSize:'100',fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,appProperties,parents,trashed,version,headRevisionId)'}));
  if(!Array.isArray(data.files)||data.incompleteSearch)throw fault('STORAGE_CONFLICT');
  // A large set of same-name matches is not proof of missing files. Fall back
  // to the original parent-scoped discovery, never initialize from a partial list.
  return data.nextPageToken?null:data.files;
 }
 function fileIdentity(path,node){
  validateNode(node,false);
  if(node.id!==nodes.get(path)||node.name!==path.split('/').pop()||node.trashed||!node.parents?.includes(nodes.get('NARO Biz/Data'))||!/^\d+$/.test(node.version||''))throw fault('STORAGE_CONFLICT');
  return Object.freeze({provider:'drive',logicalKey:path.split('/').pop().replace(/\.json$/,''),fileId:node.id,path,revision:node.version,revisionKind:'drive.version',headRevisionId:node.headRevisionId||null,etag:null});
 }
 async function acquire(){
  if(!locks?.request)throw fault('UNAVAILABLE');
  await new Promise((resolve,reject)=>{
   locks.request('naro-personal-drive-bootstrap',{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock){reject(fault('BUSY'));return;}
    await new Promise(release=>{releaseLock=release;resolve();});
   }).catch(()=>reject(fault('UNAVAILABLE')));
  });
 }
 async function load(path){validPath(path);if(!filePaths.includes(path)||!nodes.has(path))throw fault('STORAGE_CONFLICT');return request('files/'+encodeURIComponent(nodes.get(path))+'?alt=media');}
 const strongEtag=value=>typeof value==='string'&&/^"[^"\r\n]+"$/.test(value);
 async function companyValidator(expected){
  if(!readOnly||!companiesCreate)throw fault('WRITE_BLOCKED');
  const id=nodes.get('NARO Biz/Data/companies.json');
  if(!id||expected?.provider!=='drive'||expected.logicalKey!=='companies'||expected.fileId!==id)throw fault('STORAGE_CONFLICT');
  // v2 exposes the file ETag in JSON. Do not depend on a CORS-visible HTTP
  // response header, and never substitute version/modifiedTime for an ETag.
  const latest=await request('files/'+encodeURIComponent(id)+'?'+new URLSearchParams({fields:'id,version,etag'}),{version:2});
  if(latest.id!==id||latest.version!==expected.revision)throw fault('STORAGE_CONFLICT');
  if(!strongEtag(latest.etag))throw fault('CONCURRENCY_UNAVAILABLE');
  return latest.etag;
 }
 return {
  readConcurrency:7,
  takeDiscoveryIdentities(){check();const result=discoveryIdentities;discoveryIdentities=null;return result;},
  async identities(){
   check();const parent=nodes.get('NARO Biz/Data');if(!parent||!filePaths.every(path=>nodes.has(path)))throw fault('STORAGE_CONFLICT');
   const metadata=await childrenMany(parent,filePaths,{register:false});
   return filePaths.map((path,i)=>fileIdentity(path,metadata[i]));
  },
  async connect(){
   if(disposed)throw fault('CANCELLED');const result=await oauth.authorize(signal);
   if(disposed||signal?.aborted)throw fault('CANCELLED');token=result.accessToken;expires=result.expiresAt;check();
   if(result.accountBinding){try{
    // Verify the token's actual Drive account BEFORE any file discovery/bootstrap.
    const about=await request('about?fields=user(permissionId,emailAddress)');
    await result.accountBinding.verify(about.user?.permissionId,signal,about.user?.emailAddress);check();
    accountBinding=result.accountBinding;accountBinding.assertCurrent();
   }catch(e){token=null;expires=0;accountBinding=null;throw e;}}
  },
  async disconnect(){disposed=true;token=null;expires=0;accountBinding=null;savedEtags.clear();nodes.clear();reserved.clear();discoveryIdentities=null;discoveryMetadata.clear();releaseLock?.();releaseLock=null;oauth.close();},
  async exists(path){validPath(path);check();return nodes.has(path);},load,
  metrics(){return {...metrics};},
  async checkCompanyWrite(expected){await companyValidator(expected);return {ready:true};},
  async updateDataset(key,before,next,expected,{recoveryOnly=false}={}){
   if(!readOnly||!businessWrite||!(extendedWrite?extendedDatasets:writableDatasets).includes(key))throw fault('WRITE_BLOCKED');
   const path=`NARO Biz/Data/${key}.json`,id=nodes.get(path);
   if(!id||expected?.provider!=='drive'||expected.logicalKey!==key||expected.fileId!==id)throw fault('STORAGE_CONFLICT');
   if((key==='settings'?(!before||!next||Array.isArray(before)||Array.isArray(next)||next.schema!==3):(!Array.isArray(before)||!Array.isArray(next)))||JSON.stringify(next).length>1048576)throw fault('STORAGE_INVALID');
   if(!locks?.request)throw fault('UNAVAILABLE');
   return locks.request('naro-dataset:'+id,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw fault('BUSY');check();
    let stage='IDENTITY_READ',transport='';
    try{
    // Retry only safe reads. A PUT is never replayed, including on lost replies.
    const read=operation=>boundedRead(async()=>{try{return await operation();}catch(e){transport=e.transport||'';throw e;}},{signal});
    const cached=savedEtags.get(id);
    if(!recoveryOnly&&cached&&cached.version===expected.revision&&strongEtag(cached.etag)){
     // 빠른 저장(왕복 1번): 지난 저장에서 받은 ETag를 조건(If-Match)으로 바로 올린다 — 그 사이 바뀌었으면 Drive가 412로 거절(덮어쓰지 않음).
     // 저장된 내용은 응답의 md5Checksum과 직접 계산한 MD5로 확인한다. 412면 아래 예전 방식으로 처음부터 다시 확인한다.
     const body=JSON.stringify(next);stage='CONDITIONAL_WRITE';transport='';let dispatched=false,res=null;
     try{res=await request('files/'+encodeURIComponent(id)+'?uploadType=media&fields=id,version,etag,md5Checksum,headRevisionId',{version:2,method:'PUT',body,upload:true,datasetPatch:true,etag:cached.etag,onDispatch:()=>{dispatched=true;}});}
     catch(e){
      transport=e.transport||'';savedEtags.delete(id);
      if(e.code!=='STORAGE_CONFLICT'){if(!dispatched||e.writeRejected)throw e;throw fault('SAVE_UNCONFIRMED');}
     }
     if(res){
      if(res.id===id&&/^\d+$/.test(res.version||'')&&strongEtag(res.etag))savedEtags.set(id,{version:res.version,etag:res.etag});else savedEtags.delete(id);
      if(res.id===id&&/^\d+$/.test(res.version||'')&&res.md5Checksum&&res.md5Checksum===md5Hex(body))
       return {rows:JSON.parse(body),identity:Object.freeze({provider:'drive',logicalKey:key,fileId:id,path,revision:res.version,revisionKind:'drive.version',headRevisionId:res.headRevisionId||null,etag:null}),recovered:false};
      try{
       stage='READBACK_CONTENT';const persisted=await read(()=>load(path));
       stage='READBACK_IDENTITY';const updated=await read(()=>this.identity(path));
       if(canonical(persisted)!==canonical(next))throw fault('SAVE_UNCONFIRMED');
       return {rows:persisted,identity:updated,recovered:false};
      }catch{throw fault('SAVE_UNCONFIRMED');}
     }
     stage='IDENTITY_READ';
    }
    const identity=await read(()=>this.identity(path));stage='CONTENT_READ';
    const current=await read(()=>load(path));
    if(recoveryOnly){
     stage='READBACK_IDENTITY';const after=await read(()=>this.identity(path));
     if(after.revision!==identity.revision)throw fault('SAVE_UNCONFIRMED');
     if(canonical(current)===canonical(next))return {rows:current,identity:after,recovered:true};
     // Observation only: delayed writes may still be in flight. Keep the intent
     // locked and never treat this result as permission to submit another PUT.
     if(identity.revision===expected.revision&&canonical(current)===canonical(before))throw fault('SAVE_NOT_OBSERVED');
     throw fault('STORAGE_CONFLICT');
    }
    if(canonical(current)===canonical(next))return {rows:current,identity,recovered:true};
    if(identity.revision!==expected.revision||canonical(current)!==canonical(before))throw fault('STORAGE_CONFLICT');
    stage='VALIDATOR_READ';
    const validator=await read(()=>request('files/'+encodeURIComponent(id)+'?'+new URLSearchParams({fields:'id,version,etag'}),{version:2}));
    if(validator.id!==id||validator.version!==identity.revision)throw fault('STORAGE_CONFLICT');
    if(!strongEtag(validator.etag))throw fault('CONCURRENCY_UNAVAILABLE');
    stage='CONDITIONAL_WRITE';transport='';let dispatched=false;
    try{const res=await request('files/'+encodeURIComponent(id)+'?uploadType=media&fields=id,version,etag',{version:2,method:'PUT',body:JSON.stringify(next),upload:true,datasetPatch:true,etag:validator.etag,onDispatch:()=>{dispatched=true;}});
     if(res?.id===id&&/^\d+$/.test(res.version||'')&&strongEtag(res.etag))savedEtags.set(id,{version:res.version,etag:res.etag});else savedEtags.delete(id);}
    catch(e){
     transport=e.transport||'';savedEtags.delete(id);
     // No network request, or an explicit client-error rejection: do not invent
     // an uncertain write. Transport/5xx/response decoding failures stay locked.
     if(!dispatched||e.writeRejected||e.code==='STORAGE_CONFLICT')throw e;
     throw fault('SAVE_UNCONFIRMED');
    }
    try{
     stage='READBACK_CONTENT';const persisted=await read(()=>load(path));
     stage='READBACK_IDENTITY';const updated=await read(()=>this.identity(path));
     if(canonical(persisted)!==canonical(next))throw fault('SAVE_UNCONFIRMED');
     return {rows:persisted,identity:updated,recovered:false};
    }catch{throw fault('SAVE_UNCONFIRMED');}
    }catch(e){e.stage=stage;e.transport=transport;throw e;}
   });
  },
  async createCompany(record,expected,{recoveryOnly=false}={}){
   if(!readOnly||!companiesCreate)throw fault('WRITE_BLOCKED');
   const row=validateCompany(record),path='NARO Biz/Data/companies.json';check();
   if(!locks?.request)throw fault('UNAVAILABLE');
   return locks.request('naro-company-create:'+nodes.get(path),{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw fault('BUSY');check();
    if(expected?.provider!=='drive'||expected.logicalKey!=='companies'||expected.fileId!==nodes.get(path))throw fault('STORAGE_CONFLICT');
    const identity=await this.identity(path);
    const rows=await load(path);if(!Array.isArray(rows))throw fault('STORAGE_INVALID');
    const found=rows.filter(x=>x.id===row.id);
    if(found.length){if(found.length!==1||canonical(found[0])!==canonical(row))throw fault('STORAGE_CONFLICT');return {rows,identity,recovered:true};}
    if(recoveryOnly||uncertain.has(row.id))throw fault('SAVE_UNCONFIRMED');
    if(identity.revision!==expected.revision)throw fault('STORAGE_CONFLICT');
    const next=[...rows,row],body=JSON.stringify(next);if(body.length>1048576)throw fault('QUOTA_LIMIT');
    // Use one API version for validator and conditional update. A missing
    // validator or a 412 still stops the operation; there is no blind retry.
    const etag=await companyValidator(identity);
    uncertain.add(row.id);
    try{await request('files/'+encodeURIComponent(identity.fileId)+'?uploadType=media&fields=id,version',{version:2,method:'PUT',body,upload:true,companyPatch:true,etag});}
    catch(e){if(e.code==='STORAGE_CONFLICT')uncertain.delete(row.id);else throw fault('SAVE_UNCONFIRMED');throw e;}
    const persisted=await load(path);
    if(canonical(persisted)!==canonical(next))throw fault('SAVE_UNCONFIRMED');
    const updated=await this.identity(path);uncertain.delete(row.id);
    return {rows:persisted,identity:updated,recovered:false};
   });
  },
  async identity(path){
   validPath(path);check();if(!filePaths.includes(path)||!nodes.has(path))throw fault('STORAGE_CONFLICT');
   const node=await request('files/'+encodeURIComponent(nodes.get(path))+'?'+new URLSearchParams({fields:'id,name,mimeType,appProperties,parents,trashed,version,headRevisionId,modifiedTime,md5Checksum'}));
   return fileIdentity(path,node);
  },
  async list(){
   discoveryIdentities=null;discoveryMetadata.clear();nodes.clear();
   // Independent requests overlap: verify the root while obtaining candidate
   // metadata. Drain both requests before returning even if one fails.
   const [root,candidates]=await parallelRead([()=>children('root','NARO Biz'),discoveryCandidates],run=>run(),2);
   if(!root)return [];
   validateNode(root,true);nodes.set('NARO Biz',root.id);
   const pending=[...folders.slice(1),...filePaths];
   for(const depth of [2,3]){
    const groups=new Map();
    for(const path of pending.filter(path=>path.split('/').length===depth)){
     const parent=nodes.get(path.slice(0,path.lastIndexOf('/')));if(!parent)throw fault('STORAGE_CONFLICT');
     if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(path);
    }
    if(candidates){
     for(const [parent,paths] of groups){
      const names=new Set(paths.map(path=>path.split('/').pop()));
      registerChildren(parent,paths,candidates.filter(node=>node.parents?.includes(parent)&&names.has(node.name)));
     }
    }else await parallelRead([...groups],([parent,paths])=>childrenMany(parent,paths));
   }
   if(new Set(nodes.values()).size!==nodes.size)throw fault('STORAGE_CONFLICT');
   discoveryIdentities=filePaths.map(path=>fileIdentity(path,discoveryMetadata.get(path)));discoveryMetadata.clear();
   return [...filePaths];
  },
  async prepareFolders(requested){
   if(readOnly&&!initializeNew){metrics.blockedWrites++;throw fault('WRITE_BLOCKED');}
   check();if(prepared||JSON.stringify(requested)!==JSON.stringify(folders))throw fault('WRITE_BLOCKED');
   await acquire();check();
   // Recheck under a same-origin Web Lock. Drive has no global name-uniqueness transaction.
   if(await children('root','NARO Biz'))throw fault('STORAGE_CONFLICT');
   const generated=await request('files/generateIds?count=15&space=drive&type=files');
   if(!Array.isArray(generated.ids)||generated.ids.length!==15||new Set(generated.ids).size!==15||generated.ids.some(id=>typeof id!=='string'||!id))throw fault('STORAGE_INVALID');
   [...folders,...filePaths].forEach((path,i)=>reserved.set(path,generated.ids[i]));
   for(const path of folders){
    const cut=path.lastIndexOf('/');const metadata={id:reserved.get(path),name:path.slice(cut+1),mimeType:folderMime,parents:[cut<0?'root':nodes.get(path.slice(0,cut))],appProperties:marker};
    const node=await request('files?fields=id',{method:'POST',body:metadata,bootstrap:true});
    if(node.id!==metadata.id)throw fault('STORAGE_INVALID');nodes.set(path,node.id);
   }
   prepared=true;
  },
  async createOnly(path,value){
   if(readOnly&&!initializeNew){metrics.blockedWrites++;throw fault('WRITE_BLOCKED');}
   check();if(!prepared||!filePaths.includes(path)||attempted.has(path))throw fault('WRITE_BLOCKED');
   if(path.endsWith('/settings.json')?JSON.stringify(value)!=='{"schema":3}':!Array.isArray(value)||value.length)throw fault('WRITE_BLOCKED');
   attempted.add(path); // Ambiguous response is never replayed, overwritten or deleted.
   const id=reserved.get(path),metadata={id,name:path.split('/').pop(),mimeType:'application/json',parents:[nodes.get('NARO Biz/Data')],appProperties:marker};
   const body='--naro_bootstrap_boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--naro_bootstrap_boundary\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(value)+'\r\n--naro_bootstrap_boundary--\r\n';
   const result=await request('files?uploadType=multipart&fields=id',{method:'POST',body,upload:true,bootstrap:true});
   if(result.id!==id)throw fault('STORAGE_INVALID');nodes.set(path,id);
   if(JSON.stringify(await load(path))!==JSON.stringify(value))throw fault('STORAGE_INVALID');
   if(attempted.size===7){releaseLock?.();releaseLock=null;}
  },
  uploadAsset:(kind,bytes)=>assets.upload(kind,bytes),
  downloadAsset:path=>assets.download(path)
 };
}
