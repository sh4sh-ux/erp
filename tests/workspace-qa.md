# v1.151 desktop workspace verification

## Company/item control and header correction

- Corrected selector specificity so shared select arrow padding (32px right, arrow inset 12px) and borderless search inner inputs win over the generic control rule.
- Company/item detail pseudo-headers now use border-box; both header bottoms measured at y=175px (top 31px, height 144px) in the actual in-app preview. Previously padding was added outside the specified height.
- Left company/item cards stretch to the available panel height; lists scroll within the panel.
- In-app sample preview: both search inner borders 0px, select right padding 32px, horizontal document overflow 0px. Navigation/materials/quote-workflow and diff checks PASS. Production authentication and business logic unchanged; not deployed.

## Navigation revision

- Desktop fixed 208px rail, permanently visible labels, shared resting/hover geometry; app maximum expanded from 1484px to 1616px.
- Actual main widths: 1280 viewport → 1046px; 1440 → 1206px; 1920 → 1406px. No document horizontal overflow. At wide viewport the previous 1406px main maximum is preserved; at narrower viewports physical space limits preservation (100px less than previous main at 1280/1440 despite reduced outer margins).
- Mobile 390×844: bottom menu opens the existing navigation as a bottom sheet. Selecting stock closes it and navigates. Escape closes and restores focus to moreNavBtn. Opening focuses closeNavBtn. Background/main is inert while open.
- Navigation, materials, quote-workflow tests passed after navigation changes. No deployment.

- Scope: all ten rail views, desktop >=1024px. Shared typography, 32px single-line controls/actions, split panels and table separators. Textarea/list/rail sizes remain role-specific.
- Existing business calculations, persistence and authentication code unchanged.
- Chrome UI fixture at 1280x900, actual index/CSS/JS with sample in-memory records and no wrapper/iframe: 103 visible controls across all ten views measured at 32px; document horizontal overflow 0 for every view.
- Rail navigation across all ten views succeeded. Console errors: 0. Duplicate IDs: 0.
- At 820px and 1023px presentation wrappers removed; at 1280px restored. Original mobile/tablet nodes retained, including one CSV control.
- navigation.cjs, materials.cjs, quote-workflow.cjs: PASS. git diff --check: PASS.
- New headless workspace-system.cjs could not execute in this environment because Chrome launch was denied by the sandbox. The UI checks above were performed using the existing browser instead.
- This is sample-data QA, not authenticated production-data QA. No backend writes or deployment were performed.
- Start local preview with `node tests/workspace-preview.cjs`, then open http://127.0.0.1:4178. Server is loopback-only and does not change the production authentication files.
