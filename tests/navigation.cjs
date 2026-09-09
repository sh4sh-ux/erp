const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sidebar = html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/)?.[1] || "";
const expectedOrder = ["dash", "quotes", "materials", "payments", "stock", "companies", "items", "sales", "ar", "settings"];
let previous = -1;
for (const view of expectedOrder) {
  const current = sidebar.indexOf(`data-view="${view}"`);
  assert(current > previous, `desktop navigation order is incorrect near ${view}`);
  previous = current;
}

const mobile = html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)?.[0] || "";
for (const view of ["dash", "quotes", "materials", "payments", "stock"]) {
  assert(mobile.includes(`data-view="${view}"`), `mobile quick navigation is missing ${view}`);
}

assert(html.includes('let currentView="dash";'), "dashboard is not the default view");
assert(html.includes('switchView("dash");'), "initial login does not open the dashboard");
assert(html.includes('querySelectorAll(".nav-item,.mobile-nav-item")'), "desktop and mobile navigation are not bound together");
assert(html.includes('id="dashNewQuote"') && html.includes('id="dashNewPayment"'), "dashboard quick actions are missing");
assert(html.includes('const APP_VERSION = "v1.76";'), "app version was not updated");

console.log("PASS: desktop/mobile navigation order, dashboard default and quick actions");
