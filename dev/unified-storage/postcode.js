// Address search window: loads the Kakao(Daum) postcode widget here, sends the chosen address to the app window
// that opened it (same origin only), then closes. The app page itself never loads third-party script.
(()=>{
 const theme=new URLSearchParams(location.search).get('theme');if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;
 const box=document.getElementById('box'),msg=document.getElementById('msg');
 document.getElementById('close').onclick=()=>window.close();
 const fail=()=>{box.hidden=true;msg.hidden=false;};
 const send=data=>{
  const address=data.userSelectedType==='J'?(data.jibunAddress||data.address):(data.roadAddress||data.address);
  // Building name (e.g. 미사테스타타워) starts the detail line; the user only adds 동·층·호.
  const building=String(data.buildingName||'').trim();
  try{window.opener&&window.opener.postMessage({type:'NARO_POSTCODE',address,building,zonecode:data.zonecode||''},location.origin);}catch{}
  window.close();
 };
 const sources=['https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js','https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'];
 const load=i=>{
  if(i>=sources.length){fail();return;}
  const s=document.createElement('script');s.src=sources[i];
  s.onload=()=>{if(window.daum&&window.daum.Postcode){try{new window.daum.Postcode({oncomplete:send,width:'100%',height:'100%'}).embed(box);}catch{fail();}}else load(i+1);};
  s.onerror=()=>{s.remove();load(i+1);};
  document.head.append(s);
 };
 setTimeout(()=>{if(!box.children.length)fail();},15000);
 load(0);
})();
