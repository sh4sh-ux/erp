// 매입 시험용 서버(내 컴퓨터 전용). http://localhost:4219 에서만 열린다 — Dropbox 로그인이 이 주소를 허용한다.
// 운영(naro-biz.web.app)과 같은 보안 헤더·주소 규칙(hosting-config.json)을 그대로 쓴다. 읽기 전용, 기록·전달 없음.
// 쓰는 법: node serve-test.mjs   (같은 폴더에 release/ 와 hosting-config.json 이 있어야 한다)
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]||resolve(here,'release'));
const cfg=JSON.parse(await readFile(process.argv[3]||resolve(here,'hosting-config.json'),'utf8')).config;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
const glob=(g,p)=>new RegExp('^'+g.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'\0').replace(/\*/g,'[^/]*').replace(/\0/g,'.*')+'$').test(p);
createServer(async(req,res)=>{
 if(!['localhost:4219','127.0.0.1:4219'].includes(req.headers.host)){res.writeHead(403);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost:4219').pathname);}catch{res.writeHead(400);res.end();return;}
 const rw=(cfg.rewrites||[]).find(r=>glob(r.glob,url));
 let file=resolve(root,'.'+(rw?rw.path:url));
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{if((await stat(file)).isDirectory())file=resolve(file,'index.html');}catch{res.writeHead(404);res.end('없음');return;}
 let body;try{body=await readFile(file);}catch{res.writeHead(404);res.end('없음');return;}
 const h={'Content-Type':TYPES[extname(file)]||'application/octet-stream'};
 for(const x of cfg.headers||[])if(glob(x.glob,url)||glob(x.glob,url.replace(/index\.html$/,'')))Object.assign(h,x.headers);
 res.writeHead(200,h);res.end(req.method==='HEAD'?undefined:body);
}).listen(4219,'127.0.0.1',()=>console.log('매입 시험 서버: http://localhost:4219  (끄려면 Ctrl+C)'));
