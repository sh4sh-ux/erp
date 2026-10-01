// Approved feature/UI Hosting deployment; no OAuth configuration or business data writes.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),dir=resolve(root,'../personal-all-features-candidate');
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const endpoint='https://firebasehosting.googleapis.com/v1beta1/';
let stage='LOCAL_VERIFY',released=false;
try{
 const m=JSON.parse(await readFile(resolve(dir,'manifest.json')));
 check(m.files.length===57&&m.aggregate==='6af129d11d817d9b370ec20b2d56374d510ee363125770fa2a368608a7c0179c'&&sha(JSON.stringify(m.files))===m.aggregate,'MANIFEST');
 const actual=[];async function walk(d,p=''){for(const e of await readdir(d,{withFileTypes:true})){check(!e.isSymbolicLink(),'SYMLINK');if(e.isDirectory())await walk(resolve(d,e.name),p+e.name+'/');else actual.push(p+e.name);}}
 await walk(resolve(dir,'release'));check(JSON.stringify(actual.sort())===JSON.stringify(m.files.map(f=>f.path).sort()),'FILESET');
 const buffers=new Map(),files={};
 for(const f of m.files){
  check(!/draft|mock|fixture|debug|\.map$|\.env|credential|service.account/i.test(f.path),'UNEXPECTED_FILE');
  const raw=await readFile(resolve(dir,'release',f.path));check(sha(raw)===f.sha256,'HASH');
  if(!f.path.endsWith('.png'))check(![/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/"type"\s*:\s*"service_account"/,/ya29\.[A-Za-z0-9_-]{20,}/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}/,/(?:access_token|refresh_token|password|client_secret)\s*[:=]\s*['"][A-Za-z0-9_+\/-]{16,}['"]/,/business-card-gownii|naro-step6-user-a/].some(re=>re.test(raw.toString())),'SECRET_SCAN');
  const zip=gzipSync(raw),h=sha(zip);buffers.set(h,zip);files['/'+f.path]=h;
 }
 const prior=JSON.parse(await readFile(resolve(root,'candidate/manifest.json')));
 for(const name of ['google-oauth.mjs','dropbox-oauth.mjs']){
  const before=prior.files.find(f=>f.path===name),after=m.files.find(f=>f.path===name);
  // Approved GIS prompt/binding change; scope, client, origins and Dropbox stay pinned.
  if(name==='google-oauth.mjs')check(after?.sha256==='2c1375a6bf250fd57ed1a9ae3debddac8d717277b6f5b67f61c113f66e3b609e','AUTH_CONTRACT_CHANGED');
  else if(before)check(after?.sha256===before.sha256,'AUTH_CONTRACT_CHANGED');
 }
 const {config,site}=JSON.parse(await readFile(resolve(dir,'hosting-config.json')));check(site==='naro-biz','SITE');
 const originalConfig=JSON.parse(await readFile(resolve(root,'../personal-business-extended-public-release/hosting-config.json'))).config;
 check(JSON.stringify(config.rewrites)===JSON.stringify(originalConfig.rewrites)&&JSON.stringify(config.headers.slice(0,-2))===JSON.stringify(originalConfig.headers),'CONFIG_DIFF');
 stage='AUTH';
 const api=createRequire(new URL('../../work/erp/dev/firebase/package.json',import.meta.url))('firebase-tools/lib/api.js');
 const cli=JSON.parse(await readFile('/Users/sanghyeon/.config/configstore/firebase-tools.json'));
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:cli.tokens.refresh_token,client_id:api.clientId(),client_secret:api.clientSecret()})});
 check(auth.ok,'CLI_AUTH');const token=(await auth.json()).access_token;
 async function req(url,method='GET',body){
  if(method!=='GET')check(url.startsWith(endpoint+'sites/naro-biz/'),'WRITE_SCOPE');
  const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});check(r.ok,'HTTP_'+r.status);return r.json();
 }
 stage='PREFLIGHT';
 const project=await req('https://firebase.googleapis.com/v1beta1/projects/naro-biz');check(project.projectId==='naro-biz','PROJECT');
 const billing=await req('https://cloudbilling.googleapis.com/v1/projects/naro-biz/billingInfo');check(billing.billingEnabled===false&&!billing.billingAccountName,'BILLING');
 const functions=await req('https://serviceusage.googleapis.com/v1/projects/'+project.projectNumber+'/services/cloudfunctions.googleapis.com');check(functions.state==='DISABLED','FUNCTIONS');
 const rules=(await req('https://firebaserules.googleapis.com/v1/projects/naro-biz/releases/cloud.firestore')).rulesetName;
 const active=(await req(endpoint+'sites/naro-biz/releases?pageSize=1')).releases?.[0];
 check(active?.version?.name==='sites/naro-biz/versions/30bc378ed163d4dd','CONCURRENT_RELEASE');
 const report={files:57,aggregate:m.aggregate,billingConnected:false,functions:'DISABLED',ruleset:rules,previousRelease:active.name,previousVersion:active.version.name,featureChanges:true};
 await writeFile(resolve(dir,'preflight.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'PREFLIGHT_PASS',...report}));
 if(!process.argv.includes('--deploy'))process.exit(0);
 stage='CREATE_VERSION';const v=await req(endpoint+'sites/naro-biz/versions','POST',{config});check(v.name?.startsWith('sites/naro-biz/versions/'),'VERSION');
 await writeFile(resolve(dir,'deployment-progress.json'),JSON.stringify({version:v.name,liveReleased:false,previousVersion:active.version.name},null,2));
 stage='UPLOAD';const populated=await req(endpoint+v.name+':populateFiles','POST',{files});
 check(populated.uploadUrl?.startsWith('https://upload-firebasehosting.googleapis.com/upload/sites/naro-biz/versions/'),'UPLOAD_ORIGIN');
 for(const h of populated.uploadRequiredHashes||[]){check(buffers.has(h),'UNKNOWN_FILE');const r=await fetch(populated.uploadUrl+'/'+h,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:buffers.get(h)});check(r.ok,'UPLOAD');}
 stage='FINALIZE';check((await req(endpoint+v.name+'?update_mask=status','PATCH',{status:'FINALIZED'})).status==='FINALIZED','FINALIZE');
 check((await req(endpoint+'sites/naro-biz/releases?pageSize=1')).releases?.[0]?.name===active.name,'CONCURRENT_RELEASE');
 stage='RELEASE';const release=await req(endpoint+'sites/naro-biz/releases?versionName='+encodeURIComponent(v.name),'POST',{});released=true;
 await writeFile(resolve(dir,'deployment.json'),JSON.stringify({site:'naro-biz',release:release.name,version:v.name,previousVersion:active.version.name,aggregate:m.aggregate,otherResourceWrites:0},null,2));
 stage='PUBLIC_VERIFY';const results=[];
 for(const f of m.files){const r=await fetch('https://naro-biz.web.app/'+f.path,{headers:{'Cache-Control':'no-cache'}});results.push({path:f.path,status:r.status,hashMatch:sha(Buffer.from(await r.arrayBuffer()))===f.sha256});}
 const rulesUnchanged=(await req('https://firebaserules.googleapis.com/v1/projects/naro-biz/releases/cloud.firestore')).rulesetName===rules;
 await writeFile(resolve(dir,'public-verification.json'),JSON.stringify({results,rulesUnchanged},null,2));
 check(rulesUnchanged,'RULES_CHANGED');check(results.every(r=>r.status===200&&r.hashMatch),'PUBLIC_HASH_PENDING');
 console.log(JSON.stringify({status:'DEPLOYED_AND_VERIFIED',files:57,version:v.name,url:'https://naro-biz.web.app/',rulesUnchanged}));
}catch(e){console.log(JSON.stringify({status:'STOP',stage,liveReleaseSubmitted:released,code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'DEPLOY_FAILED',automaticRetry:false}));process.exitCode=1;}
