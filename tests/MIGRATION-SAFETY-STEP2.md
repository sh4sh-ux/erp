# STEP 2 — legacy migration safety

STEP 1 checkpoint: `0b5e4090e6331733d90cc5ae99965e0cfb20dbd7`.
This supersedes the partial-migration risk description in STORAGE-CONTRACT-STEP1.md.

Only runMigrations and loadAll production function bodies change. Adapter,
settings-schema preservation, UI markup/styles, calculations and stock transport
remain identical. No live Dropbox calls, Firebase, new dependencies or deployment.

## Protocol

1. Apply the existing schema-3 transformation to a JSON copy of quotes.
2. Await quote snapshot save. Failure throws; settings is never attempted.
3. Retain the persisted quote IDs in memory for a direct caller retry.
4. Await settings snapshot save with the existing SCHEMA value, 3.
5. Only after success publish the completed settings and success toast.

This is ordered persistence, not a cross-file transaction. A saved quote and old
schema is an intentional recoverable intermediate state. A completed schema
cannot be written by this sequence before the quote save resolves successfully.
Legacy delivery meaning/quantity/date/amount/ID generation logic is unchanged.

## Failures

| Case | Old parallel behavior | New ordered behavior |
| --- | --- | --- |
| A quotes fail, settings available | settings can advance alone | settings not attempted; error; old schema |
| B quotes succeed, settings fail | error hidden, memory schema advanced | error propagated; persisted quotes retained; old schema |
| C both succeed | completes | completes, data before metadata |
| D both unavailable | error hidden | quote error; settings not attempted |

runMigrations rejects to its caller. loadAll catches with the existing error
status/toast, restores the previous db references, returns false, and skips
rendering, success status and legacy-import follow-up. appView is inert while
loading and after failure, preventing normal workspace interactions with stale
drafts. Reload the page to retry; a successful load removes inert. No new UI or
global error framework was added. This is not a lock against other tabs or
programmatic callers; existing whole-array concurrency remains out of scope.

## Tests

migration-safety.cjs runs old STEP 1 source and current source using only mock
files, reproduces A/B/C/D, checks skipped downstream processing and recovery,
compares complete quote objects through three successful loads, and tests direct
runMigrations retries and pending-save ordering. Generated IDs, deliveries,
legacy_stock, quantities, dates, prices and schema remain stable after persistence.
storage-contract retains the seven snapshot contracts and original schema-loss
reproduction, updating only expected migration failure behavior.

Exact preservation permits only the two STEP 2 function bodies in addition to
the approved STEP 1 changes. Browser inert interaction is not claimed as tested
on real Safari; Playwright availability is reported separately.

Existing production data whose schema was already incorrectly advanced by the
old implementation cannot be diagnosed/repaired by blindly rerunning schema 3.
Any such repair requires separately approved read-only investigation first.
