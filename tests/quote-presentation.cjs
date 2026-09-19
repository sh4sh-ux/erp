const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = require('node:path').join(__dirname, '..');
const current = fs.readFileSync(root + '/index.html', 'utf8');
const baseline = execFileSync('git', ['show', '0e1f216d934423ea486eb828655d6e7d63a035b4:index.html'], {cwd:root, maxBuffer:2e6, encoding:'utf8'});
function context(html) {
  const ctx = vm.createContext({document:{addEventListener(){},querySelectorAll(){return []},getElementById(){return {}}},window:{location:{origin:'http://localhost',pathname:'/'},addEventListener(){}},MutationObserver:class{observe(){}},console,URL,URLSearchParams,localStorage:{getItem(){return null}},setTimeout(){},clearTimeout(){}});
  const js = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/init\(\);\s*$/, '');
  vm.runInContext(js,ctx); return ctx;
}
const a=context(baseline),b=context(current);
const preserved=['submitQuote','loadAll','quoteTotals','itemSell','itemBuy','applyAutomaticPrice','quoteMargin','marginOf','quoteMarginText','quoteShortage','quoteStockNeeds','quoteStockDone','currentStocks','expandBom','stockDeltaForQuote','syncStockForQuote','quoteDecorationTargetQty','syncDecorationWorkQty','blankQuote','blankLine','blankItem','printQuote','drawQuoteCanvas','saveQuoteImage','shareQuote','emailQuote','duplicateQuote','deleteQuote','bindQtLines','applyItemPick'];
for(const name of preserved) assert.equal(vm.runInContext(`${name}.toString()`,b),vm.runInContext(`${name}.toString()`,a),`${name} changed`);
for(const name of ['load','save','loadObj']) assert.equal(vm.runInContext(`Table.${name}.toString()`,b),vm.runInContext(`Table.${name}.toString()`,a));
const ui=fs.readFileSync(root+'/quote-presentation.js','utf8');new vm.Script(ui);
assert.ok(current.includes('!event.composedPath().includes(ipPop)'));
assert.ok(ui.includes("['기본정보', '품목', '메모']"));
assert.ok(!ui.includes('parent_id'));
assert.ok(!ui.includes('Table.save'));
console.log(`PASS: ${preserved.length+3} protected functions identical to v1.179; presentation syntax and picker guard`);
