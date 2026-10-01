import {fault, boundedRead, tables} from './core.mjs';

// Production OAuth/network adapters are deliberately not supplied by the LOCAL build.
// The injected backend owns provider-specific IDs, App Folder boundaries and session tokens.
class PersonalProvider {
 #backend; #connected=false; #signal;
 constructor(backend,{signal}={}) {this.#backend=backend;this.#signal=signal;}
 #check(){if(this.#signal?.aborted)throw fault('CANCELLED');if(!this.#connected)throw fault('RECONNECT_REQUIRED');}
 async connect(){if(!this.#backend)throw fault('OAUTH_SETUP_REQUIRED');await this.#backend.connect();
  if(this.#signal?.aborted){await this.#backend.disconnect();throw fault('CANCELLED');}this.#connected=true;}
 async disconnect(){this.#connected=false;await this.#backend?.disconnect();}
 async #read(fn){this.#check();const result=await boundedRead(fn,{signal:this.#signal});this.#check();return result;}
 exists(path){return this.#read(()=>this.#backend.exists(path));}
 load(path){return this.#read(()=>this.#backend.load(path));}
 list(){return this.#read(()=>this.#backend.list());}
 async prepareFolders(folders){this.#check();await this.#backend.prepareFolders(folders);this.#check();}
 async save(path,value,options={}){
  this.#check();
  const name=path.split('/').pop()?.replace(/\.json$/,'');
  const isEmptyTable=tables.includes(name)&&Array.isArray(value)&&value.length===0;
  const isSettings=name==='settings'&&JSON.stringify(value)==='{"schema":3}';
  if(!options.bootstrap||!options.createOnly||path!==`NARO Biz/Data/${name}.json`||(!isEmptyTable&&!isSettings))throw fault('WRITE_BLOCKED');
  // No retries: ambiguous mutation results require reconciliation, never blind replay.
  await this.#backend.createOnly(path,structuredClone(value));this.#check();
 }
 async uploadAsset(){throw fault('WRITE_BLOCKED');}
 downloadAsset(path){if(!/^NARO Biz\/(Images|Documents)\//.test(path)||path.includes('..'))throw fault('WRITE_BLOCKED');return this.#read(()=>this.#backend.downloadAsset(path));}
}
export class GoogleDriveProvider extends PersonalProvider {}
export class DropboxProvider extends PersonalProvider {}
export const providerContract=Object.freeze(['connect','disconnect','exists','load','save','list','uploadAsset','downloadAsset']);

// Only safe status/reason mapping; raw provider responses never become UI/log messages.
export function providerFailure(status,reason='') {
 if(status===401)return fault('RECONNECT_REQUIRED');
 if(['dailyLimitExceeded','storageQuotaExceeded','quotaExceeded','insufficient_space'].includes(reason))return fault('QUOTA_LIMIT');
 if(status===429 || ['rateLimitExceeded','userRateLimitExceeded'].includes(reason))return fault('RATE_LIMIT');
 if(status>=500)return fault('NETWORK_ERROR');
 return fault('UNAVAILABLE');
}
