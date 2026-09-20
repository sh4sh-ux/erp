# Storage contract — STEP 1

Baseline: `91184412a9abb8a45ab1104661f94652ddc83e1d`. No Firebase or live Dropbox data.

## Implemented boundary

`Table.load/loadObj/save` delegate to `StorageRepository`, currently bound to
`DropboxStorageAdapter`. Minimal neutral methods:

- `loadCollection(name)`: parsed JSON, absent/empty text -> `[]`.
- `loadObject(name)`: parsed JSON, absent/empty text -> `{}`.
- `saveSnapshot(name, data)`: JSON serialization with two-space indentation;
  replaces the complete named file; resolves after upload, rejects on failure.

No validation, record merge, retry, deletion inference, new schema, or database
shape conversion was added. An empty collection persists `[]`, not file deletion.
For the settings singleton, snapshot tests cover property create/update/removal;
there is no existing settings-record delete UI and no new delete operation.
JSON serialization behavior (including omitted undefined fields) stays unchanged.
Legacy fallback is read-only; writes always use the current data directory.

## Whole-snapshot callers and future record boundaries

| Caller | Snapshot | Operation |
| --- | --- | --- |
| submitCompany / deleteCompany | companies | create/update/delete by id |
| submitItem / deleteItem | items | create/update/delete by id |
| saveStockMinimums | items | update minimums on affected items |
| submitQuote / deleteQuote | quotes | create/update/delete; nested delivery edits saved with quote |
| quote copy | quotes | new quote/line IDs, then normal quote save |
| addPayment / quote payment registration / deletePayment | payments | create/delete |
| persistMaterialMove / updateMaterialMove / voidMaterialMove | material_moves | create/update/logical void |
| saveSettings | settings | singleton replace, now preserves existing schema |
| runMigrations | quotes + settings | parallel snapshot replacement |
| importBackup | six arrays + settings | parallel snapshot replacement |
| saveStockChecked | stock_moves | checked ledger replacement, bypasses Table |

Future record-level repository work must use explicit changed/deleted IDs and
versions, or an independent last-read snapshot. Absence from a stale array must
never imply deletion of a newer remote record. STEP 1 does not implement this.

## Dropbox dependency inventory

| Location | Dependency | STEP 1 / later |
| --- | --- | --- |
| needToken/token refresh/OAuth callback/logout | localStorage OAuth credentials, Dropbox OAuth/account endpoints | unchanged; later authentication boundary |
| dbxDownload / dbxUpload / readTable | JSON download/overwrite, current-path then legacy-path fallback | enclosed by adapter for ordinary Table operations; transport unchanged |
| saveStockChecked (stock-entry.js) | direct download metadata/rev and conditional upload; legacy Table.load fallback | later; retain checked revision/fingerprint semantics |
| business certificate resolution/share | direct binary download, dbxList and Dropbox fallback path outside ERP data directory | later binary-file boundary |
| business card / configured certificate URL fetch | static or external URL bytes, not necessarily Dropbox | later only if storage provider changes |
| dbxList / findLegacyDir / importFromAppFolder | legacy folder discovery and sequential raw file copying via dbxUpload | later import boundary; unchanged |
| exportBackup | in-memory JSON download, NO Dropbox API bypass | unchanged |
| importBackup | Table.save for seven snapshots; updates memory before completion | adapter reached through Table; atomic restore deferred |
| runMigrations | Table.save, NOT direct Dropbox API | adapter reached through Table; migration sequencing deferred |
| migrateStockQuoteLinks | in-memory normalization, no immediate storage call | unchanged |
| offerImportIfEmpty | can prompt and invoke legacy import after load | unchanged; prompt/UI stubbed in tests |

## Reproduced settings bug

The baseline saveSettings reconstructs the supplier object without schema.
Synthetic schema=3 settings -> supplier save -> schema absent -> runMigrations
interprets 0 and marks an undelivered ordered quote as delivered.
The only settings fix preserves an existing own `schema` property verbatim;
absent schema remains absent. No migration version or algorithm changed.

## Load / migration contract and known risks

- Successful schema>=3 load: no migration writes, but ensureQuoteLineIds can
  normalize legacy objects in memory. A read is not a pure immutable operation.
- Old schema: migration normalizes quotes and writes quotes/settings using
  Promise.all. Successful persisted reload performs no further migration writes.
- Any initial Table read rejection: loadAll catches it before assignment and
  migration; the read stage itself issues no writes.
- Quote-write failure + settings success: schema=3 can persist despite quotes
  remaining old. Next load skips that migration. Reproduced in a mock test.
- Settings-write failure + quote success: next load repeats migration; completed
  quote normalization/IDs remain stable in the fixture.
- Migration errors are swallowed and loadAll can report success. This is existing
  behavior, not a guarantee introduced by the adapter. Atomicity/error handling
  is deferred to STEP 2 rather than changing migration semantics in this patch.
- Empty-data legacy import is a separate user-confirmed write path; mock tests
  suppress prompts and never access the network.

## Verification

`storage-contract.cjs` executes actual inline application code with init disabled,
mock file storage and no fetch/credentials. It also reproduces the bug against
the pinned baseline. Snapshot CRUD tests are storage-shape tests, not claims that
every business UI supports all CRUD operations. Existing workflow suites cover
their business restrictions.

`storage-preservation.cjs` asserts byte-for-byte baseline identity outside the
adapter block and schema line, plus unchanged external UI/stock/SW files. This
protects all existing business function bodies, not only the earlier 33-function
subset. Neither test accesses production Dropbox.
