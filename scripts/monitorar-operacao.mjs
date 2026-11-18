// One-shot external monitor. Run under an approved independent scheduler.
// Local aggregate state only; no account credentials, notifications or remote writes.
import assert from 'node:assert/strict';
import {lstat,realpath,readFile,writeFile,rename,mkdir,rmdir,unlink} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {probeDeploy,probeVersion,validatedTarget} from './verificar-saude-deploy.mjs';
import {verifyBackupPair} from './verificar-backup-operacional.mjs';
const H=3600000,M=60000;
const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const safeTime=(t,now)=>Number.isSafeInteger(t)&&t>0&&t<=now;
const empty=()=>({checkedAt:null,failures:0,successes:0,incident:false,outcome:'unknown'});
export function initialState(){return {schemaVersion:1,deploy:empty(),backup:{checkedAt:null,ageMs:null,outcome:'unknown'}};}
export function validateState(s,now){
 assert.ok(fields(s,['schemaVersion','deploy','backup'])&&s.schemaVersion===1,'Estado inválido');
 const d=s.deploy,b=s.backup;
 assert.ok(fields(d,['checkedAt','failures','successes','incident','outcome'])&&fields(b,['checkedAt','ageMs','outcome']),'Estado inválido');
 assert.ok([d.checkedAt,b.checkedAt].every(t=>t===null||safeTime(t,now)),'Relógio/estado inválido');
 assert.ok([d.failures,d.successes].every(n=>Number.isInteger(n)&&n>=0&&n<=3)&&!(d.failures&&d.successes)&&typeof d.incident==='boolean'&&['healthy','failed','unknown'].includes(d.outcome),'Contadores inválidos');
 assert.ok(d.checkedAt===null?d.outcome==='unknown'&&!d.incident&&d.failures===0&&d.successes===0:d.outcome!=='unknown'&&(d.outcome==='healthy'?d.successes>0:d.failures>0),'Estado de deploy inconsistente');
 assert.ok((d.failures<3||d.incident)&&(d.successes<2||!d.incident),'Incidente inconsistente');
 assert.ok(['verified','invalid','unknown'].includes(b.outcome)&&((b.outcome==='unknown')===(b.checkedAt===null))&&(b.outcome==='verified'?Number.isSafeInteger(b.ageMs)&&b.ageMs>=0:b.ageMs===null),'Backup inválido');
 return s;
}
export function applyDeploy(s,ok,now){
 validateState(s,now);assert.equal(typeof ok,'boolean');const d=s.deploy;
 // A long gap is missing coverage, not evidence of consecutive checks.
 const contiguous=d.checkedAt!==null&&now-d.checkedAt<=15*M;
 const failures=ok?0:Math.min(3,(contiguous?d.failures:0)+1);
 const successes=ok?Math.min(2,(contiguous?d.successes:0)+1):0;
 const incident=d.incident?(successes<2):failures>=3;
 return {state:{...s,deploy:{checkedAt:now,failures,successes,incident,outcome:ok?'healthy':'failed'}},event:incident&&!d.incident?'deploy-open':!incident&&d.incident?'deploy-recovered':null};
}
export function applyBackup(s,ageMs,now){
 validateState(s,now);
 assert.ok(ageMs===null||Number.isSafeInteger(ageMs)&&ageMs>=0,'Idade inválida');
 return {...s,backup:{checkedAt:now,ageMs,outcome:ageMs===null?'invalid':'verified'}};
}
export function summarize(s,now){
 validateState(s,now);
 const d=s.deploy,b=s.backup;
 const deployment=d.checkedAt===null||now-d.checkedAt>15*M?'unknown':d.incident?'incident':d.outcome==='failed'?'degraded':'healthy';
 const elapsed=b.checkedAt===null?null:now-b.checkedAt;
 const backup=b.outcome==='invalid'?'invalid':b.outcome==='unknown'||elapsed>26*H?'unknown':b.ageMs+elapsed>24*H?'stale':'verified';
 const alerts=[];
 if(d.incident)alerts.push('deploy-incident');
 if(deployment==='unknown')alerts.push('deploy-evidence-missing');
 if(backup!=='verified')alerts.push('backup-'+backup);
 return {deployment,backup,deployIncident:d.incident,alerts,checkedAt:new Date(now).toISOString(),deployCheckedAt:d.checkedAt===null?null:new Date(d.checkedAt).toISOString(),backupCheckedAt:b.checkedAt===null?null:new Date(b.checkedAt).toISOString(),backupAgeHours:b.ageMs===null?null:Math.round((b.ageMs+elapsed)/H*100)/100,restoreVerified:false};
}
export function validateConfig(c){
 assert.ok(fields(c,['deployUrl','expectedSha','backupPrimary','backupSecondary','projectRef']),'Config inválida');
 validatedTarget(c.deployUrl);
 assert.ok(typeof c.expectedSha==='string'&&/^[a-f0-9]{40}$/.test(c.expectedSha),'SHA inválido');
 assert.ok(typeof c.projectRef==='string'&&/^[a-z0-9]{20}$/.test(c.projectRef),'Projeto inválido');
 assert.ok([c.backupPrimary,c.backupSecondary].every(p=>typeof p==='string'&&isAbsolute(p)),'Diretórios absolutos obrigatórios');
 return c;
}
async function readJson(dir,name,optional=false){
 const path=join(dir,name);let st;
 try{st=await lstat(path);}catch(e){if(optional&&e.code==='ENOENT')return null;throw e;}
 assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=16384&&await realpath(path)===path,'Arquivo inválido');
 const raw=await readFile(path,'utf8');assert.ok(Buffer.byteLength(raw)<=16384,'Arquivo grande demais');
 return JSON.parse(raw);
}
async function writeState(dir,state){
 const dest=join(dir,'state.json'),tmp=join(dir,'.state-'+randomUUID());
 try{await writeFile(tmp,JSON.stringify(state)+'\n',{flag:'wx',mode:0o600});await rename(tmp,dest);}
 finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export async function runMonitor(dirInput,mode,{clock=Date.now,deploy=probeDeploy,version=probeVersion,backup=verifyBackupPair}={}){
 assert.ok(['deploy','backup','status'].includes(mode),'Modo inválido');
 const raw=resolve(dirInput),stat=await lstat(raw),dir=await realpath(raw);
 assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'Diretório inválido');
 const repo=await realpath(fileURLToPath(new URL('../',import.meta.url))),rel=relative(repo,dir);
 assert.ok(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\'),'Estado fora do Git obrigatório');
 const lock=join(dir,'.monitor-lock');await mkdir(lock,{mode:0o700});
 try{
  const cfg=validateConfig(await readJson(dir,'config.json'));
  const prior=await readJson(dir,'state.json',true);
  const configHash=createHash('sha256').update(JSON.stringify(Object.keys(cfg).sort().map(k=>[k,cfg[k]]))).digest('hex');
  if(prior!==null)assert.ok(fields(prior,['configHash','state'])&&prior.configHash===configHash,'Configuração mudou; arquive o estado e revalide.');
  const initial=prior===null?initialState():prior.state;
  validateState(initial,clock());
  let state=initial,event=null;
  if(mode==='deploy'){
   let ok=false;
   try{const r=await deploy(cfg.deployUrl);ok=r.ok===true&&(await version(cfg.deployUrl,cfg.expectedSha)).ok===true;}catch{}
   ({state,event}=applyDeploy(initial,ok,clock()));
  }
  if(mode==='backup'){
   let age=null;
   try{
    const checkedAt=clock();
    const r=await backup(cfg.backupPrimary,cfg.backupSecondary,cfg.projectRef,checkedAt);
    assert.ok(r.copiesVerified===2&&Number.isSafeInteger(r.ageMs)&&r.ageMs>=0);
    age=r.ageMs+Math.max(0,clock()-checkedAt);
   }catch{}
   state=applyBackup(initial,age,clock());
  }
  if(mode!=='status')await writeState(dir,{configHash,state});
  const summary=summarize(state,clock());
  return {...summary,event,mode};
 }finally{await rmdir(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  assert.equal(process.argv.length,4);
  const r=await runMonitor(process.argv[3],process.argv[2]);
  console.log(JSON.stringify(r));
  if(r.alerts.length)process.exitCode=1;
 }catch{
  console.error('Monitor indisponível: confira configuração, diretório protegido, relógio e execução concorrente. Nenhum detalhe sensível exibido.');
  process.exitCode=2;
 }
}
