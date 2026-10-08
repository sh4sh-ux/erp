import {emptyData} from './core.mjs';
import {createStorageRepository,GoogleDriveProvider,keys,datasetPath} from './storage.mjs';
import {openWorkspace,prepareWorkspace} from './workspace.mjs';
import {assetPath,pngDigest} from './asset-store.mjs';
// Test-only memory backend. No OAuth, network, persistent storage or production data.
const data=emptyData(),revisions=Object.fromEntries(keys.map(k=>[k,1]));
if(new URL(location.href).searchParams.has('layout')){
 data.companies=[{id:'layout-c',name:'시안 거래처',type:'매출',prices:[]}];
 data.items=[{id:'layout-i',name:'시안 품목',code:'LAYOUT-01',type:'단품',components:[],variants:[],colors:[],buy_price:500,sell_price:1000}];
 data.quotes=[{id:'layout-q',no:'LAYOUT-01',company_id:'layout-c',date:'2026-09-29',status:'수주',lines:[{id:'layout-l',item_id:'layout-i',name:'시안 품목',color:'',spec:'',qty:2,price:1000}]}];
 data.payments=[{id:'layout-p',company_id:'layout-c',kind:'수금',amount:1000,date:'2026-09-29',memo:'화면 검증용 합성 기록'}];
 data.material_moves=[{id:'layout-m',company_id:'layout-c',kind:'받음',material:'시안 자재',qty:5,date:'2026-09-29',created_at:'2026-09-29T00:00:00Z'}];
 if(new URL(location.href).searchParams.has('long')){
  const seed=structuredClone(data);
  for(let i=2;i<=40;i++){
   data.companies.push({...seed.companies[0],id:'layout-c'+i,name:'시안 거래처 '+i});
   data.items.push({...seed.items[0],id:'layout-i'+i,name:'시안 품목 '+i,code:'LAYOUT-'+i});
   data.quotes.push({...seed.quotes[0],id:'layout-q'+i,no:'LAYOUT-'+i,company_id:'layout-c'+i});
   data.payments.push({...seed.payments[0],id:'layout-p'+i,company_id:'layout-c'+i});
   data.material_moves.push({...seed.material_moves[0],id:'layout-m'+i,company_id:'layout-c'+i});
  }
 }
}
if(new URL(location.href).searchParams.has('dashboard')){
 const now=new Date(),day=n=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 data.companies=[{id:'dash-c',name:'대시보드 합성 거래처',type:'매출',prices:[]}];
 data.items=[{id:'dash-i',name:'합성 품목',code:'DASH-01',type:'단품',components:[],variants:[],colors:[],buy_price:500,sell_price:1000}];
 data.quotes=['작성중','발송','수주','부분납품','납품'].map((status,i)=>({id:'dash-q'+i,no:'DASH-'+i,company_id:'dash-c',date:day(-i),status,created_at:day(-i)+'T09:00:00Z',lines:[{id:'dash-l'+i,item_id:'dash-i',name:'합성 품목',qty:2,price:1000}],...(i>=3?{delivered_at:day(-i),deliveries:[{id:'dash-d'+i,date:day(-i),lines:[{line_id:'dash-l'+i,qty:i===3?1:2}]}]}:{})}));
 data.payments=[{id:'dash-p',company_id:'dash-c',kind:'수금',amount:1000,date:day(-1),memo:'로컬 대시보드 검증용'}];
 // Local-only typography QA: multiple thousands separators, never real cloud records.
 if(new URL(location.href).searchParams.has('type-rules')){
  data.quotes.forEach(q=>q.lines.forEach(line=>line.price=10000000));
  data.payments[0].amount=115500;
 }
 data.stock_moves=[{id:'dash-stock-in',item_id:'dash-i',kind:'입고',qty:3,color:'',spec:'',date:day(-5)},...[3,4].map(i=>({id:'dash-stock-'+i,item_id:'dash-i',kind:'출고',qty:i===3?1:2,color:'',spec:'',date:day(-i),quote_id:'dash-q'+i}))];
}
if(new URL(location.href).searchParams.has('interrupted')){
 data.companies=[{id:'synthetic-c',name:'합성 복구 거래처',type:'매출',prices:[]}];
 data.items=[{id:'synthetic-i',name:'합성 복구 품목',type:'단품',components:[],variants:[],colors:[],buy_price:500,sell_price:1000}];
 data.quotes=[{id:'synthetic-q',no:'SYN-RECOVERY',company_id:'synthetic-c',date:'2026-09-29',status:'납품',lines:[{id:'synthetic-l',item_id:'synthetic-i',name:'합성 복구 품목',color:'',spec:'',qty:2,price:1000}],deliveries:[{id:'synthetic-d',date:'2026-09-29',lines:[{line_id:'synthetic-l',qty:2}]}]}];
}
if(new URL(location.href).searchParams.has('company-ledger')){
 data.companies=[{id:'ledger-c',name:'합성 거래내역 검증 거래처',type:'매출',prices:[]}];
 data.items=[{id:'ledger-i',name:'검증 품목',code:'TEST',type:'단품',components:[],variants:[],colors:[],buy_price:500,sell_price:1000}];
 const states=['완료','부분 입금','부분 납품','초과 입금','선입금','입금 없음'];
 data.quotes=states.map((state,i)=>({id:'ledger-q'+i,no:'TEST-'+state,company_id:'ledger-c',date:'2026-08-01',status:i===4?'수주':i===2?'부분납품':'납품',lines:[{id:'ledger-l'+i,item_id:'ledger-i',name:'검증 품목',qty:2,price:1000}],deliveries:i===4?[]:[{id:'ledger-d'+i,date:'2026-09-'+String(30-i).padStart(2,'0'),lines:[{line_id:'ledger-l'+i,qty:i===2?1:2}]}]}));
 data.payments=[2200,1000,1100,2500,1000].map((amount,i)=>({id:'ledger-p'+i,company_id:'ledger-c',quote_id:'ledger-q'+i,kind:'수금',amount,date:'2026-10-01',method:'계좌이체'}));
 data.payments.push({id:'ledger-unlinked',company_id:'ledger-c',kind:'수금',amount:2200,date:'2026-09-01',method:'현금'}, {id:'ledger-out',company_id:'ledger-c',quote_id:'ledger-q0',kind:'지급',amount:100,date:'2026-08-31',method:'계좌이체'});
 data.stock_moves=[{id:'ledger-in',item_id:'ledger-i',kind:'입고',qty:20,date:'2026-08-01',color:'',spec:''},...data.quotes.flatMap(q=>q.deliveries.map(d=>({id:'stock-'+d.id,item_id:'ledger-i',kind:'출고',quote_id:q.id,qty:d.lines[0].qty,date:d.date,color:'',spec:''})))];
}
if(new URL(location.href).searchParams.has('sales-analysis')){
 data.companies=[{id:'sa-c',name:'합성 루미호스피탈리티_슈가스컬(서울역) 아주 긴 거래처명',type:'매출',prices:[]},{id:'sa-d',name:'합성 테스트 주방',type:'매출',prices:[]}];
 data.items=[{id:'sa-a',name:'합성 셰프복',code:'SA-CHEF',category:'의류',type:'단품',components:[],variants:[],colors:[],buy_price:500,sell_price:1000},{id:'sa-b',name:'합성 타월',code:'SA-TOWEL',category:'잡화',type:'단품',components:[],variants:[],colors:[],buy_price:300,sell_price:500}];
 const date=new Date(),today=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 data.quotes=[{id:'sa-q',no:'SA-001',company_id:'sa-c',date:today,status:'수주',lines:[{id:'sa-l1',item_id:'sa-a',name:'합성 셰프복',qty:4,price:1000},{id:'sa-l2',item_id:'sa-b',name:'합성 타월',qty:3,price:500},{id:'sa-l3',item_id:'__free__',name:'합성 배송비',qty:1,price:100}]},{id:'sa-q2',no:'SA-002',company_id:'sa-d',date:today,status:'수주',lines:[{id:'sa-l4',item_id:'sa-a',name:'합성 셰프복',qty:2,price:1000}]}];
 data.payments=[];data.stock_moves=[];
 if(new URL(location.href).searchParams.has('sales-many')){
  for(let i=0;i<20;i++){
   const id='sa-extra-'+i;
   data.companies.push({id,name:'합성 추가 거래처 '+String(i+1).padStart(2,'0'),type:'매출',prices:[]});
   data.quotes.push({id:'q-'+id,no:'SA-EXTRA-'+i,company_id:id,date:today,status:'수주',lines:[{id:'l-'+id,item_id:'sa-a',name:'합성 셰프복',qty:1,price:100+i}]});
  }
 }
 if(new URL(location.href).searchParams.has('sales-large'))data.quotes.forEach(q=>q.lines.forEach(l=>l.price*=1000));
}
const identity=key=>({provider:'drive',logicalKey:key,fileId:'synthetic-'+key,path:datasetPath(key),revision:String(revisions[key])});
const backend={list:async()=>keys.map(datasetPath),identity:async path=>identity(keys.find(k=>datasetPath(k)===path)),load:async path=>structuredClone(data[keys.find(k=>datasetPath(k)===path)]),async updateDataset(key,before,next){data[key]=structuredClone(next);revisions[key]++;document.documentElement.dataset.syntheticSaves=String(Object.values(revisions).reduce((a,b)=>a+b,0)-7);return {rows:structuredClone(next),identity:identity(key)};}};
const repo=createStorageRepository(new GoogleDriveProvider(backend),{businessWrite:true,extendedWrite:new URL(location.href).searchParams.has('extended')});await repo.loadAll();
const syntheticAssets=new Map();
backend.uploadAsset=async(kind,bytes)=>{const path=assetPath(kind,await pngDigest(bytes));syntheticAssets.set(path,bytes.slice());return {path};};
backend.downloadAsset=async path=>{if(!syntheticAssets.has(path))throw Error('missing fixture asset');return syntheticAssets.get(path).slice();};
const width=Number(new URL(location.href).searchParams.get('width'));
async function reconnect(){
 await repo.loadAll();openWorkspace(structuredClone(data),reconnect,repo);
 if([1440,430,390].includes(width)){const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height='900px';document.documentElement.dataset.fixtureWidth=String(width);}
}
if(new URL(location.href).searchParams.has('prewarm')){
 prepareWorkspace();
 const button=document.createElement('button');button.textContent='준비된 합성 화면 열기';
 button.onclick=()=>reconnect();document.querySelector('main.onboarding').append(button);
}else await reconnect();
