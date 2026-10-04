import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const read=path=>readFile(new URL(path,root));
test('Dropbox loading mark is 80% of 52px without shrinking its container or Drive icon',async()=>{
 const css=(await read('dev/personal-cloud-onboarding/style.css')).toString();
 assert.match(css,/\.connecting-icon \.provider-icon\{width:52px;height:52px\}/);
 assert.match(css,/\.connecting-icon \.provider-icon\[src\$="dropbox-icon\.png"\]\{width:41\.6px;height:41\.6px\}/);
 assert.equal(52*.8,41.6);
});
test('installed app PNGs keep required dimensions and match the pinned candidate',async()=>{
 for(const size of [180,192,512]){
  const path=`dev/unified-storage/naro-icons/icon-${size}.png`,icon=await read(path);
  assert.equal(icon.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16),size);assert.equal(icon.readUInt32BE(20),size);
  assert.deepEqual(icon,await read(`naro-workspace/outputs/naro-redesign/candidate/release/erp/icons/icon-${size}.png`));
 }
 const renderer=(await read('dev/unified-storage/render-app-icons.swift')).toString();
 assert.match(renderer,/symbolScale: CGFloat = 1\.2/);
 assert.match(renderer,/naro-icon-source\.png/);
 assert.match(renderer,/\(edge-expanded\)\/2/);
});
