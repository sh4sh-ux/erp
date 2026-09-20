// Presentation regression boundaries against the deployed quote checkpoint.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.join(__dirname, '..');
const baseline = '9c65f847dfb81cb488939072b056edf390ffb43c';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const before = name => cp.execFileSync('git', ['show', `${baseline}:${name}`], {cwd:root, encoding:'utf8'});
// The separate exact-diff guard allows only STEP 1's adapter and schema fix in HTML.
require('./storage-preservation.cjs');
for (const file of ['workspace-system.css','workspace-layout.js','mobile-workspace.css','stock-entry.js']) {
  assert.equal(read(file), before(file), `${file} must remain unchanged`);
}
assert.equal(read('sw.js'), before('sw.js').replace('erp-shell-v89-v179', 'erp-shell-v90-v179'), 'Only the deployment cache identifier may change');
const css = read('quote-presentation.css'), js = read('quote-presentation.js');
assert.ok(css.endsWith(before('quote-presentation.css').split('\n').slice(1).join('\n')), 'Existing presentation rules must remain intact');
for (const name of ['editSheet','searchSheet','cards','changeQty']) {
  const section = text => text.slice(text.indexOf(`  function ${name}(`), text.indexOf('\n  function ', text.indexOf(`  function ${name}(`) + 1));
  assert.equal(section(js), section(before('quote-presentation.js')), `${name} unchanged`);
}
assert.match(js, /dates\.some\(input => !!input\.value\)/);
assert.match(js, /input\.closest\('label'\)/);
assert.match(js, /desktopMenu\.append\(csv\)/);
assert.match(js, /\$\('#qtSaveBtn'\)\.click\(\)/);
assert.match(css, /\.naro-sheet-close:focus:not\(:focus-visible\)/);
assert.match(css, /\.naro-sheet-close:focus-visible \{outline:2px/);
assert.match(css, /min-height:44px;padding:6px 1\.5em/);
console.log('PASS: business/desktop files and Option Grid unchanged; original save/CSV controls reused; focus-visible retained');
