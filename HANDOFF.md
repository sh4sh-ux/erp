# NARO Personal Cloud handoff

Base: b8efd90 (v1.186, = main). This branch adds the uncommitted local source used for the public naro-biz.web.app release (2026-09-29 13:17 KST). No code changes.

- `dev/personal-cloud-onboarding/` — onboarding source (Firebase Auth, Google/Dropbox OAuth, UI). Review screenshots excluded.
- `dev/unified-storage/` — storage/provider modules, tests, synthetic fixtures, `build.mjs`.
- `naro-workspace/` — files from the local Codex workspace root, same relative paths (`build.mjs` resolves paths from that root):
  - `outputs/general-public-readiness/` — `build-features.mjs` (builds the public candidate), `deploy-features.mjs`, `verify-public.mjs`, `site/` (about/privacy).
  - `outputs/personal-cloud-onboarding-public-release/release/` — earlier build output, used as an INPUT by `build.mjs`.
  - `outputs/personal-all-features-candidate/release/` — REFERENCE ONLY: the exact deployed artifact (28/28 public files match by SHA-256). Do not edit; rebuild from source.
  - `dev/firebase` or `work/erp/dev/firebase` — package manifest for the bundled Firebase SDK.
- Repo root files (v1.186 ERP) are the input for the `/erp/` iframe app; the build applies NARO changes on copy.

## Build inputs added in follow-up
- `naro-workspace/outputs/privacy-safe-companies-pilot/source/app/` — sanitized v1.186 renderer used by `build.mjs` for `/erp/` (only the files build.mjs reads).
- `naro-workspace/outputs/general-public-readiness/candidate/hosting-config.json` — copied by `build-features.mjs`.

## Rebuild (verified 55/57 before these inputs; onboarding 28/28)
Place `dev/` at `<root>/work/erp-login-shell-v186-release/dev` and `naro-workspace/*` at `<root>/`, install `firebase@12.19.0` in `<root>/work/erp/dev/firebase`, point the esbuild import in `build.mjs` (hard-coded `/private/tmp/naro-onboarding-build-tools/...`) to esbuild 0.28.2, then from `<root>`:
`node work/erp-login-shell-v186-release/dev/unified-storage/build.mjs --business --extended && node outputs/general-public-readiness/build-features.mjs`
