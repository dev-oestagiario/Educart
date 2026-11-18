// Offline validation of an operator-created encrypted logical bundle.
// Never connects to Supabase, exports data, decrypts or restores a backup.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,open,realpath,writeFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const header=Buffer.from('age-encryption.org/v1\n');
const MAX_METADATA=16384;
export const requiredScope=['roles','schema','data','migration-history','auth','configuration-inventory'];
const fixedKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
const projectValid=s=>typeof s==='string'&&/^[a-z0-9]{20}$/.test(s);
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const within=(root,path)=>{const r=relative(root,path);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../')&&!r.startsWith('..\\'));};
export function validateMetadata(m,expected,now=Date.now()){
 assert.ok(projectValid(expected),'Referência esperada inválida');
 assert.ok(fixedKeys(m,['schemaVersion','projectRef','startedAt','completedAt','postgresMajor','migrations','scope','storage','format']),'Metadados inválidos');
 assert.equal(m.schemaVersion,1,'Versão de manifesto inválida');
 assert.equal(m.projectRef,expected,'Projeto não corresponde');
 assert.ok(timestamp(m.startedAt)&&timestamp(m.completedAt),'Data UTC inválida');
 assert.ok(Date.parse(m.startedAt)<=Date.parse(m.completedAt)&&Date.parse(m.completedAt)<=now,'Intervalo de captura inválido');
 assert.equal(m.postgresMajor,17,'Major PostgreSQL não suportada pelo contrato atual');
 assert.ok(Array.isArray(m.migrations)&&m.migrations.length>0&&m.migrations.length<=1000&&m.migrations.every(x=>typeof x==='string'&&/^\d{14}$/.test(x))&&m.migrations.every((x,i)=>i===0||x>m.migrations[i-1]),'Histórico de migrations inválido');
 assert.deepEqual(m.scope,requiredScope,'Escopo obrigatório incompleto');
 assert.ok(['empty-verified','included'].includes(m.storage),'Inventário Storage ausente');
 assert.equal(m.format,'age-binary-v1','Formato esperado: age binário');
 return m;
}
async function safeDirectory(input){
 const dir=resolve(input);
 const s=await lstat(dir);
 assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'Diretório inválido ou link');
 const canonical=await realpath(dir);
 assert.ok(!within(repo,canonical),'Backup deve ficar fora do repositório');
 return canonical;
}
async function safeOpen(dir,name){
 const path=join(dir,name),s=await lstat(path);
 assert.ok(s.isFile()&&!s.isSymbolicLink(),'Arquivo inválido ou link');
 assert.equal(await realpath(path),path,'Arquivo redirecionado');
 const f=await open(path,'r');
 try{
  const a=await f.stat();
  assert.ok(a.isFile()&&a.dev===s.dev&&a.ino===s.ino,'Arquivo alterado');
  return {f,a};
 }catch(e){await f.close();throw e;}
}
const unchanged=(a,b)=>a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&a.ino===b.ino&&a.dev===b.dev;
async function json(dir,name){
 const {f,a}=await safeOpen(dir,name);
 try{
  assert.ok(a.size>0&&a.size<=MAX_METADATA,'Metadados grandes ou vazios');
  const bytes=await f.readFile();
  assert.ok(bytes.length===a.size&&unchanged(a,await f.stat()),'Metadados alterados');
  return JSON.parse(bytes.toString('utf8'));
 }finally{await f.close();}
}
async function artifact(dir){
 const {f,a}=await safeOpen(dir,'backup.age');
 try{
  assert.ok(Number.isSafeInteger(a.size)&&a.size>header.length,'Arquivo vazio ou inválido');
  const prefix=Buffer.alloc(header.length);
  const r=await f.read(prefix,0,prefix.length,0);
  assert.ok(r.bytesRead===prefix.length&&prefix.equals(header),'Cabeçalho age ausente');
  const h=createHash('sha256');let bytes=0;
  for await(const chunk of f.createReadStream({start:0,autoClose:false})){h.update(chunk);bytes+=chunk.length;}
  assert.ok(bytes===a.size&&unchanged(a,await f.stat()),'Arquivo alterado durante verificação');
  return {bytes,sha256:h.digest('hex'),dev:a.dev,ino:a.ino};
 }finally{await f.close();}
}
export async function recordBackup(dirInput,expected,now=Date.now()){
 const dir=await safeDirectory(dirInput);
 const m=validateMetadata(await json(dir,'metadata.json'),expected,now);
 const {bytes,sha256}=await artifact(dir);
 const manifest={...m,bytes,sha256};
 await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
 return {recorded:true,bytes,migrations:m.migrations.length};
}
async function verifyOne(dir,expected,now){
 const m=await json(dir,'manifest.json');
 assert.ok(fixedKeys(m,['schemaVersion','projectRef','startedAt','completedAt','postgresMajor','migrations','scope','storage','format','bytes','sha256']),'Manifesto inválido');
 const {bytes,sha256,...metadata}=m;
 validateMetadata(metadata,expected,now);
 assert.ok(Number.isSafeInteger(bytes)&&bytes>header.length&&typeof sha256==='string'&&/^[a-f0-9]{64}$/.test(sha256),'Integridade declarada inválida');
 const actual=await artifact(dir);
 assert.equal(actual.bytes,bytes,'Tamanho divergente');
 assert.equal(actual.sha256,sha256,'SHA-256 divergente');
 return {m,dev:actual.dev,ino:actual.ino};
}
export async function verifyBackupPair(primary,secondary,expected,now=Date.now()){
 const a=await safeDirectory(primary),b=await safeDirectory(secondary);
 assert.ok(!within(a,b)&&!within(b,a),'Cópias devem ficar em diretórios distintos, não aninhados');
 const x=await verifyOne(a,expected,now),y=await verifyOne(b,expected,now);
 assert.ok(!(x.ino!==0&&x.dev===y.dev&&x.ino===y.ino),'Cópias apontam para o mesmo arquivo');
 assert.deepEqual(x.m,y.m,'Manifestos divergentes');
 const ageMs=now-Date.parse(x.m.startedAt),ageHours=ageMs/3600000;
 return {copiesVerified:2,bytes:x.m.bytes,migrations:x.m.migrations.length,ageMs,ageHours:Math.round(ageHours*100)/100,fresh:ageHours<=24,scopeAttested:true,restoreVerified:false};
}
async function main(){
 const [action,...args]=process.argv.slice(2);
 if(action==='record'&&args.length===2){console.log(JSON.stringify(await recordBackup(...args)));return;}
 if(action==='verify'&&args.length===3){
  const r=await verifyBackupPair(...args);
  console.log(JSON.stringify(r));if(!r.fresh)process.exitCode=1;return;
 }
 throw Error('Uso: record <diretorio> <projectRef> | verify <primario> <secundario> <projectRef>');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{
 // Do not log exception details: unexpected paths, metadata and content may be sensitive.
 console.error('Backup não validado: confira diretórios, manifesto, referência, timestamps, cópias, formato e integridade. Nenhum dado/segredo exibido.');
 process.exitCode=1;
});
