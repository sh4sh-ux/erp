# 다른 사람이 쓰기 전 — 공개 준비 체크리스트 (10/22, 4단계)

제출과 콘솔 설정은 **사용자(운영자)가 직접** 합니다. 이 문서는 무엇이 이미 되어 있고, 무엇을 어디서 누르면 되는지 정리한 것입니다.

## 지금 상태
| 항목 | 상태 |
|---|---|
| 개인정보처리방침 | https://naro-biz.web.app/privacy.html (10/22 개정: 매입·변경 기록·자동 백업, Drive 연결 유지, 클라우드 옮기기) |
| 서비스 안내(홈페이지) | https://naro-biz.web.app/about.html |
| Google 로그인(Drive) | 사용자 유형 External · 게시 상태 Production. `drive.file`은 **비민감 범위**라 별도 심사 없이 누구나 연결 가능 |
| Gmail로 견적서 보내기 | `gmail.send`는 **민감 범위** — 심사 전에는 '확인되지 않은 앱' 경고가 뜨고 새 사용자 수에 한도가 있음 |
| Dropbox | Development 상태(연결 계정 수 한도 있음) |

## 1. Google — Gmail 보내기 심사 (다른 사람도 경고 없이 쓰게 하려면)
Google Cloud Console → **Google 인증 플랫폼(OAuth 동의 화면)** 에서:
1. **브랜딩**: 앱 이름 `NARO Biz`, 지원 이메일, 로고(선택), 홈페이지 `https://naro-biz.web.app/about.html`, 개인정보처리방침 `https://naro-biz.web.app/privacy.html`.
2. **승인된 도메인**: `naro-biz.web.app` — 소유권 확인이 필요하면 [Google Search Console](https://search.google.com/search-console)에서 `https://naro-biz.web.app/` 속성을 추가하고 **HTML 파일 확인**을 고르세요. 받은 `googleXXXX.html` 파일을 저에게 주시면 배포 파일에 넣어 올리겠습니다(배포는 승인 후).
3. **데이터 액세스(범위)**: `.../auth/drive.file`, `.../auth/gmail.send` 두 개만.
4. **심사 제출**: 아래 '범위 사용 이유'와 시연 영상 링크를 넣고 제출.
   - 시연 영상(유튜브 '일부 공개'): 로그인 → 저장소 연결(동의 화면에 범위가 보이게) → 견적서 열기 → [Gmail로 보내기] → 받은편지함에서 메일 확인. 화면 주소창에 `naro-biz.web.app`이 보이게. 시험용 이름·데이터로 찍기.
   - 범위 사용 이유(영문 초안 — 그대로 붙여 넣어도 됩니다):
     > **gmail.send** — NARO Biz lets a small business email a quote to its customer directly from the user's own Gmail. When the user presses "Send with Gmail", the app sends one message (recipient, subject, body and the quote image the user prepared) through `users.messages.send`. The app cannot read, list or delete any mail. The access token stays in browser memory only and is never sent to our servers (there are none — the app is a static site).
     >
     > **drive.file** — Business records (companies, items, quotes, payments, stock, purchases, monthly change log and a daily backup) are stored as JSON files in a "NARO Biz" folder the app creates in the user's own Google Drive. The app only touches files it created.

## 2. Dropbox — Production 신청
Dropbox App Console → 앱 `NARO Biz`(App Folder) → **Settings → Production** 의 신청 버튼. 신청서에는 위와 같은 설명(업무 기록을 사용자 Dropbox의 앱 폴더에만 저장, 서버 없음)과 개인정보처리방침 주소를 넣습니다. 조건(연결 사용자 수 등)은 콘솔 안내를 따릅니다.

## 3. 공개 뒤 첫 주에 확인할 것
- 시험용 Google 계정(운영 데이터 아님)으로: 연결 → 매입 시작 → 매입 저장 → 변경 기록 → 다음 날 자동 백업 파일 생김 → [되살리기].
- 1시간 넘게 켜 둔 뒤 버튼을 눌러 연결이 이어지는지(Google 창이 잠깐 떴다 닫힘), 팝업이 막힌 브라우저에서는 위쪽 [연결 유지] 띠가 뜨는지.
- 사용 승인(관리자 화면)에서 새 가입자를 승인해야 업무 화면이 열립니다.
