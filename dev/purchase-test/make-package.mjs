// 시험 꾸러미 만들기: node make-package.mjs <매입 개발 빌드 release> <운영 빌드 release> <hosting-config.json> <출력 폴더>
// 가짜 Dropbox는 자동 테스트의 purchase-fixtures.mjs를 그대로 복사한다(불러오는 경로만 꾸러미 안의 앱 파일로).
import {cp,readFile,writeFile,mkdir,rm,chmod} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [news,olds,hosting,out]=process.argv.slice(2).map(p=>resolve(p));
if(!out)throw Error('사용법: node make-package.mjs <new release> <old release> <hosting-config.json> <out>');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(news,resolve(out,'new'),{recursive:true});await cp(olds,resolve(out,'old'),{recursive:true});
await cp(hosting,resolve(out,'hosting-config.json'));
for(const f of ['serve-test.mjs','mock-runtime.mjs','test-data.mjs','panel.html','panel.js','시작하기.command','안내문.txt'])await cp(resolve(here,f),resolve(out,f));
await chmod(resolve(out,'시작하기.command'),0o755);
let fx=await readFile(resolve(here,'../unified-storage/purchase-fixtures.mjs'),'utf8');
const map={"'../personal-cloud-onboarding/dropbox-backend.mjs'":"'./new/dropbox-backend.mjs'","'../personal-cloud-onboarding/purchase-contract.mjs'":"'./new/purchase-contract.mjs'","'./storage.mjs'":"'./new/storage.mjs'"};
for(const [a,b] of Object.entries(map)){if(!fx.includes(a))throw Error('가짜 Dropbox 불러오기 경로가 바뀜: '+a);fx=fx.replaceAll(a,b);}
await writeFile(resolve(out,'fake-dropbox.mjs'),'// 자동 테스트용 가짜 Dropbox(dev/unified-storage/purchase-fixtures.mjs) 그대로 — 불러오는 경로만 꾸러미 안으로.\n'+fx);
console.log('꾸러미:',out);
