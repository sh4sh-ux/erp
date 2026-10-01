// LOCAL only, no proxy, credentials, API writes, URL logs or cloud administration.
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'outputs/unified-storage-read/release');
const port=Number(process.argv[3]||4219);
const manifest=JSON.parse(await readFile(resolve(root,'../manifest.json'),'utf8'));const allowed=new Set(manifest.files.map(f=>f.path));
const businessRoot=process.argv.includes('--business-route')?resolve('outputs/personal-business-candidate/release'):null;
const businessAllowed=businessRoot?new Set(JSON.parse(await readFile(resolve(businessRoot,'../manifest.json'),'utf8')).files.map(f=>f.path)):null;
const extendedRoot=process.argv.includes('--extended-route')?resolve('outputs/personal-business-extended-candidate/release'):null;
const extendedAllowed=extendedRoot?new Set(JSON.parse(await readFile(resolve(extendedRoot,'../manifest.json'),'utf8')).files.map(f=>f.path)):null;
createServer(async(req,res)=>{
 if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)||!['GET','HEAD'].includes(req.method)){res.writeHead(403).end();return;}
 const urlPath=new URL(req.url,'http://localhost:4219').pathname.slice(1);
 const callbackMap={'oauth/dropbox/callback':'dropbox-callback.html','oauth/dropbox/waiting':'dropbox-waiting.html','dropbox-callback.mjs':'dropbox-callback.mjs'};
 const extended=!!extendedRoot&&(urlPath.startsWith('extended/')||Object.hasOwn(callbackMap,urlPath));
 const business=!!businessRoot&&urlPath.startsWith('business/');
 const path=(extended?(callbackMap[urlPath]||urlPath.slice(9)):business?urlPath.slice(9):urlPath)||'index.html';
 const erp=path.startsWith('erp/');
 // OAuth callback returns from a cross-origin popup. Only these minimal popup
 // documents opt out of COOP isolation; the authenticated app retains COOP.
 // PKCE and exact origin/source/state validation remain mandatory.
 const coop=['dropbox-callback.html','dropbox-waiting.html'].includes(path)?'unsafe-none':'same-origin-allow-popups';
 const csp=erp?"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; worker-src 'none'":`default-src 'none'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self'; frame-src 'self' https://accounts.google.com/gsi/; connect-src https://accounts.google.com/gsi/ https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${extended?' https://api.dropboxapi.com https://content.dropboxapi.com':''}; form-action 'none'; frame-ancestors 'none'; worker-src 'none'`;
 const fixture=!business&&['fixture.html','fixture.mjs','fixture-error.js','company-fixture.html','company-fixture.mjs','business-fixture.html','business-fixture.mjs','import-fixture.html','import-fixture.mjs'].includes(path);
 if(!(extended?extendedAllowed:business?businessAllowed:allowed).has(path)&&!fixture){res.writeHead(404).end();return;}
 try{let body=await readFile(fixture?new URL(path,import.meta.url):resolve(extended?extendedRoot:business?businessRoot:root,path));if(process.argv.includes('--diagnostic-shell')&&path==='erp/index.html')body=Buffer.from(body.toString().replace('<head>','<head><script src="/fixture-error.js"></script>'));res.writeHead(200,{'Content-Type':/\.(mjs|js)$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html','Cache-Control':'no-store','Content-Security-Policy':csp,'Cross-Origin-Opener-Policy':coop,'Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500).end();}
}).listen(port,'127.0.0.1',()=>console.log(`LOCAL storage candidate: http://localhost:${port}`));
