# NARO Unified Storage READ Foundation — local candidate

Base: v1.186 (`b8efd9032b0211d2a235a8c648e283fa87297e1e`). Public E2E checkpoint is preserved, not rerun or redeployed.

## Existing boundaries and reuse

The old `DropboxStorageAdapter` implements `loadCollection`, `loadObject`, `saveSnapshot`; `StorageRepository` aliases it, and `Table.load/loadObj/save` delegates to it. `saveTable` is a UI wrapper. Old `loadAll` also runs migrations and legacy Dropbox discovery; it is intentionally excluded from this READ candidate. Those paths must not run against personal storage.

`storage.mjs` retains the repository/Table contract, supplies atomic validated snapshots, and defines Google/Dropbox provider boundaries. Existing onboarding Auth and lifecycle code are copied unchanged. Its provider facade exposes seven existing paths or fails closed; it cannot initialize missing storage. Business frame receives validated JSON only, never OAuth credentials or provider file IDs. Existing v1.186 renderers/calculations are reused from the privacy-sanitized source; no second ERP implementation.

Business UI → existing Table/StorageRepository read methods → validated common snapshot → common repository → active provider. Navigation reads memory, with no polling. The business frame has `connect-src 'none'`; legacy OAuth initialization and transport code are excluded, snapshot/ledger writes throw, and the existing READ ONLY UI guard remains installed. Companies Pilot code is not included.

## Data and file identity

Same seven logical keys and schemas: companies/items/quotes/payments/stock_moves/material_moves arrays; settings object with schema 3. No provider-specific ERP schema.

Identity: `{provider, logicalKey, fileId, path, revision, revisionKind, etag}`. Google uses immutable file ID plus `version` (string), optional headRevisionId; etag is null, not invented. Dropbox boundary maps App Folder metadata ID/path_lower/rev, rejects legacy /erp paths. No production Dropbox code/token/network is used.

Google discovery uses the existing exact marked NARO Biz folder hierarchy under drive.file, without new markers/scopes/Console setup. Missing, foreign, duplicate or partial structure fails closed. Seven versions/IDs are checked before and after content reads; changes reject the whole snapshot. This is optimistic READ consistency, NOT an atomic write/CAS guarantee. Future WRITE needs a separately verified provider concurrency contract.

No creation or mutation capability is exposed. Google read-only transport rejects non-GET, prepareFolders and createOnly before requests. Normal empty existing storage uses 36 GET requests per connection (15 discovery, 14 metadata, 7 JSON); bounded transient retries only, no background sync.

Reconnection comparison keeps only an in-memory SHA-256 of provider/key/file-ID/path across logout. No OAuth token, credential or business data is persisted. DOM evidence exposes only BASELINE/PASS/MISMATCH, dataset count, and request counters, never file IDs. Full page reload starts a new baseline; cross-reload reuse is not claimed by this instrument.

Official metadata contracts:
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files
- https://www.dropbox.com/developers/documentation/http/documentation#files-get_metadata

## Build and tests

From repository root (Node 24):

    node work/erp-login-shell-v186-release/dev/unified-storage/build.mjs
    node --test work/erp-login-shell-v186-release/dev/unified-storage/storage.test.mjs work/erp-login-shell-v186-release/dev/personal-cloud-onboarding/tests/*.test.mjs
    node work/erp-login-shell-v186-release/dev/unified-storage/regression.mjs
    node work/erp-login-shell-v186-release/dev/unified-storage/server.mjs

Local candidate: http://localhost:4219/ (approved OAuth origin). Synthetic browser-only fixture: /fixture.html, excluded from release manifest. No deploy script exists in this foundation.

## Evidence status

- 63 offline tests, including original 26 onboarding tests: PASS.
- Existing sales-insight, stock-planning, materials, quote-workflow calculation suites executed against derived candidate: PASS.
- Module graph and inline JavaScript syntax: PASS.
- Actual Google 7-dataset READ and same-identity reconnect: pending direct user authentication in the isolated candidate. Synthetic results must not be reported as Cloud results.
- No Cloud data/config writes, public deploy, Production changes, or production Dropbox access performed.
