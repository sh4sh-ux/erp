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
assert(html.includes('const APP_VERSION = "v1.143";'), "app version was not updated");
assert(html.includes('href="./v142-dutch-pay.css?v=1431"'), "Dutch Pay desktop stylesheet is not linked directly");
assert(
  html.indexOf('href="./v142-dutch-pay.css?v=1431"') > html.lastIndexOf("</style>"),
  "Dutch Pay stylesheet must load after the legacy inline stylesheet",
);
assert(html.includes('meta.className="app-view-meta"'), "desktop view version meta is missing");
assert(html.includes('head.prepend(meta)'), "desktop view version meta is not mounted in page headers");
const staticMarkup=html.slice(0,html.indexOf("<script>"));
const ids=[...staticMarkup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=ids.filter((id,index)=>ids.indexOf(id)!==index);
assert(duplicateIds.length===0, `duplicate DOM ids found: ${[...new Set(duplicateIds)].join(", ")}`);

const desktopShell = fs.readFileSync(path.join(__dirname, "..", "v142-dutch-pay.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
assert(
  /flex:0 0 76px;[\s\S]*width:76px;[\s\S]*min-width:76px/.test(desktopShell),
  "desktop rail is not fixed at 76px",
);
assert(
  /\.shell>\.main\s*\{[\s\S]*flex:1 1 auto;[\s\S]*min-width:0/.test(desktopShell),
  "desktop main does not consume the remaining flex space",
);
assert(
  /\.shell>\.rail-gutter:hover\s*\{\s*flex-basis:76px;\s*width:76px;\s*min-width:76px;\s*\}/.test(desktopShell),
  "desktop rail hover does not preserve its 76px geometry",
);
assert(
  /@media\(min-width:821px\) and \(max-width:1023px\)/.test(html),
  "the existing tablet rail behavior is not scoped to 821–1023px",
);

console.log("PASS: navigation wiring, dashboard defaults, direct stylesheet, and fixed Dutch Pay rail geometry");
