# Real connection checkpoint

Google: GOOGLE OAUTH BLOCKED. Console first-use terms validation unresolved.
Do not repeat checkbox, country, reload, or billing/trial instructions.
Drive provider source retained; release disables connection until separately resolved.

Firebase: dedicated REAL_AUTH_PROVIDER_SETUP_PENDING candidate build, existing
naro-biz public client config, Firebase Auth 12.19.0 only. No Firestore import.
Signup/login/verification/reset reuse firebase-auth.mjs and core.mjs unchanged.
Memory-only session; explicit build selection, no query/localStorage switches.
No mock module or test identities in the release. No public deployment performed.

Build from this repository root (official esbuild must already be installed):

    NARO_ESBUILD_MODULE=/path/to/esbuild/lib/main.js node work/erp-login-shell-v186-release/dev/personal-cloud-onboarding/build-live.mjs
    node --test work/erp-login-shell-v186-release/dev/personal-cloud-onboarding/tests/foundation.test.mjs
    node work/erp-login-shell-v186-release/dev/personal-cloud-onboarding/serve-live.mjs outputs/<printed-candidate-directory>

Candidate is served at http://localhost:4219. Not the LOCAL mock at port 4218.
Do not publish to production /erp/. Any subsequent provider build needs a new hash.

Manual real Auth gate (user enters credentials, automation never reads inputs):
1. Signup with a user-chosen account; verification screen, no provider access yet.
2. User opens verification link in own mailbox; press verification check.
3. Storage screen only after verified identity; provider buttons currently blocked.
4. Sign out; login same account; verify authenticated storage screen returns.
5. Sign out; reset request; user completes password change in Firebase email page.
6. User logs in with new password. Do not record email/password/token/UID.
Mail quota failure stops with safe message; no retry loop or paid fallback.
These are prepared gates, NOT claimed Cloud PASS.

Dropbox setup completed by user on 2026-09-29: NEW NARO Personal Cloud,
Scoped App Folder / Development / Only you. Three file scopes selected and saved;
account_info.read is Console default/locked, not requested or called by our backend.
Registered http://localhost:4219/oauth/dropbox/callback only. No public callback yet.
App secret not revealed; generated access token not used; production app untouched.

Latest candidate: outputs/personal-cloud-auth-candidate-fcy2oW (18 files).
Aggregate: 508e510e0b5b08313222501543293e4c74539e412c3474b3ab5be9dc7a11de69
38 local tests PASS (26 foundation + 12 Dropbox). All 18 served hashes and both
OAuth routes PASS. core.mjs, firebase-auth.mjs, providers.mjs original hashes unchanged.
Short-lived online PKCE / memory token / callback origin+source+state validation.
Popup is reserved on user gesture before Auth revalidation; no URL/storage mode toggle.
Only exact bootstrap folders and seven empty JSON files can be created. No overwrite,
delete, business edit, asset upload, existing-production access or mutation retry.
Each JSON creation is read back. Existing partial root stops, never auto-repairs.
Google disabled with original provider retained.

REAL USER GATE PENDING: Chrome http://localhost:4219 opened on Signup.
No credentials read/entered by agent. No Firebase account creation, verification/reset
email, real OAuth token exchange or Dropbox bootstrap executed by agent.
After user signup/verification, user approves Dropbox consent on provider page.
No real bootstrap or empty-workspace entry claimed until provider succeeds.

Billing/Blaze/Functions/paid quota prohibited. Companies Pilot remains untouched.
