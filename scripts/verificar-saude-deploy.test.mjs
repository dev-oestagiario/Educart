import test from 'node:test';
import assert from 'node:assert/strict';
import {probeDeploy,validatedTarget} from './verificar-saude-deploy.mjs';
const base='https://example.test/Educart/';
const html=(src='./assets/index-test.js')=>'<html><title>Educart</title><div id="root"></div><script type="module" src="'+src+'"></script></html>';
const response=(body,type='text/html',status=200)=>new Response(body,{headers:{'content-type':type},status});
test('probe requires successful HTML and same-base JS without credentials',async()=>{
 const calls=[];const result=await probeDeploy(base,async(url,init)=>{calls.push([url.href,init]);return calls.length===1?response(html()):response('const privateContent=1','text/javascript');});
 assert.equal(result.ok,true);assert.equal(calls[1][0],base+'assets/index-test.js');
 for(const [,init] of calls){assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');}
 assert.ok(!JSON.stringify(result).includes('privateContent')&&!JSON.stringify(result).includes(base));
});
test('rejects redirect, missing or external entry and HTML error masquerading as JS',async()=>{
 for(const src of ['https://evil.test/a.js','../assets/index.js','/assets/index.js','./assets/index.js?key=1']){
  let n=0;const report=await probeDeploy(base,async()=>{n++;return response(html(src));});assert.equal(report.ok,false);assert.equal(n,1);
 }
 assert.equal((await probeDeploy(base,async()=>{throw Error('secret URL');})).ok,false);
 let n=0;assert.equal((await probeDeploy(base,async()=>++n===1?response(html()):response('wrong type'))).ok,false);
});
test('rejects HTTP error, unexpected app, overlarge and empty responses',async()=>{
 for(const r of [()=>response('not available','text/html',503),()=>response('<h1>not Educart</h1>'),()=>response('x'.repeat(513*1024)),()=>response('')])assert.equal((await probeDeploy(base,async()=>r())).ok,false);
});
test('rejects credentials, query, fragment, non-HTTPS remote, missing trailing slash',()=>{
 for(const u of ['https://a:b@example.test/','https://example.test/?token=x','https://example.test/#x','http://example.test/','https://example.test/Educart'])assert.throws(()=>validatedTarget(u));
 assert.equal(validatedTarget('http://127.0.0.1:4173/').hostname,'127.0.0.1');
});
