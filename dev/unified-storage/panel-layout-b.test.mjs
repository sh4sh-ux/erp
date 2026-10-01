import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const js=await readFile(new URL('./panel-layout-b.js',import.meta.url),'utf8');
const css=await readFile(new URL('./panel-layout-b.css',import.meta.url),'utf8');
const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
test('panel B is presentation-only; dashboard is never split',()=>{
 new Script(js);
 assert.doesNotMatch(js,/split\('dash'/);
 assert.match(js,/split\('stock'/);assert.match(js,/split\('payments'/);
 assert.doesNotMatch(js,/\b(fetch|localStorage|sessionStorage|saveTable|saveSnapshot|XMLHttpRequest)\b/);
 assert.match(js,/marker\.replaceWith\(node\)/);
 assert.match(js,/observer\.disconnect\(\)/);
});
test('one desktop geometry for all nine rail views; dashboard full width',()=>{
 for(const view of ['quotes','materials','payments','stock','companies','items','sales','ar','settings'])assert.ok(css.includes('#view-'+view));
 for(const token of ['--panel-list:300px','--panel-head:96px','--panel-title:20px','--panel-body:13px'])assert.ok(css.includes(token));
 assert.match(css,/#view-dash:not\(\.hidden\)\{display:flex/);
 assert.match(css,/#qtForm\.workspace-form\{grid-template-rows:minmax\(0,1fr\) auto\}/);
 assert.match(css,/@media screen and \(min-width:1024px\)/);
});
test('personal candidate loads B after legacy layout; old production untouched',()=>{
 assert.match(build,/if\(business\)\{[\s\S]*panel-layout-b\.css/);
 assert.match(build,/panel-layout-b\.js/);
 assert.match(build,/inventory-presentation\.js/);
});
test('fixed searches and actions use original controls with reversible advanced filters',()=>{
 assert.match(js,/compact-control-origin/);
 assert.match(js,/positions\.forEach\(\(\[marker,node\]\)=>marker\.replaceWith\(node\)\)/);
 assert.match(js,/panel-b-danger/);
 assert.match(css,/#view-stock \.workspace-left>#stockItems\{overflow:auto/);
 assert.match(css,/\.material-owner-list\{flex:1;min-height:0;overflow:auto/);
 assert.match(css,/#qtForm \.qp-tabs\{position:sticky;top:var\(--panel-head\)/);
 assert.doesNotMatch(js,/cloneNode/);
});
test('quote pilot keeps original search and tabs in fixed headers, filters outside the list grid',()=>{
 assert.match(js,/move\(quoteView\.querySelector\('\.list-head'\),quoteHead\)/);
 assert.match(js,/move\(quoteView\.querySelector\('\.quote-filters'\),quoteHead\)/);
 assert.doesNotMatch(js,/fold\(document\.querySelector\('#view-quotes/);
 assert.match(js,/quote-work-header-origin/);
 assert.match(js,/headerObserver\.disconnect\(\);headerRestore\(\)/);
 assert.match(js,/removeEventListener\('pointerdown',outside\)/);
 assert.match(css,/--panel-head:144px;--panel-list:340px;--panel-caption-y:24px;--panel-title-y:48px/);
 assert.match(css,/\.qfilters-open>\.page-head>\.quote-filters\{display:grid\}/);
 assert.match(css,/grid-template-rows:104px 40px/);
});
test('all rail destinations share divider and title alignment, including dashboard',()=>{
 assert.match(css,/Shared header contract/);
 assert.match(css,/#view-dash>\.page-head\{align-items:flex-start;padding:var\(--panel-title-y\)/);
 assert.match(css,/\.rail-brand-name\{line-height:var\(--panel-title-line\)/);
 assert.match(css,/\.material-detail-head\{padding:var\(--panel-caption-y\)/);
 assert.doesNotMatch(css,/#view-quotes\{--panel-head:/);
});
