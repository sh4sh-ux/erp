import test from 'node:test';
import assert from 'node:assert/strict';
import {Onboarding,message} from '../core.mjs';
import {GoogleDriveProvider} from '../providers.mjs';
import {mockAuth,mockCloud} from '../mock.mjs';
const email='person@example.invalid',password='local-mock-only';
function setup(states){
 const auth=mockAuth(),cloud=mockCloud(),calls={n:0};
 const access={check:async()=>{calls.n++;const s=states.length>1?states.shift():states[0];if(s instanceof Error)throw s;return {status:s,email};}};
 const flow=new Onboarding({auth,access,providerFactory:(kind,uid,signal)=>new GoogleDriveProvider(cloud(kind,uid),{signal})});
 return {auth,flow,calls};
}
async function verified(s){await s.flow.authenticate('signup',email,password,password);s.auth.confirmMockEmail();await s.flow.verify();}

test('승인 전: 이메일 인증 뒤 승인 대기에서 멈추고, 저장소 연결도 막힌다',async()=>{
 const s=setup(['pending']);await verified(s);
 assert.equal(s.flow.state.screen,'pending');assert.equal(s.flow.state.access.status,'pending');
 await s.flow.connect('drive');assert.equal(s.flow.state.ready,false);assert.equal(s.flow.state.screen,'pending');assert.equal(s.flow.state.error,'ACCESS_PENDING');
});
test('승인되면 [승인 확인하기]로 저장소 연결 화면으로 넘어가 사용한다',async()=>{
 const s=setup(['pending','pending','approved']);await verified(s);
 await s.flow.recheck();assert.equal(s.flow.state.screen,'pending');assert.equal(s.flow.state.error,'ACCESS_PENDING');
 await s.flow.recheck();assert.equal(s.flow.state.screen,'storage');assert.equal(s.flow.state.error,null);
 await s.flow.connect('drive');assert.equal(s.flow.state.ready,true);
});
test('거절된 계정은 승인 안 됨 화면',async()=>{
 const s=setup(['rejected']);await verified(s);assert.equal(s.flow.state.screen,'rejected');
 await s.flow.recheck();assert.equal(s.flow.state.screen,'rejected');assert.equal(s.flow.state.error,'ACCESS_REJECTED');
});
test('승인 확인 실패는 들여보내지 않고 승인 대기 화면에서 다시 확인할 수 있다',async()=>{
 const s=setup([Object.assign(Error('x'),{code:'NETWORK_ERROR'}),'approved']);await verified(s);
 assert.equal(s.flow.state.screen,'pending');assert.equal(s.flow.state.error,'NETWORK_ERROR');
 await s.flow.recheck();assert.equal(s.flow.state.screen,'storage');
});
test('로그인할 때마다 확인한다: 승인 취소되면 다음 로그인에서 멈춘다',async()=>{
 const s=setup(['approved','approved','pending']);await verified(s);assert.equal(s.flow.state.screen,'storage');
 await s.flow.logout();await s.flow.authenticate('login',email,password);assert.equal(s.flow.state.screen,'storage');
 await s.flow.logout();await s.flow.authenticate('login',email,password);assert.equal(s.flow.state.screen,'pending');
});
test('승인 문구',()=>{for(const c of ['ACCESS_PENDING','ACCESS_REJECTED','ACCESS_CHECK_FAILED'])assert.notEqual(message(c),message('UNAVAILABLE'));});
