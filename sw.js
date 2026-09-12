/* ERP 서비스워커 — 오프라인 지원
   앱 껍데기(HTML·아이콘)만 캐시한다. 데이터는 Dropbox API라 캐시하지 않음.

   전략
   - HTML(내비게이션): network-first — 새 버전 배포를 즉시 받기 위함.
     오프라인일 때만 캐시된 사본을 돌려준다. (버전 칩으로 배포 확인하는 습관과 충돌 방지)
   - 아이콘·매니페스트: cache-first — 거의 바뀌지 않고 바뀌면 CACHE 이름을 올린다.
   - Dropbox API(api.dropboxapi.com 등): 서비스워커가 건드리지 않고 그대로 통과.
*/
const CACHE = "erp-shell-v41";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.png",
  "./assets/business-card-gownii.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // 일부 파일 실패해도 설치는 진행
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 같은 출처(GitHub Pages)만 처리 — Dropbox API 호출은 그대로 통과시킨다
  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    // network-first: 항상 최신 index.html을 먼저 시도
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // cache-first: 아이콘·매니페스트 등 정적 자원
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
