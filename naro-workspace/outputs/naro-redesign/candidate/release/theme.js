/* NARO theme before first paint (classic script: the page CSP allows 'self' scripts, not inline).
   Same 'naroTheme' preference as /erp/: light | dark | absent = system. */
(()=>{const m=matchMedia('(prefers-color-scheme: dark)'),a=()=>{let p=null;try{p=localStorage.getItem('naroTheme')}catch{}document.documentElement.dataset.theme=p==='light'||p==='dark'?p:(m.matches?'dark':'light')};a();m.addEventListener?.('change',a);addEventListener('storage',e=>{if(e.key==='naroTheme'||e.key===null)a()})})();
