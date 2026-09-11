const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/,'');
const elements=new Map();
const document={addEventListener(){},querySelectorAll(){return []},getElementById(id){if(!elements.has(id))elements.set(id,{value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){}});return elements.get(id)}};
const context=vm.createContext({document,window:{location:{origin:'http://localhost',pathname:'/'},addEventListener(){}},localStorage:{getItem(){return null}},MutationObserver:class{observe(){}},crypto:require('node:crypto').webcrypto,console,setTimeout,clearTimeout,URL,URLSearchParams});
const run=s=>vm.runInContext(s,context);run(source);
(async()=>{
  run(`db.companies=[{id:'a',name:'A업체'},{id:'b',name:'B업체'}];saveTable=async()=>true;toast=()=>{};
    const receipt=buildMaterialMove({...newMaterialDraft('a'),date:'2026-09-01',material:'패치',qty:'100'});`);
  assert.equal(await run('persistMaterialMove(receipt)'),true);
  await run('persistMaterialMove(receipt)');assert.equal(run('db.material_moves.length'),1);
  run(`const job=buildMaterialMove({...newMaterialDraft('a'),date:'2026-09-02',kind:'작업 완료',material:'패치',work_qty:'15',per_unit:'2',source:'스마트스토어',order_no:'1234'});`);
  await run('persistMaterialMove(job)');
  assert.equal(run('materialBalances()[materialKey(receipt)]'),70);
  assert.equal(run('job.quote_id'),'');assert.equal(run('job.qty'),30);
  assert.equal(run('db.payments.length+db.quotes.length+db.stock_moves.length'),0);
  await assert.rejects(()=>run(`persistMaterialMove(buildMaterialMove({...newMaterialDraft('b'),date:'2026-09-03',kind:'작업 완료',material:'패치',work_qty:'1',per_unit:'1'}))`));
  await assert.rejects(()=>run(`persistMaterialMove(buildMaterialMove({...newMaterialDraft('a'),date:'2026-09-03',kind:'반환',material:'패치',qty:'71'}))`));
  await assert.rejects(()=>run(`persistMaterialMove(buildMaterialMove({...newMaterialDraft('a'),date:'2026-08-01',kind:'반환',material:'패치',qty:'1'}))`));
  await assert.rejects(()=>run('voidMaterialMove(receipt.id)'));
  run('saveTable=async()=>false');
  assert.equal(await run('voidMaterialMove(job.id)'),false);
  assert.equal(run('materialBalances()[materialKey(receipt)]'),70);
  assert.equal(await run(`persistMaterialMove(buildMaterialMove({...newMaterialDraft('a'),date:'2026-09-03',kind:'반환',material:'패치',qty:'10'}))`),false);
  assert.equal(run('db.material_moves.length'),2);
  run('saveTable=async()=>true');await run('voidMaterialMove(job.id)');
  assert.equal(run('materialBalances()[materialKey(receipt)]'),100);
  assert.equal(run('db.material_moves.length'),2);
  await run(`persistMaterialMove(buildMaterialMove({...newMaterialDraft('a'),date:'2026-09-04',kind:'반환',material:'패치',qty:'10'}))`);
  await run(`persistMaterialMove(buildMaterialMove({...newMaterialDraft('a'),date:'2026-09-05',kind:'불량/분실',material:'패치',qty:'2'}))`);
  assert.equal(run('materialBalances()[materialKey(receipt)]'),88);
  for(const qty of ['-1','0','1.5','abc'])assert.throws(()=>run(`buildMaterialMove({...newMaterialDraft('a'),material:'패치',qty:${JSON.stringify(qty)}})`));
  assert.throws(()=>run(`buildMaterialMove({...newMaterialDraft('a'),material:'패치',qty:'1',date:'2026-02-30'})`));
  assert.ok(run('BACKUP_TABLES.includes("material_moves")&&ERP_TABLES.includes("material_moves")'));
  const materialButtons=[{disabled:false},{disabled:false},{disabled:false}];
  let materialButtonSelector='';
  document.querySelectorAll=selector=>{materialButtonSelector=selector;return materialButtons};
  run('setMaterialSaving(true)');
  assert.ok(materialButtons.every(button=>button.disabled));
  run('setMaterialSaving(false)');
  assert.ok(materialButtons.every(button=>!button.disabled));
  assert.equal(materialButtonSelector,'[data-mm-edit],[data-mm-void],#mm_save,#mm_quick_save');
  document.querySelectorAll=()=>[];
  run('renderMaterials()');
  const materialsHTML=elements.get('materialContent').innerHTML;
  assert.ok(materialsHTML.includes('견적서 없이 기록'));
  assert.ok(materialsHTML.includes('id="mm_statement_company"'));
  assert.ok(!materialsHTML.match(/id="mm_statement"[^>]*disabled/));
  // 입출고 내역이 날짜 그룹으로 렌더되고 실제 날짜·입출고 방향·수량이 값으로 노출되는지 검증.
  // (구 legacy renderMaterialsLegacy는 .material-day-head 헤더를 썼으나, 현재 활성 renderMaterials는
  //  <section class="material-day"> + 각 기록의 .material-record-date 로 날짜 그룹을 표현한다.)
  assert.ok(materialsHTML.includes('class="material-day"'));                                     // 날짜 그룹 섹션
  assert.ok(materialsHTML.includes('material-record-date'));                                     // 각 기록에 날짜 표시
  assert.ok(materialsHTML.includes('2026. 9. 1.') && materialsHTML.includes('2026. 9. 2.'));    // 입고일·작업일 실제 값
  assert.ok(materialsHTML.includes('material-record-qty in') && materialsHTML.includes('100개')); // 입고 +100개
  assert.ok(materialsHTML.includes('material-record-qty out') && materialsHTML.includes('30개')); // 작업 완료 차감 30개(15작업×2)
  assert.ok(materialsHTML.includes('material-record-actions'));
  assert.ok(materialsHTML.includes('material-master'));
  assert.ok(materialsHTML.includes('material-owner active'));
  assert.ok(materialsHTML.includes('바로 사용'));
  assert.ok(materialsHTML.includes('1개 사용 기록'));
  assert.equal(run('materialStatementCompanyId'),'a'); // only owner is selected automatically
  run('let materialToast="";toast=message=>{materialToast=message};previewMaterialStatement("")');
  assert.equal(run('materialToast'),'재고내역서를 만들 업체를 먼저 선택하세요');
  run(`const statement=materialStatementData('a','2026-09-04');`);
  assert.equal(run('statement.total'),90);
  assert.equal(run('statement.summary[0].received'),100);
  assert.equal(run('statement.summary[0].used'),0); // canceled work must not leak into customer totals
  assert.equal(run('statement.history.length'),2);
  assert.equal(run('materialStatementData("a","2026-08-01").total'),0);
  assert.equal(run('materialStatementData("a","2026-09-05").total'),88);
  assert.equal(run('materialStatementData("b","2026-09-05").total'),0);
  assert.throws(()=>run('materialStatementData("unknown","2026-09-05")'));
  assert.throws(()=>run('materialStatementData("a","2026-02-30")'));
  assert.equal(run('materialHoldingCompanyIds().join(",")'),'a');
  assert.equal(run('materialChoices("a",materialBalances(),true)[0].name'),'패치');
  run('const lost=db.material_moves.find(m=>m.kind==="불량/분실");const editedLost=buildMaterialMove({...lost,qty:"3"})');
  assert.equal(await run('updateMaterialMove(lost.id,editedLost)'),true);
  assert.equal(run('materialBalances()[materialKey(receipt)]'),87);
  run('saveTable=async()=>false');
  assert.equal(await run('updateMaterialMove(lost.id,buildMaterialMove({...lost,qty:"4"}))'),false);
  assert.equal(run('materialBalances()[materialKey(receipt)]'),87);
  run('saveTable=async()=>true');
  await assert.rejects(()=>run('updateMaterialMove(lost.id,buildMaterialMove({...lost,qty:"200"}))'));
  assert.equal(run('materialBalances()[materialKey(receipt)]'),87);
  run('receipt.memo="PRIVATE MEMO";receipt.order_no="SECRET_ORDER";const statementHTML=materialStatementHtml(statement,{name:"<script>alert(1)</script>",bank:"PRIVATE BANK"})');
  const output=run('statementHTML');
  assert.ok(output.includes('지급자재 재고내역서'));
  assert.ok(output.includes('&lt;script&gt;'));
  assert.ok(!output.includes('<script>'));
  assert.ok(!output.includes('PRIVATE MEMO')&&!output.includes('SECRET_ORDER')&&!output.includes('PRIVATE BANK'));
  assert.equal(run('db.material_moves.filter(m=>!m.void_at).length'),3);
  console.log('PASS: standalone work, owner isolation, save/edit safety, cancellation, holding filters, balance choices, backup, statement cutoff/totals/escaping/privacy and read-only behavior');
})().catch(e=>{console.error(e);process.exitCode=1});
