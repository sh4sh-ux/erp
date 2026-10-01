import {fault,tables} from './core.mjs';
import {canonical} from './company-contract.mjs';
import {validateBusinessChange} from './business-contract.mjs';
import {validateAssetPath} from './asset-store.mjs';
export const extendedDatasets=Object.freeze([...tables,'settings']);
const valid=x=>{if(!x)throw fault('VALIDATION');};
const equal=(a,b)=>canonical(a)===canonical(b);
function records(rows){
 valid(Array.isArray(rows)&&rows.length<=20000);
 const ids=new Set();for(const r of rows){valid(r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.id==='string'&&r.id.length>0&&!ids.has(r.id));ids.add(r.id);}return ids;
}
function settings(value){
 valid(value&&typeof value==='object'&&!Array.isArray(value)&&value.schema===3);
 // Preserve existing schema-3 settings, but reject executable/prototype payloads.
 const visit=v=>{if(typeof v==='string')valid(v.length<=10000);else if(typeof v==='number')valid(Number.isFinite(v));else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){valid(!['__proto__','constructor','prototype'].includes(k));visit(x);}};visit(value);
 for(const key of ['business_card_url','biz_cert_url'])if(value[key])valid(typeof value[key]==='string'&&/^https:\/\//i.test(value[key]));
 if(value.assets!==undefined){valid(value.assets&&typeof value.assets==='object'&&!Array.isArray(value.assets)&&Object.keys(value.assets).length<=2000);for(const [key,path] of Object.entries(value.assets)){valid(key==='card'||key==='registration'||key.startsWith('product:')&&key.length<=160);validateAssetPath(path);}}
}
function material(rows,snapshot){
 const totals=new Map();
 for(const r of rows){
  valid(snapshot.companies.some(c=>c.id===r.company_id));
  valid(typeof r.material==='string'&&r.material.trim()&&r.material.length<=10000);
  valid(['받음','작업 완료','반환','불량/분실'].includes(r.kind)&&Number.isSafeInteger(r.qty)&&r.qty>0);
  valid(/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&Number.isFinite(Date.parse(r.date))&&new Date(r.date).toISOString().slice(0,10)===r.date);
  if(r.quote_id)valid(snapshot.quotes.some(q=>q.id===r.quote_id&&q.company_id===r.company_id));
  if(r.work_item_id)valid(snapshot.items.some(i=>i.id===r.work_item_id));
  if(r.kind==='작업 완료')valid(Number.isSafeInteger(r.work_qty)&&r.work_qty>0&&Number.isSafeInteger(r.per_unit)&&r.per_unit>0&&r.qty===r.work_qty*r.per_unit);
 }
 for(const r of rows.filter(r=>!r.void_at).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.created_at||'').localeCompare(b.created_at||''))){const k=JSON.stringify([r.company_id,r.material]);const n=(totals.get(k)||0)+(r.kind==='받음'?r.qty:-r.qty);valid(n>=0);totals.set(k,n);}
}
function deletion(key,row,s){
 const id=row.id;
 if(key==='companies')valid(!s.quotes.some(r=>r.company_id===id)&&!s.payments.some(r=>r.company_id===id)&&!s.material_moves.some(r=>r.company_id===id));
 if(key==='items')valid(!s.items.some(r=>(r.components||[]).some(c=>c.item_id===id))&&!s.quotes.some(r=>(r.lines||[]).some(l=>l.item_id===id))&&!s.stock_moves.some(r=>r.item_id===id)&&!s.material_moves.some(r=>r.work_item_id===id));
 if(key==='quotes')valid(!(row.deliveries||[]).length&&!s.payments.some(r=>r.quote_id===id)&&!s.stock_moves.some(r=>r.quote_id===id)&&!s.material_moves.some(r=>r.quote_id===id));
 // Stock/material cancellation retains audit history; never hard-delete ledgers.
 if(['stock_moves','material_moves'].includes(key))throw fault('WRITE_BLOCKED');
}
export function validateExtendedChange(key,before,next,snapshot){
 if(!extendedDatasets.includes(key))throw fault('WRITE_BLOCKED');
 valid(JSON.stringify(next).length<=1048576);
 if(key==='settings'){settings(next);return structuredClone(next);}
 records(before);const ids=records(next),old=new Map(before.map(r=>[r.id,r]));
 const removed=before.filter(r=>!ids.has(r.id)),changed=next.filter(r=>!old.has(r.id)||!equal(r,old.get(r.id)));
 if(removed.length){valid(removed.length===1&&changed.length===0);deletion(key,removed[0],snapshot);return structuredClone(next);}
 if(key==='material_moves'){
  valid(changed.length<=1);for(const r of changed)if(old.has(r.id)){const prior=old.get(r.id);valid(!prior.void_at&&r.created_at===prior.created_at);if(r.void_at)valid(equal({...r,void_at:undefined},{...prior,void_at:undefined}));}
  material(next,snapshot);return structuredClone(next);
 }
 if(key==='stock_moves'&&changed.some(r=>old.has(r.id))){
  const edited=changed.filter(r=>old.has(r.id)),added=changed.filter(r=>!old.has(r.id));valid(edited.length===1&&added.length===1);
  const row=edited[0],prior=old.get(row.id),reverse=added[0],audit=row.audit?.at(-1);
  valid(!prior.quote_id&&!prior.cancelled_at&&!prior.reversal_of&&!before.some(r=>r.reversal_of===prior.id));
  valid(typeof row.cancelled_at==='string'&&Number.isFinite(Date.parse(row.cancelled_at))&&audit?.action==='void'&&typeof audit.reason==='string'&&audit.reason.trim());
  valid(equal({...row,cancelled_at:undefined,audit:undefined},{...prior,cancelled_at:undefined,audit:undefined})&&equal(row.audit.slice(0,-1),prior.audit||[]));
  valid(reverse.reversal_of===prior.id&&!reverse.quote_id&&reverse.item_id===prior.item_id&&reverse.qty===prior.qty&&reverse.kind===(prior.kind==='입고'?'출고':'입고')&&(reverse.color||'')===(prior.color||'')&&(reverse.spec||'')===(prior.spec||'')&&equal(reverse.audit,[audit]));
  validateBusinessChange(key,before,[...before,reverse],snapshot);
  const balance=before.filter(r=>r.item_id===prior.item_id&&(r.color||'')===(prior.color||'')&&(r.spec||'')===(prior.spec||'')).reduce((n,r)=>n+(r.kind==='입고'?r.qty:-r.qty),0);
  valid(balance+(reverse.kind==='입고'?reverse.qty:-reverse.qty)>=Math.min(balance,0));
  return structuredClone(next);
 }
 return validateBusinessChange(key,before,next,snapshot);
}
// Add-only merge: existing IDs must be identical. No overwrite, deletion or
// settings replacement is hidden inside an import operation.
export function planMerge(snapshot,backup){
 valid(backup?.app==='erp'&&backup.format===1);
 const merged=structuredClone(snapshot),steps=[];
 for(const key of tables){
  if(backup[key]===undefined)continue;records(backup[key]);
  for(const row of backup[key]){const old=merged[key].find(r=>r.id===row.id);if(old){if(!equal(old,row))throw fault('STORAGE_CONFLICT');continue;}
   merged[key]=[...merged[key],structuredClone(row)];steps.push({key,row:structuredClone(row)});
  }
 }
 // Validate all additions against the completed graph before the first write.
 for(const {key,row} of steps)validateExtendedChange(key,merged[key].filter(r=>r.id!==row.id),merged[key],merged);
 // Settings are intentionally retained; supplier changes use the settings form.
 const ordered=[],remaining=[...steps];const available=new Set(snapshot.items.map(r=>r.id));
 for(const key of tables){
  const group=remaining.filter(s=>s.key===key);
  if(key==='items')while(group.length){const at=group.findIndex(s=>(s.row.components||[]).every(c=>available.has(c.item_id)));if(at<0)throw fault('VALIDATION');const [s]=group.splice(at,1);ordered.push(s);available.add(s.row.id);}
  else if(key==='material_moves')ordered.push(...group.sort((a,b)=>a.row.date.localeCompare(b.row.date)||(a.row.created_at||'').localeCompare(b.row.created_at||'')));
  else ordered.push(...group);
 }
 return {steps:ordered,merged};
}
