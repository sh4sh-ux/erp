# Release contract

- Preserve the existing design source. Dutch Pay light-theme amber is #FF9500; do not substitute warning-text brown for unissued invoice values.
- Inspect related consumers together: master lists, item selectors, desktop and mobile cards. Keep labels on the left and amounts on the right. Verify inner padding as well as page overflow.
- Keep fixes scoped. Do not rewrite business data, calculation rules, or historical item snapshots for presentation changes.
- Run navigation, materials, quote-workflow, stock-planning, company-address, sales-insight and release tests; use synthetic data for browser checks. Record tested widths and limitations.
- Create a release branch and PR, document changes and checks, then merge. Do not directly push future releases to main.
- Bump app version, changed asset query versions and service-worker cache together. Tag the deployed commit. Verify deployment success and live asset equality.
- Roll back through a new revert/restoration commit and PR, never force-push away history. Refresh service-worker/cache versions when restoring old application code. Application rollback does not restore business data; that requires a separate verified backup.

## v1.156

- Separate sales item name and code columns; preserve historical code snapshots.
- Correct mobile sales card/header padding and column labels.
- Use Dutch Pay #FF9500 for unissued invoice values.
- Previous deployment: v1.155, 8822ac46de5896c7ea785552c932da2ed20c3103.
- No data migration or business-data writes. Automated tests and synthetic browser checks do not guarantee absence of all bugs or replace physical iPhone Safari validation.
