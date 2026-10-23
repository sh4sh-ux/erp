import {tables,fault} from '../personal-cloud-onboarding/core.mjs';
import {planMerge} from '../personal-cloud-onboarding/extended-contract.mjs';
// 매입(10/22 5단계): 백업에 매입(purchases)이 있으면 없는 매입서만 하나씩 더한다(매입 저장 규칙이 한 번에 한 건만 받는다).
// 순서: 거래처·품목·견적 → 매입 → 입출금·재고(매입에 연결된 줄이 매입을 찾을 수 있게) → 자재.
const PURCHASE_AFTER='quotes';
export function createMergeImport(repository){
 let plan=null,index=0,busy=false,uncertain=false,uncertainPurchase=false;
 const snapshot=()=>Object.fromEntries([...tables.map(k=>[k,repository.loadCollection(k)]),['settings',repository.loadObject('settings')]]);
 const purchaseRows=backup=>{const rows=backup?.purchases?.rows;if(rows===undefined)return [];if(!Array.isArray(rows))throw fault('VALIDATION');return rows;};
 async function purchasesReady(){
  if(!repository.loadPurchases)return false;
  let st=repository.purchasesState();
  if(st.status==='unknown'||st.status==='error'){await repository.loadPurchases();st=repository.purchasesState();}
  if(st.status==='absent'){await repository.startPurchases();st=repository.purchasesState();}
  return st.status==='ready';
 }
 function build(backup,options){
  const base=planMerge(snapshot(),backup,options),rows=purchaseRows(backup);
  // 매입 기능이 없는 저장소면 매입은 건너뛴다(나머지는 그대로 가져온다).
  if(!rows.length||!repository.loadPurchases||repository.purchasesState?.().status==='unsupported')return {steps:base.steps};
  const have=new Set(repository.purchasesState?.().status==='ready'?repository.loadPurchasesDoc().rows.map(r=>r.id):[]);
  const adds=rows.filter(r=>r&&typeof r==='object'&&!have.has(r.id)).map(row=>({purchase:true,row:structuredClone(row)}));
  const at=tables.indexOf(PURCHASE_AFTER),cut=base.steps.findIndex(s=>tables.indexOf(s.key)>at);
  const steps=cut<0?[...base.steps,...adds]:[...base.steps.slice(0,cut),...adds,...base.steps.slice(cut)];
  return {steps};
 }
 return {
  active:()=>plan!==null,
  preview(backup,options={}){if(plan||busy)throw fault('BUSY');return {count:build(backup,options).steps.length};},
  async run(backup,onProgress,options={}){
   if(busy)throw fault('BUSY');busy=true;
   try{
    if(!plan){if(purchaseRows(backup).length&&repository.loadPurchases)await purchasesReady();plan=build(backup,options);index=0;}
    for(;index<plan.steps.length;index++){
     const step=plan.steps[index];
     if(step.purchase){
      if(uncertainPurchase){await repository.savePurchases(null,{recover:true});uncertainPurchase=false;continue;}
      if(!await purchasesReady())throw fault('UNAVAILABLE');
      const doc=repository.loadPurchasesDoc();
      if(!doc.rows.some(r=>r.id===step.row.id)){
       try{await repository.savePurchases({...doc,rows:[...doc.rows,step.row]});}
       catch(e){if(e.code==='SAVE_UNCONFIRMED')uncertainPurchase=true;throw e;}
      }
      try{onProgress?.(index+1,plan.steps.length);}catch{}
      continue;
     }
     const {key,row}=step;
     if(uncertain){await repository.saveTable(key,null,{recover:true});uncertain=false;continue;}
     try{await repository.saveTable(key,[...repository.loadCollection(key),row]);try{onProgress?.(index+1,plan.steps.length);}catch{}}
     catch(e){if(e.code==='SAVE_UNCONFIRMED')uncertain=true;throw e;}
    }
    const result={data:snapshot(),completed:index,total:plan.steps.length};plan=null;return result;
   }catch(e){e.importProgress={completed:index,total:plan?.steps.length||0};throw e;}
   finally{busy=false;}
  }
 };
}
