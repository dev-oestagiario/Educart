// Local release rehearsal only. Does not deploy, merge, tag, touch the remote DB or grant approval.
import {spawnSync} from 'node:child_process';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {verifyArtifact} from './verificar-artefato-release.mjs';
import {probeDeploy,probeVersion} from './verificar-saude-deploy.mjs';
import {createServer} from 'node:http';
import {resolve,relative,isAbsolute} from 'node:path';
import assert from 'node:assert/strict';

const npm=process.env.npm_execpath;
const sha=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim();
if(!npm||!sha||!(/^[a-f0-9]{40}$/).test(sha)||process.env.EDUCART_LOCAL_RELEASE_PREFLIGHT!=='1'){
 console.error('Use npm run release:preflight em worktree de teste, com EDUCART_LOCAL_RELEASE_PREFLIGHT=1.');process.exit(2);
}
const dirty=spawnSync('git',['status','--porcelain','--untracked-files=normal'],{encoding:'utf8'});
if(dirty.status!==0||dirty.stdout.trim()){console.error('Worktree deve estar limpo.');process.exit(2);}
const env={...process.env,CI:'1',VITE_SUPABASE_URL:'https://educart-e2e.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_e2e_test_only'};
const results=[];
function run(name,args,timeout=300000){
 const start=Date.now();const p=spawnSync(process.execPath,args,{env,timeout,encoding:'utf8',maxBuffer:16*1024*1024});
 const ok=p.status===0&&!p.error;
 results.push({name,ok,exit:p.status,ms:Date.now()-start});
 console.log(name+': '+(ok?'PASS':'FAIL'));
 // Synthetic local outputs; capture detailed output separately only if necessary.
 return p;
}
const np=(name,args,timeout)=>run(name,[npm,...args],timeout);
np('typecheck',['run','typecheck']);
const unit=np('vitest',['test','--','--maxWorkers=2']);
console.log((unit.stdout??'').split(/\r?\n/).filter(x=>/Test Files|Tests\s+\d/.test(x)).join('\n'));
run('node-tests',['--test','scripts/verificar-f5-2-layout.mjs','scripts/email-worker.test.mjs','scripts/verificar-saude-deploy.test.mjs','scripts/verificar-artefato-release.test.mjs','scripts/homologacao-preflight.test.mjs','scripts/verificar-backup-operacional.test.mjs','scripts/monitorar-operacao.test.mjs']);
run('glb',['scripts/generate-f5-3-assets.mjs','--check']);
np('audit-full',['run','audit']);
np('audit-runtime',['run','audit:runtime']);
np('audit-bundle',['run','audit:bundle']);
for(const file of ['verificar-f5-6-sql','verificar-sql-local','ensaiar-f6-1-recuperacao'])run(file,['scripts/'+file+'.mjs']);
if(!existsSync('.local-sql-test/node_modules/axe-core/axe.min.js')){
 results.push({name:'axe-required',ok:false});console.log('axe-required: FAIL');
}
const e2e=run('e2e',['node_modules/@playwright/test/cli.js','test','--workers=3','--retries=0','--reporter=json'],600000);
try{
 const data=JSON.parse(e2e.stdout);
 const tests=[];
 const walk=s=>{for(const spec of s.specs??[])for(const t of spec.tests??[])tests.push({title:spec.title,status:t.status});for(const child of s.suites??[])walk(child);};
 for(const suite of data.suites??[])walk(suite);
 const skip=tests.filter(t=>t.status==='skipped').map(t=>t.title).sort();
 const legacy=['Fase 5 — navegação mobile e alternativa textual sem WebGL','Fase 5 — ocupação 3D mantém capacidade e revela detalhes também via lista'].sort();
 const ok=tests.length>2&&data.stats.unexpected===0&&data.stats.flaky===0&&data.stats.expected===tests.length-2&&JSON.stringify(skip)===JSON.stringify(legacy);
 results.push({name:'e2e-coverage',ok,passed:data.stats.expected,skipped:data.stats.skipped,unexpected:data.stats.unexpected});
 console.log('e2e-coverage: '+(ok?'PASS':'FAIL')+' '+JSON.stringify(data.stats));
}catch{results.push({name:'e2e-coverage',ok:false});console.log('e2e-coverage: FAIL');}
const build=np('build-synthetic',['run','build']);
if(build.status===0){
 try{
  // This is deliberately not a publishable artifact. Input points only to the mock API.
  const dir=resolve('dist'),ref='local-rehearsal';
  writeFileSync(resolve(dir,'version.json'),JSON.stringify({commit:sha,ref,build:new Date().toISOString()},null,2));
  const a=await verifyArtifact(dir,sha,ref);assert.ok(a.ok);
  results.push({name:'artifact',ok:true,entryAssets:a.entryAssets});
  const server=createServer((req,res)=>{
   try{
    if(req.method!=='GET'||!req.url.startsWith('/Educart/'))throw Error();
    const path=resolve(dir,decodeURIComponent(req.url.slice('/Educart/'.length))||'index.html'),rel=relative(dir,path);
    if(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')||isAbsolute(rel))throw Error();
    const mime=path.endsWith('.js')?'application/javascript':path.endsWith('.json')?'application/json':'text/html';
    res.writeHead(200,{'content-type':mime});res.end(readFileSync(path));
   }catch{res.writeHead(404);res.end();}
  });
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  try{const url='http://127.0.0.1:'+server.address().port+'/Educart/';assert.ok((await probeDeploy(url)).ok);assert.ok((await probeVersion(url,sha)).ok);results.push({name:'local-http',ok:true});}
  finally{await new Promise(r=>server.close(r));}
 }catch{results.push({name:'artifact-or-probe',ok:false});}
}
const localChecksPassed=results.every(r=>r.ok);
console.log(JSON.stringify({sha,localChecksPassed,publicationApproved:false,syntheticArtifact:true,externalGates:['isolated-auth-db','real-backup-restore','monitoring-activation','physical-institutional-acceptance','authorized-pipeline','explicit-release-approval'],results}));
if(!localChecksPassed)process.exitCode=1;
