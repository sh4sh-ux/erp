// Existing v1.186 company shape; no provider-specific business fields.
export const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function validateCompany(record){
 const fields=['id','name','type','biz_no','contact','phone','email','address_base','address_detail','address','memo','quote_memo','prices','created_at'];
 const fail=()=>{throw Object.assign(Error('VALIDATION'),{code:'VALIDATION'});};
 if(!record||Object.keys(record).length!==fields.length||fields.some(k=>!Object.hasOwn(record,k)))fail();
 if(fields.filter(k=>k!=='prices').some(k=>typeof record[k]!=='string'))fail();
 if(!/^[a-zA-Z0-9-]{1,128}$/.test(record.id)||!record.name.trim()||!['매출','매입'].includes(record.type)||!Array.isArray(record.prices)||record.prices.length)fail();
 const limits={name:200,biz_no:100,contact:200,phone:100,email:320,address_base:500,address_detail:500,address:1001,memo:2000,quote_memo:2000,created_at:40};
 if(!record.created_at||Object.entries(limits).some(([k,n])=>record[k].length>n))fail();
 return structuredClone(record);
}
