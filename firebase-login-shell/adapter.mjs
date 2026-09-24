export const collections=Object.freeze(['companies','items','quotes','payments','stock_moves','material_moves']);
export function prepareSnapshot(value){
 if(value?.settings?.schema!==3)throw Object.assign(Error('schema-invalid'),{code:'schema-invalid'});
 for(const n of collections)if(!Array.isArray(value[n])||value[n].some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Object.assign(Error('load-failed'),{code:'load-failed'});
 // v1.185 renderer has a legacy ID/ledger repair helper. Do not migrate in STAGED.
 if(value.quotes.some(q=>!Array.isArray(q.deliveries)||(q.lines||[]).some(l=>!l.id)))throw Object.assign(Error('legacy-shape'),{code:'load-failed'});
 return structuredClone({...Object.fromEntries(collections.map(n=>[n,value[n]])),settings:value.settings});
}
export function clearSnapshot(db){for(const n of collections)db[n]=[];db.settings={};}
