// Exact metadata-only CSP derivative. No script, connection, opener or referrer changes.
import assert from 'node:assert/strict';
export function installMetadataConfig(base){
 const config=structuredClone(base);
 const paths=['/oauth/dropbox/callback','/oauth/dropbox/waiting','/dropbox-callback.html','/dropbox-waiting.html'];
 const before="default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
 const after=before+"; img-src https://naro-biz.web.app/naro-symbol.png https://naro-biz.web.app/erp/icons/; manifest-src https://naro-biz.web.app/manifest.webmanifest";
 for(const path of paths){
  const rule=config.headers.filter(r=>r.glob===path);assert.equal(rule.length,1,path);
  assert.equal(rule[0].headers['Content-Security-Policy'],before,path);
  rule[0].headers['Content-Security-Policy']=after;
 }
 return config;
}
