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
| Page title | 22px / 30px, 650 | same | `--nd-ink` |
| Record title and primary header amount | 22px / 30px, 650 | same | `--nd-ink` |
| KPI/summary total | 20px / 24px, 600 | same | `--nd-ink` |
| Section heading | 14px / 22px, 600 | same | `--nd-ink` |
| Record name and record amount | 14px / 20px, 600 | same | existing semantic text color |
| Supporting label/header metadata | 12px / 18px, 400 | same | `--nd-ink-2` |
| Muted list metadata | 12px / 18px, 400 | same | `--nd-ink-3` |
| Rail text | 14px / 20px, 500 (selected 600) | same | rail state colors |
| Utility dialog title | 22px / 30px, 650 | same | `--nd-ink` |
| Detail section tab | 13px / 20px, height 46px | 14px / 20px, height 44px | selected underline: blue on desktop and mobile |

Status badges, warnings, destructive actions and loss/margin annotations retain
meaningful colors and smaller annotation sizes. A percentage or a count belongs to
its numeric role; it should not select a different font merely because it contains
noncurrency characters. Filled pill filters (change log, access approval and action
filter chips) use `--nd-pill-active-bg` / `--nd-pill-active-ink`: dark background,
white text. Underlined list filters remain blue; they are a different control role.

## Background tints

Gray backgrounds inside a list or a dialog are tints, not `--nd-fill`. `--nd-fill`
(#F2F3F6) is for controls only: segmented controls, chips, disabled buttons, badges.

| Use | Token | Light result |
| --- | --- | --- |
| Row hover (list, table, record row) | `--nd-tint-hover` = `--nd-fill` 35% on surface | about #FAFAFB |
| Opened/expanded row, inline note or summary box in a dialog | `--nd-tint-open` = `--nd-fill` 55% on surface | about #F8F9FA |
| Control background (segment, chip, disabled button) | `--nd-fill` | #F2F3F6 |

Both tints are defined in `ui-contract.css` and follow dark mode automatically. Never
lay a tint over another tint, and never use `--nd-fill`/`--nd-fill-2` as a row or panel
background.

## Vertical centering between dividers

Text in a row sits in the vertical middle between the divider above and the divider
(or tinted block edge) below. Use equal top and bottom padding with `align-items:center`.
Never add bottom-only (or top-only) padding to a row or an expanded block. An expanded
block uses the same padding at top and bottom (6px around 40px sub-rows), so its first and
last lines are spaced the same from its edges.

## Quote panel tables

Every table in the quote/purchase right panel (품목, 진행: 납품·입금·계산서) uses the
same dividers, colors and spacing as the 품목 table. Reuse these `#qtForm` tokens; never
hard-code a border or row padding in a new table.

| Part | Token | Desktop | Mobile (under 1024px) |
| --- | --- | --- | --- |
| Header rule | `--quote-table-head-rule` | 1.5px #D4D4D8 (dark `--nd-line`) | 1px `--nd-line-2` |
| Row rule | `--quote-table-row-rule` | 1px `--ws-line` | 1px `--nd-line-2` |
| Side padding | `--quote-table-pad-x` (= `--nd-in`) | 17px | 12px |
| Header height | `--quote-table-head-h` | 38px | header hidden |
| Row height | `--quote-table-row-h` | 48px minimum | two-line rows |
| Header text | `--ink-3`, 12px | same | — |

Rows draw only a bottom rule. A row never draws a top rule too, because two adjacent
1px rules render as a 2px line. `ui-contract.test.mjs` compares the progress rules with
the 품목 rules in light and dark mode at 390 and 1440.

## More menus

A button that opens more actions uses **vertical dots (⋮)**: record rows (납품·입금·입고),
action bars (견적서·매입·거래처·품목 ⋯), and the materials header. The only exception is
the phone bottom tab bar's labeled 더보기 tab: it is a navigation tab, not a menu button.

- Icon: three dots in a vertical line, 16px in rows and 17–18px in action bars, `--nd-ink-2`.
- Button: 36×36 in rows (44px touch area on phones), no border, `--nd-tint-open` on hover/open.
- Popover: its **right edge lines up with the content's right edge** — the same line as the
  table's right end and the section buttons ([납품 추가] etc.), not inside it. Row menus open 4px
  below the button; bottom-bar menus open 8px above it, right edge on the bar's right end.
- Focus ring: only for keyboard focus (`:focus-visible`), never after a mouse/touch tap. It never extends past the screen
  (`max-width: 100vw - 32px`).
- Item: 16px icon + name (14px/20px, 500) + optional one-line description (12px, `--nd-ink-3`).
  Destructive items come last, after a 1px `--nd-line-2` divider, in `--nd-red`.

## Parcels (택배 송장)

A delivery can carry several tracking numbers. Storage stays backward compatible: one
parcel is saved as `shipping={method:'택배',carrier,tracking}` exactly as before; two or more
add `parcels:[{carrier,tracking}]` while `carrier`/`tracking` keep the first parcel.

- Entry: one row per parcel = [carrier select][number field with 조회 ↗ inside][×].
  The count ("송장 N개") and × show only when there are 2 or more. ＋ 송장 추가 (dashed, 40px,
  44px on phones) is under the rows; at most 10 parcels. Every number is 8–30 digits.
- List: the row always shows the first parcel as the representative — carrier · number · 조회 ↗ —
  plus a `+N` badge when there are more. The opened row lists "송장 1, 송장 2 …", each with its own 조회 ↗.
- An opened row keeps the light `--nd-tint-open` background (its sub-lines belong to the row above);
  sub-lines are 34px and are never separated by table dividers.
- 고친 기록 names only what changed (수량 a → b · 날짜 · 배송 정보 수정 · 메모 수정); never "250개 → 250개".
- Lookup opens one carrier page per parcel; there is no combined lookup.

## Segmented controls

Every segmented choice (dashboard 연간·월별·일별, delivery and purchase-receipt 남은 수량 전부·일부만)
looks the same. Use the `--nd-seg-*` tokens in `ui-contract.css`.

| Part | Value |
| --- | --- |
| Track | 44px tall, 4px padding, radius 10px, `--nd-fill` 50% on surface, 1px inset `--nd-line-2` ring |
| Item | equal width, radius 7px, 12px text, `--nd-ink-3` |
| Selected | surface background, `--nd-blue` text, 600, shadow `0 1px 4px #20294012` |

Never use a dark (ink) filled selected item for a segmented control; dark filled pills are only
for the filter chips listed above.

## Section heading rows

In the quote/purchase right panel (품목 · 진행 · 정보), every section heading row has the same
height as the section action button: `--nd-sec-head-h` = 30px on desktop, 44px under 1024px.
The title is vertically centred in that row, so the first heading of every tab lands on the
same line whether or not the section has a button (정보's 기본 정보 has none).

## Supplied materials (업체 제공 자재)

`material-panel.js` draws the whole screen in the quote layout and keeps the original save
functions (`buildMaterialMove` → `persistMaterialMove` / `updateMaterialMove` / `voidMaterialMove`).

- Left: [업체 · 자재] tabs only — no filter chips. Holding rows come first; finished ones (남음 0) sit
  under one collapsed "다 씀 N곳 ›" row at the bottom. Rows are two lines (name · 수량 / meta); a
  "N일째 보관" tag marks materials untouched for 90+ days. No per-row bars on the left.
- Right: header (업체 · 남은 수량) → 받음 bar with legend (보유 · 사용 · 반환·불량) → tabs
  [자재 · 기록 · 정보] → bottom bar [재고내역서] … [＋ 기록]. One ＋ 기록 button only (bottom bar).
- 자재 table: 자재 | 받음 | 사용·반환 | 남음 | 남은 비율(bar only) | ⋮. It must fit a 1024px-wide window
  without clipping (no percentage text; the bar's tooltip carries it).
- Tables use the quote table tokens; opened rows use `--nd-tint-open`; row menus use ⋮ aligned
  to the table's right edge.
- The record sheet uses the delivery-sheet parts and the segmented control
  [받음 · 작업에 사용 · 반환 · 불량·분실]. Editing keeps `materialDraft`/`materialEditingId`, so
  the `mm_save` '저장됨' rule applies unchanged. Cancelling marks the record void (never deletes).
- No planned/expected usage is shown (사용자 결정 10/15).
- A 작업에 사용 record asks "어디에 썼나요?" [견적 · 네이버 주문 · 기타], stored only in the existing
  fields (`quote_id`, `source` = '스마트스토어'/'기타', `order_no`). The 기록 tab shows the quote link or a green
  네이버 badge with the order number, and has a [네이버] chip. There is no separate orders tab (사용자 결정 10/15).
- Quote work lines may name the supplied material they use: `line.supplied_material` +
  `line.supplied_per_unit` (default 1), edited in a tinted sub-row under the work line, shown only when
  the customer has supplied materials or the line already names one. Picking that quote in the record
  sheet fills material, work item, remaining work quantity and per-unit amount.

## Panel dividers

Left and right panels share their horizontal rules. On desktop the header rule sits on one line
(left list header and right record header are both `--panel-head` tall), and the left list tab row and
the right detail tab row are both `--nd-detail-tab-height` (46px) + a 1px `--nd-line` rule, so their
rules form one straight line across the screen (44px + 1px under 1024px). Tables below follow
'Quote panel tables'. `ui-contract.test.mjs` checks the tab-row line for quotes and supplied materials
at 1100 and 1440, light and dark.

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
The purchase + first shows a two-item menu (국내 매입 / 수입 매입 붙여넣기); 국내 매입
follows this flow, the paste sheet is described in 'Import purchase paste'.
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

All menu page titles, record headers and primary header amounts use the shared 22px/30px title tokens and `--nd-header-weight:650`, on desktop and mobile. Utility dialog titles follow the same rule. Never override individual destinations. Payment labels keep the text `입금·출금`; `.nd-payment-dot` adds `.10em` on each side of the dot. Render the span in payment-panel markup to preserve its DOM comparison and stable clickable rows.

Payment dot labels must be a single `.nd-payment-label` inline group; never expose the dot as a direct flex child of page titles or overview rows. The dot inherits the label font/size/weight/color. Regression checks must measure rendered gaps beside the dot, including desktop overview lists, rather than only computed margins.

Desktop rail headers share caption top 30px and title top 50px relative to the page header. Right header captions use `--nd-header-caption-line:13px`, with `--nd-header-title-gap:7px`. All detail tabs use `--nd-section-underline-color:var(--nd-blue)` for the selected underline; text state colors stay separate. Verify rendered title positions across every destination, not just font sizes.

Desktop quote/purchase metadata aligns vertically with the left search field center using `--nd-header-meta-center` (anchored to the header, independent of title/amount flow; the row starts at the header's own left edge, never adding the panel inset twice). Quote progress steps center between the detail-tab divider and their lower divider using `--nd-progress-body-inset` and `--nd-progress-strip-height`. Check actual bounding-box centers without moving other body sections.

Header alignment applies to BOTH title and numeric sides: amount/quantity captions at y30, values at y50, with the same caption-line/title-gap tokens. The caption→value spacing comes only from the column `gap` (`--nd-header-title-gap`); never also give the caption a bottom margin, or the value drops below the title. Check quotes, purchases, companies, payments, supplied materials, sales and receivables at desktop breakpoints (`ui-contract.test.mjs` measures them).

## Quotation progress and supplied-material actions

Progress sections reuse `.qt-sec-t` and its existing count role. Each heading owns
an independent accessible disclosure; its summary and action pair stay visible
when collapsed. Editing is the left action, adding/recording is the right action.
Record actions use `.nd-record-action`: 84px wide, 30px tall on desktop, 44px tall
on mobile, with the same neutral styling as item Edit. Supplied-material statement
and entry actions reuse this geometry; quantity steppers keep their existing role.
Tables use horizontal rules, matching header/value alignment for numeric columns.
Balance labels use the supporting-label token rather than the grand-total role.

Each partial delivery may carry optional `shipping` metadata (`method`, `carrier`,
`tracking`). Existing records remain unchanged; corrections void the original and
append a replacement, preserving the audit trail and existing stock reconciliation.
Carrier lookup uses an explicit HTTPS carrier URL map. No automatic shipping or
invoice service integration is implied by recording these details.

Desktop quotation progress table dividers match item detail: header 1.5px solid #D4D4D8 (dark: --nd-line), rows 1px solid --ws-line. Mobile retains its existing 1px --nd-line-2 rules. Do not draw a second border above payment totals. Disclosure headings have no arrow; keep native button semantics, aria-expanded/aria-controls, click, Enter and Space behavior. Verify rendered rules against item rows in desktop/mobile and light/dark.

Quotation and purchase item summaries must not add a second top border after the item table. Keep the item row divider and the full-width separator before the grand total; `.qtotals` itself has no top border. Verify both forms at mobile and desktop sizes in light and dark themes.

Parcel carrier choices and tracking links share one explicit HTTPS map (CJ, post, Hanjin, Logen, Lotte, Kyungdong). Input previews and saved records use the same URL builder, strip spaces/hyphens, and only enable lookup for 8–30 digits. Lookup opens the carrier site without saving a delivery or changing stock.

## Dashboard shortcuts into lists

Every dashboard row that summarises a list is a shortcut into that list and ends with the
shared chevron (`›`); hover uses `--nd-tint-hover`. Progress stages (작성·발송 / 수주 / 납품 /
입금) open 견적서 filtered to that stage. Because a stage is not always one status tab
(작성·발송 spans two; 입금 is derived from payments), the list shows a 44px `.nd-stage-bar`
above the rows — "견적 진행 · <stage> (<hint>) N건" with a `✕ 해제` pill — and the status tab
underline is neutralised while it is on (`.quote-list-card.nd-stage-on`). The bar stays on one
line: the hint truncates with an ellipsis first, the stage name and count never wrap. `✕ 해제`
or choosing a status tab removes the filter and the bar; search narrows within it. Verify at 390 and 1440.
The bar reads "<stage> 단계만 보는 중 · N건 <hint>" with a `전체 보기` button, the title count shows
`N / 전체건`, and rows outside the stage are really hidden (`.list-item[hidden]` beats the row's flex
display). When no quote is in the stage the list says so ("지금 <stage> 단계인 견적이 없어요.").

## Option columns (색상 · 규격/옵션)

Colour and spec/option are short codes (BK, XL, FREE) and are centred in every table — the
header and the value share one centre line. Tables mark them by header text through
`optionCols()` (adds `.nd-opt-col` to the header and its cells; print tables are marked again
right before `print()`). In quote and purchase item rows the selects/inputs use equal 8px side
padding so the text centre is the column centre (no hidden arrow gap). A line without colours
(작업 · 직접 입력) puts its spec field in the spec half, under the 규격/옵션 header, never across
both columns. Quantity is centred (header and value), like the printed quote; unit price and
amount stay right-aligned. Phone item cards are not tables and keep their own layout.

## Phone item cards (견적서 · 매입)

A phone item card reads like one table row folded into two lines. Line 1: item name + gray item
code on the left, the line amount (bold) on the right. Line 2: colour · spec on the left,
`수량 × 단가` on the right (view mode) or `단가 / 단위` (edit mode, where the stepper shows the
quantity). Only while editing does a third line appear: quantity stepper on the left and
`편집 ›` on the right. Work lines use the same two lines. Cards are separated by a straight
full-width rule with 14px vertical padding.

## Payments (입금·출금)

Definition: 입금·출금 is the record of money that actually moved. Quotes and purchases create
money owed (받을 돈 / 줄 돈); a payment settles it, and linking it to the quote or purchase is what
lowers 받을 금액 / 미출금. Cash flow is 입금 − 출금, not sales + purchases.

- Words: 입금 · 출금 · 차액 (입금 − 출금). No "+" on the net; a negative net shows − in red.
  Inside a quote, the unpaid part is 남은 금액 (never 차액).
- Left panel: title with the count beside it (same place as 견적서), search · filter · ＋, kind tabs
  [전체 | 입금 | 출금], then rows grouped by date ("10월 13일 (화)"). Row = company | signed amount
  (입금 green +, 출금 −) / kind badge · quote or purchase no (or memo) · method. No permanent
  period/count/reset row and no summary row inside the list: a period chip with ✕ appears only when
  the period is not this month.
- Right panel, nothing selected: header 입출금 현황 · period · 차액. Body: three numbers on one line
  (입금 · 출금 · 차액) with one ratio bar, then shortcuts 아직 못 받은 돈 (→ 받을 금액, same as arData)
  and 아직 안 준 돈 (→ 매입, same as the purchase list's 미출금), then the period table
  (날짜 · 거래처·연결 · 방법 · 입금 · 출금). The method column hides at ≤1200px.
- Right panel, record selected: header 입금/출금/환불 · company · amount; meta = document link · date ·
  method · state chip (일부 입금 / 다 받음). Body: 받을 돈 progress for a linked quote, the records of
  that quote/purchase (or this company in the period) with the current row in soft blue, memo ·
  company · record date.
- Bottom bar matches the quote bar: left secondary ([⋮] with 이 기록 삭제, 고치기 / 내보내기),
  right one blue primary (남은 N원 입금 기록 when a linked quote still has money left, else
  ＋ 입금·출금 기록).
- 고치기 = save the new record first, then remove the original (storage accepts append and delete,
  not edits — same as quote progress). The entry shows "고치는 중 …" while editing.
- Entry: choosing a company with open quotes shows them as choices with their remaining amount;
  choosing one fills the amount. Order is 거래처 → 어느 건 → 금액 → 날짜 → 방법 → 메모. While the
  entry is open the old summary cards are hidden and the header reads 새 입금 기록 / 입금 기록 고치기.

## Purchases follow quotes

The purchase detail uses the quote anatomy everywhere: same header (매입처 · amount; meta row
`번호 날짜 [상태]` with no dot separators), same tabs, and the 진행 tab uses the quote progress list
(`.nd-record-section.nd-pl`): heading = name + summary (amber "N 남음") + one outline action on the
right, then a table with a header rule and one-line records (날짜 · 내용 · 수량/금액 · ⋯). Sections are
입고 · 출금 · 반품 · 계산서. No boxed cards or progress bars inside the tab; the step row above keeps the
one blue next action. Header number buttons keep text height on phones (the hit area grows with a
pseudo-element) so the meta row never pushes outside the header.
The header amount never wraps or clips: the hero grid is `minmax(0,1fr) auto`, the amount keeps
its full width on one line, and a long company name shortens with an ellipsis instead (phones
included — e.g. 2,216,500원 with a 20-character company name at 390px).

## Corrected records and document links

Lists that show delivery history use only live deliveries (`!void_at`). A corrected delivery keeps its
original as a voided record for the audit trail; showing it would repeat the same delivery once per
correction. Wherever a record names its document (견적 번호 · 매입 번호), that number is a blue link that
opens the document — e.g. 거래처 › 최근 입금 → 견적서, 최근 출금 → 매입 — the same action as
'견적서 열기 ›'.

## Header third line

Every right-panel detail header has the same three lines: eyebrow (caption) · title · third line
(document no · date · state chip, or the screen's equivalent — contact · type, period, kind count).
The third line is 22px tall and its centre sits at the quote's position: on PC 111px from the header
top (`--nd-header-meta-center`, 20px under the title), on phones 12px under the title (centre 53px
from the title top). Links and chips in it keep text height (no 44px button boxes). Applies to
견적서 · 매입 · 입금·출금 · 거래처 · 업체 제공 자재 · 매출 집계, and every new header. A ui-contract test
measures it at 1440 and 390.

## Receivables (받을 금액)
- 받을 금액 = 납품한 금액 − 받은 금액(입금). 수주만 하고 납품하지 않은 금액은 '납품 전 금액'으로 따로 보이고 더하지 않는다. 화면 글은 '받을 금액 · 입금'만 쓴다(수금·미수 금지).
- 얼마나 오래 = 가장 오래된 미입금 납품부터 오늘까지의 날수. 받은 돈은 견적마다 오래된 납품부터 채운다. 기준은 30일 · 60일: 30일 안 = 칩 없음, 31–60일 = 주황 칩, 61일 넘음 = 빨강 칩(`.ap-age.ap-mid` / `.ap-old`). 다른 기준을 화면마다 따로 두지 않는다.
- 왼쪽: 제목 옆 'N곳' · [검색][필터] · [거래처 | 견적] 탭 · 오래된 순 목록(이름 · 받을 금액 · 칩 · 견적 수 · 마지막 입금). 필터는 '받을 돈 있는 곳만 / 다 받은 곳도 보기'.
- 오른쪽 요약: 머리 '받을 금액 현황 / 오늘 기준 / 받을 금액 · 납품 − 입금'. 숫자 셋(받을 금액 · 납품 전 금액 · 계산서 미발행), 얼마나 오래 막대(파랑 · 주황 · 빨강) + 범례, 거래처별 표(오래된 순). 아래 바 [내보내기] … [＋ 입금 기록].
- 거래처 상세: 머리 '거래처 / 이름 / 받을 금액', 셋째 줄 '견적 N건 · 가장 오래된 납품 N일 전 · 마지막 입금'. 본문 = '납품 X원 중 Y원 받음' 막대 → 받을 돈이 남은 견적 표(견적번호는 견적서로 가는 링크) → 최근 입금 3건. 아래 바 [거래처 보기 ›] … [입금 기록 · Q-…부터].
- 입금 기록 버튼은 입금·출금 화면의 입력 창을 열고 거래처 · 견적(견적 탭에서 고른 것, 없으면 가장 오래된 것) · 그 견적의 남은 금액(쉼표 포함)을 채운다. 받을 금액 화면은 아무것도 저장하지 않는다.
- 모양은 입금·출금 부품(`.pp-*`)을 그대로 쓴다 — payment-panel.css의 규칙은 `:is(#view-payments,#view-ar)`로 두 화면에 함께 걸고, 입력 창 전용 규칙만 입금·출금에 남긴다. 받을 금액 전용 모양은 ar-panel.css(칩 · 막대)만.
- 폰: 요약 줄(받을 금액 · 막대 · 30일 안 / 30일 넘음) → [거래처 | 견적] 탭 → 목록, 누르면 상세. 좁은 폭(≤1200px)에선 납품액 · 받음 칸을 숨기고 남은 금액 · 경과는 늘 보인다.
- 입금 입력 창의 '어느 건의 돈인가요?' 견적 고르기도 같은 기준을 쓴다. 굵은 금액 = 받을 금액(납품액 − 받은 돈), 그 아래에 기준을 적는다: 견적 남은 금액과 다르면 '받을 금액 · 견적 남은 N원', 같으면 '받을 금액', 아직 납품 전이면 견적 남은 금액을 굵게 쓰고 '견적 남은 · 납품 전'(선입금). 견적을 누르면 금액 칸에 굵은 금액이 쉼표와 함께 들어간다.

## Sales (매출 집계)
- 입금·출금 · 받을 금액과 같은 짜임이다. 왼쪽 = 제목 옆 개수('N곳' · 'N종') · [검색][필터] · [거래처별 | 품목별 | 카테고리별] 탭 · 목록(맨 위 '전체'). 따로 된 개수 줄은 두지 않는다.
- 오른쪽 머리: '매출 현황 / 전체 거래처' 또는 '거래처 / 이름', 오른쪽 '판매 금액 · 부가세 포함'. 셋째 줄은 기간 정보만(기간 · 견적일 기준 · 상태 · 고른 거래처). 검색·정렬은 머리에 두지 않는다.
- 요약 숫자 셋: 예상 마진(아래 작은 글씨 '마진율 N%', 원가 미등록이면 '—' · '원가 미등록') · 수량 합계 · 개수(전체일 때) 또는 전체 매출 비중(하나를 골랐을 때).
- 표 머리 줄: 왼쪽 제목 + 작은 개수, 오른쪽 [검색][정렬]. 표는 견적서 품목 표와 같은 선(머리 1.5px · 줄 1px)이고 머리 바탕색은 없다.
- 아래 바: [내보내기] … 거래처를 골랐으면 [거래처 보기 ›], 품목을 골랐으면 [품목 보기 ›]. PC는 오른쪽 패널 맨 아래에 붙는다.
- 폰 목록 맨 위에 요약 줄(판매 금액 · 예상 마진 · 수량)을 두고, 누르면 전체 현황을 연다.
- 요약 숫자 칸 안에서는 `span`을 숫자에 쓰지 않는다(ui-contract의 캡션 규칙이 `.nd-sa-kpis span`을 작은 글씨로 만든다).

## Information groups (정보 칸 묶음)
- 견적서 정보 탭 · 매입 정보 탭 · 품목 · 거래처 정보 · 공급자 정보는 모두 같은 모양이다: 왼쪽 = 묶음 이름 + 한 줄 설명('어디에 나오는지'), 오른쪽 = 칸. 칸은 회색 바탕 · 테두리 없음, 두 칸씩 한 줄(폰은 한 줄에 하나), 긴 칸(주소 · 비고 · 카테고리)은 한 줄 전체.
- 견적서: 기본 정보(거래처 → 견적일자 · 유효기간, '견적서에 나와요') / 비고('견적서 아래에 나와요') / 관리(상태 직접 바꾸기 · 변경 기록, '보통은 진행 탭에서 바뀌어요'). 부가세는 품목 줄마다 정하므로 정보 탭에 없다.
- 매입: 기본 정보(매입처 → 매입일 · 부가세, '매입 장부에 남아요') / 비고('나만 보는 메모예요') / 관리(변경 기록).
- 품목: 기본 정보(품명 · 코드 · 출력 이름 미리보기 · 유형 · 단위 · 카테고리) / 가격(매입단가 · 매출단가 · 1개당 마진) / 옵션(색상 · 규격/옵션 표 · 기본 규격) — 세트는 '구성품' / 사진 · 메모 / 관리(변경 기록). 머리 오른쪽 = 매출단가(세트가 비어 있으면 구성 합계), 셋째 줄 = 코드 · 유형 · 카테고리 · 옵션 수.
- 기본 앱이 그린 칸을 옮기기만 한다(info-groups.js) — id · 이벤트 · 저장 값은 그대로. 옮길 곳을 모르는 칸은 버리지 않고 옵션(구성품) 묶음 끝에 둔다.
- '변경 기록 보기'는 늘 관리 묶음 맨 아래, 창 제목은 '이 견적서/매입/품목/거래처의 변경 기록'(NaroChangeLog.open의 noun).
- 매입 비고는 치는 동안 [저장]이 켜지고, 바로 [저장]을 눌러도 한 번에 저장된다.

## Purchase loading (매입 열기 속도)
- 매입 파일은 업무 화면이 뜬 뒤 쉬는 틈에 한 번 미리 읽는다(purchase-ui `warm`, 매입 권한이 있을 때만). [매입]을 누를 때 네트워크를 기다리지 않는다. 미리 읽기가 실패하면 조용히 넘기고 화면을 열 때 다시 읽는다.
- 읽기는 Dropbox 내려받기 1회: 응답 머리 Dropbox-API-Result(내려받은 그 판의 metadata)로 식별 정보를 만든다. 머리를 못 읽으면 예전 3단계(식별 → 내려받기 → 식별 비교)로 읽는다. 읽은 뒤 다른 기기가 바꾸면 저장 때 판 번호 확인으로 막힌다.
- 화면을 그리기 전에 읽기 요청을 먼저 보낸다(기다리는 동안 그린다).

## Wording (화면 글자)
- 기록을 바꾸는 동작은 '수정'(고치기 쓰지 않음): 버튼·메뉴 '수정', 창 제목 '입금 수정 · 납품 기록 수정 · 자재 기록 수정 · ○○ 기록 수정', 확인 버튼 '○원으로 수정 · ○개로 수정', 안내 '수정 중 · 수정하거나 삭제할 수 없어요'.
- 글자 버튼·링크에는 기호를 붙이지 않는다: '＋ 입금·출금 기록' → '입금·출금 기록', '매입 열기 ›' → '매입 열기'. glyphTidy가 그리는 더하기(.nd-gi-plus)도 글자 버튼에서는 숨긴다. 글자 없는 [+] 아이콘 버튼(#itNewBtn · nd-tadd)은 그대로.
- '누를 수 있음' 표시(대시보드 숫자 옆 꺾쇠 · 목록 줄 끝 꺾쇠 · 뒤로 가기 ‹)는 글자가 아니라 남겨 둔다.
- 공급자 주소는 한 칸에 저장하지만 화면에서는 '기본주소 | 상세주소'로 나눠 보인다(도로명+건물번호 / 지번까지가 기본주소). 저장할 때 한 번만 합친다.
- 업무 용어로 쓴다(10/16 문구 점검 확정): 받을 금액 · 지급할 금액 · 미수 견적/거래처 · 입금과 출금 · 연결할 견적 · 입금 완료 · 출금 완료 · 초과 입금/지급 · 경과일 · 변경자·일시·변경 내용. '돈 · 다 받음 · 다 줌'은 쓰지 않는다. 남은 곳까지 정리(10/17): 미리 받은 돈 → 선입금, 받은 돈 → 입금액, 보낸 돈 → 출금액, 다 받았어요/다 줬어요 → 입금 완료/출금 완료.
- 정보 묶음 설명은 짧은 명사형: 견적서 표시 · 견적서 하단 표시 · 견적서·거래명세서 표시 · 견적서 발송용 · 매입 장부 기록 · 내부 메모(출력 안 됨) · 옵션 단가 미입력 시 적용 · 진행 탭에서 자동 변경 · 취소·복원 시에만 사용. 관리 묶음은 설명 없음.
- 기록 없애기는 '삭제'(지우기 쓰지 않음). 검색창의 '검색어 지우기'와 사이즈별 수량 칸 비우기('초기화')는 기록 삭제가 아니라 그대로/초기화.
- 고르기는 '선택해 주세요'. 안내 문장 말투(해요체)는 앱 전체 그대로.

## Purchase entry rows (매입 입고 · 반품 줄)
- 견적서 진행 탭의 납품 줄과 같은 부품(.nd-pl-dl): 날짜 · 품목(첫 품목 [코드] 외 N건) · 상태(입고 완료 / 마무리 필요, 반품은 사유) · 수량 · [⋯]. 줄을 누르면(또는 Enter) 품목 · 옵션 · 수량이 펼쳐진다. 취소된 입고는 흐리게, 펼치지 않는다.

## Import purchase paste (수입 매입 붙여넣기)
- 영수증 앱과 같은 방식: 앱은 파일을 밖으로 보내지 않는다. 매입 [+] → '수입 매입 붙여넣기' → ① 프롬프트 복사(import-paste.mjs `IMPORT_PROMPT`, 형식 고정 — 숫자 쉼표 없이, 모르면 '없음') ② AI 답 붙여넣기 ③ 확인 → [매입 만들기]. 입고는 물건이 오면 따로.
- 확인 창: 매입처(이름이 같은 매입 거래처, 없으면 '새로 등록') · 필증 품명 ↔ 등록 품목·옵션 짝 · 청구서 항목 ↔ 앱 구분(운임·보험·관세·통관수수료·국내운송·기타 / 수입부가세 / 넣지 않음) · 청구서 낸 곳 · 검사 줄(✓ 맞음 / 주황 경고 / 빨강 막음).
- 막는 것: 품목 표·통화·과세환율을 못 읽음, 수량이 정수가 아님, 필증과 청구서 B/L이 다름(기호 무시 비교), 품목 짝·매입처·낸 곳 미선택, 같은 신고번호로 이미 만든 매입. 경고만: 합계 불일치, 수량×단가≠금액, 청구서 관세 ≠ 필증 관세(원가는 필증 기준).
- 10/17 결정: ① 수입 정보(수입신고번호 · B/L · 인도조건 · 결제방법 · 신고일 · 수리일)를 매입에 저장(정보 탭 '수입 정보' 묶음) ② 매입 환율 기본 = 필증 과세 환율 ③ 부대비용은 금액 비율로 나눔 ④ 관세는 필증 값 ⑤ 품명 짝은 매입처별로 기억 — 따로 저장하지 않고 지난 수입 매입 줄의 src_name에서 읽는다.
- 수입부가세와 수수료 부가세는 원가에 넣지 않는다(공제). 대신 낸 곳(운송사·관세사)의 지급할 금액에는 더한다.
- 외화 매입 화면: 머리 금액 '금액 (CNY)' + 번호 줄 오른쪽 '원화 · 환율'. 품목 단가·금액은 소수 둘째 자리. 합계 칸은 합계(외화) · 원화 환산 · 부대비용 · 도착원가(부가세 줄 없음). 진행 줄은 발주 · 입고 · 출금(외화) · 부대비용(남은 원화) · 계산서 — 좁은 줄이라 정수 외화는 소수점 없이.
- 진행 탭(외화): 입고 · 출금(받는 곳 · 방법, 외화 아래 실제 원화) · 부대비용([비용 추가] — 더하기만) · 개당 원가 · 반품 · 계산서. 출금 창은 받는 곳을 고른다: 매입처(외화 + 실제 보낸 원화 → 송금 환율·환차) 또는 낸 곳(원화).
- 관세·수입부가세는 청구서에 그 항목이 있을 때만 운송사·관세사에 갚을 돈으로 잡는다. 없으면 세관에 직접 낸 것(관세 비용에 낸 곳 없음, 수입부가세 direct:true).
- 표 안의 합계 줄 · 프롬프트 자리 표시 줄은 품목·청구 항목으로 넣지 않는다. 원화금액이 빈 청구서 항목은 막는다('넣지 않음'으로 바꾸면 통과).
- 매입 삭제의 돌려받음은 받은 곳별 원화로 따로 기록한다(입출금은 저장 1번에 1건). 매입 취소의 돌려받음은 매입처 몫만.
- 입금·출금 화면에서 매입에 연결된 출금을 수정해도 연결 · 외화 금액 · 환불 표시가 그대로 옮겨진다. 운송사·관세사 거래처 화면에는 그 매입의 '부대비용' 줄, '아직 안 준 돈'에는 그 몫(원화)이 들어간다.

### 확인 칸 부품(10/17 시안 2 확정)
- 기본 선택 상자(화살표)를 쓰지 않는다. 매입처·청구서 낸 곳 = 거래처 고르기 창 모양(맨 위 '새로 등록 · 문서 이름'), 품목 = 품목 고르기 창 모양(품명·코드 검색, 맨 아래 '새 품목으로 등록 · 필증 품명'). 창이 모달이라 고르기 창도 창 안에 띄운다.
- 새 품목 등록 칸: 품명(필증 품명이 먼저) · 코드 · 단위 · 색상 · 사이즈(쉼표로 구분). 저장하면 바로 골라진다. 판매가·사진·메모는 품목 화면에서.
- 옵션이 둘 이상인 품목은 색상 칩 + 사이즈별 수량 칸(옵션별 한번에와 같은 칸). 합계가 필증 수량과 다르면 막는다('200개 중 180개 · 20개 남음'). 사이즈마다 매입 품목 한 줄(같은 단가, 같은 필증 품명).
- 기억: 품목·색상은 매입처별(사이즈 수량은 기억하지 않음), 청구서 구분은 낸 곳별(매입의 invoice_map). 구분 표시는 '자동 / 기억 / 바꿈 · 기억', 누르면 메뉴로 바꾼다.
- 사전 보강: CURRENCY ADJUSTMENT · BUNKER · FUEL · LSS · PSS · TERMINAL HANDLING → 운임, CLEARANCE → 통관수수료.

## Quote done badge (견적 '완료')
- 납품 + 계산서 발행(또는 발행 안 함) + 입금 완료(환불 뺀 순입금 ≥ 견적 금액)면 목록 배지를 회색 테두리 '완료'(st-complete)로. 저장되는 상태는 그대로 '납품'.
- 칩에 '완료'를 더한다. '납품' 칩은 아직 끝나지 않은 납품만, '완료' 칩은 끝난 것만. 매입의 '완료'도 같은 회색 테두리.
- 할 일이 남았을 때만 눈에 띄게: '계산서 미발행'(주황 글자)은 그대로, 발행한 건 따로 배지를 달지 않는다.

## Purchase read waits for the storage lane (매입 읽기 대기)
- 저장소 통로는 한 번에 하나. 매입 읽기·저장은 다른 일(저장·시작 때 정리·사진)이 끝나길 최대 30초 기다렸다가 처리한다(전엔 바로 BUSY로 거절해 새로고침 직후 '매입을 불러오지 못했어요'가 떴다).
- 화면은 BUSY면 오류 대신 '불러오는 중'인 채로 몇 번 더 묻는다. 백업 합치기 중 매입 요청은 버리지 않고 바로 BUSY로 답한다.

## Dashboard tax tile (대시보드 '계산서' 칸)
- 한 칸에 '미발행 N · 미수취 M'(할 일이 있는 숫자만 주황). 미발행 = 납품했는데 우리가 안 낸 계산서(견적), 미수취 = 입고했는데 아직 안 받은 계산서(매입 — 수입은 세관 수입세금계산서, 줄에 '수입' 표시).
- 칸을 누르면 아래 목록 위에 [미발행 | 미수취] 구분 버튼. 처음엔 할 일이 있는 쪽. 미수취 줄을 누르면 그 매입의 진행 탭이 열린다(계산서 [받음 기록]).
- 매입 권한이 없으면 예전처럼 '계산서 미발행 N건'만. 매입 파일을 읽기 전이면 '미수취 …', 읽으면 대시보드를 다시 그린다.
- 대시보드 '최근 견적' 배지도 목록과 같이 끝난 견적은 '완료'.

### 붙여넣기 창 다듬기(10/17)
- 작성 중(붙여 넣은 글이 있음)이면 창 바깥 누름·Esc로 닫지 않고 '작성 중인 내용이 있어요 [계속 작성] [임시 저장하고 닫기]'. [닫기]를 눌러도 임시 저장한다. 다시 열면 맨 위에 '임시 저장한 붙여넣기가 있어요 · 신고번호 … [새로 시작] [이어서 하기]'. 임시 저장은 이 기기에서 앱을 다시 열기 전까지(매입을 만들면 지운다).
- 좌우 여백은 같게(PC 28px · 폰 18px). 단계는 번호와 제목을 한 줄에 두고 내용은 창 폭 전체로.
- 매입처·청구서 낸 곳은 '이름표 + 고르기 버튼' 한 줄, 문서 정보는 회색 칸 3개. 긴 이름은 한 줄로 줄이고(말줄임) '새로 등록' 표시는 줄이지 않는다. 고르기 창의 '새로 등록 · 이름'도 한 줄.
- 청구서 구분은 글자 없이 구분만(자동), 기억한 것은 '기억', 바꾼 것은 '바꿈'. 표 위에 한 줄 안내.
- 선적 서류·현지 처리 비용(DOCUMENT · D/O · HANDLING · CFS · WHARFAGE · CONTAINER 등)은 운임으로 자동 분류(원가 나누기는 구분과 상관없이 금액 비율로 같다). '기타'는 은행 수수료처럼 진짜 다른 것만.

## Button text centering (버튼 글자 가운데)
- 글자 버튼은 글자가 버튼의 가로·세로 가운데(측정 오차 1.5px 안). 고정 높이 버튼은 display:block + padding으로 맞추지 말고 inline-flex + align-items/justify-content:center.
- 새 버튼을 만들면 Playwright로 글자 상자와 버튼 상자의 가운데를 비교한다(scratch btnscan과 같은 방식). 메뉴 항목·목록 줄처럼 왼쪽 정렬이 원래 모양인 것은 제외.

## Sales tables follow quote tables (매출 집계 표)
- 매출 집계 표도 견적서 표 규칙: 머리 12px/500 회색(모든 칸 같게), 수량 13px, 합계 줄 13px/600, 판매 금액만 14px/600, 모든 칸은 구분선 사이 세로 가운데.
- 공통 '금액' 글자 규칙(ui-contract 'List and ledger money')에 칸 전체 클래스(.nd-sa-n처럼 머리·수량까지 붙는 것)를 넣지 않는다 — 금액 글자(.nd-sa-sale)만.

## Purchase forms reuse quote behavior (매입 = 견적서 동작)
- 매입 화면은 견적서 양식을 따로 그리므로, 견적서에 동작을 고치면 매입(purchase-ui.mjs)에도 같은 동작을 넣는다. 예: 옵션별 한번에 Tab = 옆 옵션 수량(단가 건너뜀), 마지막 → [품목에 넣기].

## Quote supplier address (견적서 공급자 주소)
- 주소는 기본주소 / 상세주소 두 줄(공급자 정보의 나눔과 같은 naroSplitAddress). 공급자 칸은 가장 긴 줄이 들어가는 만큼 넓히되(최소 316 · 최대 420px), 왼쪽 거래처 이름과 24px 이상 떨어지게. 인쇄(HTML)와 이미지(캔버스) 모두.

## Chart scroll arrows (그래프 이전·다음 화살표)
- 대시보드 매출·입금 현황의 이전·다음은 글자(‹ ›)가 아니라 선 모양 SVG(14×40, 선 굵기 1.75 — 다른 선 아이콘과 같은 굵기), 누르는 곳 32×72. 채운 도형은 쓰지 않는다(다른 아이콘이 모두 선이라 혼자 튄다).

## Purchases never block on deleted companies/items (매입 ↔ 거래처·품목 삭제)
- 매입은 별도 파일이라 거래처·품목 삭제 검사에서 빠지기 쉽다. 삭제 전 연결 검사에 '매입 N건'을 넣고, 매입이 쓰면 숨김만(목록·고르기에서 빼기). 저장소도 진행 중 매입이 쓰는 거래처·품목을 목록에서 빼는 저장을 막는다(PURCHASE_REF).
- 읽을 때는 지워진 거래처·품목이 있어도 매입 파일 전체를 막지 않는다 — 화면에 (삭제된 거래처)/(삭제된 품목)으로 표시. 고쳐 저장하는 매입만 엄격하게 검사.
- 매입을 못 읽으면 오류 코드를 쉬운 말로 보여 준다('잠시 뒤 다시'만 보여 주지 않는다).

## Material ledger rows (업체 제공 자재 기록 줄)
- 기록 표: 날짜(연.월.일 '2026.10.12' — 견적서·입금과 같은 숫자 날짜, 월 머리 없음. 10/17 사용자 선택 시안 D) | 구분 | 자재 · 출처(자재 이름 오른쪽에 회색으로 붙임) | 메모 | 수량 | ⋮. 숫자(수량)는 줄 오른쪽 끝 규칙 그대로 — 메모는 수량 앞 칸. 폰은 메모를 셋째 줄.
- 기록 줄을 누르면 바로 수정 창(취소된 기록 제외). ⋮에는 수정·기록 취소.
- 자재 이름 바꾸기: 자재 탭 ⋮ → 이름 바꾸기. 한 업체의 같은 이름 기록(취소된 것 제외)을 한 번에 저장(저장 규칙이 이름만 바뀐 여러 줄을 허용), 그 업체 견적의 '쓰는 자재' 이름도 함께. 이미 있는 이름이면 합쳐진다고 미리 알린다.

## Auto order confirmation (자동 수주)
- 작성중·발송 견적에 입금(받은 돈)·계산서 발행·납품 기록이 '새로' 생기면 저장이 끝난 뒤 따로 한 번 저장해 수주로 바꾼다(quote-actions.js, saveTable 감싸기). 알림에 [되돌리기].
- 이미 근거가 있던 견적(일부러 발송으로 되돌린 것)은 다시 바꾸지 않는다. 취소된 견적은 바꾸지 않고 알리기만. 수주·납품은 그대로.

## Stock screen (재고, 10/17 시안 A)
- 견적서·매입·업체 제공 자재와 같은 틀: 오른쪽 머리(품목명 · 현재 수량, 아래 출고 예정·가용) → 탭 [옵션 · 기록 · 정보] → 아래 줄 [최소 기준][재고 조정] … [출고 기록][입고 기록]. 아무것도 안 골랐을 때 = 전체 현황(숫자 4개 + 확인할 옵션).
- 사이즈 = 색상 × 사이즈 숫자표: 상자·배경 없이 숫자와 가는 선, 품절 빨강 · 미달/부족 주황 글자만. 칸을 누르면 그 옵션 기록(기록 탭, 옵션 칩).
- 표 안 입력칸 없음: 최소 기준은 [최소 기준] 창에서, 입고·출고·조정은 원래 입력 폼을 PC에서 가운데 창으로(아래 버튼으로 열었을 때만).
- 기록 날짜는 2026.10.12, 출처(매입·납품 번호)는 옵션 오른쪽, 메모 칸, 수량 맨 오른쪽. 코드는 stock-panel.js — 계산·저장은 원래 함수 그대로.

## Stock entry sheet (재고 입력 창, 10/17)
- 납품 처리·입금 받기 창과 같은 모양: 머리 = '입고 기록/출고 기록/재고 조정' + 품목 · 코드 [바꾸기](품목 선택칸은 바꾸기를 눌렀을 때만), 입고/출고/조정 = 회색 바탕 칸 고르기, 앱 파랑(초록·빨강 버튼 없음).
- 사이즈 표 = 현재 / 입력 / 변경 후(조정은 장부 / 실제 / 차이) 작은 세 줄, 바뀐 칸만 색(늘면 파랑 · 줄면 빨강). 합계 칸 대신 버튼 위 한 줄 요약, 버튼에 결과('18개 입고 기록', '2개 사이즈 −3 조정').
- 창 폭은 사이즈 수로: 7개까지 560 · 10개까지 720 · 그 이상 760에서 표만 옆으로(왼쪽 글자 칸 고정). 폰은 세로 줄 + [− +]. 재고 화면 사이즈 표도 칸이 좁아지면 옆으로 넘기고 색상 칸 고정.
- (10/17 2차) 입고·출고·조정은 어디서 열든(아래 줄 · 왼쪽 머리 버튼 · 메뉴) PC 가운데 창. 재고 화면 왼쪽 머리 버튼은 [+] 대신 ⇅(입고·출고·조정) — 누르면 메뉴 없이 바로 입력 창.
- 색상·규격이 하나뿐이면 고르는 칸을 숨기고 머리 줄에 적는다. 옵션 하나뿐인 품목은 수량 · 날짜 한 줄 + 수량 아래 '현재 N개 → M개'(조정: 장부 → 실제 · 차이).
- 사이즈 표 줄 이름(현재·입고·변경 후)은 같은 크기 13px, 입력 줄만 굵게. 글자색은 회색 2단계(ink-2) — 너무 흐리지 않게.
- 입력 창 칸 줄맞춤: 나란한 칸(수량·일자, 색상·일자)은 이름 위치와 칸 높이(40px)를 똑같이. 날짜 칸 감싸개에 높이·여백을 따로 주지 말 것.
- (10/17 4차) 입력 창 순서 = 무엇을 먼저: 머리 제목은 품목명(아래 줄 코드 · 하나뿐인 색상), 그다음 입고·출고·조정 탭 → 색상 → 수량/사이즈 표 → 일자 · 메모 한 줄. 아래쪽 옛 [입고][출고] 구분 칸은 탭과 겹치므로 늘 숨김.
- 구분 버튼(입고·출고·입금·출금·조정·불량)을 고르면 옅게 물든다: 그 색 12% 바탕 · 45% 테두리 · 진한 글자. 짙게 채우지 않는다.
