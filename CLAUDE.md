# ERP — 거래처 관리 업무 앱

## 프로젝트 개요
단일 HTML 파일로 동작하는 소규모 사업자용 ERP. dutch-pay·receipt-db의 자매 앱으로
디자인 톤·코드 스타일을 맞춤. 거래처·품목·재고·견적서·수금/지급을 한 곳에서 관리하고,
견적서를 인쇄·이미지·공유로 고객에게 전달하는 것이 핵심 용도.

- 사용자: 한국어 사용자, 비개발자, 혼자 사용 (디에디트 / THE EDIT)
- 데이터는 **사용자 본인 Dropbox에만** 저장 — 별도 서버 없음
- 외부 의존성 없음 — 순수 HTML + CSS + Vanilla JS, 인라인 SVG
- 데스크탑·모바일 양쪽에서 사용 (모바일 비중 높음 — iOS Safari·카카오톡 인앱 브라우저)

## 라이브 URL / 저장소
- **라이브:** https://sh4sh-ux.github.io/erp/
- **GitHub:** https://github.com/sh4sh-ux/erp
- **배포 브랜치:** `main` (GitHub Pages가 main에서 자동 배포, 반영까지 1~2분)

## 파일 구조
```
index.html            — 앱 전체 (HTML/CSS/JS 통합, 약 2,480줄)
sw.js                 — 서비스워커 (오프라인 지원)
manifest.webmanifest  — PWA 매니페스트 (아이콘·테마색)
favicon.png           — 브라우저 탭 아이콘 64px
icons/icon-180.png    — iOS 홈 화면 (apple-touch-icon)
icons/icon-192.png    — 매니페스트 아이콘
icons/icon-512.png    — 매니페스트 아이콘
CLAUDE.md             — 이 파일 (세션 컨텍스트용)
ROADMAP.md            — 이카운트 ERP 대비 분석 · 개선 우선순위 (추가/유지/삭제 판단 근거)
```

## 버전 관리
- 단일 상수 `APP_VERSION` (JS 상단, `DROPBOX_APP_KEY` 바로 아래)이 진실의 원천.
  `init()`에서 상단바 `#tbVer`에 주입 — DOM에 버전을 하드코딩하지 말 것
- 형식: `v메이저.패치` (예: `v1.9` → `v1.10` → `v1.11`)
- **변경 시마다** `APP_VERSION` + 아래 changelog 한 줄 + 커밋 메시지(`vX.Y: 요약`)를 함께 갱신
- 사용자가 라이브에서 버전 칩으로 배포 반영 여부를 확인하므로 버전 누락 금지

## 데이터 저장 (Dropbox)
- OAuth: Authorization Code + PKCE (`client_secret` 불필요, 서버 없음)
- App key는 `DROPBOX_APP_KEY_DEFAULT`(`uy4mukymihfjf1o`, 접근 유형 **App folder**)가 기본값이고,
  로그인 화면에서 새 키를 넣으면 localStorage `dbx_app_key`가 우선한다 (`appKey()`).
  **`/07_Apps/`에 저장하려면 Full Dropbox 권한의 앱을 새로 만들어 그 키를 넣어야 한다** —
  Dropbox는 앱 생성 후 접근 유형을 바꿀 수 없다.
- 토큰은 localStorage(`dbx_access`/`dbx_refresh`/`dbx_exp`/`dbx_verifier`)에 보관.
  access_token 만료 60초 전 `refreshToken()`으로 자동 갱신
- 저장 경로: `DATA_DIR = "/07_Apps/거래처관리(ERP)"` 아래 테이블별 JSON 파일 (v1.47~)
  ```
  /07_Apps/거래처관리(ERP)/companies.json  items.json    quotes.json
                            payments.json   stock_moves.json  settings.json
  ```
  읽기는 `readTable()`이 새 위치 → 옛 위치(`DATA_DIR_LEGACY = "/erp"`) 순으로 시도한다.
  폴더를 아직 안 옮겼거나 옛 App key로 접속해도 데이터가 보이게 하기 위한 폴백이고, **쓰기는 항상 새 위치**로 간다.
  한글 폴더명이라 `Dropbox-API-Arg` 헤더는 반드시 `dbxArg()`로 ASCII 이스케이프할 것 (헤더는 ASCII만 허용).
- `Table.load/loadObj/save` → `db` 전역 객체가 메모리 캐시.
  **저장 버튼 없음 = 의도적 설계** — 변경 시 해당 테이블만 `saveTable(name, data)`로 즉시 업로드
- `loadAll()`은 6개 테이블을 `Promise.all`로 병렬 로드 (상단바 새로고침 버튼)

## 데이터 모델
```js
db = { companies:[], items:[], quotes:[], payments:[], stock_moves:[], settings:{} }

Company {
  id, name, biz_no, type:"매출"|"매입", contact, phone, email, address,
  memo,          // 내부 메모 (출력물에 안 나감)
  quote_memo     // 견적서 기본 비고 — 이 거래처 선택 시 견적 비고에 자동 입력 (v1.26)
}

Item {
  id, code, name, type:"단품"|"세트", spec, unit:"EA",   // code = 품목코드 (선택, 중복 불가)
  buy_price, sell_price,
  colors:["BK","WH"],                              // 색상 옵션 (별개 축)
  spec,                                            // 고정 규격 — variants가 있으면 쓰이지 않음
  variants:[{spec, buy_price, sell_price}],        // 사이즈 옵션 (단가가 다를 수 있는 축)
  components:[{item_id, color, spec, qty}],        // 세트 구성품 (type==="세트")
  memo
}

Quote {
  id, no:"Q-20260702-1",     // nextQuoteNo(date) — Q-YYYYMMDD-N 자동 채번
  date, company_id,
  status:"작성중"|"발송"|"수주"|"납품"|"취소",
  sent_at,        // 발송일 — '발송'으로 처음 바뀐 날
  delivered_at,   // 납품일 — 비어 있으면 미납품. **매출·미수금의 기준** (v1.37)
  tax_at,         // 세금계산서 발행일 — 비어 있으면 미발행 (v1.41)
  valid:"견적일로부터 1주일",
  lines:[{item_id, name, color, spec, unit, qty, price}],
  memo
}
// 견적번호는 nextQuoteNo()가 그날 최대 일련번호 +1로 채번 (개수 기반 아님 — 삭제해도 안 겹침)
// item_id === "__free__" → 품명 직접 입력 행 (품목 미등록 항목)

Payment {
  id, date, company_id, kind:"수금"|"지급", method, amount, memo, created_at,
  quote_id   // 수금을 특정 견적 건에 연결 (선택). 없으면 거래처 단위 상계만 됨 (v1.42)
}
StockMove {
  id, date, item_id, color, spec, kind:"입고"|"출고", qty, memo, created_at,
  quote_id   // 이 기록을 만든 견적 id (수동 입출고는 null) — 재고 정합의 핵심 (v1.27)
}
Settings  { name, ceo, biz_no, phone, email, bank, address }   // 견적서 공급자 란
```

## 화면 구조
탭(사이드바) 9개 — `switchView(v)` → `renderers[v]()` 호출, `.view` 섹션 토글

| 뷰 | 렌더러 | 역할 |
|----|--------|------|
| companies | `renderCoList` / `renderCoDetail` | 거래처 (목록 + 상세 폼) |
| items | `renderItList` / `renderItDetail` | 품목 (색상·사이즈 옵션·세트 구성) |
| stock | `renderStock` | 재고 현황 + 입출고 기록 |
| quotes | `renderQtList` / `renderQtDetail` | 견적서 작성·인쇄·이미지·공유 |
| payments | `renderPay` | 수금/지급 (월별) |
| dash | `renderDash` | 대시보드 (매출·마진·수금·지급·미수금·회신대기 + 월별 매출·수금 차트) |
| sales | `renderSales` | 매출 집계 (기간·거래처별 품목 집계 + CSV) |
| ar | `renderAr` | 미수금 — 거래처별 / 건별 두 가지 보기 (`#arView`) |
| settings | `renderSettings` | 공급자 정보 + 전체 데이터 백업/복원 |

- 거래처·품목·견적서는 좌(목록)·우(상세) 2단 `.cols` 그리드.
  모바일에서는 1열로 접히므로 목록 항목 선택 시 `scrollToDetail(formId)`로 상세까지 자동 스크롤
- 견적 저장 시 `syncStockForQuote(q)`가 재고를 목표 상태로 맞춘다 (아래 "재고 정합 설계" 참조)

## 견적서 출력 — 3가지 경로 × 2가지 양식
같은 견적서를 세 경로로 내보내고, 각 경로는 **견적서 / 거래명세서** 두 양식을 지원.
`DOC_TYPES`가 양식별 차이(제목·eyebrow·번호/일자 라벨·금액 라벨·유효기간 표시·푸터 문구)를
한곳에 모아두고, 세 경로가 모두 `docOf(docType)`으로 같은 값을 읽는다.
견적서 폼의 `#fq_doc` 선택값은 `qtDocType`(렌더 간 유지)에 보관되며 인쇄·이미지·공유가 공유한다.
**레이아웃이 서로 어긋나지 않게 함께 확인할 것**

1. **인쇄(PDF)** — `printQuote(q, docType)` → `#printArea`에 HTML 주입 후 `window.print()`
2. **미리보기(모바일)** — `openPrintPreview(q, docType)`. 모바일(≤820px)에서는 `window.print()`가
   막힌 인앱 브라우저가 많아 화면 내 오버레이를 먼저 띄움. 툴바: 닫기·이미지·공유·인쇄·PDF
3. **이미지(PNG)** — `drawQuoteCanvas(q, docType)`가 Canvas에 2배 해상도로 직접 그림.
   `saveQuoteImage(q, docType)`=파일 저장, `shareQuote(q, docType)`=공유

### 인쇄 CSS 핵심 (`@media print`)
- `@page{margin:16mm 14mm}`, `.p-wrap{min-height:250mm}` — 기타·안내문을 하단 고정(`.p-bottom{margin-top:auto}`)
  하면서 **A4 한 장을 넘지 않는** 값. 이 높이를 올리면 2페이지로 쪼개짐 (v1.12에서 263mm→250mm)
- `.pv-scale .p-wrap{padding:0!important; width:688px!important}` —
  미리보기용 여백을 인쇄에서 제거하고, 폭을 데스크탑 인쇄 폭(A4 182mm≈688px)으로 고정.
  이게 없으면 iOS Safari가 모바일 화면 폭(390px) 기준으로 렌더해 글자가 확대됨 (v1.13)
- `<meta name="format-detection" content="telephone=no">` +
  `#printArea a{color:inherit;text-decoration:none}` — iOS가 전화번호·계좌번호를 링크로
  바꿔 밑줄이 생기는 것 차단

### 캔버스 이미지 (`drawQuoteCanvas`)
- A4 96dpi 기준 `PW=794`, `MX=53`, `CW=688`, 2배 스케일(`SC=2`)
- 컬럼: 품명(가변 202) | 색상 46 | 규격 112 | 수량 58 | 단가 88 | 공급가액 100 | 세액 82 — 인쇄 `colgroup`과 동일.
  **폭은 실측 기준**("WH" 22px, "5000X900mm" 89px, 품명 최장 143px) — 줄이면 줄바꿈이 생긴다
- 열별 정렬은 `ALIGN` 배열 한곳에서 정의하고 `cell()` 헬퍼로 그린다.
  인쇄 표의 `.ctr`/`.num` 클래스와 **같은 규칙을 유지할 것** (품명·색상 왼쪽 / 규격·수량 가운데 / 금액 오른쪽)
- **측정 패스 → 드로잉 패스** 2단 구조. 품명·주소·메모를 `qimgWrap()`으로 줄바꿈 측정한 뒤
  전체 높이를 계산하고, 하단 블록(합계·기타·푸터)은 페이지 하단에 고정 배치
- 품목이 많으면 이미지 높이가 1123px(A4)에서 자동으로 늘어남

### 공유 (`shareQuote`)
환경별 자동 fallback — 3단계
1. `navigator.canShare({files})` → 공유 시트 (iOS·안드로이드·macOS Safari·Windows Chrome).
   **`navigator.share()`에는 `files`만 넘긴다** — `text`/`title`을 함께 넘기면 카카오톡 등에서
   이미지와 별개로 텍스트 메시지가 하나 더 전송되므로 의도적으로 제외 (v1.25)
2. `navigator.clipboard.write(ClipboardItem)` → 클립보드 복사 (그 외 데스크탑, 붙여넣기로 전송)
3. `downloadBlob()` → PNG 파일 저장

## 모바일 대응
- 분기: **≤820px** (사이드바 드로어 전환), ≤980px (2단→1단 그리드), ≤560px (grid2/grid3→1열)
- 사이드바는 `position:fixed` + `transform:translateX(-105%)` 드로어.
  상단 햄버거(`#menuBtn`) → `toggleNav()`, 백드롭(`#navBackdrop`) 클릭 시 닫힘.
  `switchView()`가 항상 `toggleNav(false)` + `scrollTo(0,0)` 실행
- **모바일 CSS는 컴포넌트 규칙보다 뒤(인쇄 CSS 직전)에 위치** — 앞에 두면 나중에 오는
  `.qline`·`.stock-add` 등에 덮여서 무효가 됨 (v1.10에서 실제로 겪은 문제)
- 넓은 표는 `overflow-x:auto` + `min-width`로 가로 스크롤:
  `.qline` 560px, `.cline` 440px, `.vline` 400px, `#slBody .tbl` 860px
- iOS 입력 확대 방지: viewport에 `maximum-scale=1.0, user-scalable=no`

## 디자인 원칙 (dutch-pay·receipt-db와 통일)
- 배경 `--paper:#F2F4F7`, 카드 `#FFFFFF`, 선 `--line:#E5E9EF`
- 강조 `--primary:#0A84FF`, 위험 `--danger:#FF3B30`, 성공 `--ok:#34C759`, 경고 `--warn-c:#FF9F0A`
- 모서리 `--r:16px / --r-sm:10px`, 폰트는 시스템 스택 (외부 폰트·CDN 없음 — 오프라인 동작)
- 아이콘은 인라인 SVG(lucide 계열)만. 앱 아이콘도 같은 육각형 로고 + `#0A84FF` 배경
- 숫자는 `font-variant-numeric:tabular-nums` + `fmt()`/`won()`로 천단위 쉼표

## 백업 / 오프라인
- **백업 JSON** — `exportBackup()`이 `{app:"erp", appVersion, format:1, exportedAt, settings, ...5개 테이블}`
  형태로 저장. `importBackup()`은 `app!=="erp"`이거나 테이블이 배열이 아니면 **아무것도 반영하지 않고 중단**
  (부분 복원으로 데이터가 섞이는 것 방지) → 확인 후 전체 덮어쓰기 + Dropbox 재업로드
- **서비스워커(`sw.js`)** — 앱 껍데기만 캐시(`erp-shell-v1`). 데이터는 Dropbox API라 캐시하지 않음
  - HTML은 **network-first**: 새 배포를 즉시 받고, 오프라인일 때만 캐시 사본을 씀.
    사용자가 버전 칩으로 배포를 확인하는 습관과 충돌하지 않도록 한 의도적 선택 —
    cache-first로 바꾸면 배포해도 옛 버전이 계속 보인다
  - 아이콘·매니페스트는 cache-first. **파일을 바꾸면 `CACHE` 상수(`erp-shell-v1`)를 올릴 것**
  - `manifest.webmanifest`의 `display`는 `browser` 유지 — standalone으로 바꾸면 iOS에서
    Safari 인쇄 경로가 막혀 견적서 인쇄가 어려워진다

## 재고 정합 설계 (v1.27~) — 건드리기 전에 반드시 읽을 것
견적과 재고는 **"목표 상태로 맞추는(reconcile)" 방식**으로 연결돼 있다. 차감을 쌓는 방식이 아니다.

- `quoteStockNeeds(q)` — 이 견적이 재고에서 빼야 할 목표 수량 (수주면 견적 수량, 그 외엔 0.
  세트는 구성품으로 분해)
- `quoteStockDone(q.id)` — `stock_moves.quote_id`로 추적한, 이미 반영된 수량
- `stockDeltaForQuote(q)` — 목표 − 현재 = 기록할 입출고. 차이가 0이면 아무것도 안 만든다
- `syncStockForQuote(q)` — 위 차이를 확인받고 반영. **멱등** — 여러 번 실행해도 결과가 같다

이 구조 덕분에 수주↔취소 반복, 수량 증감, 재저장, 견적 삭제가 모두 자동으로 맞는다.
**차감 로직을 다시 "상태가 바뀔 때만 빼기"로 되돌리지 말 것** — v1.26 이전에 그렇게 돼 있어서
이중 차감·미복구 버그가 있었다 (v1.27에서 수정).

- `stock_moves.quote_id`: 견적이 만든 기록이면 견적 id, 수동 입출고면 `null`
- `migrateStockQuoteLinks()` — v1.26 이전 기록에는 `quote_id`가 없어서 메모의 견적번호로
  역추적해 채운다. `loadAll()`에서 실행. **이게 없으면 기존 수주 건 재저장 시 이중 차감된다**

## 매출·미수금 기준 (v1.37~) — 중요
**매출과 미수금은 "수주"가 아니라 "납품"이 기준이다.** `delivered_at`이 있으면 납품된 것으로 본다
(`isDelivered(q)`). 수주만 하고 아직 납품 전인 건은 청구할 수 없으므로 미수금이 아니라
**미납품 잔액**으로 따로 표시한다.

- 미수금 = Σ(납품액) − Σ(수금)  ·  미납품 = Σ(수주액) − Σ(납품액)
- 대시보드 이달 매출도 `delivered_at` 기준 (`monthSales`)
- 재고는 `QT_COMMITTED=["수주","납품"]` — 수주하면 제작에 들어가므로 납품까지 계속 나가 있다
- 상태를 '납품'으로 바꾸거나 납품일을 넣으면 서로 자동으로 맞춰진다

### 스키마 마이그레이션 (`runMigrations`, `settings.schema`)
`SCHEMA=3`. **반드시 버전을 기록하고 1회만 실행해야 한다** — 매번 돌면 새 수주 건까지
납품 처리돼 버린다. v3는 기존 '수주' 건에 `delivered_at=q.date`를 채워
기준 변경 전후로 미수금 수치가 달라지지 않게 한다.

## 숫자 입력 규칙 (v1.38~)
- 수량·단가 입력은 `type="text" inputmode="numeric"`. **`type="number"`를 쓰지 말 것** —
  스피너가 자리를 예약해 가운데·오른쪽 정렬을 밀어낸다 (v1.38에서 겪은 문제)
- 입력칸에도 천단위 쉼표를 표시한다. 포커스 시 쉼표를 걷고 `select()`,
  블러 시 다시 쉼표. 값 읽기는 항상 `parseNum()`
- `select()`는 **동기로 호출**할 것 — `setTimeout`으로 미루면 비동기 포커스가
  Tab 이동을 삼킨다 (사이즈 패널에서 실제로 발생)
- 헤더 라벨을 오른쪽 정렬할 땐 입력칸의 테두리+여백(10px)만큼 `padding-right`를 줘야
  숫자와 줄이 맞는다

## 규격 / 색상 / 사이즈의 관계 (v1.43~)
견적 행은 `color`와 `spec` 두 축만 가진다.
- **색상**(`Item.colors` → `line.color`) — 완전히 별개 축. 출력물에서도 별도 열
- **규격**(`line.spec`) — 사이즈 옵션이 있으면 **선택한 사이즈**(L·2XL·30inch)가,
  없으면 **품목의 고정 규격**(`Item.spec`, 예: 80X40cm)이 들어간다
- 즉 **사이즈와 규격은 같은 필드를 공유**한다. 한 품목이 둘을 동시에 가질 수 없어
  "타월 110g"처럼 규격 일부를 품명에 넣는 우회가 쓰이고 있다.
  둘 다 필요해지면 `line.size`를 새로 만들고 출력 열을 하나 더 늘려야 한다 (아직 미구현)

## BOM(소요량) — 세트 전개 규칙 (v1.46~)
`세트` 품목이 곧 BOM이다. `expandBom(item_id,color,spec,qty,out,path)`이 **원자재까지 재귀로**
펼친다 — 세트 안에 세트가 들어가도 끝까지 내려가고, 순환 참조(A⊃B, B⊃A)는 `path`로 차단한다.

- `bomOfSet(i)` — 세트 1개당 소요 자재 맵
- `setCompSums(i)` — 전개된 자재의 매입·매출 합 (중첩 세트 가격도 정확)
- `quoteStockNeeds(q)` — 견적 소요량. **세트를 여기서 직접 펼치지 말고 `expandBom`을 쓸 것**
- `quoteShortage(q)` — 소요량 대비 부족 자재. 이 견적이 이미 뺀 양(`quoteStockDone`)을
  되돌려 계산하므로 수주 후에도 중복으로 잡히지 않는다
- **`quoteStockDone(qid)`는 `qid`가 없으면 빈 값을 반환해야 한다** — 저장 전 견적(id=null)에서
  수동 입출고(`quote_id=null`)까지 매칭되어 보유 재고가 0으로 보이던 버그가 있었다 (v1.46)

**생산입고(제조 후 완제품 입고)는 일부러 넣지 않았다** — 무지 제품을 사서 자수만 하는 업태라
완제품 재고를 따로 잡을 일이 없다. 필요해지면 `stock_moves`에 `kind:"생산"`을 더하는 방식이 맞다.

## 마진 계산 규칙 (v1.29~)
`itemBuy(i,spec)`가 매입단가를 찾고(옵션별 단가 우선 → 기본 단가 → 세트는 구성품 합계),
`quoteMargin(q)`가 견적 마진을 낸다.
**매입단가를 모르는 항목은 0원으로 치지 말고 계산에서 제외하고 몇 건인지 표시할 것** —
0으로 처리하면 마진이 실제보다 부풀려진다. 견적 마진은 화면에만 표시하고
**인쇄·이미지 출력물에는 절대 넣지 않는다** (고객에게 나가는 문서다).

## 남은 결함 (2단계에서 처리)
- **미수금이 "수주 = 매출" 기준** — 아직 납품 안 한 건도 미수금으로 잡혀 부풀려진다.
  납품(출고) 문서를 분리해야 정확해짐. `ROADMAP.md` 2단계 참조

## 알려진 함정 (작업 시 주의)
- **인쇄·미리보기·캔버스 3중 레이아웃** — 하나만 고치면 나머지가 어긋남. 견적서 출력을
  건드릴 때는 셋 다 확인 (PDF 페이지 수, 모바일 미리보기, PNG)
- **표 열 폭 고정 시 min-width 확인** — `table-layout:fixed` + `colgroup`으로 열을 고정하면
  모바일 `min-width`가 고정 열 합계보다 충분히 커야 함. v1.17에서 min-width 660px이
  고정 열 합 640px과 거의 같아 품명 열이 20px로 짜부라져 글자가 겹쳤음
- **여러 테이블의 열 정렬** — 매출 집계처럼 카드가 반복되는 화면은 열 폭을 명시하지 않으면
  브라우저가 카드마다 따로 계산해 열 위치가 제각각이 됨 (v1.15)
- `escapeHtml`/`escapeAttr`을 거치지 않은 사용자 입력을 innerHTML에 넣지 말 것
- 렌더 함수는 innerHTML로 전체를 다시 그리므로, 이벤트는 **매 렌더마다 재바인딩** 필요
  (`bindQtLines`, `renderCoDetail` 하단 `onclick` 할당 패턴)
- `qtEditing`/`itEditing`은 편집 중 사본. 새로 만들기(`__new__`) 시 반드시 초기화
  (v1.8에서 이전 편집 내용이 남는 버그)

## 검증 방법
로컬에 Playwright(`playwright-core` + `/opt/pw-browsers/chromium`)로 스크린샷·PDF를 뽑아 확인.
Dropbox 로그인은 우회하고 `db`에 직접 샘플 데이터를 주입:
```js
document.getElementById('loginView').classList.add('hidden');
document.getElementById('appView').classList.remove('hidden');
db.companies.push({id:'c1', name:'메디랩코리아(주)', type:'매출'});
db.quotes.push({ /* ... */ });
switchView('quotes');
```
- 인쇄 검증은 `page.pdf({format:'A4'})` → 페이지 수 확인 (`/Type /Page` 카운트)
- 모바일은 `viewport:{width:390,height:844}, isMobile:true, hasTouch:true`

## Git 작업 방법
```bash
git add index.html          # 변경된 파일만 명시적으로 추가 (git add -A 금지)
git commit -m "vX.Y: 요약"
git push -u origin main     # 라이브 반영 — 사용자 승인 후에만
```
- 개발은 작업 브랜치에서, **main 병합·푸시는 사용자가 "병합해줘"라고 할 때만** 실행
- GitHub Pages는 main에서 배포 — 병합 전에는 라이브에 반영되지 않음

## Changelog
- `v1.52` — 견적서의 **저장하지 않은 변경사항 경고**, 상태·시작일·종료일 필터와 초기화,
  상단 Dropbox 저장·동기화 상태(진행·완료 시각·실패)를 추가. 필터 결과는 CSV에도 동일하게 적용.
- `v1.51` — **견적서 복사** 추가. 기존 견적의 거래처·품목·수량·단가·비고를 새 작성 화면으로
  가져오되 견적일은 오늘, 상태는 작성중으로 초기화하고 납품일·세금계산서 발행일은 비운다.
  복사 직후에는 저장하지 않으며 등록할 때 새 견적번호를 발급한다.
- `v1.47` — Dropbox 저장 위치를 `/07_Apps/거래처관리(ERP)/`로 이동(앱 전체 폴더 통합).
  App key를 로그인 화면에서 입력받도록 변경(Full Dropbox 앱으로 교체하기 위함) + 옛 `/erp` 읽기 폴백.
- `v1.0` — 거래처 관리 ERP 초기 배포
- `v1.1` — 품목·견적서(인쇄)·수금/지급·대시보드·공급자 정보 구현
- `v1.2` — 견적서 인쇄 양식을 실사용 양식(디에디트)으로 교체 — 유효기간·계좌번호 필드 추가
- `v1.3` — 견적서 그레이 디자인(레이아웃 고정) + 품목 사이즈 옵션·세트 구성
- `v1.4` — 품목 색상(BK/WH) + 재고 관리 + 수주 시 자동 출고
- `v1.5` — 견적서 합계 행 열 정렬(라벨·총액 제거) + 대시보드 버전 표시
- `v1.6` — 매출 집계: 기간·거래처별 품목 집계 + CSV 내보내기 (세금계산서 준비용)
- `v1.7` — 견적서 기타란에 주문 제작 안내 문구 빨간색 고정 표시
- `v1.8` — 품목 + 버튼 클릭 시 이전 편집 내용이 남는 버그 수정 (빈 폼으로 초기화)
- `v1.9` — 버전 표시를 상단 ERP 로고 옆으로 이동 + 로고 클릭 시 새로고침
- `v1.10` — **모바일 대응**: 햄버거 드로어 내비게이션(≤820px에서 사이드바가 숨겨져 화면
  이동 자체가 불가능했음) + 목록 선택 시 상세 자동 스크롤 + 재고·매출 집계 모바일 레이아웃 정리
- `v1.11` — 모바일 견적서 인쇄 미리보기 오버레이 (인앱 브라우저에서 `window.print()` 무반응 대응)
- `v1.12` — 견적서 인쇄 2페이지 분리 수정 (미리보기 여백이 인쇄에 적용돼 A4를 넘김)
- `v1.13` — 모바일 인쇄 레이아웃을 데스크탑과 동일하게 (인쇄 폭 688px 고정, iOS 링크 밑줄 차단)
- `v1.14` — **견적서 이미지(PNG) 내보내기** — 인쇄 양식과 동일한 레이아웃을 Canvas에 2배 해상도로 그림
- `v1.15` — 매출 집계 테이블 열 정렬 통일 (`table-layout:fixed` + `colgroup`)
- `v1.16` — 매출 집계 소계 행 굵은 글씨로 시안성 개선
- `v1.17` — 모바일 매출 집계 겹침 수정 (테이블 min-width 860px, 카드 상단 요약 줄바꿈)
- `v1.18` — 홈 화면 앱 아이콘 추가 (apple-touch-icon·manifest·favicon, 상단바 로고와 동일 디자인)
- `v1.19` — **견적서 공유 기능** — 공유 시트 → 클립보드 복사 → 파일 저장 3단 fallback.
  '이미지' 버튼은 항상 파일 저장으로 역할 분리
- `v1.20` — 견적서 목록 CSV 내보내기 (검색 결과 그대로, 견적 1건당 1행).
  `filteredQuotes()`로 목록 화면과 CSV가 같은 필터를 공유
- `v1.21` — 전체 데이터 JSON 백업·복원 (설정 탭). 형식 검증 후 전체 덮어쓰기
- `v1.22` — **거래처별 미수금** 뷰 추가 — 수주 견적 합계 − 수금 합계, CSV 내보내기 포함.
  카드 총액은 전체 기준, 표 하단은 표시된 행 기준이라 라벨을 '합계/표시 합계'로 구분
- `v1.23` — **거래명세서 양식** — `DOC_TYPES`로 견적서/거래명세서 전환.
  인쇄·이미지·공유 3경로 모두 선택된 양식으로 출력
- `v1.24` — **PWA 오프라인 지원** — 서비스워커 추가.
  HTML network-first(배포 즉시 반영) + 정적 자원 cache-first
- `v1.25` — 모바일 공유 시 이미지 파일만 전송 — `navigator.share()`의 `text`·`title` 제거
  (카톡에 요약 메시지가 함께 발송되던 것 삭제)
- `v1.46` — **BOM(소요량) 강화** — 세트를 원자재까지 **다단계 재귀 전개**(`expandBom`).
  중첩 세트의 가격·재고 차감이 통째로 누락되던 문제 수정(개업패키지 가격 10,000→80,000원).
  순환 참조 차단. 견적 폼에 **재고 부족 경고**(필요·보유·부족), 품목 상세에 1세트당 소요 자재 표시.
  `quoteStockDone(null)`이 수동 입출고를 잡아 보유량이 0으로 보이던 버그 수정
- `v1.45` — 날짜 칸 달력 자동 열기를 **빈 칸에만** 적용. v1.40이 모든 날짜 칸에서 클릭 시
  달력을 열어 **직접 타이핑이 막혀 있었다** (달력이 열리면 키 입력을 달력이 가져감).
  값이 있는 칸은 기본 동작 → 숫자로 직접 수정 가능, 달력은 오른쪽 아이콘으로.
  모바일(iOS)은 원래 탭하면 달력이 뜨므로 영향 없음
- `v1.44` — 출력물 **규격·수량 가운데 정렬** (사이즈·수량은 자릿수가 짧아 가운데가 읽기 쉬움).
  캔버스도 `ALIGN` 배열 + `cell()` 헬퍼로 정리해 인쇄 표와 규칙을 공유
- `v1.43` — 출력물의 **색상과 규격을 별도 열로 분리** (기존엔 "WH · L"로 한 칸에 합쳐 표시하면서
  헤더는 "규격"이라 무엇이 무엇인지 알기 어려웠음). 인쇄·캔버스 모두 7열로,
  열 폭은 실측 기준으로 재배분. 품목 폼에 규격·사이즈 관계 안내 추가
- `v1.42` — **ROADMAP 3단계 ③: 수금 ↔ 견적 연결** — `Payment.quote_id` 추가.
  수금 입력 시 그 거래처의 '납품했고 덜 받은' 견적을 골라 연결(고르면 잔액이 금액칸에 자동 입력),
  지급은 대응 문서가 없어 비활성. 미수금 화면에 **건별 보기** 추가 —
  견적마다 납품액·수금액·잔액·계산서 상태. 건에 연결되지 않은 수금은 하단에 따로 표시해
  숫자가 맞아떨어지게 함. 수금/지급 목록에도 연결 견적번호 표시.
  `#payAmt`·`#ivQty`도 text+쉼표로 통일 (number 타입이라 쉼표 값이 무효 처리되던 문제)
- `v1.41` — **ROADMAP 3단계 ②: 세금계산서 발행 체크** — `Quote.tax_at` 추가.
  견적 폼에 발행일 입력('오늘' 버튼), 납품했는데 미발행이면 목록에 '계산서 미발행' 배지.
  미수금 화면에 미발행 금액·건수 카드와 거래처별 컬럼, 대시보드에도 미발행 건수.
  `needsTax(q)` = 납품됨 && 미발행 (미납품 건은 대상 아님)
- `v1.40` — **날짜 칸 아무 데나 누르면 달력이 열린다** — `showPicker()`를 document에
  한 번만 위임 등록해서 date/month 입력 전체(견적일자·납품일·수금일·월·기간·재고일)에 적용.
  나중에 추가되는 날짜 칸에도 자동 적용된다 (receipt-db와 같은 방식)
- `v1.39` — 사이즈별 패널이 **견적에 이미 들어간 품목**을 기본으로 잡는다
  (여러 개면 품목 행 맨 위의 것, 색상도 그 행 기준). 없을 때만 전체 품목 중 첫 번째.
  다른 견적으로 옮기면 패널을 닫는다
- `v1.38` — 수량·단가 입력을 `type=text`로 바꿔 정렬 정확화(스피너 제거),
  **입력칸 천단위 쉼표**(포커스 시 해제·블러 시 복원), 단가 헤더를 숫자 위치에 맞춤,
  `select()` 동기 호출로 Tab 이동 누락 수정
- `v1.37` — **ROADMAP 3단계 ①: 납품일 도입** — `Quote.delivered_at` + '납품' 상태 추가.
  미수금을 **납품액 − 수금액**으로 정정하고 미납품 잔액을 분리 표시.
  대시보드 매출도 납품 기준. 기존 수주 건은 1회 마이그레이션으로 납품 처리해 수치 보존
- `v1.36` — 사이즈별 입력에서 **Tab이 단가를 건너뛰고 옆 사이즈 수량으로** 이동.
  패널을 열거나 품목·색상을 바꾸면 첫 사이즈 수량에 자동 포커스, 포커스 시 기존 값 전체 선택.
  마지막 사이즈에서 Tab을 누르면 '품목에 넣기' 버튼으로. 단가는 클릭으로 계속 수정 가능
- `v1.35` — **품목코드 + 견적서 품목 검색** — `Item.code` 추가(이카운트 방식).
  견적 품목 선택을 `<select>` → **검색형 선택기**로 교체 (품명·코드 검색, ↑↓·Enter, 바깥 클릭 닫기).
  견적 행의 `name`에는 `itemLabel()`로 **"품명 [코드]"**를 넣어 기존 출력물 표기를 유지.
  품명 끝의 `[XXX]`를 코드로 분리해 주는 안내(기존 데이터 이전용) 포함
- `v1.34` — 견적 품목 행 열별 정렬 — 단가는 금액과 같이 오른쪽, 수량·규격/사이즈는 가운데
- `v1.33` — 견적 품목 행의 **규격/사이즈 칸 확대** (104px → 176px). 색상·사이즈 select 두 개가
  좁은 칸에 들어가 "WH"가 "W"로 잘리던 문제. 품목 칸이 과하게 넓어(1.4fr → 1fr) 남는 폭을 넘김.
  두 select만 글자 12.5px·좌우 여백 축소. 모바일 가로 스크롤 기준 560 → 620px
- `v1.32` — **사이즈별 한번에 입력** — 같은 품목의 여러 사이즈를 행 추가 없이 한 화면에서
  수량만 채워 넣는 패널(`renderSizePanel`/`applySizePanel`). 기존 행의 수량을 그대로 보여줘
  수정도 가능하고, 0/빈칸이면 해당 행을 제거. 품목·색상 단위로 동작
- `v1.31` — **대시보드 재구성** — 현금 입출금만 보이던 것을 매출(수주)·마진·수금·지급·미수금·
  회신대기까지 담은 사업 현황 화면으로. 월별 차트도 수금·지급 → **매출·수금**으로 변경
- `v1.30` — 견적 **총 수량** 표시 (사이즈별로 나눠 입력할 때 합계가 안 보이던 불편 해소) +
  견적 발송일(`Quote.sent_at`) 기록과 '발송 N일째' 배지 + 거래처 매출/매입 구분 필터 +
  수금/지급 화면에 거래처별 집계 카드
- `v1.29` — **품목 매입단가 살리기** — `itemBuy()` 추가, 품목 상세 1개당 마진,
  견적 예상 마진(내부용), 매출 집계 마진 컬럼·카드·CSV
- `v1.28` — 견적서·거래명세서 하단 라벨을 "기타" → **"비고"**로 통일
  (입력란은 비고인데 출력물만 기타여서 용어가 어긋나 있었음). 인쇄·캔버스 양쪽 변경.
  수금/지급의 결제수단 "기타"는 그대로 유지
- `v1.27` — **ROADMAP 1단계: 정합성 복구** — ① 재고를 reconcile 방식으로 재설계
  (수주↔취소 반복·수량 증감·재저장·삭제 모두 정확, `stock_moves.quote_id` 추가 +
  기존 데이터 마이그레이션) ② 견적번호를 최대값 기준 채번으로 (삭제 후 중복 해소)
  ③ 거래처 삭제 시 연결된 견적·수금 건수 경고
- `v1.26` — **거래처별 견적서 기본 비고** (`Company.quote_memo`) — 거래처 선택 시 견적 비고에
  자동 입력. `applyCoQuoteMemo()`가 **직접 입력한 내용은 덮어쓰지 않고**, 비었거나 직전 거래처의
  기본 문구 그대로일 때만 교체 (receipt-db의 `_catAutoFilled`와 같은 방식)

## 다음 작업 후보
- 미수금에 연령 분석(30/60/90일 경과) 추가
- 수금 입력 시 특정 견적서와 연결 (현재는 거래처 단위 상계)
- 품목별 매입·매출 마진 분석
- 견적서 상태 변경 이력 (작성중 → 발송 → 수주 타임스탬프)
- 다중 사용자 공유 (Dropbox 공유 폴더 가이드)
