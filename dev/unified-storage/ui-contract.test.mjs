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
// receipt-db v3.90, index.html body font rule: system-ui must be first for comma glyphs.
const receiptNumberFont='system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Arial, sans-serif';
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
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
  window.supplierOriginalNodes={};window.supplierInputEvents=0;
  for(const id of ['st_name','st_ceo','st_biz','st_phone','st_email','st_bank','st_address','stSaveBtn']){
   const el=document.getElementById(id);window.supplierOriginalNodes[id]=el;
   el?.addEventListener('input',()=>window.supplierInputEvents++);
   if(id==='stSaveBtn')el.onclick=()=>saveSettings();
  }
 }));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='https://naro-fixture.test')return route.abort();
  const pathname=url.pathname.replace(/^\//,'')||'erp/index.html';
  if(pathname==='erp/entry.mjs')return route.fulfill({contentType:'application/javascript',body:'export function start(app) { app.bindBusinessUI(); }'});
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
 await page.waitForFunction(()=>typeof document.getElementById('qtNewBtn').onclick==='function');
 // Keep the async fixture alive while Chrome waits for module imports.
 await page.evaluate(()=>window.naroFixtureReady=(async()=>{
  document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden');
  const date=localDate();
  db.companies=[{id:'c',name:'합성 거래처',type:'매출',prices:[]},{id:'v',name:'합성 매입처',type:'매입',prices:[]}];
  db.items=[{id:'i',name:'합성 품목',code:'FIXTURE',type:'단품',colors:['WH'],variants:[],components:[],buy_price:1000,sell_price:2000}];
  db.quotes=[{id:'q',no:'Q-FIXTURE',company_id:'c',date,memo:'',status:'납품',delivered_at:date,deliveries:[{id:'d',date,lines:[{line_id:'l',qty:100}]}],lines:[{id:'l',item_id:'i',name:'합성 품목',qty:100,price:20000}],vat_on:true}];
  db.payments=[{id:'p',company_id:'c',quote_id:'q',kind:'수금',date,amount:143000,method:'계좌이체',memo:'합성 내역'}];
  db.stock_moves=[{id:'s',item_id:'i',kind:'입고',date,qty:100,color:'WH',spec:''}];
  db.material_moves=[{id:'m',company_id:'c',kind:'받음',material:'합성 자재',date,qty:10}];
  db.settings={schema:3,name:'합성 공급자'};
  Table.save=async()=>{throw Error('Unexpected write in style test');};
  const {installPurchaseUI}=await import('./purchase-ui.mjs');
  let purchase;window.fixturePurchaseRequests=[];
  purchase=installPurchaseUI({port:()=>({postMessage(m){
   if(m.type!=='PURCHASE_STATE')throw Error('Unexpected purchase write');
   fixturePurchaseRequests.push(m.type);
   queueMicrotask(()=>purchase.onMessage({type:'PURCHASE_STATE',requestId:m.requestId,state:{status:'ready'},doc:{schema:1,rows:[{id:'buy',no:'PO-FIXTURE',vendor_id:'v',date,status:'작성중',lines:[{id:'bl',item_id:'i',name:'합성 품목',qty:10,unit_price:1000}],vat_on:true}]}}));
  }})});
  const {installLogUI}=await import('./log-ui.mjs');let log;
  log=installLogUI({port:()=>({postMessage(m){if(m.type!=='LOG_READ')throw Error('Unexpected log write');queueMicrotask(()=>log.onMessage({type:'LOG_ROWS',requestId:m.requestId,rows:[]}));}})});
  const {installAccessUI}=await import('./access-ui.mjs');let access;
  access=installAccessUI({say(){throw Error('Unexpected access mutation');},port:()=>({postMessage(m){if(m.type!=='ACCESS_LIST')throw Error('Unexpected access write');queueMicrotask(()=>access.onMessage({type:'ACCESS_USERS',requestId:m.requestId,users:[]}));}})});
  window.styleAccess=access;
  switchView('dash');
 })());
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
  const item=page.locator('#puList .list-item').first();if(await item.isVisible())await item.click();
 }
 await page.waitForTimeout(80);
}
test('all rail destinations share rendered typography in desktop/mobile and light/dark themes',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [320,390,820,1440])for(const theme of ['light','dark']){
  await t.test(`${width}px ${theme}`,async()=>{
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
   try{
    await prepare(page);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    let reference=null,companyInfo=null;const report=[];
    for(const view of ['dash','quotes','materials','payments','purchases','stock','companies','items','sales','ar','settings']){
     await open(page,view);
     const panel=page.locator('#view-'+view);assert.equal(await panel.isVisible(),true,view);
     const heading=panel.locator('.page-head h2').first();
     assert.ok(await heading.count(),view+' page title');
     assert.equal(await heading.evaluate(e=>getComputedStyle(e).fontSize),'22px',view+' page title size');
     assert.equal(await heading.evaluate(e=>getComputedStyle(e).fontWeight),'650',view+' page title weight');
     const kpis=panel.locator('.nd-db-metric strong,.pp-metrics strong,.nd-sa-kpis strong,.cp-ov .v b,.stats>.stat>.v');
     for(const kpi of await kpis.all()){
      const numeric=await kpi.evaluate(style);assert.equal(numeric.fontSize,'20px',view+' KPI size');assert.equal(numeric.letterSpacing,'normal',view+' KPI spacing');assert.equal(numeric.fontWeight,'600',view+' KPI weight');assert.equal(numeric.fontFamily,receiptNumberFont,view+' receipt KPI number font');
     }
     if(evidence&&theme==='light'&&[390,1440].includes(width))await page.screenshot({path:resolve(evidence,`${view}-${width}.png`)});
     if(roles[view]&&(!roles[view].desktopOnly||width>=1024)){
      const role=roles[view],title=page.locator(role.title).first();
      assert.ok(await title.count(),view+' title must exist');
      const actual=await title.evaluate(style);
      if(!reference)reference=actual;
      assert.equal(actual.fontSize,'22px',view);
      assert.equal(actual.lineHeight,'30px',view);
      assert.equal(actual.fontWeight,'650',view);assert.equal(actual.letterSpacing,'normal',view);
      assert.deepEqual(actual,reference,view+' detail title');
      if(role.money){const amount=page.locator(role.money).first();assert.ok(await amount.count(),view+' header amount must exist');const numeric=await amount.evaluate(style);
       assert.equal(numeric.fontFamily,receiptNumberFont,view+' receipt number font');
       for(const key of ['fontSize','lineHeight','fontWeight','letterSpacing','color'])assert.equal(numeric[key],reference[key],view+' header amount '+key);
       assert.equal(await amount.evaluate(e=>getComputedStyle(e).fontFeatureSettings),'normal',view+' no forced tnum');}
      report.push(view);
     }
     if(view==='companies'){
      if(width<1024)await page.locator('#coList .list-item[data-id=c]').click();
      await page.locator('#coForm [data-cp-tab=info]').click();
      companyInfo=await page.locator('#coForm .cp-panel[data-cp-panel=info] .cp-grp').first().evaluate(e=>{
       const g=getComputedStyle(e),h=getComputedStyle(e.querySelector('.cp-grph h4')),p=getComputedStyle(e.querySelector('.cp-grph p')),input=getComputedStyle(e.querySelector('input'));
       return {display:g.display,columns:g.gridTemplateColumns,gap:g.columnGap,heading:h.font,description:p.font,descriptionColor:p.color,inputFont:input.font,inputHeight:input.height,inputBackground:input.backgroundColor,inputBorder:input.borderColor,inputRadius:input.borderRadius,inputPadding:input.padding,labelFont:getComputedStyle(e.querySelector('label')).font,labelColor:getComputedStyle(e.querySelector('label')).color,fieldMargin:getComputedStyle(e.querySelector('.field')).marginBottom,innerGap:getComputedStyle(e.querySelector('.cp-grpb .grid2')).columnGap};
      });
     }
     if(view==='settings'){
      const groups=page.locator('#view-settings .sup-sec.cp-grp');assert.equal(await groups.count(),3);
      const supplier=await groups.first().evaluate(e=>{
       const g=getComputedStyle(e),h=getComputedStyle(e.querySelector('.cp-grph h3')),p=getComputedStyle(e.querySelector('.cp-grph p')),input=getComputedStyle(e.querySelector('input'));
       return {display:g.display,columns:g.gridTemplateColumns,gap:g.columnGap,heading:h.font,description:p.font,descriptionColor:p.color,inputFont:input.font,inputHeight:input.height,inputBackground:input.backgroundColor,inputBorder:input.borderColor,inputRadius:input.borderRadius,inputPadding:input.padding,labelFont:getComputedStyle(e.querySelector('label')).font,labelColor:getComputedStyle(e.querySelector('label')).color,fieldMargin:getComputedStyle(e.querySelector('.field')).marginBottom,innerGap:getComputedStyle(e.querySelector('.cp-grpb .grid2')).columnGap};
      });
      for(const key of ['display','gap','heading','description','descriptionColor','inputFont','inputHeight','inputBackground','inputBorder','inputRadius','inputPadding','labelFont','labelColor','fieldMargin','innerGap'])assert.equal(supplier[key],companyInfo[key],'supplier/company info '+key);
      if(width>=1024){assert.ok(supplier.columns.startsWith('180px '));assert.ok(companyInfo.columns.startsWith('180px '));}
      assert.equal(await page.evaluate(()=>Object.entries(window.supplierOriginalNodes).every(([id,node])=>document.getElementById(id)===node)),true,'native controls preserved');
      await page.locator('#st_name').fill('입력 보존 검증');assert.ok(await page.evaluate(()=>window.supplierInputEvents)>0,'native listener preserved');
      assert.equal(await page.locator('#nd_address_detail').locator('..').locator('label').textContent(),'상세주소');
      assert.equal(await page.locator('#st_name').evaluate(e=>{const f=e.closest('.field'),b=e.closest('.cp-grpb');return Math.abs(f.getBoundingClientRect().width-b.getBoundingClientRect().width)<1;}),true,'full-width supplier name');
      if(evidence&&theme==='light'&&[390,1440].includes(width))await page.screenshot({path:resolve(evidence,`supplier-info-${width}.png`)});
      if(width===390&&theme==='light'){
       await page.evaluate(()=>{window.supplierSaved=[];Table.save=async(name,rows)=>{if(name!=='settings')throw Error('Unexpected fixture write');window.supplierSaved.push(structuredClone(rows));};});
       await page.locator('#st_address').fill('합성 기본주소');await page.locator('#nd_address_detail').fill('합성 상세주소');
       await page.locator('#stSaveBtn').click();await page.waitForFunction(()=>window.supplierSaved.length===1);
       await page.waitForFunction(()=>document.getElementById('stSaveBtn').classList.contains('nd-saved'));
       const saved=await page.evaluate(()=>window.supplierSaved[0]);assert.equal(saved.name,'입력 보존 검증');assert.equal(saved.schema,3);assert.equal(saved.address,'합성 기본주소 합성 상세주소');
       await page.evaluate(()=>{Table.save=async()=>{throw Error('Unexpected write in style test');};});
      }

     }
    }
    const nav=await page.locator('.rail-nav').evaluate(e=>[...e.querySelectorAll('.nav-item,.nd-nav-act')].map(b=>{const s=getComputedStyle(b);return {label:b.textContent.trim(),font:s.fontFamily,size:s.fontSize,line:s.lineHeight};}));
    assert.ok(nav.length>=17);for(const n of nav){assert.equal(n.size,'14px',n.label);assert.equal(n.line,'20px',n.label);assert.equal(n.font,nav[0].font,n.label);}
    await page.evaluate(()=>window.styleAccess.open());await page.waitForTimeout(60);
    assert.deepEqual(await page.locator('.nd-acc-ttl h3').evaluate(e=>{const s=getComputedStyle(e);return [s.fontSize,s.lineHeight,s.fontWeight];}),['22px','30px','650']);
    const accessTab=page.locator('.nd-acc-chip[aria-selected=true]');
    assert.deepEqual(await accessTab.evaluate(e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.color];}),['rgb(22, 26, 35)','rgb(255, 255, 255)']);
    await page.keyboard.press('Escape');
    // Utility export dialog is appended outside appView; it must inherit the same tokens.
    await page.locator('.rail-nav .nd-nav-act').filter({hasText:'데이터 내보내기'}).evaluate(e=>e.click());
    assert.deepEqual(await page.locator('.nd-export .nd-ex-head h2').evaluate(e=>{const s=getComputedStyle(e);return [s.fontSize,s.lineHeight,s.fontWeight];}),['22px','30px','650']);
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


test('quote and purchase + share company picking and continue to editable items without writing',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  try{
   await prepare(page);
   await page.evaluate(()=>switchView('quotes'));await page.locator('#qtNewBtn').click();
   const picker=page.locator('.nd-co-pop');await picker.waitFor();
   const quotePicker=await picker.evaluate(e=>{const s=getComputedStyle(e);return {font:s.font,borderRadius:s.borderRadius,background:s.backgroundColor};});
   await picker.locator('input').fill('합성 거래처');await picker.locator('[role=option]').first().click();
   await page.waitForFunction(()=>document.getElementById('qp-tab-items')?.getAttribute('aria-selected')==='true');
   assert.equal(await page.locator('#fq_co').inputValue(),'c');
   if(width<821){
    await page.locator('#qtForm [data-qp-edit]').first().click();await page.locator('#qp-edit-item').click();
    await page.locator('#qtForm .qp-result').filter({hasText:'합성 품목'}).click();
    for(const [field,value] of [['qty','3'],['price','2500']]){const input=page.locator('#qp-edit-'+field);await input.fill(value);await input.dispatchEvent('change');}
    await page.locator('#qtForm .qp-sheet-footer .qp-primary').click();
   }else{
    await page.locator('#qtForm .ip-btn[data-f="item"]').first().click();await page.locator('.ip-opt[data-id="i"]').click();
    for(const [field,value] of [['qty','3'],['price','2500']]){const input=page.locator(`#qtForm [data-f="${field}"]`).first();await input.fill(value);await input.dispatchEvent('change');}
   }
   assert.equal(await page.evaluate(()=>quoteTotals(qtEditing).total),8250);
   if(width>=1024){const g=await page.locator('#qtForm .qtotals .grand').evaluate(e=>{const r=e.getBoundingClientRect(),t=e.closest('.qtotals').getBoundingClientRect(),p=getComputedStyle(e,'::before');return {left:r.left+parseFloat(p.left),right:r.right-parseFloat(p.right),tl:t.left,tr:t.right};});assert.ok(Math.abs(g.left-g.tl)<1);assert.ok(Math.abs(g.right-g.tr)<1);const icon=await page.locator('#qtForm .qline .rm svg').first().boundingBox();assert.equal(icon.width,14);assert.equal(icon.height,14);}
   if(evidence)await page.screenshot({path:resolve(evidence,`quote-entry-${width}.png`)});
   await page.locator('#qp-tab-basic').click();await page.locator('#fq_co').selectOption('v');
   await page.waitForFunction(()=>document.getElementById('qp-tab-items')?.getAttribute('aria-selected')==='true');
   await page.evaluate(()=>{qtEditing=null;qtBaseline='';qtSel=null;renderQtDetail();switchView('purchases');});
   const add=page.locator('#puNewBtn');await add.waitFor();
   await page.waitForFunction(()=>!document.getElementById('puNewBtn').disabled);
   const count=await page.locator('#puList .list-item').count();
   await add.click();
   assert.equal(await page.locator('#puForm').isVisible(),true);
   assert.equal(await page.locator('#pp-tab-basic').getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#pu_co').isVisible(),true);
   assert.equal(await page.locator('#pu_co').isEnabled(),true);
   assert.equal(await page.locator('#pu_memo').isEditable(),true);
   await picker.waitFor();
   if(evidence)await page.screenshot({path:resolve(evidence,`purchase-picker-${width}.png`)});
   assert.deepEqual(await picker.evaluate(e=>{const s=getComputedStyle(e);return {font:s.font,borderRadius:s.borderRadius,background:s.backgroundColor};}),quotePicker);
   assert.equal(await page.locator('#pu_co').inputValue(),'');
   assert.equal(await picker.locator('[role=option]').count(),1,'only purchase vendors');
   await picker.locator('input').fill('합성 매입처');await picker.locator('[role=option]').first().click();
   assert.equal(await page.locator('#pp-tab-items').getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#pu_co').inputValue(),'v');
   if(width>=1024){
    const geometry=await page.evaluate(()=>['puForm'].map(id=>{
     const form=document.getElementById(id),line=form.querySelector('.qtotals .grand'),totals=form.querySelector('.qtotals'),icon=form.querySelector('.qline .rm svg');
     const l=line.getBoundingClientRect(),t=totals.getBoundingClientRect(),p=getComputedStyle(line,'::before'),r=icon.getBoundingClientRect();
     return {id,lineLeft:l.left+parseFloat(p.left),lineRight:l.right-parseFloat(p.right),left:t.left,right:t.right,iconWidth:r.width,iconHeight:r.height,stroke:getComputedStyle(icon).strokeWidth};
    }));
    for(const g of geometry){assert.ok(Math.abs(g.lineLeft-g.left)<1,g.id+' full left separator');assert.ok(Math.abs(g.lineRight-g.right)<1,g.id+' full right separator');assert.equal(g.iconWidth,14);assert.equal(g.iconHeight,14);assert.equal(g.stroke,'2px');}
   }

   if(width<821){
    await page.locator('[data-qp-edit="0"]').click();await page.locator('.qp-result[data-pick="i"]').click();
    await page.locator('#pu-edit-qty').fill('3');await page.locator('#pu-edit-price').fill('2500');await page.locator('[data-apply]').click();
   }else{
    await page.locator('#puForm .ip-btn[data-f="item"]').first().click();await page.locator('.ip-opt[data-id="i"]').click();
    for(const [field,value] of [['qty','3'],['price','2500']]){const input=page.locator(`#puForm [data-f="${field}"]`).first();await input.fill(value);await input.dispatchEvent('change');}
   }
   assert.equal(await page.locator('#pu_total').textContent(),'8,250원');
   if(evidence)await page.screenshot({path:resolve(evidence,`purchase-entry-${width}.png`)});
   await page.locator('#pp-tab-basic').click();await page.locator('#pu_co').selectOption('v');
   assert.equal(await page.locator('#pp-tab-items').getAttribute('aria-selected'),'true');
   await page.locator('#pp-tab-basic').click();
   await page.locator('#pu_memo').fill('새 매입 입력 검증');
   await page.locator('#pu_memo').dispatchEvent('change');
   await page.locator('#pp-tab-items').click();
   await page.locator('#pp-tab-basic').click();
   assert.equal(await page.locator('#pu_memo').inputValue(),'새 매입 입력 검증');
   await page.locator('#puCancelBtn').click();
   assert.equal(await page.locator('#puList .list-item').count(),count);
   assert.equal(await page.locator('#puForm').isVisible(),false);
   await add.click();
   assert.equal(await page.locator('#pu_memo').inputValue(),'');
   await picker.locator('input').press('Escape');
   await page.locator('#puCancelBtn').click();
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }}finally{await browser.close();}
});


test('registration photo errors remain visible and a supported JPEG attaches successfully',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 try{
  await prepare(page);await page.evaluate(()=>{
   window.assetTestReady=(async()=>{
   const {installAssets,notifyAsset}=await import('./asset-ui.mjs');window.assetNotifications=[];window.assetUploads=[];
   installAssets({db,notify:t=>{assetNotifications.push(t);notifyAsset(t);},request:async(type,body)=>{
    if(type!=='ASSET_UPLOAD')throw Error('Unexpected read');window.latestAssetBytes=body.bytes;assetUploads.push({kind:body.kind,size:body.bytes.length,width:new DataView(body.bytes.buffer,body.bytes.byteOffset).getUint32(16),height:new DataView(body.bytes.buffer,body.bytes.byteOffset).getUint32(20)});return {path:'assets/registration-test.png'};
   },save:async(key,value)=>{if(key!=='settings')throw Error('Unexpected table');db.settings=value;}});
   switchView('settings');window.assetTestInstalled=true;
   })();
  });
  await page.waitForFunction(()=>window.assetTestInstalled===true);
  const card=page.locator('.nd-photo').filter({has:page.locator('.nd-photo-name>span', {hasText:'사업자등록증'})});
  const [firstChooser]=await Promise.all([page.waitForEvent('filechooser'),card.locator('.nd-photo-shot').click()]);
  await firstChooser.setFiles({name:'registration.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 synthetic')});
  await page.waitForFunction(()=>Array.isArray(window.assetNotifications)&&assetNotifications.some(t=>t.includes('첨부 실패')));
  await page.waitForTimeout(150);
  assert.match(await card.locator('[role=status]').textContent(),/PNG, JPEG, WebP/);
  await page.evaluate(()=>{const node=document.createElement('span');node.textContent='unrelated render';document.getElementById('appView').append(node);});
  await page.waitForTimeout(150);
  assert.match(await card.locator('[role=status]').textContent(),/PNG, JPEG, WebP/);
  assert.equal(await page.evaluate(()=>assetUploads.length),0);
  const title=card.locator('.nd-photo-name>span');assert.equal(await title.textContent(),'사업자등록증');assert.ok(await title.evaluate(e=>e.clientWidth>=e.scrollWidth),'error must not truncate title');
  await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));
  await card.getByRole('button',{name:'사업자등록증 첨부 오류 닫기'}).click();
  assert.equal(await card.locator('[role=status]').textContent(),'등록 안 됨');

  const jpeg=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=100;canvas.height=140;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,100,140);ctx.fillStyle='black';ctx.fillText('Registration fixture',5,30);
   const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg'));return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const [jpegChooser]=await Promise.all([page.waitForEvent('filechooser'),card.locator('.nd-photo-up').click()]);
  await jpegChooser.setFiles({name:'registration.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg)});
  await page.waitForFunction(()=>db.settings.assets?.registration==='assets/registration-test.png');
  await card.locator('.nd-photo-shot img').waitFor({state:'visible'});
  assert.equal(await card.locator('.nd-photo-shot img').isVisible(),true);
  assert.equal(await page.evaluate(()=>assetUploads[0].kind),'registration');
  const large=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=1334;canvas.height=1888;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);let seed=123456;
   for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed>>>24;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;}
   ctx.putImageData(pixels,0,0);
   const jpeg=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.7));
   const normalized=document.createElement('canvas');normalized.width=Math.round(1334*1600/1888);normalized.height=1600;normalized.getContext('2d').drawImage(canvas,0,0,normalized.width,1600);
   const initial=await new Promise(r=>normalized.toBlob(r,'image/png'));
   return {bytes:Array.from(new Uint8Array(await jpeg.arrayBuffer())),initialSize:initial.size};
  });
  assert.ok(large.bytes.length>1048576&&large.bytes.length<8*1048576,'large JPEG within advertised input limit');
  assert.ok(large.initialSize>1048576,'dimension-only resize would exceed storage limit');
  await card.locator('input[type=file]').setInputFiles({name:'large-registration.jpg',mimeType:'image/jpeg',buffer:Buffer.from(large.bytes)});
  await page.waitForFunction(()=>assetUploads.length===2&&document.querySelectorAll('.nd-photo-state')[1].textContent==='저장 완료');
  const upload=await page.evaluate(()=>assetUploads[1]);assert.ok(upload.size>1048576&&upload.size<=8*1048576);assert.equal(upload.width,1334);assert.equal(upload.height,1888,'document resolution preserved');
  const shared=await page.evaluate(async()=>{const {createAssetFile}=await import('./asset-ui.mjs'),file=createAssetFile(latestAssetBytes,'business-registration.png'),bytes=new Uint8Array(await file.arrayBuffer());return {size:file.size,type:file.type,identical:bytes.length===latestAssetBytes.length&&bytes.every((v,i)=>v===latestAssetBytes[i])};});assert.equal(shared.size,upload.size);assert.equal(shared.type,'image/png');assert.equal(shared.identical,true,'send exact high-resolution stored bytes');
  assert.equal(await card.locator('.nd-photo-shot img').isVisible(),true);

  const oversized=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=5000;canvas.height=2000;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,5000,2000);ctx.fillStyle='black';ctx.font='60px sans-serif';ctx.fillText('High resolution registration fixture',100,200);
   const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg'));return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await card.locator('input[type=file]').setInputFiles({name:'5000px-registration.jpg',mimeType:'image/jpeg',buffer:Buffer.from(oversized)});
  await page.waitForFunction(()=>assetUploads.length===3&&document.querySelectorAll('.nd-photo-state')[1].textContent==='저장 완료');
  const scaled=await page.evaluate(()=>assetUploads[2]);assert.equal(scaled.width,4096);assert.equal(scaled.height,1638);assert.ok(scaled.size<=8*1048576);
  assert.equal(await card.getByRole('button',{name:'사업자등록증 첨부 오류 닫기'}).count(),0);
  await page.waitForFunction(()=>document.getElementById('stSaveBtn').classList.contains('nd-saved'));
  assert.equal(await page.locator('#stSaveBtn').textContent(),'저장됨');
  assert.ok(await page.evaluate(()=>assetNotifications.some(t=>t.includes('첨부 실패'))));
 }finally{await page.close();await browser.close();}
});


test('saved forms share neutral buttons and edits/reverts update save state',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 const waitSaved=async(page,id,saved)=>{await page.waitForFunction(({id,saved})=>document.getElementById(id)?.classList.contains('nd-saved')===saved,{id,saved});};
 try{for(const width of [390,1440])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1000}});
  try{
   await prepare(page);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   await open(page,'quotes');await waitSaved(page,'qtSaveBtn',true);await page.waitForTimeout(250);
   const neutral=await page.locator('#qtSaveBtn').evaluate(e=>{const s=getComputedStyle(e),rgba=v=>{const a=v.match(/[\d.]+/g).map(Number);if(a.length===3)a.push(1);return a;};return {background:rgba(s.backgroundColor),color:rgba(s.color)};});
   for(const [view,id] of [['companies','coSaveBtn'],['items','itSaveBtn'],['settings','stSaveBtn'],['purchases','puSaveBtn'],['stock','stockMinimumSave']]){
    await open(page,view);await waitSaved(page,id,true);
    await page.waitForFunction(({id,neutral})=>{const s=getComputedStyle(document.getElementById(id)),rgba=v=>{const a=v.match(/[\d.]+/g).map(Number);if(a.length===3)a.push(1);return a;};return JSON.stringify({background:rgba(s.backgroundColor),color:rgba(s.color)})===JSON.stringify(neutral);},{id,neutral});
    assert.deepEqual(await page.locator('#'+id).evaluate(e=>{const s=getComputedStyle(e),rgba=v=>{const a=v.match(/[\d.]+/g).map(Number);if(a.length===3)a.push(1);return a;};return {background:rgba(s.backgroundColor),color:rgba(s.color)};}),neutral,view+' saved colors');
   }
   await open(page,'purchases');await page.locator('#pp-tab-basic').click();const purchaseMemo=page.locator('#pu_memo');await purchaseMemo.fill('매입 수정');await purchaseMemo.dispatchEvent('change');await waitSaved(page,'puSaveBtn',false);await purchaseMemo.fill('');await purchaseMemo.dispatchEvent('change');await waitSaved(page,'puSaveBtn',true);
   await open(page,'settings');await page.locator('#st_name').fill('변경된 공급자');await waitSaved(page,'stSaveBtn',false);
   await page.locator('#st_name').fill('합성 공급자');await waitSaved(page,'stSaveBtn',true);
   await page.locator('#nd_address_detail').fill('추가 주소');await waitSaved(page,'stSaveBtn',false);
   await page.locator('#nd_address_detail').fill('');await waitSaved(page,'stSaveBtn',true);
   await page.evaluate(()=>{db.settings.assets={registration:'synthetic-photo-reference'};const n=document.createElement('span');document.getElementById('appView').append(n);});
   await waitSaved(page,'stSaveBtn',true);
   await open(page,'stock');if(width<1024){const row=page.locator('#stockItems .stock-item').first();if(await row.isVisible())await row.click();}const minimum=page.locator('#stockOverview [data-stock-min]').first();
   if(await minimum.isVisible()){const before=await minimum.inputValue();await minimum.fill('7');await waitSaved(page,'stockMinimumSave',false);await minimum.fill(before);await waitSaved(page,'stockMinimumSave',true);}
   await open(page,'materials');await page.locator('[data-material-panel=history]').click();if(width<=820){const owner=page.locator('[data-mm-owner="c"]');if(await owner.isVisible())await owner.click();await page.locator('.material-record-main').first().click();}else await page.locator('[data-mm-edit="m"]').click();await waitSaved(page,'mm_save',true);
   const memo=page.locator('[data-mm="memo"]');await memo.fill('자재 수정');await waitSaved(page,'mm_save',false);await memo.fill('');await waitSaved(page,'mm_save',true);
  }finally{await page.close();}
 }}finally{await browser.close();}
});


test('summary label and value are horizontally level on each row',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);
  for(const view of ['quotes','purchases']){
   await open(page,view);const form=view==='quotes'?'qtForm':'puForm';
   if(view==='quotes')await page.locator('#fq_margin').evaluate(e=>e.textContent='마진 32,500원 (13.3%)');
   const rows=await page.locator('#'+form+' .qtotals .row').evaluateAll(es=>es.map(e=>{const k=e.querySelector('.k').getBoundingClientRect(),v=e.querySelector('.v').getBoundingClientRect();return {label:e.querySelector('.k').textContent,kCenter:k.top+k.height/2,vCenter:v.top+v.height/2};}));
   assert.ok(rows.some(r=>r.label==='합계'));
   if(view==='quotes')assert.ok(rows.some(r=>r.label==='예상 마진'));
   for(const row of rows)assert.ok(Math.abs(row.kCenter-row.vCenter)<1,view+' '+width+' '+row.label+' center line');
  }
  await page.close();
 }}finally{await browser.close();}
});

test('item add glyph is centered and copy opens an independent unsaved item',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);
  await page.evaluate(()=>{Object.assign(db.items[0],{category:'합성 분류',memo:'복사 메모',spec:'기본 규격',unit:'개',variants:[{spec:'M',buy_price:1200,sell_price:2400}],stock_minimums:{'WH|M':5},created_at:'old'});window.originalItem=JSON.stringify(db.items[0]);window.itemWrites=[];Table.save=async(name,rows)=>{if(name!=='items')throw Error('Unexpected write');window.itemWrites.push(structuredClone(rows));};});
  await open(page,'items');
  await page.locator('#itCopyBtn').waitFor();assert.equal(await page.locator('#itCopyBtn').isVisible(),true);
  await page.locator('#itCopyBtn').click();
  assert.equal(await page.locator('#fi_name').inputValue(),'합성 품목 (복사)');assert.equal(await page.locator('#fi_code').inputValue(),'');
  assert.equal(await page.locator('#itSaveBtn').textContent(),'등록');assert.equal(await page.locator('#itCopyBtn').count(),0);
  if(evidence)await page.screenshot({path:resolve(evidence,`item-copy-${width}.png`)});
  const draft=await page.evaluate(()=>({draft:itEditing,writes:itemWrites.length,unchanged:JSON.stringify(db.items[0])===originalItem}));
  assert.equal(draft.writes,0);assert.equal(draft.unchanged,true);assert.equal(draft.draft.id,null);assert.equal(draft.draft.created_at,undefined);assert.equal(draft.draft.stock_minimums,undefined);assert.equal(draft.draft.memo,'복사 메모');assert.equal(draft.draft.category,'합성 분류');assert.deepEqual(draft.draft.variants,[{spec:'M',buy_price:1200,sell_price:2400}]);assert.deepEqual(draft.draft.colors,['WH']);
  await page.locator('#fi_name').fill('복사해서 수정');await page.locator('#itSaveBtn').click();await page.waitForFunction(()=>itemWrites.length===1);
  const saved=await page.evaluate(()=>({rows:db.items,unchanged:JSON.stringify(db.items[0])===originalItem}));assert.equal(saved.unchanged,true);assert.equal(saved.rows.length,2);assert.notEqual(saved.rows[1].id,'i');assert.ok(saved.rows[1].id);assert.equal(saved.rows[1].name,'복사해서 수정');
  await page.locator('#itCopyBtn').click();await page.locator('#itCancelBtn').click();assert.equal(await page.evaluate(()=>itemWrites.length),1,'cancel does not save');
  await page.waitForTimeout(80);
  const center=await page.locator('#itNewBtn').evaluate(e=>{const s=getComputedStyle(e,'::before'),m=new DOMMatrix(s.transform);return {x:parseFloat(s.left)+parseFloat(s.width)/2+m.e,y:parseFloat(s.top)+parseFloat(s.height)/2+m.f,cx:e.clientWidth/2,cy:e.clientHeight/2};});
  assert.ok(Math.abs(center.x-center.cx)<1,'+ horizontal center');assert.ok(Math.abs(center.y-center.cy)<1,'+ vertical center');
  await page.close();
 }}finally{await browser.close();}
});

test('item filter trash section shares body insets with category and keeps bottom space',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440])for(const count of [0,1]){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);
  await page.evaluate(count=>{db.settings.trash=count?[{key:'items',id:'deleted',at:'2026-10-12',label:'삭제된 합성 품목',row:{id:'deleted',name:'삭제된 합성 품목'}}]:[];switchView('items');itSel=null;itEditing=null;renderItList();renderItDetail();},count);
  await page.locator('#view-items button[aria-label="필터"]').click();const panel=page.locator('.nd-pop-panel');await panel.locator('.nd-trash-go').waitFor();
  const geometry=await panel.evaluate(p=>{const category=p.querySelector('#itCategory').getBoundingClientRect(),trash=p.querySelector('.nd-trash-go').getBoundingClientRect(),body=p.querySelector('.nd-pop-body'),b=body.getBoundingClientRect();return {inBody:body.contains(p.querySelector('.nd-trash-field')),left:trash.left-category.left,right:trash.right-category.right,bottom:b.bottom-trash.bottom};});
  assert.equal(geometry.inBody,true);assert.ok(Math.abs(geometry.left)<1);assert.ok(Math.abs(geometry.right)<1);assert.ok(geometry.bottom>=15);
  assert.equal(await panel.locator('.nd-trash-go').isEnabled(),!!count);
  if(count){await panel.locator('.nd-trash-go').click();await page.locator('dialog.nd-trash').waitFor();assert.match(await page.locator('dialog.nd-trash').textContent(),/삭제된 합성 품목/);}
  if(evidence)await page.screenshot({path:resolve(evidence,`item-filter-${width}-${count}.png`)});
  await page.close();
 }}finally{await browser.close();}
});

test('quote print and shared image split nested item codes and center the other columns',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);
  await page.evaluate(()=>{window.print=()=>{};window.quotePrintReady=(async()=>{const {installAssets}=await import('./asset-ui.mjs');installAssets({db,request:async()=>{throw Error('Unexpected asset request');},save:async()=>{throw Error('Unexpected save');},notify(){}});window.quotePrintInstalled=true;})();});await page.waitForFunction(()=>window.quotePrintInstalled===true);
  const result=await page.evaluate(()=>{
   const lines=[{id:'nested',item_id:'i',name:'셰프복 [JK_3SB-LS [VN]]',color:'BK',spec:'M',qty:4,price:17000},{id:'simple',name:'타월 [T-100]',color:'WH',spec:'L',qty:2,price:1000}];const q={...db.quotes[0],lines};const original=JSON.stringify({q,items:db.items});
   const split=lines.map(naroSplitName),removed=naroSplitName({name:'옛 품목 [OLD [VN]]',item_id:'removed'}),fallback=naroSplitName({name:'합성 품목',item_id:'i'});
   const calls=[],fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){calls.push({text:String(text),x,y});return fill.call(this,text,x,y,...rest);};let canvas;try{canvas=drawQuoteCanvas(q,'견적서');}finally{CanvasRenderingContext2D.prototype.fillText=fill;}
   window.quoteCanvasEvidence=canvas.toDataURL();printQuote(q,'견적서');return {split,removed,fallback,calls,unchanged:original===JSON.stringify({q,items:db.items})};
  });
  assert.deepEqual(result.split,[{name:'셰프복',code:'JK_3SB-LS [VN]'},{name:'타월',code:'T-100'}]);assert.deepEqual(result.removed,{name:'옛 품목',code:'OLD [VN]'});assert.deepEqual(result.fallback,{name:'합성 품목',code:'FIXTURE'});assert.equal(result.unchanged,true);
  const name=result.calls.find(c=>c.text==='셰프복'),code=result.calls.find(c=>c.text==='JK_3SB-LS [VN]'),mid=(name.y+code.y)/2;
  for(const text of ['BK','M','4','17,000','68,000','6,800'])assert.ok(Math.abs(result.calls.find(c=>c.text===text).y-mid)<.01,text+' centered between name and code');
  await page.emulateMedia({media:'print'});
  const row=page.locator('#printArea .p-tbl tbody tr').first();assert.equal(await row.locator('.nd-pn>b').textContent(),'셰프복');assert.equal(await row.locator('.nd-pn>small').textContent(),'JK_3SB-LS [VN]');
  const centers=await row.evaluate(tr=>{const p=tr.querySelector('.nd-pn').getBoundingClientRect();return [...tr.cells].slice(1).map(td=>{const r=document.createRange();r.selectNodeContents(td);const b=r.getBoundingClientRect();return {alignment:getComputedStyle(td).verticalAlign,offset:b.top+b.height/2-(p.top+p.height/2)};});});for(const c of centers){assert.equal(c.alignment,'middle');assert.ok(Math.abs(c.offset)<3,'printed column vertically centered');}
  if(evidence){await page.screenshot({path:resolve(evidence,`quote-print-code-${width}.png`)});await page.emulateMedia({media:'screen'});await page.evaluate(()=>{document.body.innerHTML='<img style="width:794px" src="'+quoteCanvasEvidence+'">';});await page.screenshot({path:resolve(evidence,`quote-image-code-${width}.png`),fullPage:true});}
  await page.close();
 }}finally{await browser.close();}
});


test('purchase navigation reuses loaded rows without repeated cloud requests',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 try{await prepare(page);await page.locator('.pu-nav').click();await page.waitForFunction(()=>NaroPurchases.state().status==='ready');
  assert.equal(await page.locator('#puList .list-item').count(),1);
  for(let i=0;i<3;i++){await page.locator('.rail-nav .nav-item[data-view="dash"]').click();await page.locator('.pu-nav').click();assert.equal(await page.locator('#puList .list-item').count(),1);}
  assert.deepEqual(await page.evaluate(()=>fixturePurchaseRequests),['PURCHASE_STATE']);
 }finally{await browser.close();}
});

test('all screen searches and item/company pickers clear through the original filter handlers',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);
  for(const view of ['quotes','companies','items','materials','payments','purchases','stock','sales','ar','settings']){
   await page.evaluate(view=>switchView(view),view);await page.waitForTimeout(120);
   const searches=page.locator('#view-'+view+' input.nd-search-input:visible:not(:disabled)');const count=await searches.count();assert.ok(count>0,view+' has a search');
   for(let i=0;i<count;i++){
    const input=searches.nth(i);await input.fill('zz-no-matching-fixture');
    const button=input.locator('..').locator('.nd-search-clear:visible').first();await button.waitFor();const geometry=await input.evaluate(e=>{const host=e.parentElement,r=host.getBoundingClientRect(),b=host.querySelector('.nd-search-clear').getBoundingClientRect(),icon=host.querySelector(':scope>svg'),x=host.querySelector('.nd-search-clear>svg').getBoundingClientRect();return {inside:b.left>=r.left&&b.right<=r.right+1,gap:icon?Math.abs(icon.getBoundingClientRect().left-r.left-(r.right-x.right)):0};});assert.equal(geometry.inside,true,view+' '+width+' X stays in search box');assert.ok(geometry.gap<1.1,view+' '+width+' equal icon gutters');
    await button.click();assert.equal(await searches.nth(i).inputValue(),'');assert.equal(await button.count(),0,view+' empty search hides X');
   }
  }
  await page.evaluate(()=>switchView('quotes'));await page.locator('#qtNewBtn').click();const picker=page.locator('.nd-co-pop');await picker.waitFor();const company=picker.locator('input');await company.fill('zz-no-match');assert.equal(await picker.locator('[role=option]').count(),0);await picker.locator('.nd-search-clear').click();assert.equal(await company.inputValue(),'');assert.equal(await picker.locator('[role=option]').count(),2);await picker.locator('[role=option]').filter({hasText:'합성 거래처'}).click();
  if(width<821){await page.locator('#qtForm [data-qp-edit]').first().click();await page.locator('#qp-edit-item').click();}else await page.locator('#qtForm .ip-btn[data-f="item"]').first().click();
  const item=page.locator(width<821?'.qp-search:visible':'.ip-pop>input:visible');await item.fill('zz-no-match');const host=item.locator('..');await host.locator('.nd-search-clear').click();assert.equal(await item.inputValue(),'');assert.ok(await page.locator(width<821?'.qp-result:visible':'.ip-opt:visible').count()>0,'item results restored');
  if(evidence)await page.screenshot({path:resolve(evidence,`search-clear-${width}.png`)});
  await page.close();
 }}finally{await browser.close();}
});

test('material detail reuses quote tabs, typography and insets while preserving native entry controls',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await open(page,'quotes');const quoteTab=await page.locator('#qp-tab-items').evaluate(e=>{const s=getComputedStyle(e);return {font:s.font,height:s.height,color:s.color};}),quoteAmount=await page.locator('#qtForm .qs-amt-v').evaluate(style);
  await open(page,'materials');if(width<=820)await page.locator('[data-mm-owner=c]').click();await page.locator('.nd-material-tabs').waitFor();
  const tab=page.locator('[data-material-panel=overview]');assert.deepEqual(await tab.evaluate(e=>{const s=getComputedStyle(e);return {font:s.font,height:s.height,color:s.color};}),quoteTab);
  const number=await page.locator('.material-balance-hero strong').evaluate(style);for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color'])assert.equal(number[key],quoteAmount[key],key);
  assert.equal(await page.locator('.nd-material-overview').isVisible(),true);assert.equal(await page.locator('.material-history-wrap').isVisible(),false);
  await page.locator('[data-material-panel=history]').click();assert.equal(await page.locator('.material-record').isVisible(),true);assert.equal(await page.locator('.nd-material-overview').isVisible(),false);
  const before=await page.evaluate(()=>JSON.stringify(db.material_moves));await page.locator('[data-material-panel=entry]').click();await page.locator('#mm_material').waitFor();await page.locator('#mm_memo').fill('입력 보존');
  await page.locator('[data-material-panel=history]').click();await page.locator('[data-material-panel=entry]').click();assert.equal(await page.locator('#mm_memo').inputValue(),'입력 보존');assert.equal(await page.evaluate(()=>JSON.stringify(db.material_moves)),before,'tab navigation never writes');
  const overflow=await page.locator('.material-detail').evaluate(e=>e.scrollWidth-e.clientWidth);assert.ok(overflow<2,'no horizontal overflow');
  if(evidence)await page.screenshot({path:resolve(evidence,`material-entry-${width}-${theme}.png`)});
  await page.close();
 }}finally{await browser.close();}
});

test('rail and mobile tabs respond once while startup images read, but remain guarded during saves',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);
  await page.route('**/erp/nav-entry-test.mjs',async route=>route.fulfill({body:await readFile(resolve(release,'erp/entry.mjs')),contentType:'application/javascript'}));
  await page.evaluate(()=>{window.navigationEntryReady=(async()=>{
   const {start}=await import('./nav-entry-test.mjs');db.settings.assets={registration:'assets/registration-test.png'};
   start({db,Table,StorageRepository,bindReadUI(){document.querySelectorAll('.nav-item,.mobile-nav-item').forEach(n=>n.onclick=()=>switchView(n.dataset.view));},bindBusinessUI(){},switchView,setSyncState(){},clearDrafts(){},pendingStock(){return null;}},{personalBusinessWrite:true,extendedWrite:true});
   window.navMessages=[];const channel=new MessageChannel();window.navHost=channel.port2;navHost.onmessage=e=>navMessages.push(e.data);
   const data=Object.fromEntries(['companies','items','quotes','payments','stock_moves','material_moves','settings'].map(k=>[k,structuredClone(db[k])]));
   dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{type:'NARO_READ_SNAPSHOT',data,features:['*'],provider:'dropbox'},ports:[channel.port1]}));
  })();});
  await page.waitForFunction(()=>window.navMessages?.some(m=>m.type==='ASSET_READ'));
  const target=page.locator(width<821?'.mobile-nav-item[data-view=quotes]':'.rail-nav .nav-item[data-view=quotes]');await target.click();assert.equal(await page.evaluate(()=>currentView),'quotes','first click switches during asset read');
  await page.evaluate(()=>{const request=navMessages.find(m=>m.type==='ASSET_READ');navHost.postMessage({type:'ASSET_ERROR',requestId:request.requestId,code:'NETWORK_ERROR'});});await page.waitForTimeout(80);
  await page.evaluate(()=>{window.navSave=Table.save('settings',structuredClone(db.settings));});await page.waitForFunction(()=>navMessages.some(m=>m.type==='SAVE_TABLE'));
  const next=page.locator(width<821?'.mobile-nav-item[data-view=payments]':'.rail-nav .nav-item[data-view=items]');await next.click();assert.equal(await page.evaluate(()=>currentView),'quotes','save protection remains');
  await page.evaluate(()=>{const request=navMessages.find(m=>m.type==='SAVE_TABLE');navHost.postMessage({type:'TABLE_SAVED',requestId:request.requestId,key:'settings',rows:request.rows});});await page.evaluate(()=>navSave);
  await next.click();assert.equal(await page.evaluate(()=>currentView),width<821?'payments':'items','first click after save switches');await page.close();
 }}finally{await browser.close();}
});


test('payment title dot spacing is shared by desktop and mobile labels without changing text',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});
 try{for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:1000}});await prepare(page);await open(page,'payments');
  for(const selector of ['#view-payments .page-head h2','.rail-nav [data-view="payments"]','#bottomNav [data-view="payments"]','.pp-head h3','.pp-overview .nd-payment-label','.pp-mobile-row b']){const label=page.locator(selector).first();if(!await label.count())continue;const dots=label.locator('.nd-payment-dot');assert.equal(await dots.count(),1,selector);const style=await dots.evaluate(e=>{const s=getComputedStyle(e);return {left:parseFloat(s.marginLeft),right:parseFloat(s.marginRight),size:parseFloat(s.fontSize)};});assert.ok(Math.abs(style.left-style.size*.1)<.1);assert.equal(style.left,style.right);assert.match(await label.textContent(),/입금·출금/);if(!await label.isVisible())continue;const geometry=await dots.evaluate(e=>{const before=document.createRange(),after=document.createRange();before.selectNode(e.previousSibling);after.selectNode(e.nextSibling);const a=before.getBoundingClientRect(),b=after.getBoundingClientRect(),r=e.getBoundingClientRect(),s=getComputedStyle(e),p=getComputedStyle(e.parentElement);return {left:r.left-a.right,right:b.left-r.right,size:parseFloat(s.fontSize),parentSize:p.fontSize,dotSize:s.fontSize};});assert.equal(geometry.dotSize,geometry.parentSize,selector+' inherited dot size');assert.ok(Math.abs(geometry.left-geometry.size*.1)<1,selector+' actual left gap '+JSON.stringify(geometry));assert.ok(Math.abs(geometry.right-geometry.size*.1)<1,selector+' actual right gap '+JSON.stringify(geometry));}
  await page.close();}}finally{await browser.close();}
});

test('desktop headers share caption and title lines and selected detail tabs are blue',async()=>{const browser=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await prepare(page);for(const view of ['dash','quotes','materials','payments','purchases','stock','companies','items','sales','ar','settings']){await open(page,view);const rows=await page.evaluate(view=>{const v=document.getElementById('view-'+view),top=v.querySelector('.page-head').getBoundingClientRect().top;return [...v.querySelectorAll('.page-head h2,.qs-val.co,.co-title-name,.workspace-heading h3,.panel-b-empty-heading h3,.material-detail-head h3,.pp-head h3,.nd-sa-title')].filter(e=>e.getBoundingClientRect().height).map(e=>e.getBoundingClientRect().top-top);},view);for(const y of rows)assert.ok(Math.abs(y-50)<1,view+' header title y='+y);for(const tab of await page.locator('#view-'+view+' :is(.qp-tabs,.cp-tabs,.panel-b-tabs)>button[aria-selected=true]').all()){const colors=await tab.evaluate(e=>{const s=getComputedStyle(e);return [s.color,s.boxShadow];});assert.ok(colors[1].includes('rgb(67, 85, 232)'));}}await page.close();}finally{await browser.close();}});

test('quote header metadata and progress share the adjacent center lines',async()=>{const b=await chromium.launch({headless:true,...(process.env.NARO_BROWSER_EXECUTABLE?{executablePath:process.env.NARO_BROWSER_EXECUTABLE}:{})});try{const p=await b.newPage({viewport:{width:1440,height:1000}});await prepare(p);for(const v of ['quotes','purchases']){await open(p,v);const delta=await p.evaluate(v=>{const root=document.getElementById('view-'+v),s=root.querySelector('.page-head .search').getBoundingClientRect(),m=root.querySelector('.qp-metadata').getBoundingClientRect();return (m.top+m.bottom-s.top-s.bottom)/2;},v);assert.ok(Math.abs(delta)<1,v+' metadata center delta '+delta);}await open(p,'quotes');const delta=await p.evaluate(()=>{const tabs=document.querySelector('#qtForm .qp-tabs').getBoundingClientRect(),strip=document.querySelector('#qtForm .nd-next').getBoundingClientRect(),steps=document.querySelector('#qtForm .nd-steps').getBoundingClientRect();return (steps.top+steps.bottom-tabs.bottom-strip.bottom)/2;});assert.ok(Math.abs(delta)<1,'progress divider center delta '+delta);await p.close();}finally{await b.close();}});
