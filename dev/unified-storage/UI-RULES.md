# NARO screen style rules

`ui-contract.css` is the final screen-only typography layer, after the feature styles
and payment panel. `build.mjs` embeds it as `style#naro-ui-contract`. The legacy dark
palette generator must skip this layer, because it already uses theme tokens and
explicit selected-state tokens. Print documents keep their own rules.

Use the same token for the same role, rather than copying a font shorthand into a
feature file. Text uses the existing NARO font stack (`--sans`). Numeric glyphs use the
receipt-db v3.90 stack: `system-ui,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",Arial,sans-serif`.
The leading `system-ui` is required for the reference comma shape. There is no required downloadable font.
Use `font-variant-numeric:tabular-nums`; do not force `font-feature-settings:"tnum"`,
which can widen the comma. Reference: https://sh4sh-ux.github.io/receipt-db/ (`index.html` body rule). All numeric roles use tabular digits and
normal letter spacing. Do not change accounting, persistence or authentication to
fix a presentation issue.

| Role | Desktop | Mobile (under 1024px) | Color |
| --- | --- | --- | --- |
| Page title | 22px / 30px, 600 | same | `--nd-ink` |
| Record title and primary header amount | 22px / 30px, 600 | same | `--nd-ink` |
| KPI/summary total | 20px / 24px, 600 | same | `--nd-ink` |
| Section heading | 14px / 22px, 600 | same | `--nd-ink` |
| Record name and record amount | 14px / 20px, 600 | same | existing semantic text color |
| Supporting label/header metadata | 12px / 18px, 400 | same | `--nd-ink-2` |
| Muted list metadata | 12px / 18px, 400 | same | `--nd-ink-3` |
| Rail text | 14px / 20px, 500 (selected 600) | same | rail state colors |
| Utility dialog title | 22px / 30px, 600 | same | `--nd-ink` |
| Detail section tab | 13px / 20px, height 46px | 14px / 20px, height 44px | selected underline: ink on desktop, blue on mobile |

Status badges, warnings, destructive actions and loss/margin annotations retain
meaningful colors and smaller annotation sizes. A percentage or a count belongs to
its numeric role; it should not select a different font merely because it contains
noncurrency characters. Filled pill filters (change log, access approval and action
filter chips) use `--nd-pill-active-bg` / `--nd-pill-active-ink`: dark background,
white text. Underlined list filters remain blue; they are a different control role.

## Before changing a screen

1. Find the role in this table and the registered selectors in `ui-contract.css`.
2. Reuse the token or register the new component's selector in the existing role.
   Do not add a feature-specific `font`, `letter-spacing` or `!important` override
   for an already shared role.
3. Run the actual rendered-style test, including light/dark and mobile/desktop.
   It loads the real pinned HTML, scripts and modules; it injects only the current
   style contract and uses synthetic read responses. External traffic and writes
   are blocked. No customer records are used.
4. Run the existing business regression suites. Refresh the pinned candidate only
   after validation; check every existing file hash first, then update the manifest
   and deploy PIN together. Verify no unrelated hosted files changed.

Commands from repository root:

```sh
NARO_BROWSER_EXECUTABLE=/usr/bin/chromium node --test dev/unified-storage/ui-contract.test.mjs
NARO_BROWSER_EXECUTABLE=/usr/bin/chromium node --test dev/unified-storage/*.test.mjs
```

The browser executable override is optional if Playwright's own Chromium is
installed. The test compares computed fonts, sizes, weights, colors and letter
spacing rather than accepting the presence of CSS text as proof. Both `.github/workflows/naro-ui-check.yml` and the existing deployment workflow
run the style test with the business regressions. A failed check prevents the
deployment workflow from reaching its Hosting steps. Purchase uses
its real mirrored quote styles; company/payment/sales header amounts must match
the quote header size/weight/color while using the receipt numeric font. Mobile items have a form without a separate record-name header;
the desktop item header is compared when that component exists.

## New quote and purchase entry flow

Both + buttons open a new editable draft with no company selected and immediately
open the same searchable company picker (`NaroQuoteActions.chooseCompany`).
Purchases filter this shared picker to purchase vendors; never silently choose the
first vendor. Selecting a company in the picker or the information select advances
new drafts to the items tab. Existing saved records retain their current tab.
Verify actual + clicks and company/item selection, quantity and unit price editing,
computed totals, and cancel without persistence on mobile and desktop. An assertion
that an input exists or a tab is selected is insufficient to verify this flow.

## Photo attachment behavior

“자동으로 줄여서 저장” must fit the encoded PNG to the private asset store's
kind-specific limit (`assetByteLimit`): products 1MB, business cards/registrations 8MB.
Documents preserve original dimensions when possible; larger input images scale
proportionally to fit the stored 4096px/16MP bounds instead of being rejected before
resizing. Do not apply the product thumbnail's size cap to documents. JPG-to-PNG conversion can grow
file size. Redraw each smaller attempt from the original bitmap. Verify a JPEG
larger than 1MB whose PNG also exceeds 1MB through the actual attachment
button and native file chooser, then assert kind-specific upload size and visible preview. For documents verify
original dimensions and that `createAssetFile` retains the exact stored bytes.
Sharing must not resize/re-encode the stored document. Advise KakaoTalk users to
select original quality or send as a file, since a recipient app may compress photos.
Attachment errors must survive unrelated renders and remain visible beside the
attachment; a generic “등록 안 됨” label must not erase a failure. Inline errors
can be dismissed and reset on retry; long errors wrap below the full document title.
Transient attachment notifications use the existing auto-hiding toast rather than
the persistent storage recovery status. Verify toast disappearance and error dismissal.

## Quote/purchase totals and row deletion

The separator above 합계 spans the full item section width, including the desktop
17px text inset on each side. Keep totals text on its existing inner alignment.
Quote and purchase row-delete SVGs both use 14×14px and stroke-width 2. Apply the
shared `ui-contract.css` selectors for both forms. Check rendered separator endpoints
against the section bounds and actual SVG rectangles; CSS source equality alone
is insufficient. Screen rules must not change printed quotation documents.

## Saved button state

Existing records and supplier settings with no pending changes use `nd-saved`,
neutral `--nd-fill`/`--nd-ink-3`, and the label 저장됨. Changed values restore the
save label and normal action color; reverting values restores the saved state.
Supplier dirty checks compare the actual trimmed persisted fields and combined
base/detail address, ignoring separately auto-saved photo references. Purchase
comparisons normalize optional empty fields and key order. Stock minimum and
existing material-edit actions also use this state; material action labels must
not overwrite an existing edit's 저장됨 state. Keep native write/recovery controls.
Verify actual field edits, revert, save completion, photo auto-save, and computed
button colors on mobile/desktop in both themes.

견적서·매입 요약의 각 행은 항목명과 값을 수직 중앙 정렬하여 가로로 나란히 표시한다. 합계·예상 마진에도 같은 규칙을 적용하며 기존 열 너비, 글꼴, 구분선 길이는 유지한다.

품목 추가 버튼의 +는 숨겨진 레거시 텍스트와 무관하게 버튼의 가로·세로 중앙에 놓는다. 기존 품목에는 복사 버튼을 직접 표시한다. 복사는 새 품목 초안으로 열고 등록 전에는 쓰기 작업을 하지 않는다. 옵션·가격·분류·메모·구성품·이미지 참조를 복사하되 ID·품목코드·생성/수정일·재고 최소 기준은 초기화한다. 원본을 수정하지 않으며 취소 시 등록하지 않는다.

품목 필터의 삭제된 항목 영역은 .nd-pop-body.nd-pop-filter 안에 추가하여 카테고리와 동일한 좌우 여백 및 하단 여백을 사용한다. 팝업 외곽에 직접 붙여 여백을 우회하지 않는다. 삭제된 품목 유무 모두 같은 정렬을 유지한다.

견적서 인쇄·PDF·공유 이미지에서 품명과 품목코드는 별도 줄로 표시한다. 코드 자체에 [VN] 등 대괄호가 있어도 문서에 저장된 바깥 [코드]를 균형 있게 분리한다. 현재 품목 코드가 바뀌거나 품목이 삭제되어도 저장된 문서 스냅샷은 보존한다. 색상·규격·수량·금액은 각 행의 세로 중앙에 배치하고 품명/코드 블록도 같은 중심에 둔다. 수평 금액 정렬과 계산은 유지한다.

검색창은 공통 검색어 지우기 X 버튼을 사용한다. 입력값이 있을 때만 검색창 오른쪽 안에 표시하며, 클릭 시 기존 input/change 이벤트로 검색 결과를 복원하고 입력창에 초점을 돌려준다. 기존 입력 노드를 교체하거나 감싸지 않아 팝업/이동 필터의 원래 선택자와 이벤트를 유지한다. 목록·거래처/품목 선택·모바일 시트에도 동일한 14px 아이콘과 28px 버튼을 적용한다.

업체 제공 자재 상세는 견적서와 같은 헤더/우측 수량, 공통 밑줄 탭(자재·내역·입력), 흰 본문, 섹션 여백/구분선 및 하단 작업바를 사용한다. 탭 전환은 원래 입력 노드를 보존하여 초안 값을 유지하며 저장하지 않는다. 폰에서는 기존 기록 시트 대신 상세 입력 탭을 사용하되 새 업체의 최초 자재 받음 동작은 유지한다.

사용자 검토 방식(2026-10-12): 디자인 변경은 실제 화면 시안을 먼저 공유하고 사용자 확인 후 PR 머지를 진행한다. 구현/검증과 시안 준비까지는 진행하되 시안 확인 전에는 추가 머지하지 않는다. 배포는 사용자가 직접 실행한다. 검색창에 돋보기가 있으면 X의 우측 여백은 돋보기의 좌측 여백과 대칭으로 맞춘다.

All menu page titles, record headers and primary header amounts use the shared 22px/30px title tokens and `--nd-header-weight:600`, on desktop and mobile. Utility dialog titles follow the same rule. Never override individual destinations. Payment labels keep the text `입금·출금`; `.nd-payment-dot` adds `.10em` on each side of the dot. Render the span in payment-panel markup to preserve its DOM comparison and stable clickable rows.
