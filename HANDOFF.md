# NARO Personal Cloud handoff

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
- **왼쪽 목차 → 오른쪽 패널 이동**: `naroReveal(el)` 한 곳에서 — 묶음이 패널보다 짧으면 패널 가운데, 길면 제목이 패널 맨 위(16px)에. 입금·출금·매출 집계·공급자 정보 공통.
- **표 규칙(앱 전체)**: 글자 열(품명·품목코드·색상·규격·거래처·메모·날짜·상태)은 왼쪽, 숫자 열(수량·단가·금액·세액·마진, `.num`)은 오른쪽. 표 위 제목(상호·섹션 제목)과 첫 열 글자는 같은 세로선, 제목 줄 오른쪽 합계와 마지막 열도 같은 선(`tableAlign`이 실제 위치를 재서 맞춤 — 표마다 구조가 달라서).
- **구분 버튼 색**: 고른 버튼은 뜻의 색으로 채움 — 입고·입금·받음 초록, 출고·출금·사용·반환 빨강, 조정 청록, 불량·분실 진한 빨강. 재고 입력의 합계·변경 후 수치도 고른 구분의 색. 그 밖의 선택 버튼(목록 칩·기간 칩)은 진한 채움 그대로.
- **품목 고르기**: 품목을 고르는 곳은 모두 견적서 품목 검색과 같은 창(검색 · 품명 | 코드 | 단가, 가나다순). 코드는 단가 바로 왼쪽에 오른쪽 정렬, 단가 칸은 천만 단위(84px)까지. 거래처 약정 단가 '제품'·재고 입력 '품목'은 `itemPickers`가 원래 select를 숨기고 같은 창을 띄운다.
- **재고 부족 알림**: 앰버 상자, 제목 '재고 부족 N건', 줄마다 [품명 코드 …… 부족 N] / [색상·규격 …… 필요·보유] 두 줄(`shortageTidy`).
- **표의 합계 열**: 세로 구분선 대신 옅은 파랑 바탕 열(위·아래 모서리 10px)로 묶는다.
- **홈 화면 아이콘**: NARO 심볼(흰 바탕) — `dev/unified-storage/naro-icons/`. 아이폰 = 첫 화면 apple-touch-icon, 안드로이드 '설치하기' = 첫 화면 `manifest.webmanifest`(build.mjs가 만듦, display minimal-ui). 사이트 보안 설정(hosting-config, 승인본 general-public-readiness와 같아야 함)에 `manifest-src 'self'`가 있어야 읽힌다.
- 검증(매 배포 전): 운영과 같은 CSP를 적용한 테스트 서버, 1440·1280·390 / 라이트·다크, 선택 줄·목록 줄 측정, 가만히 둘 때 DOM 변화 0, 가로 넘침 0.
