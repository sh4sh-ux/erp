const params=new URL(location.href).searchParams;
history.replaceState(null,'',location.pathname);
const status=document.getElementById('status');
if(!['http://localhost:4219','https://naro-biz.web.app'].includes(location.origin)||!window.opener||!params.get('state')){
 status.textContent='연결 창이 만료되었습니다. NARO 화면에서 다시 연결해 주세요.';
}else{
 window.opener.postMessage({type:'NARO_DROPBOX_CALLBACK',state:params.get('state'),code:params.get('code'),error:params.has('error')},location.origin);
 status.textContent='NARO에서 연결 결과를 확인해 주세요.';
}
// No credentials in DOM, console, persistent storage or URL after initialization.
