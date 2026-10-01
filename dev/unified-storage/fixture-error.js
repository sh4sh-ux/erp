addEventListener('error',e=>{document.documentElement.dataset.localError=(e.filename||'').split('/').pop()+':'+e.lineno;});
