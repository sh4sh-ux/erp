const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sidebar = html.match(/<aside class="sidebar"[^>]*>([\s\S]*?)<\/aside>/)?.[1] || "";
const expectedOrder = ["dash", "quotes", "materials", "payments", "stock", "companies", "items", "sales", "ar", "settings"];
let previous = -1;
for (const view of expectedOrder) {
  const current = sidebar.indexOf(`data-view="${view}"`);
  assert(current > previous, `desktop navigation order is incorrect near ${view}`);
  previous = current;
}

const mobile = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || "";
for (const view of ["dash", "quotes", "payments", "stock"]) {
  assert(mobile.includes(`data-view="${view}"`), `mobile quick navigation is missing ${view}`);
}

assert(html.includes('let currentView="dash";'), "dashboard is not the default view");
assert(html.includes('switchView("dash");'), "initial login does not open the dashboard");
assert(html.includes('querySelectorAll(".nav-item,.mobile-nav-item")'), "desktop and mobile navigation are not bound together");
assert(html.includes('id="dashNewQuote"') && html.includes('id="dashNewPayment"'), "dashboard quick actions are missing");
assert(html.includes('const APP_VERSION = "v1.140";'), "app version was not updated");

const desktopShell = html
  .slice(html.indexOf("v1.140 — Desktop Stable App Shell"), html.indexOf("</style>"))
  .replace(/\/\*[\s\S]*?\*\//g, "");
assert(
  /flex:0 0 208px;width:208px;min-width:208px/.test(desktopShell),
  "desktop rail is not fixed at 208px",
);
assert(
  /\.shell>\.main\{flex:1 1 auto;min-width:0\}/.test(desktopShell),
  "desktop main does not consume the remaining flex space",
);
assert(
  !/:hover[^\{]*\{[^}]*\b(?:width|left|right|flex|transform|margin|padding)/s.test(desktopShell),
  "desktop hover changes shell geometry",
);
assert(
  /@media\(min-width:821px\) and \(max-width:1023px\)/.test(html),
  "the existing tablet rail behavior is not scoped to 821–1023px",
);

console.log("PASS: navigation wiring, dashboard defaults, and fixed desktop rail geometry");
