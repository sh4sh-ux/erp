// 회원 승인제: 가입·이메일 인증 뒤 관리자가 승인한 계정만 저장소 연결로 넘어간다.
// 서버·SDK 없이 Firestore REST 하나(무료 Spark 한도 안). 같은 규칙을 firestore.rules가 서버에서 강제한다.
// 승인 규칙(firestore.rules의 access 블록)이 아직 없으면 지금처럼 모두 들어간다 — 데이터베이스가 없거나,
// API가 꺼졌거나, 규칙이 본인 문서 읽기를 막을 때(우리 규칙은 본인 읽기를 항상 허용하므로 = 아직 안 붙임).
// 이 프로젝트의 Firestore에는 옛 시스템 데이터(tenants·users)가 있다: 그 규칙은 건드리지 않고 블록만 더한다.
// 네트워크 등 그 밖의 실패는 들여보내지 않는다.
export const ADMIN_EMAIL='onlysh4sh@gmail.com';
const BASE='https://firestore.googleapis.com/v1/projects/naro-biz/databases/(default)/documents';
const STATUSES=['pending','approved','rejected'];
const fault=code=>Object.assign(new Error(code),{code});
const str=v=>v?.stringValue??'';
const time=v=>v?.timestampValue??'';
function notSetUp(res,{selfRead=false}={}){
 const e=res.body?.error||{},text=String(e.message||'');
 if(selfRead&&res.status===403)return true;
 if(res.status===404&&/database/i.test(text)&&/does not exist/i.test(text))return true;
 if(res.status===403&&(/has not been used|is disabled/i.test(text)||JSON.stringify(e.details||[]).includes('SERVICE_DISABLED')))return true;
 return false;
}
const docOf=d=>({uid:String(d.name||'').split('/').pop(),email:str(d.fields?.email),status:STATUSES.includes(str(d.fields?.status))?str(d.fields?.status):'pending',requestedAt:time(d.fields?.requestedAt),decidedAt:time(d.fields?.decidedAt)});
export function createAccess({auth,fetcher=(...a)=>globalThis.fetch(...a),now=()=>new Date()}){
 const isAdmin=()=>auth.currentIdentity()?.emailVerified===true&&auth.email().toLowerCase()===ADMIN_EMAIL;
 async function call(path,{method='GET',body}={}){
  const token=await auth.idToken();if(!token)throw fault('SESSION_EXPIRED');
  let r;try{r=await fetcher(BASE+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
  catch{throw fault('NETWORK_ERROR');}
  let json={};try{json=await r.json();}catch{/* empty body */}
  return {status:r.status,ok:r.ok,body:json};
 }
 const fail=res=>fault(res.status===401?'SESSION_EXPIRED':res.status===429?'QUOTA_LIMIT':'ACCESS_CHECK_FAILED');
 return {
  isAdmin,
  // {status:'approved'|'pending'|'rejected', admin, setup, email, requestedAt}
  async check(){
   const user=auth.currentIdentity();if(!user?.emailVerified)throw fault('EMAIL_NOT_VERIFIED');
   const email=auth.email();
   if(isAdmin())return {status:'approved',admin:true,setup:true,email};
   let res=await call('/access/'+encodeURIComponent(user.uid));
   if(notSetUp(res,{selfRead:true}))return {status:'approved',admin:false,setup:false,email};
   if(res.status===404){
    // 처음 들어온 계정: 승인 요청을 남긴다(규칙상 본인 문서를 'pending'으로만 만들 수 있다).
    const created=await call('/access?documentId='+encodeURIComponent(user.uid),{method:'POST',body:{fields:{email:{stringValue:email},status:{stringValue:'pending'},requestedAt:{timestampValue:now().toISOString()}}}});
    if(created.ok)return {status:'pending',admin:false,setup:true,...docOf(created.body)};
    if(created.status!==409)throw fail(created);
    res=await call('/access/'+encodeURIComponent(user.uid));
   }
   if(!res.ok)throw fail(res);
   const d=docOf(res.body);return {status:d.status,admin:false,setup:true,email:d.email||email,requestedAt:d.requestedAt};
  },
  async list(){
   if(!isAdmin())throw fault('ACCESS_DENIED');
   const out=[];let token='';
   do{const res=await call('/access?pageSize=300'+(token?'&pageToken='+encodeURIComponent(token):''));
    if(notSetUp(res)||res.status===403)throw fault('ACCESS_NOT_SET_UP');if(!res.ok)throw fail(res);
    out.push(...(res.body.documents||[]).map(docOf));token=res.body.nextPageToken||'';}while(token);
   return out;
  },
  async decide(uid,status){
   if(!isAdmin())throw fault('ACCESS_DENIED');
   if(!STATUSES.includes(status)||!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid)))throw fault('VALIDATION');
   const res=await call('/access/'+uid+'?updateMask.fieldPaths=status&updateMask.fieldPaths=decidedAt&currentDocument.exists=true',{method:'PATCH',body:{fields:{status:{stringValue:status},decidedAt:{timestampValue:now().toISOString()}}}});
   if(notSetUp(res)||res.status===403)throw fault('ACCESS_NOT_SET_UP');if(!res.ok)throw fail(res);
   return docOf(res.body);
  }
 };
}
// 업무 화면(iframe)이 관리자 요청을 보낼 때 쓰는 현재 로그인의 승인 객체.
let active=null;
export function setActiveAccess(a){active=a;}
export function activeAccess(){return active;}
