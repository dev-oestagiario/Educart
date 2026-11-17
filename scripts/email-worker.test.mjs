import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processEmailBatch} from './email-worker.mjs';
const jobs=[{id:'a',lease_token:'token-a',kind:'NOVO_PEDIDO',attempts:1},{id:'b',lease_token:'token-b',kind:'EQUIPAMENTO_DEVOLVIDO',attempts:1}];
function fixture({result='SENT',authorized=true,throwTransport=false,finish=true}={}){
 const calls=[],messages=[];
 return {calls,messages,rpc:async(name,args)=>{
  calls.push({name,args});
  return {error:null,data:name==='claim_email_batch'?jobs:name==='authorize_email_send'?(authorized?'synthetic@example.test':null):finish};
 },transport:async message=>{messages.push(message);if(throwTransport)throw Error('unknown outcome');return result;}};
}
test('worker disabled by default does not query or deliver',async()=>{
 const f=fixture();assert.equal((await processEmailBatch(f)).claimed,0);assert.equal(f.calls.length,0);assert.equal(f.messages.length,0);
});
test('worker sends only generic text, stable idempotency key and aggregate counts',async()=>{
 const f=fixture();const s=await processEmailBatch({...f,enabled:true});
 assert.equal(s.sent,2);assert.equal(f.messages[0].idempotencyKey,'educart-email-a');assert.equal(f.messages[1].idempotencyKey,'educart-email-b');
 assert.match(f.messages[1].subject,/Devolução/);assert.ok(!JSON.stringify(s).includes('synthetic@'));
});
test('revoked preference prevents transport',async()=>{
 const f=fixture({authorized:false});assert.equal((await processEmailBatch({...f,enabled:true})).cancelled,2);assert.equal(f.messages.length,0);
});
test('definitive rejection may retry, ambiguous acceptance goes to review',async()=>{
 const f=fixture({result:'RETRY'});assert.equal((await processEmailBatch({...f,enabled:true})).retry,2);
 const g=fixture({throwTransport:true});assert.equal((await processEmailBatch({...g,enabled:true})).review,2);
 assert.ok(g.calls.filter(x=>x.name==='finish_email_delivery').every(x=>x.args.p_outcome==='REVIEW'));
});
test('lost completion acknowledgment does not resend',async()=>{
 const f=fixture({finish:false});const s=await processEmailBatch({...f,enabled:true});assert.equal(s.unconfirmed,2);assert.equal(f.messages.length,2);assert.equal(s.sent,0);
});
