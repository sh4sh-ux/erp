import {fault,folders,tables} from './core.mjs';
const paths=new Set([...tables,'settings'].map(k=>`NARO Biz/Data/${k}.json`));
const api='https://api.dropboxapi.com/2/files/';
const content='https://content.dropboxapi.com/2/files/';
export function createDropboxBackend({oauth,signal,fetcher=fetch,now=Date.now}){
 let token=null,expires=0,disposed=false,prepared=false;
 const check=()=>{if(disposed||signal?.aborted)throw fault('CANCELLED');if(!token||now()>=expires)throw fault('RECONNECT_REQUIRED');};
 const pathArg=path=>{if(!paths.has(path)&&!folders.includes(path))throw fault('WRITE_BLOCKED');return '/'+path;};
 async function request(url,arg,{upload,download=false,allowMissing=false}={}){
  check();let response;
  const headers={Authorization:'Bearer '+token};
  if(upload!==undefined||download){headers['Dropbox-API-Arg']=JSON.stringify(arg);if(upload!==undefined)headers['Content-Type']='application/octet-stream';}
  else headers['Content-Type']='application/json';
  try{response=await fetcher(url,{method:'POST',headers,body:upload!==undefined?JSON.stringify(upload):download?undefined:JSON.stringify(arg),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal});}
  catch{throw fault(signal?.aborted?'CANCELLED':'NETWORK_ERROR');}
  check();
  if(!response.ok){
   let data;try{data=await response.json();}catch{}
   const error=data?.error;
   if(allowMissing&&response.status===409&&error?.['.tag']==='path'&&error.path?.['.tag']==='not_found')return null;
   if(response.status===401)throw fault('RECONNECT_REQUIRED');
   if(response.status===429)throw fault('RATE_LIMIT');
   if(response.status===507||error?.['.tag']==='insufficient_space'||error?.reason?.['.tag']==='insufficient_space')throw fault('QUOTA_LIMIT');
   if(response.status===409)throw fault('STORAGE_CONFLICT');
   throw fault(response.status>=500?'NETWORK_ERROR':'UNAVAILABLE');
  }
  // Bootstrap JSON only. Reject oversized content before parsing where possible.
  if(download&&Number(response.headers?.get('content-length'))>1048576)throw fault('STORAGE_INVALID');
  let data;try{const text=await response.text();if(text.length>1048576)throw Error();data=JSON.parse(text);}catch{throw fault('STORAGE_INVALID');}
  check();return data;
 }
 async function load(path){return request(content+'download',{path:pathArg(path)},{download:true});}
 return {
  async connect(){if(disposed)throw fault('CANCELLED');const result=await oauth.authorize(signal);if(disposed||signal?.aborted)throw fault('CANCELLED');token=result.accessToken;expires=result.expiresAt;},
  async disconnect(){disposed=true;token=null;expires=0;prepared=false;oauth.close();},
  async exists(path){return !!await request(api+'get_metadata',{path:pathArg(path)},{allowMissing:true});},
  load,
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
  async downloadAsset(){throw fault('WRITE_BLOCKED');}
 };
}
