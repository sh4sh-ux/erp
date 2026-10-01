import test from 'node:test';
import assert from 'node:assert/strict';
import {createDropboxOAuth} from '../dropbox-oauth.mjs';
test('Dropbox permits only registered LOCAL and public origins',()=>{
 for(const origin of ['http://localhost:4219','https://naro-biz.web.app','https://other.invalid','http://naro-biz.web.app','https://naro-biz.web.app.evil.invalid']){
  let opened=0;const oauth=createDropboxOAuth({clientId:'synthetic',win:{location:{origin},open(path){assert.equal(path,'/oauth/dropbox/waiting');opened++;return {closed:false,close(){}};}}});
  if(['http://localhost:4219','https://naro-biz.web.app'].includes(origin)){oauth.reserve();assert.equal(opened,1);oauth.close();}
  else{assert.throws(()=>oauth.reserve(),{code:'OAUTH_SETUP_REQUIRED'});assert.equal(opened,0);}
 }
});
