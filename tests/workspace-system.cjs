// Isolated regression fixture: no Dropbox, credentials, or real records.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const dir=path.join(__dirname,'..');
 await page.route('**/*',route=>{
   const name=path.basename(new URL(route.request().url()).pathname)||'index.html';
   if(!['index.html','v142-dutch-pay.css','workspace-system.css','workspace-layout.js','navigation-layout.css'].includes(name))return route.fulfill({status:204,body:''});
   let body=fs.readFileSync(path.join(dir,name),'utf8');
   if(name==='index.html')body=body.replace(/init\(\);\s*<\/script>/,'</script>');
   return route.fulfill({contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html',body});
 });
 await page.goto('https://erp-test.invalid/index.html');
 await page.evaluate(()=>{
   document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden');
   db.companies=[{id:'c1',name:'테스트 거래처',type:'매출'}];db.items=[{id:'i1',name:'셰프복',type:'단품',colors:['WH'],variants:[],sell_price:23000}];
   const q=blankQuote();q.id='q1';q.company_id='c1';q.no='TEST';q.lines=[{...blankLine(),item_id:'i1',name:'셰프복',qty:8,price:23000}];db.quotes=[q];
 });
 const views=['dash','quotes','materials','payments','stock','companies','items','sales','ar','settings'];
 for(const view of views){
   await page.evaluate(v=>{switchView(v);if(v==='quotes'){qtSel='q1';renderQtDetail();}if(v==='companies'){coSel='c1';renderCoDetail();}if(v==='items'){itSel='i1';renderItDetail();}},view);
   const result=await page.evaluate(v=>{
     const root=document.getElementById('view-'+v);
     return {controls:Array.from(root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),select,.ip-btn,.btn,.btn-sm,.btn-add,#qtAllDates')).filter(e=>e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden').filter(e=>!e.closest('.search')).map(e=>({id:e.id||e.className,h:e.getBoundingClientRect().height})),overflow:document.documentElement.scrollWidth>innerWidth};
   },view);
   const bad=result.controls.filter(c=>Math.abs(c.h-32)>0.1);
   assert.deepEqual(bad,[],view+' controls');assert.equal(result.overflow,false,view+' viewport overflow');
   console.log('PASS '+view+': '+result.controls.length+' controls at 32px');
 }
 // Mobile must regain original control parents; repeated breakpoint changes cannot duplicate IDs.
 for(const width of [820,1440,820,1440]){
   await page.setViewportSize({width,height:1000});
   await page.waitForTimeout(30);
   const state=await page.evaluate(()=>({dupes:Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter((x,i,a)=>a.indexOf(x)!==i),panes:document.querySelectorAll('.workspace-split').length}));
   assert.deepEqual(state.dupes,[]);assert.equal(state.panes,width>=1024?6:0);
 }
 assert.deepEqual(errors,[]);console.log('PASS breakpoint restoration, unique IDs, no JS errors');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
