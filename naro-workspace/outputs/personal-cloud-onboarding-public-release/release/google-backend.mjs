import {fault,folders,tables} from './core.mjs';
import {providerFailure} from './providers.mjs';
const filePaths=[...tables,'settings'].map(k=>`NARO Biz/Data/${k}.json`);
const allowed=new Set([...folders,...filePaths]);
const folderMime='application/vnd.google-apps.folder';
const marker={naroPersonalCloud:'1'};
const api='https://www.googleapis.com/drive/v3/';
const escapeQuery=value=>value.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export function createGoogleBackend({oauth,signal,fetcher=fetch,now=Date.now,locks=globalThis.navigator?.locks}){
 let token=null,expires=0,disposed=false,prepared=false,requests=0,releaseLock=null;
 const nodes=new Map(),reserved=new Map(),attempted=new Set();
 const check=()=>{if(disposed||signal?.aborted)throw fault('CANCELLED');if(!token||now()>=expires)throw fault('RECONNECT_REQUIRED');};
 const validPath=path=>{if(!allowed.has(path))throw fault('WRITE_BLOCKED');};
 async function request(route,{method='GET',body,upload=false}={}){
  check();if(++requests>100)throw fault('QUOTA_LIMIT');
  const headers={Authorization:'Bearer '+token};if(body!==undefined)headers['Content-Type']=upload?'multipart/related; boundary=naro_bootstrap_boundary':'application/json';
  let response;try{response=await fetcher((upload?'https://www.googleapis.com/upload/drive/v3/':api)+route,{method,headers,body:body===undefined?undefined:upload?body:JSON.stringify(body),signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});}
  catch{throw fault(signal?.aborted?'CANCELLED':'NETWORK_ERROR');}check();
  if(!response.ok){let error;try{error=await response.json();}catch{}
   if(response.status===409)throw fault('STORAGE_CONFLICT');
   throw providerFailure(response.status,error?.error?.errors?.[0]?.reason);
  }
  try{if(Number(response.headers?.get('content-length'))>1048576)throw Error();const text=await response.text();if(text.length>1048576)throw Error();const data=JSON.parse(text);check();return data;}
  catch(e){if(e?.code)throw e;throw fault('STORAGE_INVALID');}
 }
 async function children(parent,name){
  const q=`'${escapeQuery(parent)}' in parents and name = '${escapeQuery(name)}' and trashed = false`;
  const data=await request('files?'+new URLSearchParams({q,spaces:'drive',pageSize:'100',fields:'nextPageToken,files(id,name,mimeType,appProperties)'}));
  if(!Array.isArray(data.files)||data.nextPageToken||data.files.length>1)throw fault('STORAGE_CONFLICT');
  return data.files[0]||null;
 }
 function validateNode(node,isFolder){
  if(!node||typeof node.id!=='string'||!node.id||node.appProperties?.naroPersonalCloud!=='1'||node.mimeType!==(isFolder?folderMime:'application/json'))throw fault('STORAGE_CONFLICT');
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
 return {
  async connect(){if(disposed)throw fault('CANCELLED');const result=await oauth.authorize(signal);if(disposed||signal?.aborted)throw fault('CANCELLED');token=result.accessToken;expires=result.expiresAt;check();},
  async disconnect(){disposed=true;token=null;expires=0;nodes.clear();reserved.clear();releaseLock?.();releaseLock=null;oauth.close();},
  async exists(path){validPath(path);check();return nodes.has(path);},load,
  async list(){
   nodes.clear();const root=await children('root','NARO Biz');if(!root)return [];
   validateNode(root,true);nodes.set('NARO Biz',root.id);
   for(const path of [...folders.slice(1),...filePaths]){
    const cut=path.lastIndexOf('/'),parent=nodes.get(path.slice(0,cut));
    if(!parent)throw fault('STORAGE_CONFLICT');const node=await children(parent,path.slice(cut+1));
    if(!node)throw fault('STORAGE_CONFLICT');validateNode(node,folders.includes(path));nodes.set(path,node.id);
   }
   return [...filePaths];
  },
  async prepareFolders(requested){
   check();if(prepared||JSON.stringify(requested)!==JSON.stringify(folders))throw fault('WRITE_BLOCKED');
   await acquire();check();
   // Recheck under a same-origin Web Lock. Drive has no global name-uniqueness transaction.
   if(await children('root','NARO Biz'))throw fault('STORAGE_CONFLICT');
   const generated=await request('files/generateIds?count=15&space=drive&type=files');
   if(!Array.isArray(generated.ids)||generated.ids.length!==15||new Set(generated.ids).size!==15||generated.ids.some(id=>typeof id!=='string'||!id))throw fault('STORAGE_INVALID');
   [...folders,...filePaths].forEach((path,i)=>reserved.set(path,generated.ids[i]));
   for(const path of folders){
    const cut=path.lastIndexOf('/');const metadata={id:reserved.get(path),name:path.slice(cut+1),mimeType:folderMime,parents:[cut<0?'root':nodes.get(path.slice(0,cut))],appProperties:marker};
    const node=await request('files?fields=id',{method:'POST',body:metadata});
    if(node.id!==metadata.id)throw fault('STORAGE_INVALID');nodes.set(path,node.id);
   }
   prepared=true;
  },
  async createOnly(path,value){
   check();if(!prepared||!filePaths.includes(path)||attempted.has(path))throw fault('WRITE_BLOCKED');
   if(path.endsWith('/settings.json')?JSON.stringify(value)!=='{"schema":3}':!Array.isArray(value)||value.length)throw fault('WRITE_BLOCKED');
   attempted.add(path); // Ambiguous response is never replayed, overwritten or deleted.
   const id=reserved.get(path),metadata={id,name:path.split('/').pop(),mimeType:'application/json',parents:[nodes.get('NARO Biz/Data')],appProperties:marker};
   const body='--naro_bootstrap_boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--naro_bootstrap_boundary\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(value)+'\r\n--naro_bootstrap_boundary--\r\n';
   const result=await request('files?uploadType=multipart&fields=id',{method:'POST',body,upload:true});
   if(result.id!==id)throw fault('STORAGE_INVALID');nodes.set(path,id);
   if(JSON.stringify(await load(path))!==JSON.stringify(value))throw fault('STORAGE_INVALID');
   if(attempted.size===7){releaseLock?.();releaseLock=null;}
  },
  async downloadAsset(){throw fault('WRITE_BLOCKED');}
 };
}
