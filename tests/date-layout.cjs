// Run with NODE_PATH pointing at a Playwright installation. Uses isolated sample data only.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').replace(/init\(\);\s*<\/script>/,'</script>');
    await page.route('https://erp-test.invalid/**',route=>route.fulfill({contentType:'text/html',body:html}));
    await page.goto('https://erp-test.invalid/');
    await page.evaluate(()=>{
      document.getElementById('loginView').classList.add('hidden');
      document.getElementById('appView').classList.remove('hidden');
      db.companies=[{id:'c1',name:'테스트 거래처',type:'매출'}];
      const q=blankQuote();q.id='q1';q.company_id='c1';q.status='수주';q.no='TEST';
      q.lines=[{...blankLine(),name:'테스트 품목',qty:25,price:10000}];db.quotes=[q];
    });
    let checked=0;
    for(const width of [320,375,390,430,768,1280]){
      await page.setViewportSize({width,height:900});
      for(const view of ['quotes','payments','stock','sales','dash']){
        await page.evaluate(v=>{qtSel=null;qtEditing=null;switchView(v);enhanceDateControls()},view);
        const result=await page.evaluate(()=>Array.from(document.querySelectorAll('input[type=date],input[type=month]')).filter(e=>e.getBoundingClientRect().width&&e.closest('.view')&&!e.closest('.view').classList.contains('hidden')).map(e=>{
          const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();
          return {id:e.id,left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right,screen:innerWidth,display:e.parentElement.querySelector('.date-control-display')?.textContent};
        }));
        for(const r of result){
          assert.ok(r.left>=r.parentLeft-1&&r.right<=r.parentRight+1,JSON.stringify({width,view,...r}));
          assert.ok(r.right<=width+1,JSON.stringify({width,view,...r}));checked++;
        }
      }
      await page.evaluate(()=>{switchView('quotes');qtSel='q1';qtEditing=null;qtDeliveryOpen=true;renderQtDetail();enhanceDateControls()});
      for(const id of ['fq_date','fd_date']){
        const input=page.locator('#'+id);
        if(await input.count()){
          await input.fill('2026-09-08');
          assert.equal(await input.locator('..').locator('.date-control-display').textContent(),'2026. 9. 8.');
          const r=await input.boundingBox();assert.ok(r.x+r.width<=width+1);checked++;
        }
      }
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${checked} date/month bounds and input labels across 6 widths; no page errors (Chromium, not physical iOS)`);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
