# v1.151 desktop workspace verification

- Scope: all ten rail views, desktop >=1024px. Shared typography, 32px single-line controls/actions, split panels and table separators. Textarea/list/rail sizes remain role-specific.
- Existing business calculations, persistence and authentication code unchanged.
- Chrome UI fixture at 1280x900, actual index/CSS/JS with sample in-memory records and no wrapper/iframe: 103 visible controls across all ten views measured at 32px; document horizontal overflow 0 for every view.
- Rail navigation across all ten views succeeded. Console errors: 0. Duplicate IDs: 0.
- At 820px and 1023px presentation wrappers removed; at 1280px restored. Original mobile/tablet nodes retained, including one CSV control.
- navigation.cjs, materials.cjs, quote-workflow.cjs: PASS. git diff --check: PASS.
- New headless workspace-system.cjs could not execute in this environment because Chrome launch was denied by the sandbox. The UI checks above were performed using the existing browser instead.
- This is sample-data QA, not authenticated production-data QA. No backend writes or deployment were performed.
- Start local preview with `node tests/workspace-preview.cjs`, then open http://127.0.0.1:4178. Server is loopback-only and does not change the production authentication files.
