import('./app.mjs').catch(()=>{
 document.getElementById('view').replaceChildren();
 document.getElementById('notice').textContent='로그인 화면을 준비하지 못했습니다. 잠시 후 새로고침해 주세요.';
 document.getElementById('notice').setAttribute('role','alert');
});
