# v1.188 — payment filter and detail polish

- Start/end date labels stay above native inputs, including month presets with hidden native labels.
- Desktop totals divider aligns with the top of the left overview row (both y=270 at 1024/1440/1920 px).
- Right detail records use the base background without a selected blue stripe, including expanded records. Master-list selection, direction badges and keyboard focus indicators remain.
- No business data, amount calculations, authentication, rules, or Hosting configuration changes.

Verification: 296 unified-storage tests; navigation, company-address, release, materials, quote-workflow, stock-planning and sales-insight checks pass. Legacy calculation harnesses disable browser init in memory only. All 7 nonempty inline candidate scripts parse. Synthetic local browser checks cover desktop selection/expansion, mobile detail and back navigation, filter dates/reset and responsive sizing. Physical iPhone Safari is not tested.

Only erp/index.html changes among the 74 hosted files. Changes are inline, so no external asset URL changes. The hosted build blocks service workers through CSP and uses no-cache/must-revalidate; no service-worker cache revision applies. Previous Hosting version: 55d7d6004c8b1b13 (v1.187).
