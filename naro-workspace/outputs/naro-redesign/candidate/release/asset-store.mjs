import {fault} from './core.mjs';
export const assetFolders=Object.freeze({product:'NARO Biz/Images/Products',card:'NARO Biz/Documents/Business Cards',registration:'NARO Biz/Documents/Business Registration'});
export function assetPath(kind,digest){if(!Object.hasOwn(assetFolders,kind)||!/^\w{64}$/.test(digest)||!/^[0-9a-f]+$/.test(digest))throw fault('VALIDATION');return assetFolders[kind]+'/'+digest+'.png';}
export function validateAssetPath(path){if(typeof path!=='string'||!Object.values(assetFolders).some(folder=>path.startsWith(folder+'/')&&/^[0-9a-f]{64}\.png$/.test(path.slice(folder.length+1))))throw fault('VALIDATION');return path;}
export async function pngDigest(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<24||bytes.length>1048576||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw fault('VALIDATION');
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=dv.getUint32(16),h=dv.getUint32(20);
 if(!w||!h||w>4096||h>4096||w*h>16000000)throw fault('VALIDATION');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
}
// Private, immutable, content-addressed PNGs. No public sharing link or overwrite.
// Auth is acquired from the active backend for every request; never persisted.
export function createAssetStore({provider,auth,folderId,fetcher=fetch,signal,enabled=false,now=Date.now}){
 let busy=false,start=now(),calls=0;const intents=new Map();
 const check=()=>{if(!enabled)throw fault('WRITE_BLOCKED');return auth();};
 async function request(url,{method='GET',headers={},body,binary=false,missing=false,write=false}={}){
  if(now()-start>=60000){start=now();calls=0;}if(++calls>60)throw fault('QUOTA_LIMIT');
  let response;try{response=await fetcher(url,{method,headers:{Authorization:'Bearer '+check(),...headers},body,signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});}catch{throw fault(write?'SAVE_UNCONFIRMED':'NETWORK_ERROR');}check();
  if(missing&&response.status===404)return null;
  if(!response.ok){
   let data;try{data=await response.json();}catch{}
   if(missing&&response.status===409&&data?.error?.['.tag']==='path'&&data.error.path?.['.tag']==='not_found')return null;
   if(response.status===401)throw fault('RECONNECT_REQUIRED');
   if(response.status===429||response.status===507||data?.error?.['.tag']==='insufficient_space')throw fault('QUOTA_LIMIT');
   if(response.status===409||response.status===412)throw fault('STORAGE_CONFLICT');
   throw fault(write&&response.status>=500?'SAVE_UNCONFIRMED':'UNAVAILABLE');
  }
  const reader=response.body?.getReader();if(!reader)throw fault('STORAGE_INVALID');
  const chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw fault('STORAGE_INVALID');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}check();
  if(binary)return bytes;try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fault(write?'SAVE_UNCONFIRMED':'STORAGE_INVALID');}
 }
 const dbx=(operation,arg,options={})=>request('https://api.dropboxapi.com/2/files/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(arg),...options});
 const drive='https://www.googleapis.com/drive/v3/';
 async function find(path){
  check();validateAssetPath(path);
  if(provider==='dropbox'){
   const node=await dbx('get_metadata',{path:'/'+path},{missing:true});
   if(node&&(node['.tag']!=='file'||node.path_lower!==('/'+path).toLowerCase()||!node.id||!node.rev))throw fault('STORAGE_CONFLICT');return node;
  }
  const split=path.lastIndexOf('/'),parent=folderId(path.slice(0,split));if(!parent)throw fault('STORAGE_CONFLICT');
  const quote=v=>v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const data=await request(drive+'files?'+new URLSearchParams({q:`'${quote(parent)}' in parents and name = '${quote(path.slice(split+1))}' and trashed = false`,fields:'nextPageToken,files(id,mimeType,appProperties)',pageSize:'2'}));
  if(!Array.isArray(data.files)||data.nextPageToken||data.files.length>1)throw fault('STORAGE_CONFLICT');const node=data.files[0];
  if(node&&(node.mimeType!=='image/png'||node.appProperties?.naroPersonalCloud!=='1'||!node.id))throw fault('STORAGE_CONFLICT');return node||null;
 }
 async function download(path){
  const node=await find(path);if(!node)throw fault('STORAGE_INVALID');
  const bytes=provider==='dropbox'?await request('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/'+path})},binary:true}):await request(drive+'files/'+encodeURIComponent(node.id)+'?alt=media',{binary:true});
  if(!path.endsWith('/'+await pngDigest(bytes)+'.png'))throw fault('STORAGE_CONFLICT');return bytes;
 }
 return Object.freeze({
  download,
  async upload(kind,bytes){
   check();if(busy)throw fault('BUSY');busy=true;
   try{
    const digest=await pngDigest(bytes),path=assetPath(kind,digest);
    if(await find(path)){await download(path);return {path};}
    if(intents.has(path))throw fault('SAVE_UNCONFIRMED'); // never replay an ambiguous POST
    if(provider==='dropbox'){
     intents.set(path,true);
     await request('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path:'/'+path,mode:'add',autorename:false,strict_conflict:true,mute:true})},body:bytes,write:true});
    }else{
     const generated=await request(drive+'files/generateIds?count=1&space=drive&type=files');const id=generated.ids?.[0];if(typeof id!=='string'||!id)throw fault('STORAGE_INVALID');
     const metadata={id,name:digest+'.png',mimeType:'image/png',parents:[folderId(assetFolders[kind])],appProperties:{naroPersonalCloud:'1'}};
     const boundary='naro_asset_'+digest;
     const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`,bytes,`\r\n--${boundary}--\r\n`]);
     intents.set(path,id);
     await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body,write:true});
    }
    await download(path);return {path};
   }finally{busy=false;}
  }
 });
}
