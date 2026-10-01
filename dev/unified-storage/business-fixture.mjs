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
if(new URL(location.href).searchParams.has('interrupted')){
 data.companies=[{id:'synthetic-c',name:'합성 복구 거래처',type:'매출',prices:[]}];
 data.items=[{id:'synthetic-i',name:'합성 복구 품목',type:'단품',components:[],variants:[],colors:[],buy_price:500,sell_price:1000}];
 data.quotes=[{id:'synthetic-q',no:'SYN-RECOVERY',company_id:'synthetic-c',date:'2026-09-29',status:'납품',lines:[{id:'synthetic-l',item_id:'synthetic-i',name:'합성 복구 품목',color:'',spec:'',qty:2,price:1000}],deliveries:[{id:'synthetic-d',date:'2026-09-29',lines:[{line_id:'synthetic-l',qty:2}]}]}];
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
