import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccess,ADMIN_EMAIL} from './access-control.mjs';
const BASE='https://firestore.googleapis.com/v1/projects/naro-biz/databases/(default)/documents';
function fake({email='buyer@company.co.kr',verified=true,routes=[]}={}){
 const calls=[];
 const auth={currentIdentity:()=>({uid:'u1',emailVerified:verified}),email:()=>email,idToken:async()=>'tok'};
 const fetcher=async(url,opt)=>{calls.push({url,method:opt.method,body:opt.body?JSON.parse(opt.body):null,auth:opt.headers.Authorization});
  const r=routes.shift();if(r instanceof Error)throw r;return {status:r.status,ok:r.status<300,json:async()=>r.body};};
 return {calls,access:createAccess({auth,fetcher,now:()=>new Date('2026-10-02T05:00:00Z')})};
}
const doc=(status,extra={})=>({name:'projects/naro-biz/databases/(default)/documents/access/u1',fields:{email:{stringValue:'buyer@company.co.kr'},status:{stringValue:status},requestedAt:{timestampValue:'2026-10-01T00:00:00Z'},...extra}});

test('관리자는 요청 없이 승인',async()=>{
 const {access,calls}=fake({email:ADMIN_EMAIL.toUpperCase()});
 assert.equal((await access.check()).status,'approved');assert.equal(access.isAdmin(),true);assert.equal(calls.length,0);
});
test('Firestore를 켜기 전(데이터베이스 없음·API 꺼짐)에는 지금처럼 들어간다',async()=>{
 for(const r of [{status:404,body:{error:{message:'The database (default) does not exist for project naro-biz',status:'NOT_FOUND'}}},
  {status:403,body:{error:{message:'Cloud Firestore API has not been used in project 1 before or it is disabled.',status:'PERMISSION_DENIED'}}}]){
  const {access}=fake({routes:[r]});const res=await access.check();assert.equal(res.status,'approved');assert.equal(res.setup,false);
 }
});
test('처음 들어온 계정은 승인 대기 요청을 남긴다(본인 uid · pending · 로그인 이메일)',async()=>{
 const {access,calls}=fake({routes:[{status:404,body:{error:{message:'Document "projects/naro-biz/databases/(default)/documents/access/u1" not found.',status:'NOT_FOUND'}}},{status:200,body:doc('pending')}]});
 const res=await access.check();assert.equal(res.status,'pending');
 assert.equal(calls[0].url,BASE+'/access/u1');assert.equal(calls[0].auth,'Bearer tok');
 assert.equal(calls[1].method,'POST');assert.equal(calls[1].url,BASE+'/access?documentId=u1');
 assert.deepEqual(calls[1].body.fields,{email:{stringValue:'buyer@company.co.kr'},status:{stringValue:'pending'},requestedAt:{timestampValue:'2026-10-02T05:00:00.000Z'}});
});
test('저장된 상태를 그대로 따른다',async()=>{
 for(const s of ['approved','rejected','pending']){const {access}=fake({routes:[{status:200,body:doc(s)}]});assert.equal((await access.check()).status,s);}
 const {access}=fake({routes:[{status:200,body:doc('bogus')}]});assert.equal((await access.check()).status,'pending');
});
test('규칙 거부·네트워크 오류는 들여보내지 않는다',async()=>{
 await assert.rejects(fake({routes:[{status:403,body:{error:{message:'Missing or insufficient permissions.',status:'PERMISSION_DENIED'}}}]}).access.check(),{code:'ACCESS_CHECK_FAILED'});
 await assert.rejects(fake({routes:[new TypeError('fetch failed')]}).access.check(),{code:'NETWORK_ERROR'});
 await assert.rejects(fake({verified:false}).access.check(),{code:'EMAIL_NOT_VERIFIED'});
});
test('목록·결정은 관리자만, 결정은 status·decidedAt만 바꾼다',async()=>{
 const user=fake();await assert.rejects(user.access.list(),{code:'ACCESS_DENIED'});await assert.rejects(user.access.decide('u1','approved'),{code:'ACCESS_DENIED'});
 const admin=fake({email:ADMIN_EMAIL,routes:[{status:200,body:{documents:[doc('pending')],nextPageToken:'p2'}},{status:200,body:{documents:[doc('approved')]}},{status:200,body:doc('approved',{decidedAt:{timestampValue:'2026-10-02T05:00:00Z'}})}]});
 const list=await admin.access.list();assert.deepEqual(list.map(u=>[u.uid,u.status]),[['u1','pending'],['u1','approved']]);
 assert.ok(admin.calls[1].url.endsWith('&pageToken=p2'));
 const d=await admin.access.decide('u1','approved');assert.equal(d.status,'approved');
 const c=admin.calls[2];assert.equal(c.method,'PATCH');assert.equal(c.url,BASE+'/access/u1?updateMask.fieldPaths=status&updateMask.fieldPaths=decidedAt&currentDocument.exists=true');
 assert.deepEqual(Object.keys(c.body.fields).sort(),['decidedAt','status']);
 await assert.rejects(admin.access.decide('../x','approved'),{code:'VALIDATION'});await assert.rejects(admin.access.decide('u1','owner'),{code:'VALIDATION'});
});
