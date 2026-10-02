const http=require('http'),fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const fixturePort=Number(process.env.ERP_PREVIEW_PORT||4178);
const shellPort=Number(process.env.ERP_RESPONSIVE_PREVIEW_PORT||4179);
const fixture=spawn(process.execPath,[path.join(__dirname,'workspace-preview.cjs')],{env:{...process.env,ERP_PREVIEW_PORT:String(fixturePort)},stdio:'inherit'});
const htmlPath=path.join(__dirname,'responsive-preview.html');
const server=http.createServer((req,res)=>{
 if(req.url!=='/'&&req.url!=='/responsive-preview.html'){res.writeHead(404);return res.end();}
 let html=fs.readFileSync(htmlPath,'utf8');
 html=html.replace('src="/"','src="http://127.0.0.1:'+fixturePort+'/"');
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
});
server.listen(shellPort,'127.0.0.1',()=>{
 console.log('NARO responsive preview ready: http://127.0.0.1:'+shellPort);
 console.log('Viewports: 360, 440, 768, 1032, 1440, 1920 CSS px');
});
function shutdown(){server.close();if(!fixture.killed)fixture.kill();}
process.on('SIGINT',()=>{shutdown();process.exit(0)});
process.on('SIGTERM',()=>{shutdown();process.exit(0)});
process.on('exit',shutdown);
