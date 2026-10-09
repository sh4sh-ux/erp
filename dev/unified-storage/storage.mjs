import {tables,validateData,fault,boundedRead,folders,emptyData,parallelRead} from '../personal-cloud-onboarding/core.mjs';
import {validateBusinessChange} from '../personal-cloud-onboarding/business-contract.mjs';
import {validateExtendedChange} from '../personal-cloud-onboarding/extended-contract.mjs';
export const keys=Object.freeze([...tables,'settings']);
export const datasetPath=key=>{if(!keys.includes(key))throw fault('STORAGE_INVALID');return `NARO Biz/Data/${key}.json`;};
export const denyWrite=()=>{throw fault('WRITE_BLOCKED');};
const same=(a,b)=>a.provider===b.provider&&a.fileId===b.fileId&&a.path===b.path&&a.logicalKey===b.logicalKey&&a.revision===b.revision;
export class StorageProvider {
 constructor(backend,{signal}={}){this.backend=backend;this.signal=signal;}
 connect(){return this.backend.connect();}
 disconnect(){return this.backend.disconnect();}
 async discover(discoveredPaths){
  const paths=discoveredPaths??await boundedRead(()=>this.backend.list(),{signal:this.signal});
  if(paths.length!==7||new Set(paths).size!==7||!keys.every(k=>paths.includes(datasetPath(k))))throw fault('STORAGE_CONFLICT');
  const identities=await this.identities({discovered:true});
  return keys.map((logicalKey,i)=>{
   const identity=identities[i];
   if(identity.logicalKey!==logicalKey||!identity.fileId||!identity.revision||!identity.provider)throw fault('STORAGE_INVALID');
   return identity;
  });
 }
 identity(key){return boundedRead(()=>this.backend.identity(datasetPath(key)),{signal:this.signal});}
 identities(){return parallelRead(keys,key=>this.identity(key));}
 read(key){return boundedRead(()=>this.backend.load(datasetPath(key)),{signal:this.signal});}
 saveSnapshot(){return denyWrite();}
 create(){return denyWrite();}
 update(){return denyWrite();}
 delete(){return denyWrite();}
}
export class GoogleDriveProvider extends StorageProvider {
 identities({discovered=false}={}){const fresh=discovered?this.backend.takeDiscoveryIdentities?.():null;return fresh??(this.backend.identities?boundedRead(()=>this.backend.identities(),{signal:this.signal}):super.identities());}
 updateDataset(...args){return this.backend.updateDataset(...args);}
 checkCompanyWrite(identity){return this.backend.checkCompanyWrite(identity);}
 createCompany(record,identity,options){return this.backend.createCompany(record,identity,options);}
}
// Only the new App Folder backend may implement this boundary. No legacy tokens,
// /erp fallback, full-Dropbox traversal, OAuth or network configuration is imported.
export class DropboxProvider extends StorageProvider {
 updateDataset(...args){return this.backend.updateDataset(...args);}
 async discover(){
  // Bootstrap's root sentinel distinguishes a partial folder from an absent
  // workspace; the unified layer deals only in the seven logical datasets.
  const original=this.backend;
  const paths=await boundedRead(()=>original.list(),{signal:this.signal});
  const datasets=paths.filter(p=>p!=='NARO Biz/');
  if(datasets.length!==7||new Set(datasets).size!==7||!keys.every(k=>datasets.includes(datasetPath(k))))throw fault('STORAGE_CONFLICT');
  return Promise.all(keys.map(k=>this.identity(k)));
 }
 async identity(key){
  const value=await super.identity(key);
  if(value.provider!=='dropbox'||value.revisionKind!=='dropbox.rev')throw fault('STORAGE_INVALID');
  return value;
 }
}
export function dropboxIdentity(logicalKey,metadata){
 if(metadata?.['.tag']!=='file'||!metadata.id||!metadata.rev||metadata.path_lower!==('/'+datasetPath(logicalKey)).toLowerCase())throw fault('STORAGE_CONFLICT');
 return Object.freeze({provider:'dropbox',logicalKey,fileId:metadata.id,path:metadata.path_lower,revision:metadata.rev,revisionKind:'dropbox.rev',etag:null});
}
export function createStorageRepository(provider,{companiesCreate=false,businessWrite=false,extendedWrite=false}={}){
 let snapshot=null,identities=null,closed=false,generation=0;
 let saving=false;
 let pending=null;
 const check=g=>{if(closed||g!==generation)throw fault('CANCELLED');};
 return Object.freeze({
  capabilities:Object.freeze({merge:businessWrite&&extendedWrite}),
  async uploadAsset(kind,bytes){
   const g=generation;check(g);if(!businessWrite||!extendedWrite||!snapshot)throw fault('WRITE_BLOCKED');if(saving||pending)throw fault('BUSY');
   saving=true;try{const result=await provider.backend.uploadAsset(kind,bytes);check(g);return result;}finally{saving=false;}
  },
  async downloadAsset(path){
   const g=generation;check(g);if(!businessWrite||!extendedWrite||!snapshot||!Object.values(snapshot.settings.assets||{}).includes(path))throw fault('WRITE_BLOCKED');
   const bytes=await provider.backend.downloadAsset(path);check(g);return bytes;
  },
  // 변경 기록(10/9): 데이터 저장과 따로(실패해도 저장은 그대로). Dropbox만 지원 — Drive는 UNAVAILABLE.
  async readLog(month){const g=generation;check(g);if(!snapshot)throw fault('WRITE_BLOCKED');if(!provider.backend.readLog)throw fault('UNAVAILABLE');const rows=await provider.backend.readLog(month);check(g);return rows;},
  async appendLog(entry){const g=generation;check(g);if(!businessWrite||!snapshot)throw fault('WRITE_BLOCKED');if(!provider.backend.appendLog)throw fault('UNAVAILABLE');await provider.backend.appendLog(entry);check(g);return true;},
  async loadAll(discoveredPaths){
   if(saving||pending)throw fault('BUSY');
   const g=++generation;check(g);
   snapshot=null;identities=null;
   const before=await provider.discover(discoveredPaths);check(g);
   const draft={};
   await parallelRead(keys,async key=>{draft[key]=await provider.read(key);check(g);},Math.min(7,provider.backend.readConcurrency||3));
   const after=await provider.identities();check(g);
   if(before.some((identity,i)=>!same(identity,after[i])))throw fault('STORAGE_CONFLICT');
   const validated=validateData(draft);check(g);
   snapshot=validated;identities=after;
   return structuredClone(snapshot);
  },
  loadCollection(key){if(!tables.includes(key)||!snapshot||closed)throw fault('STORAGE_INVALID');return structuredClone(snapshot[key]);},
  loadObject(key){if(key!=='settings'||!snapshot||closed)throw fault('STORAGE_INVALID');return structuredClone(snapshot.settings);},
  identities(){if(!identities||closed)throw fault('STORAGE_INVALID');return structuredClone(identities);},
  async checkCompanyWrite(){
   if(!companiesCreate||!snapshot)throw fault('WRITE_BLOCKED');
   const g=generation;check(g);
   const result=await provider.checkCompanyWrite(identities.find(i=>i.logicalKey==='companies'));check(g);return result;
  },
  async createCompany(record,options={}){
   if(!companiesCreate)throw fault('WRITE_BLOCKED');
   const g=generation;check(g);if(!snapshot||saving)throw fault('BUSY');saving=true;
   try{
    const result=await provider.createCompany(structuredClone(record),identities.find(i=>i.logicalKey==='companies'),options);check(g);
    if(!Array.isArray(result.rows))throw fault('STORAGE_INVALID');
    snapshot={...snapshot,companies:structuredClone(result.rows)};
    identities=identities.map(i=>i.logicalKey==='companies'?result.identity:i);
    return structuredClone(result.rows);
   }finally{saving=false;}
  },
  saveSnapshot:denyWrite,
  saveTable:!businessWrite?denyWrite:async function(key,value,{recover=false}={}){
   if(!businessWrite)throw fault('WRITE_BLOCKED');
   const g=generation;check(g);if(!snapshot||saving)throw fault('BUSY');
   if(pending&&!recover)throw fault('SAVE_UNCONFIRMED');
   if(recover&&!pending)throw fault('STORAGE_INVALID');
   const intent=pending||{key,before:structuredClone(snapshot[key]),next:(extendedWrite?validateExtendedChange:validateBusinessChange)(key,snapshot[key],value,snapshot),identity:structuredClone(identities.find(i=>i.logicalKey===key))};
   saving=true;
   try{
    const result=await provider.updateDataset(intent.key,intent.before,intent.next,intent.identity,{recoveryOnly:recover});check(g);
    snapshot={...snapshot,[intent.key]:structuredClone(result.rows)};
    identities=identities.map(i=>i.logicalKey===intent.key?result.identity:i);pending=null;
    return {key:intent.key,rows:structuredClone(result.rows)};
   }catch(e){if(e.code==='SAVE_UNCONFIRMED')pending=intent;throw e;}
   finally{saving=false;}
  },
  dispose(){closed=true;generation++;snapshot=null;identities=null;}
 });
}
// Existing Table contract; provider details never enter business modules.
export function createTable(repository){return Object.freeze({load:name=>repository.loadCollection(name),loadObj:name=>repository.loadObject(name),save:denyWrite});}
// Adapts the already-tested onboarding controller without changing Auth/session logic.
// bootstrap sees exactly seven existing datasets. Missing/partial storage throws;
// its create branch is unreachable, and every write capability also rejects.
export function onboardingReadProvider(provider,onReady=()=>{},options={}){
 const repository=createStorageRepository(provider,options);
 return {
  connect:()=>provider.connect(),
  async disconnect(){repository.dispose();await provider.disconnect();},
  async list(){
   const started=performance.now();let discoveredPaths;
   if(options.initializeNew&&(provider instanceof DropboxProvider||provider instanceof GoogleDriveProvider)){
    const existing=await boundedRead(()=>provider.backend.list(),{signal:provider.signal});
    if(existing.length)discoveredPaths=existing;
    if(existing.length===0){
     await provider.backend.prepareFolders(folders);const data=emptyData();
     for(const key of keys)await provider.backend.createOnly(datasetPath(key),data[key]);
    }
   }
   await repository.loadAll(discoveredPaths);await onReady(repository,{readMs:Math.round(performance.now()-started)});return keys.map(datasetPath);
  },
  async load(path){const key=keys.find(k=>datasetPath(k)===path);if(!key)throw fault('STORAGE_INVALID');return key==='settings'?repository.loadObject(key):repository.loadCollection(key);},
  save:denyWrite,prepareFolders:denyWrite,repository
 };
}
