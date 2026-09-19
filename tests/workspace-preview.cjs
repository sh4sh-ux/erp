// Local-only visual fixture. Original files and authentication remain unchanged.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const fixture=`
document.getElementById('loginView').classList.add('hidden');
document.getElementById('appView').classList.remove('hidden');
db.companies=[{id:'c1',name:'샘플 거래처',type:'매출'}];
db.items=[{id:'i1',name:'셰프복',type:'단품',colors:['WH'],variants:[],sell_price:23000}];
db.payments=[{id:'p1',company_id:'c1',kind:'수금',amount:1664300,date:'2026-09-10',method:'계좌이체'}];
db.stock_moves=[{id:'s1',item_id:'i1',kind:'입고',qty:12,color:'WH',spec:'3XL',date:'2026-09-10'}];
db.material_moves=[{id:'m1',company_id:'c1',material:'패치',kind:'받음',qty:100,date:'2026-09-01',source:'직접 주문',created_at:'2026-09-01'}];
const sample=blankQuote();sample.id='q1';sample.company_id='c1';sample.no='SAMPLE';sample.lines=[{...blankLine(),item_id:'i1',name:'셰프복',qty:8,price:23000}];db.quotes=[sample];
// Synthetic volume only: never persisted or sent to Dropbox.
db.companies=[];db.items=[];db.payments=[];db.stock_moves=[];db.material_moves=[];db.quotes=[];
for(let n=1;n<=36;n++){
 const cid='c'+n,iid='i'+n,date='2026-09-'+String(1+(n%12)).padStart(2,'0');
 db.companies.push({id:cid,name:'샘플 '+String(n).padStart(2,'0')+' '+['레스토랑','카페','호텔','베이커리'][n%4],type:'매출'});
 db.items.push({id:iid,name:['셰프복','앞치마','타월','바지'][n%4]+' 샘플 '+n,type:'단품',colors:['WH'],variants:[],sell_price:23000});
 const q=blankQuote();Object.assign(q,{id:'q'+n,company_id:cid,no:'SAMPLE-'+String(n).padStart(3,'0'),date,status:n%4===0?'수주':'납품',delivered_at:n%4===0?'':date,lines:[{...blankLine(),item_id:iid,name:db.items[n-1].name,qty:10+n,price:23000}]});db.quotes.push(q);
 q.lines[0].id='line'+n;
 if(n%4!==0)q.deliveries=[{id:'delivery'+n,date,lines:[{line_id:q.lines[0].id,qty:10+n}]}];
 db.payments.push({id:'p'+n,company_id:cid,quote_id:q.id,kind:'수금',amount:50000+n*1000,date,method:'계좌이체'});
 if(n%3===0)db.payments.push({id:'out'+n,company_id:cid,kind:'지급',amount:20000+n*500,date,method:'카드'});
 db.stock_moves.push({id:'s'+n,item_id:iid,kind:'입고',qty:12+n,color:'WH',spec:'L',date});
 db.material_moves.push({id:'m'+n,company_id:cid,material:'패치',kind:'받음',qty:100+n,date,source:'샘플',created_at:date});
}
db.items.slice(0,3).forEach((item,i)=>{item.name='셰프복';item.code='JK_TEST_'+(i+1);item.variants=['S','M','L','XL','2XL','3XL','4XL','5XL','6XL'].map(spec=>({spec}));});
db.stock_moves.push({id:'negative-fixture',item_id:'i1',kind:'출고',qty:15,color:'WH',spec:'L',date:'2026-09-13'});
const longQuote=db.quotes[0];longQuote.lines=Array.from({length:6},(_,i)=>({...longQuote.lines[0],id:'long-line-'+i,name:'셰프복 [JK_TEST_1]',color:'WH',spec:'3XL',qty:i+1}));longQuote.deliveries=[];
db.companies[0].name='(주)풍풍플라워에이전시 덕진센터 아주 긴 거래처명 검증';
db.items[0].colors=['WH','BK'];db.items[0].buy_price=10000;
db.items[1].colors=['WH','BK','NV'];db.items[1].variants=['28inch','30inch','32inch','34inch','36inch','38inch'].map(spec=>({spec,sell_price:23000}));
db.items[2].variants=['S','M','L','XL','2XL','3XL'].map(spec=>({spec,sell_price:23000}));
db.items[3].code='GRID_FREE';db.items[3].variants=[{spec:'FREE',sell_price:23000}];
db.items[4].code='GRID_LONG';db.items[4].variants=['80X40cm','26X26cm','앞면 자수'].map(spec=>({spec,sell_price:23000}));
db.items[0].variants.forEach((v,i)=>{v.sell_price=23000+i*1000;});
db.items.push({id:'work-auto',name:'자수',code:'Embroidery',type:'작업',spec:'로고',sell_price:3000}, {id:'work-manual',name:'패치 부착',code:'Patch Attachment',type:'작업',sell_price:2000});
longQuote.status='작성중';longQuote.delivered_at='';longQuote.memo='검증용 메모';
longQuote.lines.push({...blankLine(),id:'work-line-auto',item_id:'work-auto',name:'자수',spec:'로고',qty:21,price:3000,auto_qty:true}, {...blankLine(),id:'work-line-manual',item_id:'work-manual',name:'패치 부착',qty:3,price:2000,auto_qty:false}, {...blankLine(),id:'discount-line',item_id:'__free__',name:'할인',qty:1,price:-10000});
const savedQuotes=sessionStorage.getItem('isolated-quote-fixture');if(savedQuotes)db.quotes=JSON.parse(savedQuotes);
switchView('dash');
document.getElementById('qtSearch').oninput=e=>{qtFilter=e.target.value;renderQtList();};
['qtStatus','qtFrom','qtTo'].forEach(id=>document.getElementById(id).onchange=renderQtList);
document.getElementById('qtAllDates').onclick=clearQtDateFilters;
document.getElementById('moreNavBtn').onclick=()=>toggleNav(true);
document.getElementById('menuBtn').onclick=()=>toggleNav(true);
document.getElementById('closeNavBtn').onclick=()=>toggleNav(false);
document.getElementById('navBackdrop').onclick=()=>toggleNav(false);
`;
http.createServer((req,res)=>{
 const name=path.basename(new URL(req.url,'http://localhost').pathname)||'index.html';
 if(!['index.html','v142-dutch-pay.css','workspace-system.css','workspace-layout.js','navigation-layout.css','mobile-workspace.css','stock-entry.js','stock-entry.css','quote-presentation.css','quote-presentation.js'].includes(name)){res.writeHead(404);return res.end();}
 let content=fs.readFileSync(path.join(root,name),'utf8');
 if(name==='index.html'){
   // Run production init and event wiring, but never authenticate or access business files.
   const isolate=`ensureToken=async()=>null;window.fetch=async()=>{throw Error('Isolated preview: network disabled')};Table.save=async(name,data)=>{if(name==='quotes')sessionStorage.setItem('isolated-quote-fixture',JSON.stringify(data));};saveStockChecked=async()=>{};init();`;
   content=content.replace(/init\(\);\s*<\/script>/,isolate+'\n'+fixture+'</script>');
 }
 res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html');res.end(content);
}).listen(Number(process.env.ERP_PREVIEW_PORT||4178),'127.0.0.1',()=>console.log('Isolated workspace fixture ready'));
