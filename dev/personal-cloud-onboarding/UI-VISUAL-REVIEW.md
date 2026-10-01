# Onboarding UI review

LOCAL / DEV ONLY. No public release or Cloud changes.

Desktop: approved Design Master crop unchanged; right panel unified across Login,
Signup, Verification, Storage, Connecting, Ready and Password Reset.
Mobile: supplied logo crop plus tagline; no desktop office panel.

Run server.mjs, then visit http://127.0.0.1:4218/.
The .invalid reminder and mock verification control are inserted by the local
server only; neither exists in the static index.html markup.
preview.html?screen=login (and signup, verify, storage, connecting, ready, reset)
is a server-only visual fixture with no-op Auth actions, not a public runtime mode.
Screenshots use that fixture; functional browser checks use the normal mock page.

Auth/core, providers, mock backend and Firebase adapter are unchanged.
Storage selection plus Connect and the Ready CTA are view wiring only.
NARO start opens the existing empty-data summary, not a new ERP implementation.
Remember-login remains disabled because the existing session is memory-only.

## Provider icon provenance

Drive: official Google Drive branding guideline:
https://developers.google.com/workspace/drive/api/guides/branding
Asset: https://www.gstatic.com/images/branding/productlogos/drive_2026/v2/web-64dp/logo_drive_2026_color_2x_web_64dp.png

Dropbox: official brand logo page:
https://brand.dropbox.com/logo
Asset: https://cdn.prod.website-files.com/66c503d081b2f012369fc5d2/674000d6c0a42d41f8c331be_dropbox-2-logo-png-transparent.png

Icons served locally and unmodified; no provider account access or OAuth.

## Regression

node --test dev/personal-cloud-onboarding/tests/foundation.test.mjs

Desktop screenshots: 1440 x 1024.
Mobile screenshots: 430 / 390 x 900.
Montage pages contain screenshots, not live Auth forms.
