# Google Drive live connection checkpoint

## Confirmed checkpoint — real Google connection PASS

2026-09-29, confirmed by user for continuation. The approved additional Google test account was added without publishing or changing scopes. After user-operated Google consent, the live localhost:4219 candidate reached "나의 NARO / 빈 업무 공간이 준비되었습니다" with all six business counts zero. Captured console errors/warnings: 0. The unchanged code reaches this view only after provider connection and bootstrap validation; new JSON creation includes read-back. No separate Drive Console inventory was performed. Screenshot evidence: /private/tmp/naro-google-empty-workspace.png.

This supersedes the earlier NOT RUN entries below for Google connection/bootstrap only. It does not prove the complete fresh-user signup/email verification/password-reset flow or a public deployment. Existing logged-in checkpoint tab must be preserved; conduct new-user Auth verification in a separate tab. Firebase adapter already calls the real naro-biz signup, verification, reload, login and reset APIs; actual new-user execution remains user-input gated. No Auth/core/provider redesign is needed. Release preparation follows LOCAL fresh-user E2E success; Hosting deploy is not performed by this checkpoint.

2026-09-29. LOCAL candidate only; not a Hosting deployment.

## Console configuration observed

- Project: naro-biz. Google Drive API enabled.
- OAuth application: NARO Biz, External / Testing.
- Data access: https://www.googleapis.com/auth/drive.file only.
- One test user: the Console operator's Google account. No personal email copied here.
- Web client: NARO Personal Cloud Web, created after explicit user approval.
- JavaScript origins exactly https://naro-biz.web.app, http://localhost, http://localhost:4219.
- Redirect URIs: none. GIS token-model popup, not an authorization-code server.
- Public Web client identifier is in google-oauth.mjs. No client secret inspected, downloaded, stored or used.
- No Billing, payment, trial, Blaze, Functions or paid-quota action performed.

## Implementation and safety

google-oauth.mjs loads the official GIS library; requests exactly drive.file with include_granted_scopes=false. It rejects extra/missing scopes, late callbacks, cancellation and invalid expiry. Tokens stay in memory, with no refresh-token persistence or secret exchange. Logout clears runtime access; it does not revoke the user's Google grant. Revocation is a separate user decision.

google-backend.mjs uses Drive v3 directly. Initial connection lists only the app-visible NARO Biz root and exact expected children, then uses memory while navigating. No polling. Existing complete structure is read; partial, duplicate or foreign marked structure stops without repair. drive.file cannot enumerate unrelated files that the app has not been authorized to access.

New bootstrap creates the existing contract's eight folders and seven empty JSON files, settings schema 3. All new IDs are pre-generated. Only POST create is used, never PATCH/DELETE. JSON is read back. No mutation retry; ambiguous/partial creation requires review. A same-origin Web Lock prevents overlapping local bootstrap. Drive does not supply a global unique-folder-name transaction: simultaneous creation from different devices is not proven safe; do not test parallel first-time bootstrap. Duplicate visible roots subsequently fail closed.

Reads retain the existing bounded retry contract; daily/storage quota exhaustion stops immediately. A per-connection request cap also fails closed. No quota increase or paid fallback. Current provider pricing is not a guarantee of future policy; if billing becomes required, stop.

Firebase Auth adapter, core/session lifecycle, provider abstraction, mock runtime and existing Dropbox adapter are unchanged. No Firestore business SDK is bundled.

## Evidence

- Offline tests: 52 PASS / 0 FAIL (26 foundation, 12 Dropbox, 14 Google).
- New immutable candidate: outputs/personal-cloud-auth-candidate-p7MJdv/release, 20 files.
- SHA-256 manifest aggregate: a1cbd6748f82fff8ec5b4eb4aeb8c07c5649b0a4e9fd6c41c1637bd04972a74a.
- Browser: new candidate Login rendered; captured error/warn count 0 before login.
- Google actual user authorization: NOT RUN.
- Google Drive actual file creation/read-back: NOT RUN.
- Existing logged-in NARO tab preserved. In-memory Auth cannot be transferred or extracted into a new candidate; fresh user-driven NARO login is required before its storage-selection flow.
- Public Hosting, production /erp/, existing Dropbox production, Companies Pilot, Rules and business Firestore data: untouched.

## Resume

Use the new localhost:4219 candidate tab. User enters NARO credentials directly, then selects Google Drive. Stop at actual Google account/permission consent for user action. Only the configured Google test account can authorize while Testing. Never request or print passwords/tokens. After consent, verify actual bootstrap and empty NARO result; do not report success from synthetic tests alone.

Build with build-live.mjs and NARO_ESBUILD_MODULE pointing to the existing esbuild package; serve using serve-live.mjs with the resulting candidate directory. It is a local static server, not an OAuth token proxy.

References:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/workspace/drive/api/guides/create-file
- https://developers.google.com/workspace/drive/api/guides/limits
