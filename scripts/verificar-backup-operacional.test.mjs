import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm,symlink,link} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {recordBackup,verifyBackupPair,validateMetadata,requiredScope} from './verificar-backup-operacional.mjs';
const ref='abcdefghijklmnopqrst',now=Date.parse('2026-11-18T15:00:00.000Z');
const metadata={schemaVersion:1,projectRef:ref,startedAt:'2026-11-18T12:00:00.000Z',completedAt:'2026-11-18T12:10:00.000Z',postgresMajor:17,migrations:['20261115145429','20261117144930'],scope:requiredScope,storage:'empty-verified',format:'age-binary-v1'};
// Synthetic header fixture, intentionally not a real encrypted backup or proof of decryptability.
const fixture=Buffer.from('age-encryption.org/v1\nsynthetic-test-fixture-only');
async function setup(t,m=metadata){
 const root=await mkdtemp(join(tmpdir(),'educart-backup-verifier-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const a=join(root,'primary'),b=join(root,'secondary');await mkdir(a);await mkdir(b);
 await writeFile(join(a,'metadata.json'),JSON.stringify(m));await writeFile(join(a,'backup.age'),fixture);
 await recordBackup(a,ref,now);
 for(const f of ['manifest.json','backup.age'])await copyFile(join(a,f),join(b,f));
 return {root,a,b};
}
test('records and checks distinct copies, scope and freshness',async t=>{const {a,b}=await setup(t);const r=await verifyBackupPair(a,b,ref,now);assert.deepEqual(r,{copiesVerified:2,bytes:fixture.length,migrations:2,ageHours:3,fresh:true,scopeAttested:true,restoreVerified:false});await assert.rejects(()=>recordBackup(a,ref,now));});
test('stale backup cannot satisfy 24h target',async t=>{const {a,b}=await setup(t);assert.equal((await verifyBackupPair(a,b,ref,now+22*3600000)).fresh,false);});
test('detects same-length corruption and truncation',async t=>{const {a,b}=await setup(t);const modified=Buffer.from(fixture);modified[modified.length-1]^=1;await writeFile(join(b,'backup.age'),modified);await assert.rejects(()=>verifyBackupPair(a,b,ref,now),/SHA-256/);await writeFile(join(b,'backup.age'),fixture.subarray(0,-1));await assert.rejects(()=>verifyBackupPair(a,b,ref,now),/Tamanho/);});
test('rejects plaintext/missing header',async t=>{const {a,b}=await setup(t);await writeFile(join(b,'backup.age'),'plain fixture data not encrypted');await assert.rejects(()=>verifyBackupPair(a,b,ref,now),/age/);});
test('rejects wrong, future, reversed, incomplete or noncanonical metadata',()=>{for(const invalid of [{projectRef:'zzzzzzzzzzzzzzzzzzzz'},{startedAt:'2026-11-19T00:00:00.000Z'},{completedAt:'2026-11-19T00:00:00.000Z'},{migrations:[]},{migrations:['20261117144930','20261115145429']},{scope:['data']},{storage:'unknown'},{format:'plaintext'},{extra:'unexpected'}])assert.throws(()=>validateMetadata({...metadata,...invalid},ref,now));});
test('rejects divergent manifest, same or nested directory',async t=>{const {a,b}=await setup(t);await assert.rejects(()=>verifyBackupPair(a,a,ref,now),/distintos/);await assert.rejects(()=>verifyBackupPair(a,join(a,'nested'),ref,now));const m=JSON.parse(await readFile(join(b,'manifest.json'),'utf8'));m.storage='included';await writeFile(join(b,'manifest.json'),JSON.stringify(m));await assert.rejects(()=>verifyBackupPair(a,b,ref,now),/Manifestos divergentes/);});
test('rejects absent files and oversized manifest',async t=>{const {a,b}=await setup(t);await rm(join(b,'backup.age'));await assert.rejects(()=>verifyBackupPair(a,b,ref,now));await writeFile(join(b,'manifest.json'),' '.repeat(17000));await assert.rejects(()=>verifyBackupPair(a,b,ref,now),/grandes/);});
test('rejects directories redirected with junction/symlink',async t=>{const {root,a,b}=await setup(t);const alias=join(root,'alias');await symlink(b,alias,process.platform==='win32'?'junction':'dir');await assert.rejects(()=>verifyBackupPair(a,alias,ref,now));});
test('rejects hardlinked artifact',async t=>{const {a,b}=await setup(t);await rm(join(b,'backup.age'));await link(join(a,'backup.age'),join(b,'backup.age'));await assert.rejects(()=>verifyBackupPair(a,b,ref,now),/mesmo arquivo/);});
test('rejects repository directory',async()=>{await assert.rejects(()=>recordBackup(process.cwd(),ref,now),/fora do repositório/);});
