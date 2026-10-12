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
| Page title | 24px / 30px, 700 | 22px / 28px, 700 | `--nd-ink` |
| Record title and primary header amount | 24px / 30px, 700 | 19px / 26.6px, 700 | `--nd-ink` |
| KPI/summary total | 20px / 24px, 600 | same | `--nd-ink` |
| Section heading | 14px / 22px, 600 | same | `--nd-ink` |
| Record name and record amount | 14px / 20px, 600 | same | existing semantic text color |
| Supporting label/header metadata | 12px / 18px, 400 | same | `--nd-ink-2` |
| Muted list metadata | 12px / 18px, 400 | same | `--nd-ink-3` |
| Rail text | 14px / 20px, 500 (selected 600) | same | rail state colors |
| Utility dialog title | 22px / 28px, 700 | same | `--nd-ink` |
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
