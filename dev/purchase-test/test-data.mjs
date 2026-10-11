// 시험용 가짜 데이터(실제 거래처·고객 정보 아님). 서버를 켤 때마다, 또 시험 도구의 [처음부터]를 누를 때마다 이 상태로 돌아간다.
const day=n=>{const d=new Date();d.setDate(d.getDate()-n);const p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
export function testData(){
 const v=(spec,buy,sell)=>({spec,buy_price:buy,sell_price:sell});
 return {
  companies:[
   {id:'tc1',name:'(시험) 한빛식당',type:'매출',prices:[]},
   {id:'tc2',name:'(시험) 바른호텔',type:'매출',prices:[]},
   {id:'tv1',name:'(시험) 대한원단',type:'매입',prices:[]},
   {id:'tv2',name:'(시험) 세원봉제',type:'매입',prices:[]},
   {id:'tv3',name:'(시험) 한솔자수',type:'매입',prices:[]}],
  items:[
   {id:'ti1',code:'TJK-01',name:'(시험) 셰프복',type:'단품',unit:'EA',buy_price:4200,sell_price:9800,colors:['BK','WH'],variants:[v('S',4200,9800),v('M',4200,9800),v('L',4300,9800),v('XL',4500,10500)],components:[]},
   {id:'ti2',code:'TAP-01',name:'(시험) 앞치마',type:'단품',unit:'EA',buy_price:2100,sell_price:5500,colors:['BK','NV','BR'],variants:[v('FREE',2100,5500)],components:[]},
   {id:'ti3',code:'TCH-01',name:'(시험) 조리모',type:'단품',unit:'EA',buy_price:1500,sell_price:3900,colors:[],variants:[],components:[]}],
  quotes:[
   {id:'tq1',no:'Q-TEST-1',date:day(5),company_id:'tc1',status:'수주',lines:[
    {id:'tql1',item_id:'ti1',name:'(시험) 셰프복',color:'BK',spec:'M',unit:'EA',qty:10,price:9800},
    {id:'tql2',item_id:'ti2',name:'(시험) 앞치마',color:'NV',spec:'FREE',unit:'EA',qty:10,price:5500}],deliveries:[]}],
  payments:[{id:'tpay1',date:day(4),company_id:'tc1',kind:'수금',method:'계좌이체',amount:50000,memo:'(시험) 선금',quote_id:'tq1'}],
  stock_moves:[
   {id:'tsm1',date:day(20),item_id:'ti1',color:'BK',spec:'M',kind:'입고',qty:15,memo:'(시험) 기초 재고'},
   {id:'tsm2',date:day(20),item_id:'ti2',color:'NV',spec:'FREE',kind:'입고',qty:8,memo:'(시험) 기초 재고'},
   {id:'tsm3',date:day(20),item_id:'ti3',kind:'입고',qty:30,memo:'(시험) 기초 재고'}],
  material_moves:[],
  settings:{schema:3,name:'(시험) 나로 시험 상사'}
 };
}
