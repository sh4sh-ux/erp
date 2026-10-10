import {tables,validateData,fault,boundedRead,folders,emptyData,parallelRead} from '../personal-cloud-onboarding/core.mjs';
import {validateBusinessChange} from '../personal-cloud-onboarding/business-contract.mjs';
import {validateExtendedChange} from '../personal-cloud-onboarding/extended-contract.mjs';
import {validatePurchasesChange,validatePurchaseLinks,validatePurchase,emptyPurchases,capacity,PURCHASES_SCHEMA} from '../personal-cloud-onboarding/purchase-contract.mjs';
import {costLedger,runIssues} from './purchase-ledger.mjs';
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
// 읽어 온 매입 파일 전체 검사(구조 + 줄마다 규칙). 문제 있으면 매입만 'error' — 7개 데이터는 그대로.
export function validatePurchasesDoc(doc,snapshot){
 if(!doc||doc.schema!==PURCHASES_SCHEMA||!Array.isArray(doc.rows)||!Array.isArray(doc.archives))throw fault('STORAGE_INVALID');
 validatePurchasesChange(null,{...doc,rows:[],archives:[]},snapshot);
 for(const p of doc.rows)validatePurchase(p,snapshot);
 if(new Set(doc.rows.map(p=>p.id)).size!==doc.rows.length)throw fault('STORAGE_INVALID');
 return true;
}
// 새 원가 확정은 '지금' 시점에만(지난 출고 원가를 바꾸지 않게) + 음수·원가 모르는 재고는 확인 표시가 있어야 한다.
export function checkNewRuns(before,next,snapshot){
 const prev=new Map((before?.rows||[]).map(p=>[p.id,p]));
 for(const p of next.rows){
  const old=prev.get(p.id)?.cost_runs||[],runs=p.cost_runs||[];
  for(const run of runs.slice(old.length)){
   if(run.after_move_count!==snapshot.stock_moves.length)throw fault('VALIDATION');
   const issues=runIssues(costLedger({stock_moves:snapshot.stock_moves,purchases:before}),p);
   if(issues.some(code=>!(run.acknowledged_issues||[]).includes(code)))throw fault('VALIDATION');
  }
 }
}
export function createStorageRepository(provider,{companiesCreate=false,businessWrite=false,extendedWrite=false}={}){
 let snapshot=null,identities=null,closed=false,generation=0;
 let saving=false;
 let pending=null;
 // 매입 파일(10/10, 1단계): 7개 데이터와 따로 있는 선택 파일. 상태: unknown · unsupported(Drive 등) · absent(시작 전) · ready · error.
 // 이 상태는 7개 데이터 읽기·저장에 영향을 주지 않는다(실패해도 기존 기능은 그대로).
 let purchases={status:'unknown',doc:null,identity:null,pending:null,error:null};
 const purchaseState=()=>({status:purchases.status,count:purchases.doc?.rows.length??0,capacity:purchases.doc?capacity(purchases.doc):null,unfinishedSave:!!purchases.pending,error:purchases.error});
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
   snapshot=null;identities=null;purchases={status:'unknown',doc:null,identity:null,pending:null,error:null};
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
   // 매입과 연결된 새 줄(purchase_id)만 추가 검사 — 연결 없는 기존 저장은 지금과 똑같다.
   if(!pending)validatePurchaseLinks(key,intent.before,intent.next,purchases.status==='ready'?purchases.doc:null);
   saving=true;
   try{
    const result=await provider.updateDataset(intent.key,intent.before,intent.next,intent.identity,{recoveryOnly:recover});check(g);
    snapshot={...snapshot,[intent.key]:structuredClone(result.rows)};
    identities=identities.map(i=>i.logicalKey===intent.key?result.identity:i);pending=null;
    return {key:intent.key,rows:structuredClone(result.rows)};
   }catch(e){if(e.code==='SAVE_UNCONFIRMED')pending=intent;throw e;}
   finally{saving=false;}
  },
  // ── 매입 파일 ──
  purchasesState:()=>purchaseState(),
  loadPurchasesDoc(){if(purchases.status!=='ready'||closed)throw fault('STORAGE_INVALID');return structuredClone(purchases.doc);},
  // 7개 데이터를 읽은 뒤 따로 부른다. 어떤 실패도 7개 데이터 상태를 바꾸지 않는다.
  async loadPurchases(){
   const g=generation;check(g);if(!snapshot)throw fault('BUSY');
   const b=provider.backend;
   if(!b?.purchasesIdentity||!b?.loadPurchases){purchases={status:'unsupported',doc:null,identity:null,pending:null,error:null};return purchaseState();}
   try{
    const before=await b.purchasesIdentity();check(g);
    if(!before){purchases={status:'absent',doc:null,identity:null,pending:null,error:null};return purchaseState();}
    const doc=await b.loadPurchases();check(g);
    const after=await b.purchasesIdentity();check(g);
    if(!after||!same(before,after))throw fault('STORAGE_CONFLICT');
    validatePurchasesDoc(doc,snapshot);
    purchases={status:'ready',doc,identity:after,pending:null,error:null};
   }catch(e){if(e.code==='CANCELLED')throw e;purchases={status:'error',doc:null,identity:null,pending:null,error:e.code||'INTERNAL_ERROR'};}
   return purchaseState();
  },
  // [매입 시작하기]: 빈 매입 파일 만들기(이미 있으면 덮지 않고 읽기).
  async startPurchases(){
   const g=generation;check(g);
   if(!businessWrite||!extendedWrite||!snapshot)throw fault('WRITE_BLOCKED');
   if(purchases.status!=='absent')throw fault(purchases.status==='ready'?'STORAGE_CONFLICT':'UNAVAILABLE');
   if(saving)throw fault('BUSY');saving=true;
   try{
    const result=await provider.backend.createPurchases(validatePurchasesChange(null,emptyPurchases(),snapshot));check(g);
    validatePurchasesDoc(result.value,snapshot);
    purchases={status:'ready',doc:result.value,identity:result.identity,pending:null,error:null};
    return {created:result.created,...purchaseState()};
   }finally{saving=false;}
  },
  // 매입 저장(1번에 매입 1건). 원가 확정을 더할 때는 확정 시점 = 지금 재고 기록 수, 음수·원가 모르는 재고는 확인 표시 필수.
  async savePurchases(next,{recover=false}={}){
   const g=generation;check(g);
   if(!businessWrite||!extendedWrite||!snapshot||purchases.status!=='ready')throw fault('WRITE_BLOCKED');
   if(saving)throw fault('BUSY');
   if(purchases.pending&&!recover)throw fault('SAVE_UNCONFIRMED');
   if(recover&&!purchases.pending)throw fault('STORAGE_INVALID');
   const intent=purchases.pending||{before:structuredClone(purchases.doc),next:validatePurchasesChange(purchases.doc,next,snapshot,{stock_moves:snapshot.stock_moves,payments:snapshot.payments}),identity:structuredClone(purchases.identity)};
   if(!purchases.pending)checkNewRuns(intent.before,intent.next,snapshot);
   saving=true;
   try{
    const result=await provider.backend.updateDataset('purchases',intent.before,intent.next,intent.identity,{recoveryOnly:recover});check(g);
    purchases={...purchases,doc:structuredClone(result.rows),identity:result.identity,pending:null};
    return structuredClone(result.rows);
   }catch(e){if(e.code==='SAVE_UNCONFIRMED')purchases={...purchases,pending:intent};throw e;}
   finally{saving=false;}
  },
  dispose(){closed=true;generation++;snapshot=null;identities=null;purchases={status:'unknown',doc:null,identity:null,pending:null,error:null};}
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
