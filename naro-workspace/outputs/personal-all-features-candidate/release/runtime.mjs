import * as sdk from './sdk.mjs';
import {config} from './client-config.mjs';
import {createFirebaseAuth} from './firebase-auth.mjs';
import {fault} from './core.mjs';
import {createDropboxOAuth} from './dropbox-oauth.mjs';
import {createDropboxBackend} from './dropbox-backend.mjs';
import {loadGoogleIdentity,createGoogleOAuth} from './google-oauth.mjs';
import {createGoogleBackend} from './google-backend.mjs';
export async function createRuntime(){
 if(config.projectId!=='naro-biz')throw fault('UNAVAILABLE');
 const app=sdk.initializeApp(config,'naro-personal-cloud-onboarding');
 const oauth=createDropboxOAuth({clientId:'ehmn2pd14wm98im'}); // Public identifier of NEW App Folder app.
 let drive=null;try{drive=createGoogleOAuth({identity:await loadGoogleIdentity()});}catch{/* Firebase and Dropbox remain available if GIS cannot load. */}
 const select=kind=>kind==='dropbox'?oauth:kind==='drive'&&drive?drive:null;
 const auth=createFirebaseAuth(sdk,app);let reservedUid=null;
 return {auth,
  prepareConnect(kind,{selectAccount=false}={}){const chosen=select(kind);if(!chosen)throw fault('OAUTH_SETUP_REQUIRED');const user=auth.currentIdentity();if(!user?.emailVerified)throw fault('SESSION_EXPIRED');reservedUid=user.uid;if(kind==='drive')chosen.reserve({uid:user.uid,selectAccount,current:()=>auth.currentIdentity()?.uid});else chosen.reserve();},
  cancelConnect(){reservedUid=null;oauth.close();drive?.close();},
  cloud(kind,_uid,signal){if(_uid!==reservedUid||auth.currentIdentity()?.uid!==_uid)throw fault('SESSION_EXPIRED');if(kind==='drive'&&drive)return createGoogleBackend({oauth:drive,signal,readOnly:true,businessWrite:true,extendedWrite:true,initializeNew:true});if(kind==='dropbox')return createDropboxBackend({oauth,signal,businessWrite:true});throw fault('OAUTH_SETUP_REQUIRED');},
  blockedProviders:drive?{}:{drive:'GOOGLE SDK UNAVAILABLE'}};
}
