const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.slice(html.indexOf('async function syncStockForQuote('),html.indexOf('/* ── 스키마 마이그레이션'));
const ctx=vm.createContext({db:{stock_moves:[{id:'original'}],quotes:[{id:'q',no:'Q-1'}]},confirm:()=>true,toast:()=>{},stockDeltaForQuote:()=>({moves:[{id:'new'}],desc:[]})});
vm.runInContext(fs.readFileSync(path.join(root,'stock-entry.js'),'utf8'),ctx);vm.runInContext(source,ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(run(`stockFingerprint([{id:'old',memo:'견적 Q-1 출고'}])`),run(`stockFingerprint([{id:'old',memo:'견적 Q-1 출고',quote_id:'q'}])`),'legacy quote migration must not create a false conflict');
assert(!html.includes('(p.date||"").slice(5)'), 'payment year missing');
assert(html.includes('back.moves.length && !await syncStockForQuote'),'delete must stop on failed stock restoration');
assert(html.includes('variant-field variant-buy')&&html.includes('variant-field variant-sell'));
(async()=>{
 let calls=0;ctx.saveStockChecked=async(expected,next)=>{calls++;assert.equal(expected,JSON.stringify([{id:'original'}]));assert.equal(next.length,2);throw Error('conflict');};
 assert.equal(await run(`syncStockForQuote({id:'q'},{ask:false})`),false);assert.equal(ctx.db.stock_moves.length,1);
 ctx.saveStockChecked=async()=>{calls++};
 assert.equal(await run(`syncStockForQuote({id:'q'},{ask:false})`),true);assert.equal(ctx.db.stock_moves.length,2);assert.equal(calls,2);
 console.log('PASS: quote stock conditional save, conflict preserves ledger, legacy link normalization, restoration guard and review UI structure');
})().catch(e=>{console.error(e);process.exitCode=1});
