const $=s=>document.querySelector(s);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function paint(s){
 $('#state').textContent=s.offline?'끊김':'연결됨';$('#state').className=s.offline?'off':'';
 $('#pc').textContent=s.purchases==null?'(매입 파일 아직 없음)':`(매입 ${s.purchases}건)`;
 $('#files').innerHTML=s.files.map(f=>`<tr><td>${esc(f.path)}</td><td class="n">${f.size.toLocaleString('ko-KR')}자</td></tr>`).join('');
 $('#ev').innerHTML=s.events.map(e=>`<li>${esc(e)}</li>`).join('');
}
async function load(){try{paint(await (await fetch('/__fake/status')).json());}catch{}}
document.querySelectorAll('[data-do]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{paint(await (await fetch('/__fake/do/'+b.dataset.do,{method:'POST'})).json());}finally{b.disabled=false;}});
load();setInterval(load,1500);
