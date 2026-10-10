// 매입 테스트 공용(가짜 데이터·가짜 Dropbox). 운영 데이터에 접속하지 않는다.
import {createDropboxBackend} from '../personal-cloud-onboarding/dropbox-backend.mjs';
import {emptyPurchases} from '../personal-cloud-onboarding/purchase-contract.mjs';
import {DropboxProvider,GoogleDriveProvider,createStorageRepository,keys} from './storage.mjs';
export const AT='2026-10-10T01:00:00.000Z';
export const base=()=>({
 companies:[{id:'v1',name:'대한원단',type:'매입',prices:[]},{id:'v2',name:'광저우 유니폼',type:'매입',prices:[]},{id:'f1',name:'포워더',type:'매입',prices:[]},{id:'c1',name:'고객사',type:'매출',prices:[]}],
 items:[{id:'jk',name:'셰프복',type:'단품',components:[],variants:[]},{id:'ap',name:'앞치마',type:'단품',components:[],variants:[]},{id:'ch',name:'조리모',type:'단품',components:[],variants:[]}],
 quotes:[],payments:[],stock_moves:[],material_moves:[],settings:{schema:3}
});
export const domestic=(o={})=>({id:'p1',no:'PO-2026-1010-1',kind:'국내',vendor_id:'v1',date:'2026-10-10',status:'작성중',currency:'KRW',
 lines:[{id:'l1',item_id:'jk',color:'BK',spec:'S',qty:20,unit_price:4200},{id:'l2',item_id:'jk',color:'BK',spec:'M',qty:30,unit_price:4200}],
 vat:{supply:210000,tax:21000},costs:[],receipts:[],cost_runs:[],created_at:AT,updated_at:AT,...o});
export const imported=(o={})=>({id:'p2',no:'IM-2026-1008-1',kind:'수입',vendor_id:'v2',date:'2026-10-08',status:'작성중',currency:'USD',fx:{booking_rate:1380,customs_rate:1380},
 lines:[{id:'a',item_id:'ap',qty:500,unit_price:3.2},{id:'b',item_id:'ch',qty:300,unit_price:1.5}],
 costs:[['운임',248400],['보험',12000],['관세',247150],['통관수수료',55000],['국내운송',88000]].map(([type,amount_krw],i)=>({id:'c'+i,type,amount_krw,alloc:'금액',...(i===0?{payee_id:'f1'}:{})})),
 import_vat:{amount:333650},receipts:[],cost_runs:[],created_at:AT,updated_at:AT,...o});
export const doc=rows=>({...emptyPurchases(),rows});

export function fakeDropbox(seed){
 const files=new Map();let n=0;
 const put=(path,value)=>{const f=files.get(path.toLowerCase());files.set(path.toLowerCase(),{path,id:f?.id||'id:'+(++n),rev:'r'+(++n),body:JSON.stringify(value)});};
 for(const k of keys)put(`/NARO Biz/Data/${k}.json`,seed[k]);
 const meta=f=>({'.tag':'file',id:f.id,rev:f.rev,path_lower:f.path.toLowerCase(),path_display:f.path});
 const nf=()=>Response.json({error:{'.tag':'path',path:{'.tag':'not_found'}}},{status:409});
 let breakNext=null;const writes=[];
 const fetcher=async(url,o)=>{
  const arg=JSON.parse(o.headers['Dropbox-API-Arg']||o.body),p=String(arg.path||'').toLowerCase(),f=files.get(p);
  if(url.endsWith('get_metadata')){if(arg.path==='/NARO Biz')return Response.json({'.tag':'folder'});return f?Response.json(meta(f)):nf();}
  if(url.endsWith('list_folder'))return Response.json({entries:[...files.values()].map(meta),has_more:false});
  if(url.endsWith('download'))return f?new Response(f.body):nf();
  if(url.endsWith('upload')){
   const mode=arg.mode?.['.tag']||arg.mode;writes.push(arg.path);
   if(mode==='add'&&f)return Response.json({error:{'.tag':'path',reason:{'.tag':'conflict'}}},{status:409});
   if(mode==='update'&&(!f||f.rev!==arg.mode.update))return Response.json({error:{'.tag':'path',reason:{'.tag':'conflict'}}},{status:409});
   put(arg.path,JSON.parse(o.body));
   if(breakNext&&breakNext(arg.path)){breakNext=null;throw Error('synthetic response loss');}
   return Response.json(meta(files.get(p)));
  }
  throw Error('unexpected '+url);
 };
 return {files,fetcher,writes,loseNextResponse:fn=>{breakNext=fn;}};
}
export async function open(fake,{drive=false}={}){
 const backend=createDropboxBackend({oauth:{authorize:async()=>({accessToken:'t',expiresAt:Date.now()+3600e3}),close(){}},businessWrite:true,fetcher:fake.fetcher,locks:{request:async(_n,_o,fn)=>fn({})}});
 // 가짜 Drive: 매입 함수가 없는 backend(실제 Google backend와 같음) + Drive식 목록(루트 표시 없이 7개 경로)
 const b=drive?Object.fromEntries(Object.entries(backend).filter(([k])=>!['purchasesIdentity','loadPurchases','createPurchases'].includes(k))):backend;
 if(drive){const list=backend.list;b.list=async()=>(await list()).filter(p=>p!=='NARO Biz/');}
 const provider=drive?new GoogleDriveProvider(b):new DropboxProvider(b);await provider.connect();
 const repo=createStorageRepository(provider,{businessWrite:true,extendedWrite:true});await repo.loadAll();return {repo,backend};
}
export const snap7=fake=>keys.map(k=>fake.files.get(`/naro biz/data/${k}.json`).body);

