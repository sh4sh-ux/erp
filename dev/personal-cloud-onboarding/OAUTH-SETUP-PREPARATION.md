# NARO OAuth setup approval package

Prepared 2026-09-28. Planning only; no Console, account, Hosting, Cloud or
production access/change. Current runtime remains LOCAL mock, connect-src none.

## UI

Desktop form 412 → 424 px, centered in the same right card; headline 35 → 37 px.
Frame and left master crop unchanged. Connecting icon 44 → 52 px and progress
3 → 4 px. Ready has only its primary start action; storage card retained.
390/430 mobile composition retained. 26 foundation tests pass.
core.mjs, providers.mjs, mock.mjs and firebase-auth.mjs hashes unchanged.

## Google setup (approval required)

1. Select the Google Cloud project underlying naro-biz; confirm Billing unlinked.
   Enable Google Drive API only if absent. Do not enable paid services/quotas.
2. Inspect existing Google Auth Platform configuration before editing it:
   Branding (NARO name, support/contact addresses), Audience External / Testing,
   approved test users, Data Access with drive.file only.
   Consent settings are project-wide: stop for approval if existing clients would
   be affected. Do not repurpose the Firebase sign-in OAuth client.
3. Prepare truthful homepage/privacy-policy URLs and domain ownership requirements
   before public publication. Do not claim non-sensitive scope exempts branding
   or user-data policy requirements. No public consent publication in this gate.
4. Create a dedicated Web application OAuth client for personal storage.
   Authorized JavaScript origins, without paths/trailing slash:
   - https://naro-biz.web.app
   - http://localhost
   - http://localhost:4218
   The two localhost entries follow GIS setup instructions. Use localhost:4218
   for future OAuth development; existing 127.0.0.1 mock preview is unchanged.
   Do not register GitHub Pages production or unused origins.
5. Scope: https://www.googleapis.com/auth/drive.file only.
   Per-file access to app-created/user-authorized files, not whole-Drive access.
   New NARO files require no Picker, no whole-drive metadata scope, no social login.
6. GIS token model popup triggered by Connect: no application redirect URI.
   Client ID is public; no browser client secret. Keep access token only in memory,
   no refresh token. On expiry stop API work and show a user-triggered reconnect.

## Dropbox setup (approval required)

1. Create a NEW scoped App Folder application; do not reuse production app/tokens.
   Start Development status; enable additional approved testers if needed.
2. Scopes for the proposed backend:
   files.metadata.read (resolve/list root),
   files.content.read (load JSON),
   files.content.write (folders and create-only bootstrap).
   account_info.read only when implementing explicit current-account/root binding;
   if enabled, use account ID in memory, never personal profile display/logging.
   No sharing, team, full-account file access or unnecessary metadata-write scopes.
3. Exact redirect registrations:
   https://naro-biz.web.app/oauth/dropbox/callback
   http://localhost:4218/oauth/dropbox/callback
   These are planned routes, not currently implemented or deployed.
4. Authorization code + PKCE S256, random one-use state, short-lived access token;
   request online access, not offline/refresh-token access. No app secret in browser.
   Permit PKCE public-client flow; do not use the legacy implicit token flow.
5. Same-origin popup callback, with opener/source/origin/state validation.
   Keep verifier/state/token in memory only; remove callback code from URL promptly.
   Popup lost/reload/state mismatch: stop and offer reconnect, never guess/replay.
   No localStorage, sessionStorage, IndexedDB, console or server logs for credentials.

## Session contract

NARO logout: invalidate session, clear business state and provider token,
Firebase signOut. It does not sign the user out of Google/Dropbox globally.
Provider disconnect: invalidate provider data/token and block ERP readiness,
but does not mean revoking the grant or deleting cloud files.
Explicit unlink/revoke is a distinct user-approved action.
Reconnect may reuse existing provider consent but always verifies account/root
binding. Switching providers/accounts must never merge previous user's memory.

## Storage bootstrap

NARO Biz/
  Data/
    companies.json
    items.json
    quotes.json
    payments.json
    stock_moves.json
    material_moves.json
    settings.json
  Images/
    Products/
  Documents/
    Business Cards/
    Business Registration/
  Backup/

Six business arrays start empty; settings contains schema:3 only.
No example personal/business records, images or credentials. No Firestore ERP DB.
Drive physical root: user's My Drive / NARO Biz, resolved by stable folder/file IDs.
Dropbox physical root: /Apps/<new app name>/NARO Biz, within App Folder boundary.
Logical paths match; physical provider roots intentionally differ.
Never overwrite pre-existing/partial workspaces or infer identity from folder name.
No automatic retry of ambiguous mutations: reconcile by stable IDs/conflict state.

## Cost gate

Drive: current standard API use has no additional cost within published thresholds.
Official 2026 documentation announces future overage charging; do not promise
unlimited free usage. Billing stays unlinked, no quota increase purchase.
Dropbox: API free for developers; storage subject to user's existing account quota.
Firebase: Spark, no payment method or Functions required for this architecture.
No Billing/Blaze/payment/paid quota/automatic billing configuration is authorized.
Actual project's billing state was not queried; existing safe checkpoint retained.
Storage/daily quota error: stop, user notice. Read rate limits/transient errors:
maximum three total attempts with bounded backoff; no endless polling.
Business mutation/ambiguous bootstrap: no blind retry.
Any actual demand for billing/payment is a STOP and approval boundary.

## Remaining implementation boundary

Console values alone do not enable live storage: real OAuth/REST backends, callback
route, deliberate CSP changes, account/root validation and durable create-only
reconciliation remain future work. No live OAuth/bootstrap verification claimed.
External setup approval does not authorize public deployment or business writes.

## Official sources

- https://developers.google.com/workspace/guides/configure-oauth-consent
- https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/limits
- https://docs.dropboxapi.com/dropbox-api/docs/oauth
- https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/developer-guide
- https://www.dropbox.com/developers/support
- https://firebase.google.com/pricing

Readiness: OAUTH SETUP APPROVAL REQUIRED
