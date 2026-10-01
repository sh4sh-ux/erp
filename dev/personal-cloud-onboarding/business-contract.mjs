import {fault} from './core.mjs';
import {canonical} from './company-contract.mjs';
export const writableDatasets=Object.freeze(['companies','items','quotes','payments','stock_moves']);
const valid=condition=>{if(!condition)throw fault('VALIDATION');};
const string=v=>typeof v==='string'&&v.length<=10000;
const number=v=>typeof v==='number'&&Number.isFinite(v);
function rows(value){
 valid(Array.isArray(value)&&value.length<=20000);
 const ids=new Set();
 for(const row of value){valid(row&&typeof row==='object'&&!Array.isArray(row)&&string(row.id)&&row.id.length>0&&!ids.has(row.id));ids.add(row.id);}
 return ids;
}
// Same v1.186 records. This boundary limits operations; it does not migrate data.
export function validateBusinessChange(key,before,next,snapshot){
 if(!writableDatasets.includes(key))throw fault('WRITE_BLOCKED');
 rows(before);const ids=rows(next);
 valid(JSON.stringify(next).length<=1048576);
 const prior=new Map(before.map(r=>[r.id,r]));
 if(before.some(r=>!ids.has(r.id)))throw fault('WRITE_BLOCKED'); // No delete/import/reset capability.
 const changed=next.filter(r=>!prior.has(r.id)||canonical(r)!==canonical(prior.get(r.id)));
 if(key!=='stock_moves')valid(changed.length<=1);
 const company=id=>snapshot.companies.some(r=>r.id===id);
 const item=id=>snapshot.items.some(r=>r.id===id);
 for(const row of changed){
  if(key==='companies')valid(string(row.name)&&row.name.trim().length>0&&['매출','매입'].includes(row.type)&&Array.isArray(row.prices));
  if(key==='items'){
   valid(string(row.name)&&row.name.trim().length>0&&Array.isArray(row.components)&&Array.isArray(row.variants));
   valid(!row.code||!next.some(r=>r.id!==row.id&&r.code===row.code));
   for(const c of row.components)valid(item(c.item_id)&&c.item_id!==row.id&&Number(c.qty)>0&&Number.isFinite(Number(c.qty)));
   const old=prior.get(row.id);
   if(old&&(snapshot.quotes.length||snapshot.stock_moves.length))valid(row.type===old.type&&canonical(row.components)===canonical(old.components));
  }
  if(key==='quotes'){
   valid(company(row.company_id)&&Array.isArray(row.lines)&&row.lines.length>0&&Array.isArray(row.deliveries));
   const lineIds=rows(row.lines);
   for(const l of row.lines)valid(string(l.name)&&number(l.qty)&&l.qty>0&&number(l.price)&&(!l.item_id||l.item_id==='__free__'||item(l.item_id)));
   rows(row.deliveries);
   for(const d of row.deliveries){valid(Array.isArray(d.lines));for(const l of d.lines)valid(lineIds.has(l.line_id)&&number(l.qty)&&l.qty>0);}
   const old=prior.get(row.id);
   if(old)for(const d of old.deliveries||[])valid(row.deliveries.some(n=>canonical(n)===canonical(d))); // Correction is a separate feature.
  }
  if(key==='payments'){
   if(prior.has(row.id))throw fault('WRITE_BLOCKED');
   valid(company(row.company_id)&&number(row.amount)&&row.amount>0&&['수금','지급'].includes(row.kind));
   if(row.quote_id)valid(snapshot.quotes.some(q=>q.id===row.quote_id&&q.company_id===row.company_id));
  }
  if(key==='stock_moves'){
   if(prior.has(row.id))throw fault('WRITE_BLOCKED');
   valid(item(row.item_id)&&number(row.qty)&&row.qty>0&&['입고','출고'].includes(row.kind));
   if(row.quote_id)valid(snapshot.quotes.some(q=>q.id===row.quote_id));
  }
 }
 return structuredClone(next);
}
