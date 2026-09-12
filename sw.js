/* ERP service worker — v1.143 Dutch Pay panel typography */
const CACHE = "erp-shell-v51-v143";
const SHELL = ["./","./index.html","./v142-dutch-pay.css?v=1431","./manifest.webmanifest","./favicon.png","./assets/business-card-gownii.png","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  const isHtml=req.mode==="navigate"||(req.headers.get("accept")||"").includes("text/html");
  if(isHtml){e.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy)).catch(()=>{});return res;}).catch(()=>caches.match("./index.html").then(r=>r||caches.match("./"))));return;}
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});return res;})));
});
