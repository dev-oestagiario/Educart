import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,applyDeploy,applyBackup,summarize,validateState,runMonitor} from './monitorar-operacao.mjs';
import {probeVersion} from './verificar-saude-deploy.mjs';
const now=Date.parse('2026-11-18T15:00:00Z'),M=60000,H=3600000,sha='a'.repeat(40),base='http://127.0.0.1:5173/Educart/';
test('3 failures open and 2 successes recover',()=>{
 let s=initialState(),r;for(let i=0;i<3;i++){r=applyDeploy(s,false,now+i*M);s=r.state;assert.equal(r.event,i===2?'deploy-open':null);}
 assert.equal(summarize(s,now+3*M).deployment,'incident');
 r=applyDeploy(s,true,now+3*M);assert.equal(r.state.deploy.incident,true);assert.equal(r.event,null);
 r=applyDeploy(r.state,true,now+4*M);assert.equal(r.event,'deploy-recovered');
 assert.equal(summarize(r.state,now+4*M).deployment,'healthy');
});
test('gap resets streak but does not close existing incident',()=>{
 let s=applyDeploy(initialState(),false,now).state;
 s=applyDeploy(s,false,now+16*M).state;assert.equal(s.deploy.failures,1);
 s=applyDeploy(s,false,now+17*M).state;s=applyDeploy(s,false,now+18*M).state;
 assert.equal(summarize(s,now+34*M).deployment,'unknown');assert.ok(summarize(s,now+34*M).alerts.includes('deploy-incident'));
 s=applyDeploy(s,true,now+35*M).state;s=applyDeploy(s,true,now+51*M).state;assert.ok(s.deploy.incident);
});
test('backup missing, invalid, expired and stale verification never healthy',()=>{
 const s=initialState();assert.equal(summarize(s,now).backup,'unknown');
 const valid=applyBackup(s,23*H,now);assert.equal(summarize(valid,now+H).backup,'verified');assert.equal(summarize(valid,now+H+1).backup,'stale');
 assert.equal(summarize(applyBackup(s,null,now),now).backup,'invalid');
 assert.equal(summarize(applyBackup(s,0,now),now+27*H).backup,'unknown');
});
test('future timestamps, corrupted counters and extra fields rejected',()=>{
 const s=initialState();assert.throws(()=>validateState({...s,extra:'secret'},now));assert.throws(()=>validateState({...s,deploy:{...s.deploy,checkedAt:now+1}},now));assert.throws(()=>validateState({...s,deploy:{...s.deploy,failures:100}},now));
});
test('version requires expected SHA and same-origin bounded JSON',async()=>{
 const fixture={commit:sha,ref:'main',build:'2026-11-18T14:00:00.000Z'};
 const reply=(x)=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
 assert.equal((await probeVersion(base,sha,(u,init)=>{assert.equal(String(u),base+'version.json');assert.equal(init.redirect,'error');return reply(fixture);})).ok,true);
 assert.equal((await probeVersion(base,sha,()=>reply({...fixture,commit:'b'.repeat(40)}))).ok,false);
 assert.equal((await probeVersion(base,sha,()=>reply({...fixture,extra:'secret'}))).ok,false);
 assert.equal((await probeVersion(base,sha,()=>new Response('x'.repeat(9000),{headers:{'content-type':'application/json'}}))).ok,false);
});
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'educart-monitor-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const cfg={deployUrl:base,expectedSha:sha,projectRef:'abcdefghijklmnopqrst',backupPrimary:join(dir,'primary'),backupSecondary:join(dir,'secondary')};await writeFile(join(dir,'config.json'),JSON.stringify(cfg));return dir;
}
test('persists transitions over separate executions, no config or secrets persisted',async t=>{
 const dir=await fixture(t);let time=now;
 const deps={clock:()=>time,deploy:async()=>({ok:true}),version:async()=>({ok:true}),backup:async()=>({copiesVerified:2,ageMs:1000})};
 let r=await runMonitor(dir,'backup',deps);assert.equal(r.backup,'verified');assert.equal(r.deployment,'unknown');
 r=await runMonitor(dir,'deploy',deps);assert.equal(r.deployment,'healthy');assert.deepEqual(r.alerts,[]);
 const raw=await readFile(join(dir,'state.json'),'utf8');for(const key of [base,sha,'abcdefghijklmnopqrst','primary','secondary'])assert.ok(!raw.includes(key));
 time+=25*H;r=await runMonitor(dir,'status',deps);assert.equal(r.backup,'stale');assert.equal(r.deployment,'unknown');
});
test('version mismatch is deployment failure and invalid backup raises alert',async t=>{
 const dir=await fixture(t),deps={clock:()=>now,deploy:async()=>({ok:true}),version:async()=>({ok:false}),backup:async()=>{throw Error('sensitive');}};
 const a=await runMonitor(dir,'deploy',deps);assert.equal(a.deployment,'degraded');
 const b=await runMonitor(dir,'backup',deps);assert.ok(b.alerts.includes('backup-invalid'));
 assert.ok(!JSON.stringify(b).includes('sensitive'));
});
test('concurrent run fails closed and corrupt state is not reset',async t=>{
 const dir=await fixture(t);await mkdir(join(dir,'.monitor-lock'));await assert.rejects(()=>runMonitor(dir,'status',{clock:()=>now}));await rm(join(dir,'.monitor-lock'),{recursive:true});
 await writeFile(join(dir,'state.json'),'{}');await assert.rejects(()=>runMonitor(dir,'status',{clock:()=>now}));assert.equal(await readFile(join(dir,'state.json'),'utf8'),'{}');
});
