# NARO Personal Cloud Onboarding — LOCAL foundation

Base: v1.186 / `b8efd9032b0211d2a235a8c648e283fa87297e1e`

Status: **OAUTH SETUP APPROVAL REQUIRED**. This is NOT a production-ready release.
No production file imports this directory. No Cloud, Auth Console, Hosting, Rules,
Companies Pilot or existing Dropbox changes have been made.

## What is implemented / what is not

- New NARO desktop brand/account panels and single-column mobile UI.
- Signup/login/reset/verification/storage selection flows using memory-only mocks.
- Firebase Auth SDK-injected adapter for createUser, signIn, verification, reload,
  password reset and signOut; tested with a synthetic SDK. No Firestore import.
- GoogleDriveProvider / DropboxProvider common contract with backend injection.
  Their LOCAL backends are MOCKS, not Google/Dropbox REST implementations.
- Empty storage bootstrap and schema-3 prepared snapshot. Business mutation and
  asset upload are blocked. Existing files are never overwritten automatically.
- Empty-data readiness preview; **the legacy ERP renderer is not connected**.
  No ERP layout, Inventory, calculation or legacy provider code was copied/changed.
- Bounded read retry and no automatic write retry.

Not implemented or claimed PASS: live signup/mail delivery, OAuth exchange,
Drive/Dropbox REST backends, public hosting, real cloud bootstrap, ERP renderer
binding to the personal provider. These remain behind the external setup boundary.
`naro-biz.web.app` continues to run its existing artifact.

## Run locally

From the approved repository root (Node 20+; no dependency install required):

```sh
node --test dev/personal-cloud-onboarding/tests/foundation.test.mjs
node dev/personal-cloud-onboarding/server.mjs
```

Open `http://127.0.0.1:4218/`. Bound to loopback only, no proxy/API routes.
Use a synthetic `.invalid` email and an arbitrary test-only string of 8+ characters.
Do NOT enter a real password. Mock login does not check passwords; it only models
account state. Neither password nor password hash is retained by mockAuth.
Click signup, then the explicit LOCAL email-confirmation simulation control.
Choose a provider. Six arrays are empty; settings is `{ "schema": 3 }`.
Logout and mock-login again to reconnect. Full page reload intentionally clears
ALL mock accounts and mock cloud files. This does not simulate cloud durability.

No URL, browser-storage or window flag activates real services. The server serves
an explicit allowlist. CSP `connect-src 'none'` blocks external API connections;
forms never transmit. No Service Worker, localStorage, sessionStorage or IndexedDB.
No SDK bundle or configuration secrets are served.

## Architecture and safety

Firebase Auth is identity ONLY. The old tenant/discovery path is not used.
Storage provider authorization comes from that user's own OAuth consent, not a
Firebase owner role. Firebase email verification must precede storage connection.
Choice of provider is session memory only; no Firestore metadata is currently needed.

Common contract: connect, disconnect, exists, load, save, list, uploadAsset,
downloadAsset. `prepareFolders` is a bootstrap-only backend extension.
`save` currently permits only create-only empty bootstrap JSON. It does not enable
company/item/quote/payment/stock/material/settings business editing.

Logical layout:

```text
NARO Biz/
  Data/
    companies.json
    items.json
    quotes.json
    payments.json
    stock_moves.json
    material_moves.json
    settings.json
  Images/Products/
  Documents/Business Cards/
  Documents/Business Registration/
  Backup/
```

No name/company/phone/address/tax ID/image defaults. Only schema 3 is required by
the existing snapshot adapter; real renderer binding still needs an empty-state
regression before public activation.

Generation invalidation prevents late success/failure publishing to disposed UI.
DOM and prepared snapshot are removed on logout. Ordinary pending submissions are
serialized; new auth requests cannot race an old request. Page teardown disposes
the controller permanently and signs out again after any late Auth completion.
Logout failure leaves controls blocked. Reload is a fresh session.

Real backend MUST check provider account/root binding; a path name is not an
authorization boundary. Mock namespace isolation is not evidence for real OAuth
isolation. In real Drive, duplicate folder names are possible: resolve by stable
IDs/appProperties and detect ambiguity. Do not pick the first search result.
Do not silently bootstrap over any existing foreign/partial workspace.
Before live bootstrap, implement idempotent provider-specific create-only behavior,
response-loss reconciliation and concurrent-bootstrap tests. Dropbox writes must
use add/conflict semantics with autorename disabled, not overwrite. Drive needs
stable pre-generated IDs and root ownership validation, not name-only existence.
Partial failure is a recovery state: no automatic delete, overwrite or blind retry.

## Zero-cost contract (clarified by user)

- Billing connection: NOT PERMITTED. Blaze / paid quota / payment instrument: NO.
- Firebase Spark only; no Functions, Firebase Storage or Firestore ERP DB.
- Standard Drive API usage has no additional cost under current policy. Future
  pricing changes are monitoring items, not automatic blockers. Stop only when
  Billing/paid quota/payment becomes an actual prerequisite.
- Dropbox API use is free subject to service/rate limits and user storage quota.
- Storage is in the user's provider account; no operator-owned ERP data bucket.
- Known hard daily/storage quota failures: immediate stop, no retry or paid fallback.
- Read rate-limit/transient failures: max 3 attempts (2 bounded exponential delays
  with jitter); then user notice. Reconnection required on expiry/unauthorized.
- Mutation failures: no automatic retries, even on a transient error.
- No polling, continuous background sync or navigation-driven repeated lists.
  Bootstrap lists once; known files load once per entry; navigation uses memory.
  Real backend pagination must be bounded; hitting the cap must stop safely.
- UI message: “무료 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.”

Project Billing state was NOT queried this turn. The existing no-Billing checkpoint
is preserved; no claim of a new Cloud audit is made.

## External setup approval request — not executed

### Google Drive

1. In the existing project, confirm Billing remains unlinked and enable Drive API
   only if not enabled. STOP if Console requires Billing/payment.
2. Configure OAuth consent for testing with approved testers, minimum branding and
   required contact/privacy policy. Do not publish broadly as part of this step.
3. Create a dedicated Web OAuth client. Proposed authorized JavaScript origins:
   `http://127.0.0.1:4218` for isolated development, and later
   `https://naro-biz.web.app` only when public activation is separately approved.
4. Request only `https://www.googleapis.com/auth/drive.file` (non-sensitive per-file
   scope). No whole-Drive scope, no Google social login and no Picker needed for
   app-created files. This scope can also access files explicitly shared with the
   app; do not describe it as intrinsically “app-created files only”.
5. Google Identity Services token model: popup from user gesture, access token in
   memory only, no refresh token, no client secret in browser. This token model does
   not require an application redirect URI. Re-prompt on expiry from a user action.
6. Separate “disconnect session” (drop token) and “revoke permission” (explicit
   consent revocation via GIS). Disconnect must not delete the user's files.

### Dropbox

1. Create a NEW scoped App Folder application. Never reuse production app/tokens.
2. Minimal file metadata/content read and content write scopes for bootstrap:
   files.metadata.read, files.content.read, files.content.write. Add account_info.read
   only if needed for a verified provider-account binding, not to display personal data.
3. Plan a dedicated callback `http://127.0.0.1:4218/oauth/dropbox/callback` locally
   and `https://naro-biz.web.app/oauth/dropbox/callback` for a later public build.
   These callback routes are proposals and are NOT served by this mock build.
4. Authorization code + PKCE S256 + random state, short-lived token, no refresh
   token. Use a same-origin popup callback to keep verifier/state in memory; verify
   origin/source/state, clear callback URL, no token/credential in storage or logs.
5. Consent/session revoke is explicit; no production Dropbox account probing.
   Development apps initially allow the app owner's account; additional test users
   need Console approval. Production approval is a separate provider process.

### Firebase Auth

Email/Password is already reported enabled; new signup does not inherently require
Firestore provisioning or Functions. Before live activation separately confirm
authorized origin, password policy and email action settings. Use an isolated named
Auth app with inMemoryPersistence. Existing User A/Third-party sessions are untouched.
Verification/reset are built-in. Spark email sending quotas currently include
1,000 verification emails/day and 150 password reset emails/day; do not upgrade to
work around them. Resend should have a local cooldown before any real activation.

## Evidence from this LOCAL run

- Node regression: 26 tests PASS, including existing schema-3 snapshot adapter
  compatibility and self-contained module graph resolution.
- Browser mock signup → unverified denial → simulated verification → Drive bootstrap
  → logout → login → Dropbox bootstrap → logout: PASS.
- Password-reset mock UX: PASS; no mail sent.
- 1440 / 430 / 390: login/signup DOM width checks, no horizontal overflow;
  storage selection and empty-data preview inspected during the mobile flow.
- Screenshots: `login-desktop.png`, `signup-mobile.png` (evidence only, not served).
- Old prepared data removed from DOM and password fields empty after logout.
- Browser console error/warning count: 0 at checkpoint.
- Existing tracked files unchanged; only this new dev directory is added.
- User A/Third-party regression evidence reused by non-interference only; no live
  account login, Cloud integrity scan or production access repeated.

## Official references (checked 2026-09-28)

- [Firebase Auth user management](https://firebase.google.com/docs/auth/web/manage-users)
- [Firebase Auth limits](https://firebase.google.com/docs/auth/limits)
- [Drive scope definitions](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive quotas and pricing](https://developers.google.com/workspace/drive/api/guides/limits)
- [GIS browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Dropbox OAuth / PKCE](https://docs.dropboxapi.com/dropbox-api/docs/oauth)
- [Dropbox App Folder / development limits](https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/developer-guide)
- [Dropbox developer support / API pricing](https://www.dropbox.com/developers/support)

Next single gate: approve the limited OAuth Console setup above (no Billing).
No deploy, real account creation, cloud bootstrap or business save is authorized
by this LOCAL result. Real adapters and ERP binding are still pending, not merely
entering client IDs.
