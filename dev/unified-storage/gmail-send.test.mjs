import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMime,recipients,createGmailSender,gmailScope} from './gmail-send.mjs';

const decode=raw=>Buffer.from(raw.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
const word=s=>Buffer.from(s.match(/=\?UTF-8\?B\?([^?]+)\?=/)[1],'base64').toString('utf8');

test('MIME: UTF-8 subject/body and the PNG attachment, CRLF lines',()=>{
 const bytes=new Uint8Array([137,80,78,71,1,2,3]);
 const mime=decode(buildMime({to:'a@b.co, c@d.kr',subject:'[디에디트] 견적서 Q-1',body:'담당자님, 안녕하세요.\n감사합니다.',filename:'견적서_Q-1.png',bytes,boundary:'B'}));
 assert.match(mime,/^To: a@b\.co, c@d\.kr\r\n/);
 assert.equal(word(mime.match(/^Subject: (.*)$/m)[1]),'[디에디트] 견적서 Q-1');
 const parts=mime.split('--B');
 assert.equal(Buffer.from(parts[1].split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString('utf8'),'담당자님, 안녕하세요.\n감사합니다.');
 assert.match(parts[2],/Content-Type: image\/png/);
 assert.equal(word(parts[2].match(/filename="([^"]+)"/)[1]),'견적서_Q-1.png');
 assert.deepEqual([...Buffer.from(parts[2].split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64')],[...bytes]);
 assert.ok(mime.endsWith('--B--\r\n'));
});
test('headers cannot be injected through the subject or recipients',()=>{
 const mime=decode(buildMime({to:'a@b.co',subject:'hi\r\nBcc: evil@x.com',body:'x',boundary:'B'}));
 assert.ok(!/^Bcc:/m.test(mime));
 assert.throws(()=>recipients('a@b.co\r\nBcc: evil@x.com'),{code:'BAD_RECIPIENT'});
 for(const bad of ['', 'nope', 'a@b', '<a@b.co>', 'a@b.co; '.repeat(21)])assert.throws(()=>recipients(bad),{code:'BAD_RECIPIENT'});
 assert.deepEqual(recipients(' a@b.co ; c@d.kr '),['a@b.co','c@d.kr']);
});

function fakeGoogle({scope=gmailScope+' email',error,sendStatus=[200],userEmail='me@gmail.com'}={}){
 const calls={tokens:0,sends:[],revoked:0,hints:[]};
 const identity={initTokenClient(cfg){return {requestAccessToken(){calls.tokens++;calls.hints.push(cfg.login_hint||'');
  setTimeout(()=>error?cfg.error_callback({type:error}):cfg.callback({access_token:'t'+calls.tokens,expires_in:3600,scope}),0);}};},revoke(t,cb){calls.revoked++;cb?.();}};
 const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const fetcher=async(url,opt)=>{
  if(url.includes('userinfo'))return {ok:true,json:async()=>({email:userEmail})};
  calls.sends.push({auth:opt.headers.Authorization,raw:JSON.parse(opt.body).raw});
  const status=sendStatus.shift()??200;
  const err={403:{error:{message:'Gmail API has not been used in project 519731535486 before or it is disabled.',status:'PERMISSION_DENIED'}},401:{error:{status:'UNAUTHENTICATED'}},429:{error:{message:'rateLimitExceeded'}}}[status];
  return {ok:status===200,status,json:async()=>status===200?{id:'m1'}:err};
 };
 const win={location:{origin:'https://naro-biz.web.app'},localStorage:storage,document:{}};
 return {calls,storage,sender:createGmailSender({win,fetcher,storage,loadIdentity:async()=>identity})};
}
const msg={to:'buyer@co.kr',subject:'s',body:'b',filename:'q.png',bytes:new Uint8Array([1,2,3])};

test('send: one consent, then the token is reused; the sender address is remembered',async()=>{
 const {calls,sender,storage}=fakeGoogle();
 assert.deepEqual(await sender.send(msg),{from:'me@gmail.com'});
 await sender.send(msg);
 assert.equal(calls.tokens,1);assert.equal(calls.sends.length,2);
 assert.equal(storage.getItem('naroGmail'),'me@gmail.com');assert.deepEqual(sender.status(),{email:'me@gmail.com'});
});
test('send: an expired token re-authorizes once and retries',async()=>{
 const {calls,sender}=fakeGoogle({sendStatus:[401,200]});
 await sender.send(msg);assert.equal(calls.tokens,2);assert.equal(calls.sends.length,2);assert.equal(calls.sends[1].auth,'Bearer t2');
});
test('send: clear codes for setup, consent and recipient problems; nothing sent for a bad address',async()=>{
 await assert.rejects(fakeGoogle({sendStatus:[403]}).sender.send(msg),{code:'GMAIL_NOT_ENABLED'});
 await assert.rejects(fakeGoogle({sendStatus:[429]}).sender.send(msg),{code:'RATE_LIMIT'});
 await assert.rejects(fakeGoogle({scope:'email'}).sender.send(msg),{code:'SCOPE_DENIED'});
 await assert.rejects(fakeGoogle({error:'popup_closed'}).sender.send(msg),{code:'CANCELLED'});
 await assert.rejects(fakeGoogle({error:'popup_failed_to_open'}).sender.send(msg),{code:'POPUP_BLOCKED'});
 const g=fakeGoogle();await assert.rejects(g.sender.send({...msg,to:'not-an-address'}),{code:'BAD_RECIPIENT'});
 assert.equal(g.calls.tokens,0);assert.equal(g.calls.sends.length,0);
});
test('disconnect revokes the token and forgets the address; next send asks again with no hint',async()=>{
 const {calls,sender,storage}=fakeGoogle();
 await sender.send(msg);sender.disconnect();
 assert.equal(calls.revoked,1);assert.equal(storage.getItem('naroGmail'),null);
 await sender.send(msg);assert.equal(calls.tokens,2);assert.deepEqual(calls.hints,['','']);
});
test('other origins never start Google sign-in',async()=>{
 const g=fakeGoogle();const s=createGmailSender({win:{location:{origin:'https://evil.example'},localStorage:g.storage,document:{}},loadIdentity:async()=>{throw Error('must not load');}});
 await assert.rejects(s.send(msg),{code:'OAUTH_SETUP_REQUIRED'});
});
