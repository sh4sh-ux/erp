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
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
   try{
    await prepare(page);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    let reference=null,companyInfo=null;const report=[];
    for(const view of ['dash','quotes','materials','payments','purchases','stock','companies','items','sales','ar','settings']){
     await open(page,view);
     const panel=page.locator('#view-'+view);assert.equal(await panel.isVisible(),true,view);
     const heading=panel.locator('.page-head h2').first();
     assert.ok(await heading.count(),view+' page title');
     assert.equal(await heading.evaluate(e=>getComputedStyle(e).fontSize),width<1024?'22px':'24px',view+' page title size');
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
      assert.equal(actual.fontSize,width<1024?'19px':'24px',view);
      assert.equal(actual.lineHeight,width<1024?'26.6px':'30px',view);
      assert.equal(actual.fontWeight,'700',view);assert.equal(actual.letterSpacing,'normal',view);
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
       const saved=await page.evaluate(()=>window.supplierSaved[0]);assert.equal(saved.name,'입력 보존 검증');assert.equal(saved.schema,3);assert.equal(saved.address,'합성 기본주소 합성 상세주소');
       await page.evaluate(()=>{Table.save=async()=>{throw Error('Unexpected write in style test');};});
      }

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
   const {installAssets}=await import('./asset-ui.mjs');window.assetNotifications=[];window.assetUploads=[];
   installAssets({db,notify:t=>assetNotifications.push(t),request:async(type,body)=>{
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

  assert.ok(await page.evaluate(()=>assetNotifications.some(t=>t.includes('첨부 실패'))));
 }finally{await page.close();await browser.close();}
});
