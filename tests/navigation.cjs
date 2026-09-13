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
for (const view of ["dash", "quotes", "payments", "materials"]) {
  assert(mobile.includes(`data-view="${view}"`), `mobile quick navigation is missing ${view}`);
}

assert(html.includes('let currentView="dash";'), "dashboard is not the default view");
assert(html.includes('switchView("dash");'), "initial login does not open the dashboard");
assert(html.includes('querySelectorAll(".nav-item,.mobile-nav-item")'), "desktop and mobile navigation are not bound together");
assert(html.includes('id="dashNewQuote"') && html.includes('id="dashNewPayment"'), "dashboard quick actions are missing");
assert(html.includes('const APP_VERSION = "v1.153";'), "app version was not updated");
assert(html.includes('href="./v142-dutch-pay.css?v=1501"'), "Dutch Pay desktop stylesheet is not linked directly");
assert(
  html.indexOf('href="./v142-dutch-pay.css?v=1501"') > html.lastIndexOf("</style>"),
  "Dutch Pay stylesheet must load after the legacy inline stylesheet",
);
assert(html.includes('meta.className="app-view-meta"'), "desktop view version meta is missing");
assert(html.includes('head.prepend(meta)'), "desktop view version meta is not mounted in page headers");
assert(!html.includes('class="avatar"'), "company/item master lists still render abbreviation avatars");
assert(!html.includes("function initials("), "unused abbreviation helper remains");
const staticMarkup=html.slice(0,html.indexOf("<script>"));
const ids=[...staticMarkup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=ids.filter((id,index)=>ids.indexOf(id)!==index);
assert(duplicateIds.length===0, `duplicate DOM ids found: ${[...new Set(duplicateIds)].join(", ")}`);

const desktopShell = fs.readFileSync(path.join(__dirname, "..", "v142-dutch-pay.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
[
  "height:144px",
  "padding:30px 28px 20px",
  "--panel-title-size:23px",
  "min-height:32px",
  "border:1px solid #d4d4d8",
  "min-height:64px",
  "font-size:13.5px",
].forEach(token=>assert(desktopShell.includes(token), `measured Dutch Pay token missing: ${token}`));
const navigationCss=fs.readFileSync(path.join(__dirname,'..','navigation-layout.css'),'utf8');
assert(!html.includes('.sidebar:not(:hover)'), 'legacy hover-dependent alignment must not return');
assert(navigationCss.includes('@media screen and (min-width:821px)'), 'fixed navigation must include narrow desktop');
assert(navigationCss.includes('width:208px;min-width:208px;flex:0 0 208px'),'fixed 208px rail missing');
assert(
  /\.shell>\.main\s*\{[\s\S]*flex:1 1 auto;[\s\S]*min-width:0/.test(desktopShell),
  "desktop main does not consume the remaining flex space",
);
assert(
  navigationCss.includes('.shell>.rail-gutter,.shell>.rail-gutter:hover'),
  "desktop rail hover must share fixed geometry",
);
assert(
  /@media\(min-width:821px\) and \(max-width:1023px\)/.test(html),
  "the existing tablet rail behavior is not scoped to 821–1023px",
);

console.log("PASS: navigation wiring, dashboard defaults, direct stylesheet, and fixed Dutch Pay rail geometry");
