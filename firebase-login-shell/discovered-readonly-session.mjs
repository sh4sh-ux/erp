// Read-only session with fresh membership checks before and after loading.
import {collection, doc, getDocsFromServer, getDocFromServer} from 'firebase/firestore';
import {discoverTenants} from './tenant-discovery.mjs';
const names=['companies','items','quotes','payments','stock_moves','material_moves'];
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createDiscoveredReadOnlySession({auth,firestore}) {
  if(!auth||!firestore) fail('configuration');
  let context=null,ready=false,busy=false,disposed=false;
  const live=()=>{if(disposed)fail('session-disposed');};
  const blocked=()=>fail('read-only');
  const checkUser=uid=>{live();if(!uid||auth.currentUser?.uid!==uid)fail('auth-changed');};
  async function owner(tenantId,uid){
    checkUser(uid);
    const snap=await getDocFromServer(doc(firestore,'tenants',tenantId,'members',uid));
    if(!snap.exists()||snap.id!==uid||snap.data().role!=='owner')fail('permission-denied');
    checkUser(uid);
  }
  return Object.freeze({
    async discover(){
      live();
      if(busy)fail('busy');
      busy=true;context=null;ready=false;
      try{
        const uid=auth.currentUser?.uid;
        const result=await discoverTenants({auth,firestore},uid);
        live();
        if(result.status==='SINGLE_TENANT'){
          checkUser(uid);
          // Private context cannot be supplied/altered by a caller's result object.
          context=Object.freeze({uid,tenantId:result.tenants[0],membershipVerified:true,role:'owner'});
        }
        return structuredClone(result);
      }finally{busy=false;}
    },
    async load(tenantId){
      live();
      if(busy)fail('busy');
      ready=false;
      if(!context||tenantId!==context.tenantId)fail('tenant-context-denied');
      busy=true;
      try{
        const {uid}=context;
        await owner(tenantId,uid);
        const values=await Promise.all([
          ...names.map(async n=>(await getDocsFromServer(collection(firestore,'tenants',tenantId,n))).docs.map(d=>d.data().data)),
          getDocFromServer(doc(firestore,'tenants',tenantId,'settings','main'))
        ]);
        const settings=values[6];
        if(!settings.exists())fail('load-failed');
        if(settings.data().data?.schema!==3)fail('schema-invalid');
        if(values.slice(0,6).some(rows=>rows.some(r=>!r||typeof r!=='object'||Array.isArray(r))))fail('load-failed');
        // Recheck after loading too; no partial dataset or stale READY is exposed.
        await owner(tenantId,uid);
        ready=true;
        return {...Object.fromEntries(names.map((n,i)=>[n,values[i]])),settings:settings.data().data};
      }catch(e){context=null;throw e;}finally{busy=false;}
    },
    dispose(){disposed=true;ready=false;context=null;},
    isReady(){return !disposed&&ready&&auth.currentUser?.uid===context?.uid;},
    write:blocked,create:blocked,update:blocked,delete:blocked,
    command:blocked,migrate:blocked,restore:blocked
  });
}
