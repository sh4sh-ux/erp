import * as sdk from './sdk.mjs';
import {config} from './client-config.mjs';
import {createFirebaseAuth} from './firebase-auth.mjs';
import {fault} from './core.mjs';
import {createDropboxOAuth} from './dropbox-oauth.mjs';
import {createDropboxBackend} from './dropbox-backend.mjs';
import {createDeviceVault} from './device-vault.mjs';
import {loadGoogleIdentity,createGoogleOAuth} from './google-oauth.mjs';
import {createGoogleBackend} from './google-backend.mjs';
export async function createRuntime(){
 if(config.projectId!=='naro-biz')throw fault('UNAVAILABLE');
 const app=sdk.initializeApp(config,'naro-personal-cloud-onboarding');
 // 이 기기 기억하기(Dropbox): 열쇠는 device-vault.mjs가 꺼낼 수 없는 키로 잠가 둔다. 준비가 안 되면(사생활 보호 모드 등) 기억 없이 동작.
 const vault=await createDeviceVault().catch(()=>null);
 const oauth=createDropboxOAuth({clientId:'ehmn2pd14wm98im',vault}); // Public identifier of NEW App Folder app.
 // Google Identity loads in the background: the login screen never waits for it. It is only
 // needed at the storage Connect click, which stays synchronous (popup gesture).
 // Firebase and Dropbox remain available if GIS cannot load.
 let drive=null,driveLoading=true;const blocked={};
 loadGoogleIdentity().then(identity=>{drive=createGoogleOAuth({identity});},()=>{blocked.drive='GOOGLE SDK UNAVAILABLE';}).finally(()=>{driveLoading=false;});
 const select=kind=>{if(kind==='drive'&&!drive&&driveLoading)throw fault('PREPARING');return kind==='dropbox'?oauth:kind==='drive'&&drive?drive:null;};
 const auth=createFirebaseAuth(sdk,app);let reservedUid=null;
 return {auth,
  prepareConnect(kind,{selectAccount=false}={}){const chosen=select(kind);if(!chosen)throw fault('OAUTH_SETUP_REQUIRED');const user=auth.currentIdentity();if(!user?.emailVerified)throw fault('SESSION_EXPIRED');reservedUid=user.uid;if(kind==='drive')chosen.reserve({uid:user.uid,selectAccount,current:()=>auth.currentIdentity()?.uid});else chosen.reserve(user.uid);},
  cancelConnect(){reservedUid=null;oauth.close();drive?.close();},
  cloud(kind,_uid,signal){if(_uid!==reservedUid||auth.currentIdentity()?.uid!==_uid)throw fault('SESSION_EXPIRED');if(kind==='drive'&&drive)return createGoogleBackend({oauth:drive,signal,readOnly:true,businessWrite:true,extendedWrite:true,initializeNew:true});if(kind==='dropbox')return createDropboxBackend({oauth,signal,businessWrite:true});throw fault('OAUTH_SETUP_REQUIRED');},
  canResume(kind){const uid=auth.currentIdentity()?.uid;return kind==='dropbox'&&!!vault?.has(uid);},
  deviceRemember(){return !!vault?.enabled();},
  setDeviceRemember(on){vault?.setEnabled(on);},
  async forgetDevice(){await oauth.forget?.(auth.currentIdentity()?.uid);},
  blockedProviders:blocked};
}
