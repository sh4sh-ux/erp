// Roll naro-biz back to a previous Hosting version (re-releases it; nothing is deleted).
//   node rollback.mjs                       → uses previousVersion from deploy-log/deployment.json
//   node rollback.mjs sites/naro-biz/versions/XXXX
// Env: NARO_FIREBASE_DIR as for deploy.mjs.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),endpoint='https://firebasehosting.googleapis.com/v1beta1/';
const check=(v,c)=>{if(!v)throw Error(c);};
try{
 const target=process.argv[2]||JSON.parse(await readFile(resolve(process.env.NARO_DEPLOY_LOG_DIR||here,'deploy-log/deployment.json'))).previousVersion;
 check(/^sites\/naro-biz\/versions\/[A-Za-z0-9]+$/.test(target||''),'TARGET');
 const api=createRequire(pathToFileURL(resolve(process.env.NARO_FIREBASE_DIR||'.','package.json')))('firebase-tools/lib/api.js');
 const cli=JSON.parse(await readFile(resolve(homedir(),'.config/configstore/firebase-tools.json')));
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:cli.tokens.refresh_token,client_id:api.clientId(),client_secret:api.clientSecret()})});
 check(auth.ok,'CLI_AUTH');const token=(await auth.json()).access_token;
 const r=await fetch(endpoint+'sites/naro-biz/releases?versionName='+encodeURIComponent(target),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
 check(r.ok,'HTTP_'+r.status);const release=await r.json();
 console.log(JSON.stringify({status:'ROLLED_BACK',release:release.name,version:target}));
}catch(e){console.log(JSON.stringify({status:'STOP',code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'ROLLBACK_FAILED'}));process.exitCode=1;}
