import {tables,fault} from './core.mjs';
import {planMerge} from './extended-contract.mjs';
export function createMergeImport(repository){
 let plan=null,index=0,busy=false,uncertain=false;
 const snapshot=()=>Object.fromEntries([...tables.map(k=>[k,repository.loadCollection(k)]),['settings',repository.loadObject('settings')]]);
 return {
  active:()=>plan!==null,
  preview(backup){if(plan||busy)throw fault('BUSY');return {count:planMerge(snapshot(),backup).steps.length};},
  async run(backup){
   if(busy)throw fault('BUSY');busy=true;
   try{
    if(!plan){plan=planMerge(snapshot(),backup);index=0;}
    for(;index<plan.steps.length;index++){
     const {key,row}=plan.steps[index];
     if(uncertain){await repository.saveTable(key,null,{recover:true});uncertain=false;continue;}
     try{await repository.saveTable(key,[...repository.loadCollection(key),row]);}
     catch(e){if(e.code==='SAVE_UNCONFIRMED')uncertain=true;throw e;}
    }
    const result={data:snapshot(),completed:index,total:plan.steps.length};plan=null;return result;
   }catch(e){e.importProgress={completed:index,total:plan?.steps.length||0};throw e;}
   finally{busy=false;}
  }
 };
}
