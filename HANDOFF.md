# NARO Personal Cloud handoff

2026-10-04 대시보드 매출·입금 현황 기간 조회: 기간 버튼을 집계 탭 왼쪽(폰에서는 위)에 추가. 시작/종료일, 이번 달·지난달·최근 3개월, 조회·초기화·Esc 닫기. 조회 기간은 연간/월별/일별 전환에도 유지하며 시작/종료일 포함한 실제 날짜로 먼저 필터링(부분 월/연 과집계 방지). 이 그래프에만 적용, 핵심 현황/원본 기록은 그대로. 잘못된 날짜/역전/10년 이상은 명시적 오류. 긴 기간은 31구간씩 페이지·가로 스크롤로 표시하고 전 기간 공통 축 유지. 선택 조건은 메모리 내 UI 상태이며 네트워크/저장 호출 없음.

2026-10-04 품목 판매 분석 왼쪽 기준선 정리: 펼치기 문구·분석 제목·입력/본문을 카드 안쪽 24px(폰 16px) 기준으로 맞춤. 이전 카드 헤더의 이중 좌측 패딩 제거, 펼침 삼각형은 글자 왼쪽에 별도 배치. 데이터/집계/동작 변경 없음.

2026-10-04 최근 견적·견적 진행 카드 높이 통일: PC 2열에서 grid stretch, 공통 64px 제목 영역, flex 행으로 위/아래 끝 및 제목 구분선 일치. 최근 견적 수·부분납품 행 수가 달라도 내용 손실 없이 자연스럽게 늘어남. 1200px 이하 1열에서는 원래 내용 높이를 유지. 화면 CSS만 변경, 데이터/집계/저장 변경 없음.

2026-10-04 대시보드 글자 규칙 재조정: 전용 0.7 배율·헤더 크기 덮어쓰기 제거(공통 24/30px 헤더 상속), 섹션/본문 14px·보조 12px·통계 숫자 20px로 업무 탭 규칙에 맞춤. 금액은 시안의 숫자 서체 스택·600 굵기·좁은 자간과 별도 작은 원 단위로 표시(금액 계산/천 단위 쉼표 유지). hover 회색은 fill 35%+surface 65%, 기간 선택은 회색 묶음/흰 선택면/파란 글자로 변경하고 폰에서는 제목 아래 너비 전체 사용. 기존 기본 기간 옅은 강조·선택 단일 강조·양수 주황 경고 유지. 인증/저장/집계 변경 없음.

2026-10-04 대시보드 후속 조정: dashboard-refined.css의 공통 글자 배율 0.7, 카드 헤더/본문/차트 높이와 여백 축소(모바일 터치 영역 유지). 숫자·쉼표는 dutch-pay index.html의 시스템 서체(-apple-system/SF Pro Text/Helvetica Neue/Arial), tabular-nums, Math.round→ko-KR 형식과 통일. 차트 기본 최신 기간은 옅게, 클릭/키보드/hover 중 한 구간만 진하게(고정 선택과 미리보기 이중 강조 해소). '확인해야 할 일' 제목, 양수 건수만 --nd-amber. 데이터/집계/저장 로직 변경 없음. 210개 테스트 및 390px/PC 실화면 확인.

Base: b8efd90 (v1.186, = main). This branch adds the uncommitted local source used for the public naro-biz.web.app release (2026-09-29 13:17 KST). No code changes.

- `dev/personal-cloud-onboarding/` — onboarding source (Firebase Auth, Google/Dropbox OAuth, UI). Review screenshots excluded.
- `dev/unified-storage/` — storage/provider modules, tests, synthetic fixtures, `build.mjs`.
- `naro-workspace/` — files from the local Codex workspace root, same relative paths (`build.mjs` resolves paths from that root):
  - `outputs/general-public-readiness/` — `build-features.mjs` (builds the public candidate), `deploy-features.mjs`, `verify-public.mjs`, `site/` (about/privacy).
  - `outputs/personal-cloud-onboarding-public-release/release/` — earlier build output, used as an INPUT by `build.mjs`.
  - `outputs/personal-all-features-candidate/release/` — REFERENCE ONLY: the exact deployed artifact (28/28 public files match by SHA-256). Do not edit; rebuild from source.
  - `dev/firebase` or `work/erp/dev/firebase` — package manifest for the bundled Firebase SDK.
- Repo root files (v1.186 ERP) are the input for the `/erp/` iframe app; the build applies NARO changes on copy.

## Build inputs added in follow-up
- `naro-workspace/outputs/privacy-safe-companies-pilot/source/app/` — sanitized v1.186 renderer used by `build.mjs` for `/erp/` (only the files build.mjs reads).
- `naro-workspace/outputs/general-public-readiness/candidate/hosting-config.json` — copied by `build-features.mjs`.

## Rebuild (verified 55/57 before these inputs; onboarding 28/28)
Place `dev/` at `<root>/work/erp-login-shell-v186-release/dev` and `naro-workspace/*` at `<root>/`, install `firebase@12.19.0` in `<root>/work/erp/dev/firebase`, point the esbuild import in `build.mjs` (hard-coded `/private/tmp/naro-onboarding-build-tools/...`) to esbuild 0.28.2, then from `<root>`:
`node work/erp-login-shell-v186-release/dev/unified-storage/build.mjs --business --extended && node outputs/general-public-readiness/build-features.mjs`

## Design layer (branch feature/naro-redesign)
- `dev/unified-storage/naro-design.css` + `naro-design.js` — injected by `build.mjs` after layout B (`naro-panel-system-b`), last in `<body>`. Presentation only.
  - Theme: `naroTheme` in localStorage (`light` | `dark` | absent = system), shared by the onboarding shell and `/erp/` (same origin, synced via `storage` events). `build.mjs` adds a pre-paint script to both pages.
  - Dark mode for legacy hard-coded colours is generated at load (`darkAuto`): screen-only rules under `html[data-theme="dark"]`; print/document selectors are skipped so paper output stays white.
  - Desktop ≥1024: wide rail (248px), list 360px, shared header line 144px (eyebrow y30 · title y50, receipt-db contract). Mobile ≤1023: one sticky save bar flush on the bottom nav (clearance is a spacer, not scroll padding — sticky offsets would double).
  - v5 시안 1차 (presentation only): rail '자료' group (명함·사업자등록증 — mirrors `#bizCardBtn`/`#bizCertBtn`; while this build disables them they show '준비 중' and a toast instead of a dead click) · quick-filter chips (44px band) driving the existing `#qtStatus` / `#coType` selects · quote header 144 + tabs 44 so the tab divider meets the chip divider (y188) · one action-bar order `[secondary] … [⋯ copy·email·delete] [저장 ≥160]` (narrow desktop: quote secondaries icon-only) · mobile record screens: one-row save bar replaces the bottom nav.
  - 명함·사업자등록증 보내기 (extendedWrite): reads the image saved in 공급자 정보 → 개인 클라우드 이미지 (`settings.assets.card` / `.registration`) via `ASSET_READ`; phone → share sheet, desktop → copy image, else download. No public links. Removed from the extended `denied` list.
  - 업체 제공 자재: stacked bar 보유 · 사용 · 반환·불량 for the selected material (`.nd-mat`, validated blue ramp), drawn from `db.material_moves`; ledger logic untouched.
  - 데이터 내보내기 (rail · 자료): one dialog for every export — 견적서(품목 줄 선택)·거래처·품목·입금·출금 built from `db`; 매출 집계·받을 금액·전체 백업 call the app's own exporters. CSV = UTF-8 BOM, Korean header row, plain numbers. Per-screen CSV buttons are hidden (`.nd-retired`), functions kept.
  - 공급자 정보: 주소 검색 button on `#st_address` (same Daum postcode loader as 거래처); personal-cloud image panel styled (`.nd-assets`); legacy link hints point to it.
  - 왼쪽 패널 규칙: every list screen's header band holds [검색 · 늘어남][필터][＋] (36px, 14px above/below); below the 144 line only an optional 44px chip band and the scrolling list. Header controls proxy to each screen's own inputs/buttons; filter blocks move into a popover (handlers intact); ＋ with several kinds opens a menu (입금/출금 · 입고/출고/재고 조정).
  - 주소 검색 (공급자·거래처): `/postcode.html` window with its own CSP loads the Kakao/Daum widget and posts the address back (same origin). `/erp/` keeps its no-third-party-script CSP. Hosting config gains a `/postcode.html` header block (general-public-readiness + naro-redesign candidate).
- `dev/personal-cloud-onboarding/style.css` — "NARO design system v2" block at the end: legible type (inputs 16px), shared tokens, dark theme; the brand photo panel keeps dark ink in every theme.

## 디자인 공통 규칙 (모든 화면 — 새 화면도 이 규칙을 따른다)
naro-design.css 맨 아래 블록이 기준이다. 화면별로 따로 정하지 말 것.
- **선택된 목록 줄**: 연한 파랑 배경(`--nd-blue-soft`) + 줄 안쪽 왼쪽 3px 파란 바 + 모서리 없음. 이름만 파랑(`--nd-blue-ink`), 금액은 기본 글자색.
  적용: 견적서·거래처·품목(.list-item.on) · 업체 제공 자재(.material-owner.active) · 재고(.stock-item.selected) · 입금출금·매출·받을 금액·설정(.panel-b-index / .workspace-record-index button.on).
- **목록 줄(기록형)**: 여백 16/28px · 이름 14px/600 · 금액 13.5px/700 기본색 · 보조줄 12px/400 `--nd-ink-3`. 한 줄짜리 목차 줄: 14px.
- **섹션 이동 강조(설정)**: 구분선 아래 10–12px에서 시작해 다음 구분선 12px 전에 끝나는 연한 파랑 상자(구분선을 덮지 않음).
- **모바일**: 상세 폼은 좌우 16px 여백. 세로 스크롤 영역은 가로로 스크롤되지 않는다(.view overflow-x hidden).
- **알림**: 성공 안내는 3초 뒤 사라지고, 오류·진행·버튼 있는 안내는 남는다.
- **선택 버튼(칩·구분)**: 선택됨 = 진한 채움(`--nd-ink`) + 흰 글자, 나머지 = 테두리만. 목록 칩(전체·작성중…) · 기간 칩 · 구분(입고/출고) 모두 같다. 회색 바탕 위 흰 알약(iOS 세그먼트) 모양은 쓰지 않는다.
- **기간 필터**: 기간을 고르는 모든 화면(견적서·입금출금·매출 집계)은 맨 위에 `기간` 칩 한 줄 [전체][이번 달][지난 달][올해] (`.nd-period`, naro-design.js `periodPresets`). 칩은 화면의 원래 날짜 입력을 채우고 change를 보낸다 — 직접 기간은 그 아래 날짜 칸. 지금 범위와 같은 칩이 켜진다. 새 기간 필터도 이 함수에 화면만 추가한다.
- **모바일 하단 바(견적서)**: [⋯][공유][이메일][저장]. ⋯ 아이콘은 버튼 가운데. ⋯ 안(문서 종류·복사·인쇄·이미지·삭제)은 바 위에 2열 카드로 뜬다.
- **차트 짚어 보기**: 막대 차트는 마우스를 대거나 손가락으로 밀면 그 칸에 얇은 세로선 + 범례 자리에 '9월 · 매출 N원 · 입금 N원'. 막대마다 툴팁(title)은 쓰지 않는다. (`dashHover`)
- **사진 칸**: [사진 첨부|바꾸기] [크게 보기] [삭제]. 삭제는 연결만 끊고 클라우드 파일은 남긴다(파일은 지우지 않는 원칙). 품목 사진은 긴 변 900px로 줄여 저장.
- **견적서 품목 사진**: 사진이 등록된 품목만 품명 칸 왼쪽에 56px 사진. 같은 품목이 이어진 줄은 첫 줄에만 사진, 나머지는 같은 폭 들여쓰기 + 묶음 안 구분선 없음. 인쇄·이미지·공유·이메일·복사 공통(build.mjs가 drawQuoteCanvas·printQuote에 몇 줄 삽입, 사진은 asset-ui.mjs `naroQuotePhoto`). 사진이 없으면 원래 견적서와 같다.
- **레일 아이콘**: 매출 집계 = 막대 그래프, 받을 금액 = 지갑 (`navIcons`).
- **하단 버튼(⋯)**: ⋯ 안에 넣을 것이 하나뿐이면(거래처·품목의 삭제) ⋯ 대신 그 버튼을 바로 보인다(빨간 글자 테두리, 저장 왼쪽). 2개 이상일 때만 ⋯. 순서는 [보조·닫기·삭제] … [저장]. 버튼을 DOM에서 옮기지 말 것(패널 레이아웃과 서로 되돌려 화면이 멈춘다) — 메뉴를 펼친 채 ⋯만 숨긴다.
- **업체 제공 자재(폰)**: 목록 → 상세 두 단계(`materialsMobile`). 상세 = [‹ 업체 제공 자재][⋯ 기준일·재고내역서] · 업체명·기준일 · 자재 칩 · 남은 수량 · 그래프 · 기록, 아래 고정 [− N +][N개 사용 기록][+]. [+]·기록 줄은 아래에서 올라오는 기록 창(원래 상세 입력 폼, 구분은 칩). 수정 중이면 창 안에 [기록 취소].
- **사진 칸**: [이름 …… 상태] 한 줄, 아래 버튼은 사진 폭에 맞춰 같은 너비. 누르면 반드시 반응(파일 창 또는 이유를 상태 줄·알림에). 사진 요청은 45초 안에 답이 없으면 정리하고, 저장 중이면 작업 공간이 BUSY로 바로 답한다.
- **견적서 품명 칸**: 첫 줄 품명, 둘째 줄 품번(회색 11.5px) — 이름 끝 `[…]`를 떼거나 품목 코드. 줄바꿈은 띄어쓰기 단위(`naroWrapWords`), 한 단어가 한 줄보다 길 때만 글자 단위.
- **비침 방지**: sticky/fixed 막대는 불투명 바탕, 스크롤 영역 가장자리에 틈 없이(오른쪽 패널 아래 여백 20px만큼 bottom 보정). 폰 하단 탭도 불투명. 점검 스크립트(고정 요소의 바탕 투명도·가장자리 틈)를 배포 전 5개 폭에서 돌린다.
- **화면 규칙 주의**: `.view`에 display를 줄 때는 반드시 `:not(.hidden)` — 안 그러면 다른 탭 아래에 그 화면이 붙어 나온다.
- **폰 디자인 = A. 섹션 카드형(≤780px)**: 바깥 테두리 상자 없음, 바탕 회색 `--nd-page`, 내용 덩어리는 흰 카드 `--nd-surface`(모서리 16). 화면 좌우 12px, 카드는 그 안을 꽉 채움, 머리·칩 줄만 화면 끝까지(안쪽 16px), 카드 밖 글자는 16px 선. 카드 안 입력 칸은 연한 회색 `--nd-fill` 무테, 한 줄에 칸 하나, 저장은 아래 고정. 목록(왼쪽 패널 역할)은 모서리 없이 화면 끝까지 펼친 줄 목록·선택 표시 없음, 둥근 카드는 상세·입력(오른쪽 패널 역할)에만. 목록 탭은 목록 → 상세(‹ 뒤로), 입력은 아래에서 올라오는 창(자재·재고 같은 방식).
- **색 정의(의미별, 토큰은 naro-design.css 「색 정의」 블록)**: 파랑 `--nd-blue` 매출·핵심·버튼·선택 / 초록 `--nd-green`(더치페이 초록: 밝은 테마 #1DAD53(바탕·글자 같은 색) · 어두운 테마 #34C97D) 입금·입고·완료(숫자 "+") / 주황 `--nd-amber`(더치페이 한턱 주황: 밝은 #FF9500 · 어두운 #FF9F0A) 주의·부족·예정·부분(꼬리표) / 빨강 `--nd-red` 출금·출고·지출(숫자 "−", 바탕 없음) / 진한 빨강 꽉 찬 꼬리표 `--nd-bad` + "!" 미수·연체·품절·오류 / 청록 `--nd-teal` 이익·분석·조정 / 회색 `--nd-mute` 비교·미설정·비활성. 글자는 진한 값(흰 바탕 대비 4.7+), 막대·점은 -fill. 색만으로 뜻을 전하지 말 것(글자·부호·꼬리표와 함께).
- **폰 상세 폭**: 상세 카드는 견적서처럼 화면 좌우 12px 안을 꽉 채운다(옛 `.material-detail{margin:0 auto}`가 세로 flex 안에서 내용 폭으로 줄어 330px로 좁아졌던 일 — 상세 상자에는 `width:auto;max-width:none;margin:0`). 업체 제공 자재 상세 = 카드 두 장: ① 요약(업체명·기준일 · 자재 칩(가로 스크롤) · 남은 수량 크게 · 막대 · 보유/사용/반환·불량 3칸) ② 입출고 내역(줄마다 자재명+꼬리표 / 메모 · 날짜, 오른쪽 수량). 바로 사용 바는 아래 고정.
- **회원 승인제**: 로그인 흐름 = 가입 → 이메일 인증 → **승인 확인**(`core.mjs` `#admit`, 로그인·복원·인증·연결 때마다) → 저장소 연결. 승인 상태는 Firestore `access/{uid}`(`pending|approved|rejected`)를 SDK 없이 REST로(`dev/unified-storage/access-control.mjs`), 서버 규칙은 `naro-workspace/outputs/naro-redesign/access/access-block.rules` — **기존 규칙(옛 시스템 tenants·users)에 블록만 더한다, 통째 교체 금지**(켜는 법 `SETUP.md`). 관리자 = `onlysh4sh@gmail.com`(코드와 규칙 두 곳). 승인 블록이 없을 때(데이터베이스 없음·API 꺼짐·본인 문서 읽기 거부)만 모두 들여보내고, 그 밖의 실패는 승인 대기 화면에서 [승인 확인하기]로 재시도. 관리자 화면은 업무 화면 왼쪽 메뉴 맨 아래 '사용자 승인'(`access-ui.mjs`, 위 페이지와 `ACCESS_LIST`/`ACCESS_DECIDE` 메시지 — 위 페이지가 관리자인지 다시 확인). 데이터는 각자 저장소라 승인 취소해도 지우지 않는다.
- **저장 전 확인(naro-design.js `SAVE_CHECKS`)**: 거래처 — 이메일 형식(쉼표로 여러 개), 사업자번호 숫자 10자리, 같은 이름 거래처는 확인 후 등록 / 품목 — 판매가·매입가 0 이상. 앱의 저장 버튼 클릭을 capture 단계에서 먼저 받아 막는다(앱 저장 함수는 그대로).
- **받을 금액이 음수(선입금)**: 숫자는 '0원' + 아래 '미리 받은 돈 N원'(`advancePaid`, 대시보드 · 받을 금액 · 거래처 상세 공통). 계산은 그대로.
- **폰 목록 바닥**: 목록 안에서 스크롤하는 견적서·거래처는 카드가 아래 바 바로 위까지(바닥 여백 = 아래 바 69px). 목록 제목은 메뉴 이름 그대로('품목').
- **바로가기 규칙(naro-design.js 「바로가기」)**: 할 일이 있는 숫자는 누르면 그 일을 하는 칸까지. 누를 수 있는 숫자는 `data-nd-go`(tax·pay·pending) + 공통 표시 `›`(마우스 올리면 밑줄). 들어간 화면에는 파란 안내 줄 `.nd-jbanner` 1개 + 해야 할 칸 `.nd-jfocus`, 미리 채울 수 있는 값은 채운다. 목록 창은 `jSheet`(PC 가운데 · 폰 아래). ① 계산서 미발행(대시보드 카드·받을 금액 위 칸·표·거래처 상세) → 목록 [오늘 발행](tax_at=오늘 저장) / [열기](발행일 칸) — 입금 끝난 건도 보인다 ② 받을 금액 → 입금 입력(거래처·오래된 미수 견적·남은 금액) ③ 재고 부족 카드 → 0 이하 옵션 목록 → [입고 입력](품목·색상·부족 수량) ④ 미납품 잔액 → [납품 기록] ⑤ 회신 대기 → 견적서 '발송'. 앱의 계산·저장·이동 함수(arData·needsTax·saveTable·guardQtLeave·#stockRegister)를 그대로 쓴다.
- **빠른 저장(왕복 1번)**: Dropbox는 마지막 rev를 조건으로 바로 upload(`mode:update`) → 응답 `content_hash`를 직접 계산한 해시(`dropboxContentHash`)와 비교. Drive는 지난 저장 응답의 ETag로 바로 PUT(If-Match) → 응답 `md5Checksum`을 `md5Hex`와 비교(첫 저장·ETag 없음·412는 예전 6단계 방식으로). 확인값이 없거나 다르면 예전처럼 다시 읽어 확인, 응답 유실은 그대로 SAVE_UNCONFIRMED(재전송 없음). 시험: `fast-save.test.mjs`.
- **왼쪽 목록 줄 높이 규칙**: A 한 줄(이름만·목차) PC 64 / 폰 56 · B 두 줄(이름+설명) PC 88 / 폰 72 · C 세 줄 이상(견적서·품목) 88 이상. 글자는 세로 가운데. 새 목록도 이 셋 중 하나로.
- **레일 간격**: 메뉴 36px(사이 2px), 창 높이 940px 이하는 32px(900px 창에 한 화면), 더 낮으면 메뉴만 스크롤.
- **저장 버튼 상태**: 바뀐 내용이 없으면 회색 '저장됨'(견적서·거래처·품목, `saveState` — qtHasUnsavedChanges·masterHasUnsavedChanges), 고치면 파란 '저장', 새로 만들 땐 '등록'. 회색이어도 누를 수는 있다.
- **입금·출금 거래처별 집계**: PC는 보통 표(거래처 | 건수 | 입금 | 출금 | 차액), 폰만 카드형.
- **폰 목록 ↔ 상세 상태**: 견적서는 `#qtCols.detail-open`, 거래처 `.mobile-record-open`, 재고 `.nd-st-open`, 자재 `.nd-mm-open`. 목록 전용 규칙은 반드시 이 상태를 빼고 걸 것(빼지 않아 견적서 상세가 목록 아래로 밀려 '눌러도 반응 없음'이 된 일). `phoneListState()`가 `data-nd-phone=list|detail`을 달고, 목록 화면은 머리까지 흰 바탕 · 상세는 회색 바탕 + 흰 카드. 폰 레이아웃을 바꾸면 목록 줄을 실제로 눌러 상세가 위에 열리는지까지 확인.
- **폰 상세 글자 크기(견적서 상세 기준)**: 제목 19/700 · 섹션 제목 14/700 · 본문·이름 14/600 · 금액·수량 13~14/700 · 보조 12/400 · 큰 숫자(남은 수량 등) 32/800 · 요약 숫자 17/700. 새 상세 화면도 이 크기로.
- **폰 아래 고정 바**: 위 12 · 아래 16 + 안전 영역 · 좌우 16, 버튼 48 · 모서리 12(견적서·거래처·품목 저장 바, 자재 사용 바 공통). 수량 입력은 한 덩어리 [ − | 1 | + ](흰 바탕 · 테두리 하나 · 칸 사이 가는 선).
- **왼쪽 목차 → 오른쪽 패널 이동**: `naroReveal(el)` 한 곳에서 — 묶음이 패널보다 짧으면 패널 가운데, 길면 제목이 패널 맨 위(16px)에. 입금·출금·매출 집계·공급자 정보 공통.
- **표 규칙(앱 전체)**: 글자 열(품명·품목코드·색상·규격·거래처·메모·날짜·상태)은 왼쪽, 숫자 열(수량·단가·금액·세액·마진, `.num`)은 오른쪽. 표 위 제목(상호·섹션 제목)과 첫 열 글자는 같은 세로선, 제목 줄 오른쪽 합계와 마지막 열도 같은 선(`tableAlign`이 실제 위치를 재서 맞춤 — 표마다 구조가 달라서).
- **구분 버튼 색**: 고른 버튼은 뜻의 색으로 채움 — 입고·입금·받음 초록, 출고·출금·사용·반환 빨강, 조정 청록, 불량·분실 진한 빨강. 재고 입력의 합계·변경 후 수치도 고른 구분의 색. 그 밖의 선택 버튼(목록 칩·기간 칩)은 진한 채움 그대로.
- **품목 고르기**: 품목을 고르는 곳은 모두 견적서 품목 검색과 같은 창(검색 · 품명 | 코드 | 단가, 가나다순). 코드는 단가 바로 왼쪽에 오른쪽 정렬, 단가 칸은 천만 단위(84px)까지. 거래처 약정 단가 '제품'·재고 입력 '품목'은 `itemPickers`가 원래 select를 숨기고 같은 창을 띄운다.
- **재고 부족 알림**: 앰버 상자, 제목 '재고 부족 N건', 줄마다 [품명 코드 …… 부족 N] / [색상·규격 …… 필요·보유] 두 줄(`shortageTidy`).
- **표의 합계 열**: 세로 구분선 대신 옅은 파랑 바탕 열(위·아래 모서리 10px)로 묶는다.
- **홈 화면 아이콘**: NARO 심볼(흰 바탕) — `dev/unified-storage/naro-icons/`. 아이폰 = 첫 화면 apple-touch-icon, 안드로이드 '설치하기' = 첫 화면 `manifest.webmanifest`(build.mjs가 만듦, display minimal-ui). 사이트 보안 설정(hosting-config, 승인본 general-public-readiness와 같아야 함)에 `manifest-src 'self'`가 있어야 읽힌다.
- 검증(매 배포 전): 운영과 같은 CSP를 적용한 테스트 서버, 1440·1280·390 / 라이트·다크, 선택 줄·목록 줄 측정, 가만히 둘 때 DOM 변화 0, 가로 넘침 0.
- 폰 품목: 목록 ↔ 상세 분리(견적서와 같은 흐름). 상세(+ 새 품목 포함)에서는 머리 줄·목록을 숨기고 카드 맨 위 '‹ 품목'(견적서 '‹ 견적서'와 같은 자리·글자). 저장 안 한 변경이 있으면 확인 후 돌아간다.
- 품목 이미지 칸은 공급자 정보 명함 칸과 같은 모양: 칸 너비 가득 · 아래 '사진 · 상태' 줄 · 같은 너비 버튼(칸 제목이 '품목 이미지'라 줄 이름은 '사진').
- 폰 거래처 상세: 머리 줄(거래처 N곳)을 숨기고 앱에 있던 뒤로 가기(#coBackToList)를 '‹ 거래처'로 보이게(견적서·품목과 같은 자리). 금액 묶음은 오른쪽 정렬, 거래 내역은 폰에서 표 대신 두 줄 목록(날짜·구분 … 금액 / 내용).
- 견적서 목록 오른쪽 칩 순서: [계산서 미발행][상태] — 상태 칩은 늘 오른쪽 끝. 재고 부족 상자의 품목코드는 배경 없이 회색 얇은 글자(견적서 품번과 같게).
- 터치 기기(hover:none)에서는 시트 '닫기' 등 시트 버튼의 초점 테두리를 감춘다(열 때 자동 초점이 파란 상자로 남던 것). 품목 편집 시트의 금액은 20px/700(단가 16px보다 크게).
- 데이터 내보내기: 열 때마다 다시 그리고, 내려받을 때 그 순간의 자료로 CSV를 다시 만든다(닫은 사이 바꾼 거래처 이름 등이 옛 값으로 남던 것).
- 폰 품목 상세는 거래처와 같은 짜임: #view-items에 mobile-record-open을 함께 붙여 하단 메뉴를 숨기고, 상세 카드가 스크롤 상자 · 저장 줄 sticky bottom:0.
- 승인제 엄격 모드: 본인 승인 정보를 못 읽으면(403·DB 없음·API 꺼짐) 들여보내지 않는다(ACCESS_CHECK_FAILED). 관리자 계정은 확인을 건너뛰어 잠기지 않는다.
- 승인 대기 화면의 '아직 승인 전이에요' 안내는 빨강 대신 Dutch Pay 주황(#FF9500 · 다크 #FF9F0A, '승인 대기' 표시와 같은 색). 배포되는 app.mjs는 build.mjs가 원본에 패치를 덧대 만든다 — dev/personal-cloud-onboarding/app.mjs만 고치면 배포본에 안 들어간다.
- 품목 편집 시트의 금액 숫자는 단가 칸과 같은 16px, 굵기만 700.
- 입금·출금(시안 확정): 말은 입금·출금·차액 하나로(수금·지급은 데이터 값만). 요약 'N월 입금/출금' · '차액 (입금 − 출금)' · 세로선 위아래 14px 띄움, 폰은 차액 한 줄(왼쪽 이름·오른쪽 금액).
  목록 X 없음 — 줄(또는 PC 왼쪽 목록)을 누르면 기록 창(nd-pay-sheet: PC 가운데·폰 아래) → [삭제]는 앱의 deletePayment(확인 창). 첫 초점은 창 자체.
  금액 입금 초록 + · 출금 빨강 −. 폰 목록 2줄(거래처 … 금액 / 날짜·구분·방법·견적·메모, 없는 값은 숨김).
  기록 입력 버튼: PC는 [입금] 버튼과 같은 너비로 오른쪽 끝 한 줄, 폰은 1:2. 거래처별 집계: 제목 줄 48px+아래 얇은 선 · 거래처 사이 얇은 선 · 합계 위 2px 선, '—'→0, 차액 +/−.
- **공통 규칙(2026-10-03 사용자 요청 — 매번 다시 묻지 않게)**
  1. 표가 있는 카드: 제목·건수 줄의 글자 시작 = 표 첫 칸 글자 시작(16px), 오른쪽 안내 글자 끝 = 마지막 칸 글자 끝.
  2. 작은 창(기록 창·바로가기·사용자 승인): PC 너비 600px · 모서리 16 · 안쪽 22/24 · 제목 18px/700 · 버튼 44px. 폰은 아래에서 올라오는 창. 값 글자는 400, 금액만 600. 큰 작업 창(데이터 내보내기 960)만 예외.
  3. 품번(품목 코드): 어디서나 배경 없는 얇은 회색 글자(.qp-code · 재고 부족 .cd · 품목 선택 .ip-btn .cd · 품목 목록 .li-code).
  4. 폰에서 모양을 바꾸면 PC의 같은 요소도 같은 규칙으로 함께 바꾼다(예: 업체 제공 자재 수량 [ − | 1 | + ] 한 덩어리 — PC는 버튼과 같은 32px).
  5. 기호는 글자로 쓰지 않고 그린다: −/+ 수량 버튼은 선 두 개(2px, 정확히 가운데), 버튼 앞 '+'·'＋'·뒤로 가기 '‹'는 glyphTidy가 떼고 .nd-gi-plus/.nd-gi-back 아이콘, 접기·펼치기는 그린 꺾쇠(› 닫힘 · ⌄ 열림). 맥 글꼴에서 −·＋·‹가 아래로 처지고 +와 ＋ 크기가 달랐던 것.
  6. 폰 뒤로 가기 꺾쇠 끝 = 아래 내용 글자 시작(버튼 왼쪽 여백 0).
  7. 묶음 칸(수량 [ − | 숫자 | + ])의 너비는 안의 칸 합과 같게(flex:0 0 auto) — 고정 너비를 두면 끝에 빈 틈이 생긴다. 바꾼 뒤에는 좌우 빈 틈 0 · 옆 버튼과 위치·높이 같음 · 기호 가운데(±0.5px)를 측정해서 확인.
  8. CSS content로 쓴 '›'·'+'도 그린 모양으로(바로가기 표시 · 폰 자재 기록 줄 · 납품 수량 펼치기 · 폰 자재 상세 입력 +). 금액 앞 +/−는 숫자의 일부라 글자 그대로.
- 재고 입력(A안 확정): 구분은 입력 칸 맨 위 탭 [+ 입고 | − 출고](.nd-sk-tabs, 고른 쪽만 초록/빨강 글자+밑줄, 버튼 아님). 원래 구분 칸(#ivKind)은 숨기고 탭이 값을 바꾼다.
  순서: 탭 → 품목·색상 → 규격 → 날짜 → 수량 → 메모 → [입력 닫기][입고 N개 확인/출고 N개 확인](확인 버튼 글자·색이 구분을 따라감, stockBtnLabel).
  아래 품목 표 제목·설명 글자 시작 = 표 첫 칸 글자 시작(16px), 품번은 [ ] 없이 얇은 회색(폰 상단 제목도). 폰 입력 창: 손잡이 → 탭(창 끝까지 선) → 칸.
  9. 구분 고르기는 어디서나 맨 위 탭(재고 입고·출고 · 입금·출금 · 자재 받음·사용·반환·불량분실): 고른 쪽만 뜻의 색 글자+밑줄, 오른쪽 짧은 안내, 저장 버튼 글자·색이 구분을 따라감(kindSaveLabels).
- 재고 조정(시안 확정): 재고 입력 세 번째 탭 [= 조정](청록). 칸 = 실제로 센 수량(빈칸 = 그대로, 0 = 없음), 아래 줄 = 차이. 사유 칩(재고 조사·분실·파손·불량·잘못 입력) 필수.
  저장은 앱의 openStockReview(최종 확인 창)를 그대로 거쳐, 사이즈마다 차이만큼 입고(+)/출고(−) 기록 + memo '재고 조정 · 사유 · 장부 X → 실제 Y' + adjust{reason,book,actual}. 지난 기록은 고치지 않는다.
  '재고 조정' 버튼(PC 왼쪽·폰 아래)은 이 탭을 연다. 최근 입출고 내역에서 조정 기록은 [조정] 꼬리표 + 부호 있는 수량.
  10. 요약 칸 구분선(.stats · 매출 집계 .sl-metrics · #dashStats): 화면에 놓인 자리로 정한다 — 같은 줄 옆 칸 = 세로선(위아래 14px 띄움), 둘째 줄부터 = 가로선(좌우 14px 띄움). 원래 테두리는 투명(statDividers).
  11. 창 밖을 누르면 닫힌다(모든 <dialog>: Esc와 같은 cancel → 창의 닫기 규칙 그대로). 폰 재고 입력 창도 어두운 곳을 누르면 [입력 닫기]와 같게.
  12. 폰 재고: 입력 창 아래 버튼은 한 바(.nd-sk-act, 불투명 + 위 선, 창 아래 끝까지), 빈 상태에도 [입력 닫기] 보임, 닫으면 어두운 배경까지 바로 거둠. 상세 표는 두 줄 목록(칸 이름 data-label 기준 — 품목 하나일 때 7칸 · 전체 8칸 모두). 필터 버튼은 PC 묶음이 없으면 원래 고르기 칸을 꺼내 보여줌(재고·입출금·품목·매출·받을 금액).
  13. 폰에서 그린 기호는 한 단계 크게(−/+ 16px, 탭·버튼 앞 아이콘 13~14px, 뒤로 꺾쇠 9px).
  14. 화면(.view·#qtCols)의 class 변화에도 디자인 패스를 다시 돈다(목록↔상세가 class만 바뀔 때 흰/회색 배경이 안 맞던 것). 폰 자재 '상세 기록' 창도 밖을 누르면 닫힘. 폰 자재 아래 바의 상세 입력 버튼은 '상세' 글자. 폰 입금·출금 거래처별 집계 제목은 목록 글자와 같은 시작.
  15. 폼 제목 규칙(PC): 섹션 제목(거래 내역·거래처 정보·기본 정보·옵션 및 가격·품목 이미지·공급자 정보 섹션들) 글자 시작 = 칸 이름 = 입력 글자 = 표 첫 칸 글자(12px 안쪽). 품목 사진 칸은 PC 240px(공급자 명함 칸과 같음), 폰은 너비 가득.
  16. 그린 아이콘 클래스(.nd-gi-*)는 display를 강제하지 않는다([hidden]·PC 숨김을 깨지 않게). 폰 전용 뒤로 가기(#coBackToList 등)는 PC에서 늘 숨김.
  17. 2026-10-04 대시보드 확정안: 패널형 대시보드·인수 확인형 자재 아이콘, 핵심 현황 → 매출·입금 현황(연간/월별/일별, hover·focus·탭 선택) → 확인할 일 → 최근 견적/견적 진행. 상태 표기는 작성 중(견적 준비), 발송(고객 답변 대기), 수주(주문 확정·납품 준비), 납품(납품 완료); 부분납품은 존재할 때 별도 표시. dashboard-refined.js/css를 독립 표시 계층으로 추가. 기존 납품·금액 계산 함수와 현재 db만 읽고 저장/상태값/인증/동기화는 변경하지 않음. 기존 품목 분석은 펼치기로 보존. 자동 테스트 208 PASS, 합성 fixture에서 PC·320/390px·라이트/다크 및 기간 선택·견적 이동 확인. 배포 파일 67개 중 erp/index.html만 변경; sync-dashboard-candidate.mjs가 전체 해시 확인 후 표시 계층과 manifest/deploy PIN만 동기화한다. 기존 원본의 날짜 입력 MutationObserver 초기 오류는 이번 변경 범위에서 수정하지 않음.
