// Local static allowlist only: no API, proxy, Cloud SDK, file mutation or credential logging.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed=new Set(['index.html','preview.html','style.css','app.mjs','core.mjs','providers.mjs','mock.mjs','design-master.png','drive-icon.png','dropbox-icon.png']);
allowed.add('runtime.mjs');allowed.add('boot.mjs');
for(const name of ['montage-desktop.html','montage-mobile390.html','montage.css',...['desktop','mobile390','mobile430'].flatMap(size=>['login','signup','verify','storage','connecting','ready','reset'].map(screen=>size+'-'+screen+'.png'))])allowed.add(name);
const server=createServer(async(req,res)=>{
 const host=req.headers.host;
 if(host!=='127.0.0.1:4218'&&host!=='localhost:4218'){res.writeHead(403);res.end();return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 const name=new URL(req.url,'http://127.0.0.1:4218').pathname.slice(1)||'index.html';
 if(!allowed.has(name)){res.writeHead(404);res.end();return;}
 try{
  let body=await readFile(new URL(name==='preview.html'?'index.html':name,import.meta.url));
  if(name==='preview.html')body=body.toString().replace('<html lang="ko">','<html lang="ko" data-ui-preview>');
  if(name==='index.html')body=body.toString().replace('<footer class="page-footer"></footer>','<footer class="page-footer">LOCAL · 모의 검증 — 실제 계정 대신 .invalid 테스트 이메일을 사용하세요.<button id="mock-verify" hidden type="button">LOCAL: 인증메일 확인 모사</button></footer>');
  res.writeHead(200,{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.mjs')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});
  res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(500);res.end('LOCAL_UNAVAILABLE');}
});
server.listen(4218,'127.0.0.1',()=>console.log('LOCAL mock only: http://127.0.0.1:4218'));
