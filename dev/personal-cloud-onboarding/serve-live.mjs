// Static candidate only. No token/URL/request logging, API proxy or write endpoint.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
const allowed=new Set(manifest.files.map(x=>x.path));
createServer(async(req,res)=>{
 if(!['localhost:4219','127.0.0.1:4219'].includes(req.headers.host)){res.writeHead(403);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let path=new URL(req.url,'http://localhost:4219').pathname.slice(1)||'index.html';
 if(path==='oauth/dropbox/callback')path='dropbox-callback.html';
 if(path==='oauth/dropbox/waiting')path='dropbox-waiting.html';
 if(!allowed.has(path)){res.writeHead(404);res.end();return;}
 try{const body=await readFile(resolve(root,'release',path));
 res.writeHead(200,{'Content-Type':path.endsWith('.mjs')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin','Cross-Origin-Opener-Policy':'same-origin-allow-popups','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' https://accounts.google.com/gsi/style; img-src 'self'; frame-src https://accounts.google.com/gsi/; connect-src https://accounts.google.com/gsi/ https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.dropboxapi.com https://content.dropboxapi.com; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(500);res.end('UNAVAILABLE');}
}).listen(4219,'127.0.0.1',()=>console.log('Real Auth candidate: http://localhost:4219 — user input required; no automatic signup/login'));
