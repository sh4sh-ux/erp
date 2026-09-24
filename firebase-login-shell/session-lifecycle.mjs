// UI-independent generation boundary; contains no persistence or Cloud writes.
export function createSessionLifecycle({clear,signOut,exit}){
 let generation=0,session=null,ready=false,tenant=null,closing=false;
 return Object.freeze({
  begin(next){if(closing)throw Error('teardown-in-progress');session?.dispose();session=next;ready=false;tenant=null;return ++generation;},
  current(g){return !closing&&g===generation;},
  reject(g){if(closing||g!==generation)return;session?.dispose();session=null;ready=false;tenant=null;},
  apply(g,id,render){if(closing||g!==generation)return false;render();tenant=id;ready=true;return true;},
  state(){return {generation,session:!!session,ready,tenant:tenant!==null,closing};},
  async teardown(){
   if(closing)return;
   closing=true;++generation;ready=false;tenant=null;
   const old=session;session=null;
   try{old?.dispose();}finally{
    try{clear();}finally{
     try{await signOut();}finally{exit();}
    }
   }
  }
 });
}
