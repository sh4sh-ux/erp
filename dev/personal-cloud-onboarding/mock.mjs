// TEST/LOCAL ONLY. No external calls, credentials, browser storage or real accounts.
import {fault} from './core.mjs';
export function mockAuth() {
 const accounts=new Map();let current=null;let counter=0;
 const identity=()=>current?{uid:current.uid,emailVerified:current.verified}:null;
 const validate=(email,password)=>{if(!/^[^@]+@[^@]+\.invalid$/.test(email))throw fault('auth/invalid-email');if(password.length<8)throw fault('auth/weak-password');};
 return {
  async signup(email,password){validate(email,password);if(accounts.has(email))throw fault('auth/email-already-in-use');current={uid:`mock-account-${++counter}`,verified:false};accounts.set(email,current);return identity();},
  // Password ignored deliberately; never retained or hashed in this mock. Not real authentication.
  async login(email,password){validate(email,password);if(!accounts.has(email))throw fault('auth/invalid-credential');current=accounts.get(email);return identity();},
  async sendVerification(){if(!current)throw fault('SESSION_EXPIRED');},
  async reload(){return identity();},
  async reset(){},
  async logout(){current=null;},
  confirmMockEmail(){if(current)current.verified=true;}
 };
}
export function mockCloud() {
 const spaces=new Map();
 return (kind,uid)=>{
  const key=`${kind}:${uid}`;let connected=false;
  if(!spaces.has(key))spaces.set(key,{files:new Map(),folders:new Set()});
  const space=spaces.get(key);const check=()=>{if(!connected)throw fault('RECONNECT_REQUIRED');};
  return {
   async connect(){connected=true;},async disconnect(){connected=false;},
   async exists(path){check();return space.files.has(path);},
   async load(path){check();if(!space.files.has(path))throw fault('STORAGE_INVALID');return structuredClone(space.files.get(path));},
   async list(){check();return [...space.files.keys()];},
   async prepareFolders(paths){check();paths.forEach(p=>space.folders.add(p));},
   async createOnly(path,value){check();if(space.files.has(path))throw fault('STORAGE_CONFLICT');space.files.set(path,structuredClone(value));},
   async downloadAsset(){check();throw fault('STORAGE_INVALID');}
  };
 };
}
