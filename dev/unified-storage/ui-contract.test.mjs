// Real rendered styles, with synthetic in-memory data and blocked external traffic.
// Run from repo root: node --test dev/unified-storage/ui-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
const release=resolve(root,'naro-workspace/outputs/naro-redesign/candidate/release');
const contract=await readFile(resolve(here,'ui-contract.css'),'utf8');
const style=e=>{const s=getComputedStyle(e);return {font:s.font,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,letterSpacing:s.letterSpacing,color:s.color};};
const evidence=process.env.NARO_UI_EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
const roles={
 quotes:{title:'#qtForm .qs-val.co',money:'#qtForm .qs-amt-v'},
 companies:{title:'#coForm .co-title-name',money:'#coForm .cp-amt .v'},
 items:{title:'#itForm .co-title-name',desktopOnly:true},
 materials:{title:'.material-detail-head h3'},
 payments:{title:'.pp-detail .pp-head h3',money:'.pp-detail .pp-amount strong'},
 sales:{title:'.nd-sa-header .nd-sa-title',money:'.nd-sa-header-amount strong'},
 purchases:{title:'#puForm .qs-val.co',money:'#puForm .qs-amt-v'}
};
async function prepare(page){
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='https://naro-fixture.test')return route.abort();
  const pathname=url.pathname.replace(/^\//,'')||'erp/index.html';
  if(pathname==='erp/entry.mjs')return route.fulfill({contentType:'application/javascript',body:'export function start() {}'});
  const path=resolve(release,pathname);if(!path.startsWith(release+'/'))return route.abort();
  try{
   let body=await readFile(path);
   if(pathname==='erp/index.html'){
    let html=body.toString();
    html=html.replace(/<style id="naro-ui-contract">[\s\S]*?<\/style>/,'');
    body=html.replace('</body>',`<style id="naro-ui-contract">${contract}</style></body>`);
   }
   return route.fulfill({body,contentType:/\.(js|mjs)$/.test(pathname)?'application/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.png')?'image/png':'text/html'});
  }catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('https://naro-fixture.test/erp/index.html');
 await page.evaluate(async()=>{
  document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden');
  const date=localDate();
  db.companies=[{id:'c',name:'합성 거래처',type:'매출',prices:[]},{id:'v',name:'합성 매입처',type:'매입',prices:[]}];
  db.items=[{id:'i',name:'합성 품목',code:'FIXTURE',type:'단품',colors:['WH'],variants:[],components:[],buy_price:1000,sell_price:2000}];
  db.quotes=[{id:'q',no:'Q-FIXTURE',company_id:'c',date,status:'납품',delivered_at:date,deliveries:[{id:'d',date,lines:[{line_id:'l',qty:100}]}],lines:[{id:'l',item_id:'i',name:'합성 품목',qty:100,price:20000}],vat_on:true}];
  db.payments=[{id:'p',company_id:'c',quote_id:'q',kind:'수금',date,amount:143000,method:'계좌이체',memo:'합성 내역'}];
  db.stock_moves=[{id:'s',item_id:'i',kind:'입고',date,qty:100,color:'WH',spec:''}];
  db.material_moves=[{id:'m',company_id:'c',kind:'받음',material:'합성 자재',date,qty:10}];
  db.settings={schema:3,name:'합성 공급자'};
  Table.save=async()=>{throw Error('Unexpected write in style test');};
  const {installPurchaseUI}=await import('./purchase-ui.mjs');
  let purchase;
  purchase=installPurchaseUI({port:()=>({postMessage(m){
   if(m.type!=='PURCHASE_STATE')throw Error('Unexpected purchase write');
   queueMicrotask(()=>purchase.onMessage({type:'PURCHASE_STATE',requestId:m.requestId,state:{status:'ready'},doc:{schema:1,rows:[{id:'buy',no:'PO-FIXTURE',company_id:'v',date,status:'작성중',lines:[{id:'bl',item_id:'i',name:'합성 품목',qty:10,price:1000}],vat_on:true}]}}));
  }})});
  const {installLogUI}=await import('./log-ui.mjs');let log;
  log=installLogUI({port:()=>({postMessage(m){if(m.type!=='LOG_READ')throw Error('Unexpected log write');queueMicrotask(()=>log.onMessage({type:'LOG_ROWS',requestId:m.requestId,rows:[]}));}})});
  const {installAccessUI}=await import('./access-ui.mjs');let access;
  access=installAccessUI({say(){throw Error('Unexpected access mutation');},port:()=>({postMessage(m){if(m.type!=='ACCESS_LIST')throw Error('Unexpected access write');queueMicrotask(()=>access.onMessage({type:'ACCESS_USERS',requestId:m.requestId,users:[]}));}})});
  window.styleAccess=access;
  switchView('dash');
 });
}
async function open(page,view){
 await page.evaluate(view=>{
  switchView(view);
  if(view==='quotes'){qtSel='q';renderQtDetail();}
  if(view==='companies'){coSel='c';renderCoDetail();}
  if(view==='items'){itSel='i';renderItDetail();}
 },view);
 await page.waitForTimeout(80);
 if(view==='payments'&&await page.locator('.pp-mobile-list').isVisible())await page.locator('.pp-mobile-row').first().click();
 if(view==='purchases'){
  await page.waitForTimeout(100);
  const item=page.locator('#puList .list-item').first();if(await item.count())await item.click();
 }
 await page.waitForTimeout(80);
}
test('all rail destinations share rendered typography in desktop/mobile and light/dark themes',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [320,390,820,1440])for(const theme of ['light','dark']){
  await t.test(`${width}px ${theme}`,async()=>{
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await prepare(page);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    let reference=null;const report=[];
    for(const view of ['dash','quotes','materials','payments','purchases','stock','companies','items','sales','ar','settings']){
     await open(page,view);
     const panel=page.locator('#view-'+view);assert.equal(await panel.isVisible(),true,view);
     const heading=panel.locator('.page-head h2').first();
     assert.ok(await heading.count(),view+' page title');
     assert.equal(await heading.evaluate(e=>getComputedStyle(e).fontSize),width<1024?'22px':'24px',view+' page title size');
     const kpis=panel.locator('.nd-db-metric strong,.pp-metrics strong,.nd-sa-kpis strong,.cp-ov .v b,.stats>.stat>.v');
     for(const kpi of await kpis.all()){
      const numeric=await kpi.evaluate(style);assert.equal(numeric.fontSize,'20px',view+' KPI size');assert.equal(numeric.letterSpacing,'normal',view+' KPI spacing');assert.equal(numeric.fontWeight,'600',view+' KPI weight');
     }
     if(evidence&&theme==='light'&&[390,1440].includes(width))await page.screenshot({path:resolve(evidence,`${view}-${width}.png`)});
     if(roles[view]&&(!roles[view].desktopOnly||width>=1024)){
      const role=roles[view],title=page.locator(role.title).first();
      assert.ok(await title.count(),view+' title must exist');
      const actual=await title.evaluate(style);
      if(!reference)reference=actual;
      assert.equal(actual.fontSize,width<1024?'19px':'24px',view);
      assert.equal(actual.lineHeight,width<1024?'26.6px':'30px',view);
      assert.equal(actual.fontWeight,'700',view);assert.equal(actual.letterSpacing,'normal',view);
      assert.deepEqual(actual,reference,view+' detail title');
      if(role.money){const amount=page.locator(role.money).first();assert.ok(await amount.count(),view+' header amount must exist');assert.deepEqual(await amount.evaluate(style),reference,view+' header amount');}
      report.push(view);
     }
    }
    const nav=await page.locator('.rail-nav').evaluate(e=>[...e.querySelectorAll('.nav-item,.nd-nav-act')].map(b=>{const s=getComputedStyle(b);return {label:b.textContent.trim(),font:s.fontFamily,size:s.fontSize,line:s.lineHeight};}));
    assert.ok(nav.length>=17);for(const n of nav){assert.equal(n.size,'14px',n.label);assert.equal(n.line,'20px',n.label);assert.equal(n.font,nav[0].font,n.label);}
    await page.evaluate(()=>window.styleAccess.open());await page.waitForTimeout(60);
    assert.equal(await page.locator('.nd-acc-ttl h3').evaluate(e=>getComputedStyle(e).fontSize),'22px');
    const accessTab=page.locator('.nd-acc-chip[aria-selected=true]');
    assert.deepEqual(await accessTab.evaluate(e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.color];}),['rgb(22, 26, 35)','rgb(255, 255, 255)']);
    await page.keyboard.press('Escape');
    // Utility export dialog is appended outside appView; it must inherit the same tokens.
    await page.locator('.rail-nav .nd-nav-act').filter({hasText:'데이터 내보내기'}).evaluate(e=>e.click());
    assert.equal(await page.locator('.nd-export .nd-ex-head h2').evaluate(e=>getComputedStyle(e).fontSize),'22px');
    await page.locator('.nd-export .nd-ex-close').click();
    // Real log dialog and native filtering events, not a mock CSS fragment.
    await page.evaluate(()=>window.NaroChangeLog.open());
    await page.waitForTimeout(60);
    for(const tab of await page.locator('.nd-log-tabs button').all()){
     await tab.click();assert.equal(await tab.getAttribute('aria-pressed'),'true');
     assert.deepEqual(await tab.evaluate(e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.color];}),['rgb(22, 26, 35)','rgb(255, 255, 255)']);
     assert.equal(await page.locator('.nd-log-tabs button[aria-pressed=true]').count(),1);
    }
    if(evidence&&theme==='light'&&[390,1440].includes(width))await page.screenshot({path:resolve(evidence,`change-log-${width}.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'viewport overflow');
    assert.deepEqual(errors,[]);console.log('Checked titles/money:',report.join(', '),'and',nav.length,'rail controls, 8 log filters');
   }finally{await page.close();}
  });
 }}finally{await browser.close();}
});
