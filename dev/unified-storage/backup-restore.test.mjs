// 처음 쓰는 분 안전망(10/22, 5단계): 매일 자동 백업(만들기만) · 백업에서 되살리기(지금 것은 그대로) · 다른 클라우드로 옮기기(매입 포함). 가짜 Dropbox·시험용 이름.
import test from 'node:test';import assert from 'node:assert/strict';
import {emptyData} from '../personal-cloud-onboarding/core.mjs';
import {createMergeImport} from './merge-import.mjs';
import {base,domestic,doc,fakeDropbox,open} from './purchase-fixtures.mjs';

test('Dropbox 자동 백업: 하루 한 파일, 같은 날 다시 만들면 덮지 않고 그대로 · 목록은 최근 것부터 · 읽기',async()=>{
 const fake=fakeDropbox({...emptyData(),...base()});const {repo,backend}=await open(fake);
 assert.deepEqual(await repo.listBackups(),[]);
 const first=repo.backupSnapshot();assert.equal(first.app,'erp');assert.equal(first.companies.length,4);
 assert.deepEqual(await repo.createBackup('2026-10-21',first),{created:true});
 const before=fake.files.get('/naro biz/backups/2026-10-21.json').body;
 assert.deepEqual(await repo.createBackup('2026-10-21',{...first,companies:[]}),{created:false});
 assert.equal(fake.files.get('/naro biz/backups/2026-10-21.json').body,before,'같은 날 백업은 덮어쓰지 않는다');
 await repo.createBackup('2026-10-22',first);
 assert.deepEqual((await repo.listBackups()).map(b=>b.day),['2026-10-22','2026-10-21']);
 assert.equal((await repo.readBackup('2026-10-21')).companies.length,4);
 await assert.rejects(repo.createBackup('../x',first),e=>e.code==='VALIDATION');
 await assert.rejects(repo.createBackup('2026-10-23',{app:'other'}),e=>e.code==='VALIDATION');
 await assert.rejects(backend.readBackup('2026-1-1'),e=>e.code==='VALIDATION');
 // 크기는 글자 수가 아니라 실제 바이트로 잰다(한글은 3바이트) — 올린 백업을 다시 읽을 수 있게
 await assert.rejects(repo.createBackup('2026-10-24',{...first,memo:'가'.repeat(2500000)}),e=>e.code==='VALIDATION');
});

test('백업에 매입도 들어가고, 빈 새 클라우드로 가져오면 거래처·품목·매입이 모두 옮겨진다(클라우드 옮기기)',async()=>{
 const from=await open(fakeDropbox({...emptyData(),...base()}));
 await from.repo.loadPurchases();await from.repo.startPurchases();await from.repo.savePurchases(doc([domestic()]));
 const backup=from.repo.backupSnapshot();assert.deepEqual(backup.purchases.rows.map(r=>r.id),['p1']);
 const to=await open(fakeDropbox(emptyData()));const importer=createMergeImport(to.repo);
 assert.equal(importer.preview(backup).count,4+3+1,'거래처 4 + 품목 3 + 매입 1');
 const result=await importer.run(backup);
 assert.equal(result.completed,8);assert.equal(to.repo.loadCollection('companies').length,4);
 assert.equal(to.repo.purchasesState().status,'ready');assert.deepEqual(to.repo.loadPurchasesDoc().rows.map(r=>r.id),['p1']);
 // 같은 파일을 다시 가져와도 늘어나지 않는다
 assert.equal(createMergeImport(to.repo).preview(backup).count,0);
});

test('되살리기(keep): 지금 고친 항목은 그대로 두고 없어진 것만 다시 넣는다 · 보통 가져오기는 다르면 멈춘다',async()=>{
 const seed={...emptyData(),...base()};const old=structuredClone(seed);old.backup=true;
 const backup={app:'erp',format:1,...structuredClone(seed),companies:[...seed.companies,{id:'v9',name:'시험 거래처',type:'매입',prices:[]}]};
 seed.companies[0]={...seed.companies[0],name:'대한원단(이름 바꿈)'};
 const {repo}=await open(fakeDropbox(seed));const importer=createMergeImport(repo);
 assert.throws(()=>importer.preview(backup),e=>e.code==='STORAGE_CONFLICT');
 assert.equal(importer.preview(backup,{keepExisting:true}).count,1);
 await importer.run(backup,null,{keepExisting:true});
 const names=repo.loadCollection('companies').map(c=>c.name);
 assert.ok(names.includes('대한원단(이름 바꿈)'),'지금 이름 유지');assert.ok(names.includes('시험 거래처'),'없어진 것 되살림');
});
