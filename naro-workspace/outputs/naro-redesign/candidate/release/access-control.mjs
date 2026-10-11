// 회원 승인제: 가입·이메일 인증 뒤 관리자가 승인한 계정만 저장소 연결로 넘어간다.
// 서버·SDK 없이 Firestore REST 하나(무료 Spark 한도 안). 같은 규칙을 firestore.rules가 서버에서 강제한다.
// 엄격 모드(2026-10, 규칙 게시 완료 뒤): 승인 정보를 읽지 못하면(규칙 거부 403·데이터베이스 없음·API 꺼짐 포함)
// 들여보내지 않는다. 관리자 계정은 이 확인을 건너뛰므로 잠기지 않는다. 관리자 화면만 '설정 전'을 구분해 알린다.
// 이 프로젝트의 Firestore에는 옛 시스템 데이터(tenants·users)가 있다: 그 규칙은 건드리지 않고 블록만 더한다.
// 네트워크 등 그 밖의 실패는 들여보내지 않는다.
export const ADMIN_EMAIL='onlysh4sh@gmail.com';
const BASE='https://firestore.googleapis.com/v1/projects/naro-biz/databases/(default)/documents';
const STATUSES=['pending','approved','rejected'];
// 사용자별 맞춤(관리자가 '사용자 승인' 창에서 사람마다 켠다). 앱은 모두 같고, 켜진 사람에게만 보인다.
// 새 기능을 특정 사람에게만 주려면: ① 여기 FEATURES에 {key,label,desc}를 한 줄 더하고
// ② 앱 코드에서 window.ndHas('key')로 감싸거나 CSS로 html:not([data-nd-f~="key"]) .그요소{display:none}.
// 화면에서 숨기는 것일 뿐이라 보안(다른 사람 데이터 접근 막기)에는 쓰지 말 것.
export const FEATURES=[{key:'purchases',label:'매입',desc:'매입 등록·입고 확정·지급·반품(매입 파일은 Dropbox에서만)'}];
// 강조 색: 버튼·선택 표시 등 파란색(--nd-blue) 자리를 바꾼다. ''=기본 파랑.
export const ACCENTS=[['','기본 파랑'],['green','초록'],['teal','청록'],['violet','보라'],['pink','분홍']];
const FEATURE_KEY=/^[a-z0-9-]{1,32}$/;
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
const list=v=>(v?.arrayValue?.values||[]).map(x=>x?.stringValue).filter(k=>typeof k==='string'&&FEATURE_KEY.test(k)).slice(0,50);
const accentOf=v=>ACCENTS.some(([k])=>k===str(v))?str(v):'';
const docOf=d=>({uid:String(d.name||'').split('/').pop(),email:str(d.fields?.email),status:STATUSES.includes(str(d.fields?.status))?str(d.fields?.status):'pending',requestedAt:time(d.fields?.requestedAt),decidedAt:time(d.fields?.decidedAt),features:list(d.fields?.features),accent:accentOf(d.fields?.accent)});
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
 let mine={features:[],accent:''};
 return {
  isAdmin,
  // 변경 기록에 남길 '누가'(로그인 이메일). 저장소·Firestore 어디에도 따로 보내지 않는다.
  who(){try{return auth.email()||'';}catch{return '';}},
  // 마지막 확인의 내 맞춤 정보(관리자는 모든 기능 '*').
  profile:()=>({features:[...mine.features],accent:mine.accent}),
  // {status:'approved'|'pending'|'rejected', admin, setup, email, requestedAt}
  async check(){
   const user=auth.currentIdentity();if(!user?.emailVerified)throw fault('EMAIL_NOT_VERIFIED');
   const email=auth.email();
   if(isAdmin()){mine={features:['*'],accent:''};return {status:'approved',admin:true,setup:true,email,features:['*'],accent:''};}
   let res=await call('/access/'+encodeURIComponent(user.uid));
   if(notSetUp(res,{selfRead:true}))throw fault('ACCESS_CHECK_FAILED');
   if(res.status===404){
    // 처음 들어온 계정: 승인 요청을 남긴다(규칙상 본인 문서를 'pending'으로만 만들 수 있다).
    const created=await call('/access?documentId='+encodeURIComponent(user.uid),{method:'POST',body:{fields:{email:{stringValue:email},status:{stringValue:'pending'},requestedAt:{timestampValue:now().toISOString()}}}});
    if(created.ok)return {status:'pending',admin:false,setup:true,...docOf(created.body)};
    if(created.status!==409)throw fail(created);
    res=await call('/access/'+encodeURIComponent(user.uid));
   }
   if(!res.ok)throw fail(res);
   const d=docOf(res.body);mine={features:d.features,accent:d.accent};return {status:d.status,admin:false,setup:true,email:d.email||email,requestedAt:d.requestedAt,features:d.features,accent:d.accent};
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
  },
  // 관리자만: 한 사람의 켜진 기능·강조 색을 바꾼다(규칙도 관리자만, 이 두 칸만 허용).
  async configure(uid,{features=[],accent=''}={}){
   if(!isAdmin())throw fault('ACCESS_DENIED');
   const known=new Set(FEATURES.map(f=>f.key));
   if(!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid))||!Array.isArray(features)||features.length>50||!features.every(k=>known.has(k))||!ACCENTS.some(([k])=>k===accent))throw fault('VALIDATION');
   const res=await call('/access/'+uid+'?updateMask.fieldPaths=features&updateMask.fieldPaths=accent&currentDocument.exists=true',{method:'PATCH',body:{fields:{features:{arrayValue:{values:[...new Set(features)].map(k=>({stringValue:k}))}},accent:{stringValue:accent}}}});
   if(notSetUp(res))throw fault('ACCESS_NOT_SET_UP');if(res.status===403)throw fault('ACCESS_RULES_OLD');if(!res.ok)throw fail(res);
   return docOf(res.body);
  }
 };
}
// 업무 화면(iframe)이 관리자 요청을 보낼 때 쓰는 현재 로그인의 승인 객체.
let active=null;
export function setActiveAccess(a){active=a;}
export function activeAccess(){return active;}
