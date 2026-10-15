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
