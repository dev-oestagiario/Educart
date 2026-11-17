import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';

// Destructive reset is limited to the disposable GitHub-hosted runner.
// Never run this against a developer's persistent stack or a linked project.
assert.equal(process.env.GITHUB_ACTIONS,'true','Exige runner CI descartável');
assert.equal(process.env.CI,'true');
assert.equal(process.env.EDUCART_DISPOSABLE_RESTORE,'educart-homologacao','Opt-in explícito do workflow');
assert.ok(!process.env.SUPABASE_DB_PASSWORD&&!process.env.SUPABASE_ACCESS_TOKEN,'Não aceitar credenciais cloud');
const configPath='.env.homologacao.status.local';
function readConfig(){
  const c=JSON.parse(readFileSync(configPath,'utf8'));
  assert.match(c.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
  assert.match(c.DB_URL??'',/^postgres(?:ql)?:\/\/[^/]+@(127\.0\.0\.1|localhost):54322\/postgres(?:\?.*)?$/);
  assert.ok(c.ANON_KEY&&c.SERVICE_ROLE_KEY);
  return c;
}
let config=readConfig();
const container='supabase_db_educart-homologacao';
const url='http://127.0.0.1:54321';
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
function run(cmd,args,input){
  const r=spawnSync(cmd,args,{input,maxBuffer:100*1024*1024,timeout:300000});
  // Do not emit raw SQL, dump contents, status JSON or auth material on failure.
  if(r.error||r.status!==0){
    const diagnostic=String(r.stderr??'').split('\n').filter(line=>/^pg_restore: error:/.test(line)).map(line=>line.replace(/DETAIL:.*$/,'').replace(/(COPY|INSERT INTO|VALUES).*$/,'[dados omitidos]')).slice(0,3).join(' | ');
    throw Error(cmd+' '+args.slice(0,2).join(' ')+' falhou (status '+r.status+') '+diagnostic);
  }
  return r.stdout;
}
function pg(sql){
  return run('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq','-c',sql]).toString('utf8').trim();
}
assert.equal(run('docker',['inspect','--format','{{.State.Running}}',container]).toString().trim(),'true');
assert.equal(pg('select current_database()'),'postgres');
const tables=['admin_users','carts','notebook_codes','requesters','reservation_events','reservation_notebooks','reservation_periods','reservation_request_events','reservation_requests','reservations','teacher_account_links','user_notifications','campuses','campus_blocks','campus_rooms','cart_storage_locations'];
const authTables=['auth.users','auth.identities'];
const allTables=[...tables.map(t=>'public.'+t),...authTables];
const expectedVersions=readdirSync('supabase/migrations').filter(f=>/^\d{14}_.*\.sql$/.test(f)).sort().map(f=>f.slice(0,14));
assert.equal(new Set(expectedVersions).size,expectedVersions.length);
function history(){
  assert.deepEqual(pg('select version from supabase_migrations.schema_migrations order by version').split('\n'),expectedVersions);
}
function acl(){
  assert.equal(pg("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity"),String(tables.length));
  for(const t of tables){
    assert.equal(pg("select has_table_privilege('anon','public."+t+"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')"),'f');
    assert.equal(pg("select has_table_privilege('authenticated','public."+t+"','TRUNCATE')"),'f');
  }
  assert.equal(pg("select has_function_privilege('anon','public.public_cart_availability(date,date)','EXECUTE')"),'t');
}
function manifest(){
  // Only per-table counts and digests are kept, not the actual record contents.
  return Object.fromEntries(allTables.map(t=>[t,pg("select count(*)||':'||md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from "+t+" t")]));
}
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
function client(key){return createClient(url,key,opts);}
const root=client(config.SERVICE_ROLE_KEY);
const tag=randomUUID().slice(0,12);
async function account(role,admin=false){
  const email=role+'-restore-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
  const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar conta '+role);
  if(admin)ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI recuperação'}),'Autorizar TI real');
  const db=client(config.ANON_KEY);
  ok(await db.auth.signInWithPassword({email,password}),'Login '+role);
  return {id:user.id,email,password,db};
}
history();acl();
const admin=await account('ti',true),teacher=await account('prof'),other=await account('outro');
const row=ok(await admin.db.from('carts').insert({code:'REST-'+tag,name:'Carrinho recuperação sintético',capacity:8}).select('id').single(),'Carrinho');
const requester=ok(await admin.db.from('requesters').insert({name:'Professor recuperação sintético'}).select('id').single(),'Solicitante');
ok(await admin.db.rpc('link_teacher_account',{p_requester_id:requester.id,p_email:teacher.email}),'Vincular');
const d=new Date(Date.now()+21*86400000);
while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);
const day=d.toISOString().slice(0,10);
const req=ok(await teacher.db.rpc('submit_teacher_request',{p_cart_id:row.id,p_mode:'PARCIAL',p_quantity:3,p_dates:[day],p_shifts:['MATUTINO'],p_needs_mouse:true,p_notes:'Ensaio sintético'}),'Pedido');
const reservation=ok(await admin.db.rpc('review_teacher_request',{p_request_id:req,p_approve:true}),'Aprovar');
const before=manifest();
assert.ok(before['public.reservations'].split(':')[0]!=='0');
assert.ok(before['public.user_notifications'].split(':')[0]!=='0');
const tmp=mkdtempSync(join(tmpdir(),'educart-restore-'));
try{
  const archive=join(tmp,'data.dump');
  const started=Date.now();
  const dump=run('docker',['exec','-i',container,'pg_dump','-U','postgres','-d','postgres','--format=custom','--data-only','--no-owner','--no-privileges','--table=public.*','--table=auth.users','--table=auth.identities']);
  assert.ok(dump.length>100&&dump.subarray(0,5).toString()==='PGDMP');
  writeFileSync(archive,dump,{mode:0o600});
  const digest=createHash('sha256').update(dump).digest('hex');
  console.log('PASS F2.6-BACKUP: arquivo sintético de '+dump.length+' bytes, '+Object.keys(before).length+' tabelas verificadas.');
  // Recreate from versioned migrations, without a seed or cloud target.
  const help=run('npx',['--yes','supabase@2.79.0','db','reset','--help']).toString();
  assert.ok(help.includes('--local'));
  run('npx',['--yes','supabase@2.79.0','db','reset','--local']);
  history();acl();
  for(const table of allTables)assert.equal(pg('select count(*) from '+table),'0','Destino não está vazio: '+table);
  const afterReset=run('npx',['--yes','supabase@2.79.0','status','-o','json']);
  writeFileSync(configPath,afterReset,{mode:0o600});
  config=readConfig();
  const data=readFileSync(archive);
  assert.equal(createHash('sha256').update(data).digest('hex'),digest);
  // Only this local synthetic restore uses trigger suspension in one transaction.
  // Original schema/constraints/RLS/ACL come from the verified migrations.
  const sql=run('docker',['exec','-i',container,'pg_restore','--data-only','--no-owner','--no-privileges','--file=-'],data);
  run('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','--single-transaction','-c','SET session_replication_role = replica','-f','-'],sql);
  assert.deepEqual(manifest(),before,'Contagens ou conteúdo divergentes após restauração');
  history();acl();
  // New logins; sessions and refresh tokens were deliberately not restored.
  async function relog(who){
    const db=client(config.ANON_KEY);
    const result=ok(await db.auth.signInWithPassword({email:who.email,password:who.password}),'Login restaurado');
    assert.equal(result.user.id,who.id);
    return db;
  }
  const ti=await relog(admin),prof=await relog(teacher),unlinked=await relog(other),anon=client(config.ANON_KEY);
  assert.equal(ok(await ti.from('reservations').select('id').eq('id',reservation).single(),'Reserva recuperada').id,reservation);
  assert.equal(ok(await prof.from('reservation_requests').select('status,reservation_id').eq('id',req).single(),'Pedido recuperado').reservation_id,reservation);
  assert.deepEqual(ok(await unlinked.from('reservation_requests').select('id').eq('id',req),'Isolamento recuperado'),[]);
  assert.ok((await anon.from('carts').select('id')).error,'Anon não pode ler tabela');
  const balances=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo recuperado');
  const slot=balances.find(x=>x.cart_id===row.id&&x.shift==='MATUTINO');
  assert.ok(slot);assert.equal(slot.available,5);
  assert.ok(ok(await prof.from('user_notifications').select('id').eq('request_id',req),'Avisos recuperados').length>0);
  ok(await ti.rpc('cancel_reservation',{p_reservation_id:reservation}),'Cancelar depois da recuperação');
  const after=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo após cancelamento');
  assert.equal(after.find(x=>x.cart_id===row.id&&x.shift==='MATUTINO').available,8);
  console.log('PASS F2.6-RESTORE: '+tables.length+' tabelas de negócio e 2 tabelas Auth verificadas, histórico, RLS, login renovado e operações recuperadas. Tempo local '+Math.round((Date.now()-started)/1000)+'s.');
}finally{rmSync(tmp,{recursive:true,force:true});}
