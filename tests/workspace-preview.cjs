// Local-only visual fixture. Original files and authentication remain unchanged.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const fixture=`
document.getElementById('loginView').classList.add('hidden');
document.getElementById('appView').classList.remove('hidden');
db.companies=[{id:'c1',name:'샘플 거래처',type:'매출'}];
db.items=[{id:'i1',name:'셰프복',type:'단품',colors:['WH'],variants:[],sell_price:23000}];
db.material_moves=[{id:'m1',company_id:'c1',material:'패치',kind:'받음',qty:100,date:'2026-09-01',source:'직접 주문',created_at:'2026-09-01'}];
const sample=blankQuote();sample.id='q1';sample.company_id='c1';sample.no='SAMPLE';sample.lines=[{...blankLine(),item_id:'i1',name:'셰프복',qty:8,price:23000}];db.quotes=[sample];
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{switchView(b.dataset.view);if(b.dataset.view==='quotes'){qtSel='q1';renderQtList();renderQtDetail();}if(b.dataset.view==='companies'){coSel='c1';renderCoList();renderCoDetail();}if(b.dataset.view==='items'){itSel='i1';renderItList();renderItDetail();}});
switchView('dash');
document.getElementById('moreNavBtn').onclick=()=>toggleNav(true);
document.getElementById('menuBtn').onclick=()=>toggleNav(true);
document.getElementById('closeNavBtn').onclick=()=>toggleNav(false);
document.getElementById('navBackdrop').onclick=()=>toggleNav(false);
`;
http.createServer((req,res)=>{
 const name=path.basename(new URL(req.url,'http://localhost').pathname)||'index.html';
 if(!['index.html','v142-dutch-pay.css','workspace-system.css','workspace-layout.js','navigation-layout.css'].includes(name)){res.writeHead(404);return res.end();}
 let content=fs.readFileSync(path.join(root,name),'utf8');
 if(name==='index.html'){
   // Reuse production identity setup while omitting authentication in this fixture.
   const identity=content.slice(content.indexOf('  /* Desktop workspace identity'),content.indexOf('  // OAuth 콜백 처리'));
   if(!identity.includes('app-view-meta'))throw new Error('Production identity setup not found');
   content=content.replace(/init\(\);\s*<\/script>/,identity+'\n'+fixture+'</script>');
 }
 res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html');res.end(content);
}).listen(4178,'127.0.0.1',()=>console.log('Isolated workspace fixture: http://127.0.0.1:4178'));
