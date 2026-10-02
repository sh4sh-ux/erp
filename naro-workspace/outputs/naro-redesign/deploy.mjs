// NARO redesign — Firebase Hosting deploy for site naro-biz (Hosting only).
// Pinned to the verified candidate in ./candidate. No Auth/OAuth config, rules, functions or data writes.
//   node deploy.mjs              → preflight only (read-only): checks + what changes vs live
//   node deploy.mjs --deploy     → create version, upload, release, verify public files
// Env: NARO_SA_KEY = service-account JSON (GitHub Actions), or NARO_FIREBASE_DIR = folder whose
//      node_modules has firebase-tools (Mac: the CLI login is reused).
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash,createSign} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url)),dir=resolve(here,'candidate');
const PIN={files:67,aggregate:'eaef0f4b0af398ff5486d6ca26e52763e087d8ca668fc7b493d8465f56f94ca7',
 auth:{'google-oauth.mjs':'2c1375a6bf250fd57ed1a9ae3debddac8d717277b6f5b67f61c113f66e3b609e','dropbox-oauth.mjs':'1e5054416f1453fceff71d4b2539245df1203bc36a014beb1a4b0ec74281f95c'}};
const endpoint='https://firebasehosting.googleapis.com/v1beta1/',site='https://naro-biz.web.app/';
const out=resolve(process.env.NARO_DEPLOY_LOG_DIR||here,'deploy-log');
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stage='LOCAL_VERIFY',released=false;
try{
 const m=JSON.parse(await readFile(resolve(dir,'manifest.json')));
 check(m.files.length===PIN.files&&m.aggregate===PIN.aggregate&&sha(JSON.stringify(m.files))===m.aggregate,'MANIFEST');
 const actual=[];async function walk(d,p=''){for(const e of await readdir(d,{withFileTypes:true})){check(!e.isSymbolicLink(),'SYMLINK');if(e.isDirectory())await walk(resolve(d,e.name),p+e.name+'/');else actual.push(p+e.name);}}
 await walk(resolve(dir,'release'));check(JSON.stringify(actual.sort())===JSON.stringify(m.files.map(f=>f.path).sort()),'FILESET');
 const buffers=new Map(),files={};
 for(const f of m.files){
  check(!/draft|mock|fixture|debug|\.map$|\.env|credential|service.account/i.test(f.path),'UNEXPECTED_FILE');
  const raw=await readFile(resolve(dir,'release',f.path));check(sha(raw)===f.sha256,'HASH');
  if(!/\.(png|jpg)$/.test(f.path))check(![/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/"type"\s*:\s*"service_account"/,/ya29\.[A-Za-z0-9_-]{20,}/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}/,/(?:access_token|refresh_token|password|client_secret)\s*[:=]\s*['"][A-Za-z0-9_+\/-]{16,}['"]/,/business-card-gownii|naro-step6-user-a/].some(re=>re.test(raw.toString())),'SECRET_SCAN');
  const zip=gzipSync(raw),h=sha(zip);buffers.set(h,zip);files['/'+f.path]=h;
 }
 for(const [name,hash] of Object.entries(PIN.auth))check(m.files.find(f=>f.path===name)?.sha256===hash,'AUTH_CONTRACT_CHANGED');
 const {config,site:siteId}=JSON.parse(await readFile(resolve(dir,'hosting-config.json')));check(siteId==='naro-biz','SITE');
 const approved=JSON.parse(await readFile(resolve(here,'../general-public-readiness/candidate/hosting-config.json'))).config;
 check(JSON.stringify(config)===JSON.stringify(approved),'CONFIG_DIFF');

 stage='AUTH';
 let token;
 if(process.env.NARO_SA_KEY){
  // GitHub Actions: a dedicated service account (Firebase Hosting Admin + Firebase Viewer) from a repository secret.
  // The key is only used to sign one short-lived token request; it is never written or logged.
  let key;try{key=JSON.parse(process.env.NARO_SA_KEY);}catch{throw Error('SA_KEY_FORMAT');}
  check(key.type==='service_account'&&key.project_id==='naro-biz'&&key.client_email&&key.private_key,'SA_KEY_PROJECT');
  const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
  const body=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:key.client_email,scope:'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+1800});
  const jwt=body+'.'+createSign('RSA-SHA256').update(body).sign(key.private_key).toString('base64url');
  const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
  check(auth.ok,'SA_AUTH');token=(await auth.json()).access_token;
 }else{
  const fbDir=process.env.NARO_FIREBASE_DIR;check(fbDir,'NARO_FIREBASE_DIR');
  const api=createRequire(pathToFileURL(resolve(fbDir,'package.json')))('firebase-tools/lib/api.js');
  const cli=JSON.parse(await readFile(resolve(homedir(),'.config/configstore/firebase-tools.json')));
  const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:cli.tokens.refresh_token,client_id:api.clientId(),client_secret:api.clientSecret()})});
  check(auth.ok,'CLI_AUTH');token=(await auth.json()).access_token;
 }
 async function req(url,method='GET',body){
  if(method!=='GET')check(url.startsWith(endpoint+'sites/naro-biz/'),'WRITE_SCOPE');
  const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});check(r.ok,'HTTP_'+r.status);return r.json();
 }

 stage='PREFLIGHT';
 const project=await req('https://firebase.googleapis.com/v1beta1/projects/naro-biz');check(project.projectId==='naro-biz','PROJECT');
 const rules=(await req('https://firebaserules.googleapis.com/v1/projects/naro-biz/releases/cloud.firestore')).rulesetName;
 const active=(await req(endpoint+'sites/naro-biz/releases?pageSize=1')).releases?.[0];check(active?.version?.name,'NO_ACTIVE_RELEASE');
 const changed=[];
 for(const f of m.files){const r=await fetch(site+f.path,{headers:{'Cache-Control':'no-cache'}});const same=r.ok&&sha(Buffer.from(await r.arrayBuffer()))===f.sha256;if(!same)changed.push(f.path);}
 await mkdir(out,{recursive:true});
 const report={files:m.files.length,aggregate:m.aggregate,changedVsLive:changed.length,changed,previousRelease:active.name,previousVersion:active.version.name,previousReleaseTime:active.releaseTime,ruleset:rules};
 await writeFile(resolve(out,'preflight.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'PREFLIGHT_PASS',...report}));
 if(!process.argv.includes('--deploy'))process.exit(0);

 stage='CREATE_VERSION';const v=await req(endpoint+'sites/naro-biz/versions','POST',{config});check(v.name?.startsWith('sites/naro-biz/versions/'),'VERSION');
 await writeFile(resolve(out,'deployment-progress.json'),JSON.stringify({version:v.name,liveReleased:false,previousVersion:active.version.name},null,2));
 stage='UPLOAD';const populated=await req(endpoint+v.name+':populateFiles','POST',{files});
 check(populated.uploadUrl?.startsWith('https://upload-firebasehosting.googleapis.com/upload/sites/naro-biz/versions/'),'UPLOAD_ORIGIN');
 for(const h of populated.uploadRequiredHashes||[]){check(buffers.has(h),'UNKNOWN_FILE');const r=await fetch(populated.uploadUrl+'/'+h,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:buffers.get(h)});check(r.ok,'UPLOAD');}
 stage='FINALIZE';check((await req(endpoint+v.name+'?update_mask=status','PATCH',{status:'FINALIZED'})).status==='FINALIZED','FINALIZE');
 check((await req(endpoint+'sites/naro-biz/releases?pageSize=1')).releases?.[0]?.name===active.name,'CONCURRENT_RELEASE');
 stage='RELEASE';const release=await req(endpoint+'sites/naro-biz/releases?versionName='+encodeURIComponent(v.name),'POST',{});released=true;
 await writeFile(resolve(out,'deployment.json'),JSON.stringify({site:'naro-biz',release:release.name,version:v.name,previousVersion:active.version.name,aggregate:m.aggregate},null,2));

 stage='PUBLIC_VERIFY';let results=[];
 for(let attempt=0;attempt<6;attempt++){
  results=[];for(const f of m.files){const r=await fetch(site+f.path+'?v='+Date.now(),{headers:{'Cache-Control':'no-cache'}});results.push({path:f.path,status:r.status,hashMatch:sha(Buffer.from(await r.arrayBuffer()))===f.sha256});}
  if(results.every(r=>r.status===200&&r.hashMatch))break;await sleep(10000);
 }
 const rulesUnchanged=(await req('https://firebaserules.googleapis.com/v1/projects/naro-biz/releases/cloud.firestore')).rulesetName===rules;
 await writeFile(resolve(out,'public-verification.json'),JSON.stringify({results,rulesUnchanged},null,2));
 check(rulesUnchanged,'RULES_CHANGED');check(results.every(r=>r.status===200&&r.hashMatch),'PUBLIC_HASH_PENDING');
 console.log(JSON.stringify({status:'DEPLOYED_AND_VERIFIED',files:m.files.length,version:v.name,previousVersion:active.version.name,url:site,rulesUnchanged}));
}catch(e){console.log(JSON.stringify({status:'STOP',stage,liveReleaseSubmitted:released,code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'DEPLOY_FAILED',automaticRetry:false}));process.exitCode=1;}
