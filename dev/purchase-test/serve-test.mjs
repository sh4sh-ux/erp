// 매입 화면 시험 서버 — 압축을 풀고 '시작하기'를 누르면 실행된다. 실제 Dropbox·Google·운영 데이터에는 접속하지 않는다.
//  - 자동 테스트가 쓰는 가짜 Dropbox(purchase-fixtures.mjs의 fakeDropbox)를 그대로 이 서버 안에서 하나 돌린다(탭 여러 개가 같이 씀).
//  - 화면은 실제 로그인 대신 mock-runtime.mjs를 쓰고, 저장 요청은 모두 이 서버의 /__fake/call 로만 온다.
//  - 브라우저 보안 설정(CSP connect-src 'self')으로 바깥 주소 접속 자체를 막는다. 이 서버도 바깥으로 요청하지 않는다.
//  http://localhost:4219 = 매입 개발 버전, http://localhost:4220 = 지금 운영 버전(같은 가짜 Dropbox — 호환 시험용)
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fakeDropbox} from './fake-dropbox.mjs';
import {testData} from './test-data.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(await readFile(resolve(here,'hosting-config.json'),'utf8')).config;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
const glob=(g,p)=>new RegExp('^'+g.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'\0').replace(/\*/g,'[^/]*').replace(/\0/g,'.*')+'$').test(p);
// 바깥 주소 차단: 운영 설정의 보안 헤더에서 접속 허용 목록을 '이 서버만'으로 바꾼다
const lock=csp=>csp.replace(/connect-src [^;]*/,"connect-src 'self'").replace(/script-src [^;]*/,m=>m.replace(/https:\/\/\S+/g,'').trim()).replace(/frame-src [^;]*/,"frame-src 'self'");

// ── 가짜 Dropbox(자동 테스트와 같은 것) ──
let fake,events=[];
const reset=()=>{fake=fakeDropbox(testData());events=[];note('가짜 데이터로 새로 시작');};
const note=t=>{events.unshift(new Date().toLocaleTimeString('ko-KR')+' '+t);events.length=Math.min(events.length,30);};
const FOLDERS=['/naro biz','/naro biz/data','/naro biz/images','/naro biz/documents','/naro biz/logs'];
const isData=p=>/naro biz\/data\//i.test(p||'');
async function call({url,headers={},body=''}){
 if(!/^https:\/\/(api|content)\.dropboxapi\.com\/2\//.test(url))return {status:400,body:'{}'};
 const arg=JSON.parse(headers['Dropbox-API-Arg']||headers['dropbox-api-arg']||body||'{}'),p=String(arg.path||'').toLowerCase();
 // 자동 테스트용 가짜에 없는 '폴더' 응답만 여기서 채운다(화면 첫 연결 때 폴더를 확인하므로)
 if(url.endsWith('create_folder_v2'))return {status:200,body:JSON.stringify({metadata:{'.tag':'folder',path_lower:p}})};
 if(url.endsWith('get_metadata')&&FOLDERS.includes(p))return {status:200,body:JSON.stringify({'.tag':'folder',name:p.split('/').pop(),id:'id:'+p,path_lower:p,path_display:arg.path})};
 const r=await fake.fetcher(url,{headers:{'Dropbox-API-Arg':headers['Dropbox-API-Arg']||headers['dropbox-api-arg'],...headers},body});
 if(url.endsWith('upload')&&isData(arg.path))note(`저장 ${arg.path.split('/').pop()} (${r.status===200?'완료':'거절 — 다른 곳에서 먼저 바뀜'})`);
 return {status:r.status,body:await r.text(),headers:{'content-type':r.headers.get('content-type')||'application/json'}};
}
async function control(action){
 if(action==='reset')reset();
 else if(action==='drop'){fake.dropNextWrite(p=>isData(p));note('다음 저장은 "보내는 중 끊김"(저장 안 됨)으로 만듭니다');}
 else if(action==='lose'){fake.loseNextResponse(p=>isData(p));note('다음 저장은 "저장은 됐는데 응답 잃음"으로 만듭니다');}
 else if(action==='offline'){offline=true;fake.setOffline(true);note('연결 끊음');}
 else if(action==='online'){offline=false;fake.setOffline(false);note('연결 이음');}
 return status();
}
let offline=false;
const status=()=>({offline,events,files:[...fake.files.values()].map(f=>({path:f.path.replace(/^\/NARO Biz\//,''),size:f.body.length,rev:f.rev})).sort((a,b)=>a.path.localeCompare(b.path)),
 purchases:(()=>{try{const d=JSON.parse(fake.files.get('/naro biz/data/purchases.json')?.body||'null');return d?d.rows.length:null;}catch{return null;}})()});
reset();

// ── 앱 화면 ──
function serve(port,root,label){
 createServer(async(req,res)=>{
  try{
   if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host)){res.writeHead(403);res.end();return;}
   const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const send=(code,type,b,h={})=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...h});res.end(b);};
   const json=o=>send(200,'application/json',JSON.stringify(o));
   if(url==='/__fake/call'&&req.method==='POST'){let b='';for await(const c of req)b+=c;try{json(await call(JSON.parse(b)));}catch(e){json({throw:String(e?.message||e)});}return;}
   if(url==='/__fake/status')return json(status());
   if(url.startsWith('/__fake/do/')&&req.method==='POST')return json(await control(url.slice(11)));
   if(url==='/__fake/'||url==='/__fake')return send(200,TYPES['.html'],await readFile(resolve(here,'panel.html')),{'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'"});
   if(url==='/__fake/panel.js')return send(200,TYPES['.js'],await readFile(resolve(here,'panel.js')));
   if(url==='/runtime.mjs')return send(200,TYPES['.mjs'],await readFile(resolve(here,'mock-runtime.mjs')));
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const rw=(cfg.rewrites||[]).find(r=>glob(r.glob,url));
   let file=resolve(root,'.'+(rw?rw.path:url));
   if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   try{if((await stat(file)).isDirectory())file=resolve(file,'index.html');}catch{send(404,'text/plain; charset=utf-8','없음');return;}
   let body=await readFile(file);
   const h={'Content-Type':TYPES[extname(file)]||'application/octet-stream'};
   for(const x of cfg.headers||[])if(glob(x.glob,url)||glob(x.glob,url.replace(/index\.html$/,'')))Object.assign(h,x.headers);
   if(h['Content-Security-Policy'])h['Content-Security-Policy']=lock(h['Content-Security-Policy']);
   h['Cache-Control']='no-store';
   // 첫 화면 맨 위에 '시험 모드' 띠(운영과 헷갈리지 않게)
   if(url==='/'||url==='/index.html'){body=Buffer.from(String(body).replace(/<body[^>]*>/,m=>m+`<div style="position:fixed;z-index:2147483647;left:0;right:0;top:0;padding:4px 10px;background:#FF9500;color:#111;font:600 12px/1.4 system-ui,sans-serif;text-align:center">${label} · 가짜 Dropbox · 운영 데이터와 연결 안 됨 · 시험 도구: <a href="/__fake/" target="_blank" style="color:#111">localhost:${port}/__fake</a></div>`));}
   res.writeHead(200,h);res.end(req.method==='HEAD'?undefined:body);
  }catch(e){res.writeHead(500);res.end('오류');}
 }).listen(port,'127.0.0.1');
}
serve(4219,resolve(here,'new'),'매입 개발 버전 시험');
serve(4220,resolve(here,'old'),'지금 운영 버전(호환 시험)');
console.log('\n  매입 시험 준비 완료\n  · 매입 개발 버전:  http://localhost:4219\n  · 지금 운영 버전:  http://localhost:4220  (호환 시험용, 같은 가짜 데이터)\n  · 시험 도구:       http://localhost:4219/__fake\n  끄려면 이 창에서 Ctrl+C\n');
