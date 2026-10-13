# v1.187 — approved payment ledger

Preserves the NARO rail / list / detail shell. The approved refined mockup is implemented against existing payment records, not fixture values.

- List: all/in/out tabs, shared search typography, period/count/reset, counterparty and unsigned amount on one line.
- Detail: selected counterparty's period-wide incoming and outgoing records; neutral dashboard numeric tokens; two totals with transaction count in the section heading; date groups and expandable document/memo details.
- Mobile: one list and one detail, back navigation, no duplicated summary. The existing add form and confirmed delete handler remain authoritative.
- Filter: existing native inputs and quick periods retained, start/end dates exposed directly, close button, no empty recovery panel.
- No financial data migrations, OAuth, storage, rules, Functions or Hosting configuration changes.

Verification:

- 293 unified-storage tests pass; payment suite rerun after final edits (12 pass).
- Navigation, company-address and legacy release checks pass. Materials, quote-workflow, stock-planning and sales-insight pass with browser bootstrap disabled in the test harness (the old harness otherwise calls guarded init without location). No production bootstrap changed.
- All 11 inline candidate scripts parse. Candidate manifest validates all 74 files.
- Local synthetic browser checks at 1440, 390 and 320 px: overview totals, selected counterparty history, list/detail/back, filter open/close, custom start date, empty results, reset, original add form. No horizontal overflow at 320 px.
- Physical iPhone Safari is not tested. Browser checks use an in-memory fixture, never production business-data writes.

Deployment preflight: only `erp/index.html` differs from live version `f229dca12db8b6db`. App display version is v1.187. Changed presentation is inline; no external asset URL changed. This hosted build disables service workers via CSP and serves all files with no-cache/must-revalidate, so no service-worker cache version is applicable.
