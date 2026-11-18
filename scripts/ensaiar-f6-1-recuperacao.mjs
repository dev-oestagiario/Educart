// F6.1: isolated physical snapshot/recovery rehearsal, synthetic data ONLY.
// No database URL, hosted API, secrets, or real backup accepted by this script.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const {PGlite}=await import(pathToFileURL(resolve('.local-sql-test/node_modules/@electric-sql/pglite/dist/index.js')).href);
const admin='11111111-1111-4111-8111-111111111111',teacher='22222222-2222-4222-8222-222222222222',unlinked='33333333-3333-4333-8333-333333333333';
const hash=b=>createHash('sha256').update(b).digest('hex');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const one=async(pg,sql,args=[])=>(await pg.query(sql,args)).rows[0];
async function who(pg,role,id=''){
 await pg.exec('reset role');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 assert.ok(['postgres','authenticated','anon'].includes(role));await pg.exec('set role '+role);
}
async function migrate(pg){
 await pg.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
 const migrations=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort();
 for(const name of migrations){await pg.exec(readFileSync('supabase/migrations/'+name,'utf8'));}
 console.log('PASS migrations',migrations.length);
 return migrations;
}
async function seed(pg){
 await pg.query("insert into auth.users values ($1,'admin@example.test',now()),($2,'teacher@example.test',now()),($3,'unlinked@example.test',now())",[admin,teacher,unlinked]);
 await pg.query("insert into public.admin_users(user_id,display_name) values($1,'TI sintética')",[admin]);
 await who(pg,'authenticated',admin);
 const id=async(sql,args=[]) => (await one(pg,sql,args)).id;
 const campus=await id("insert into public.campuses(name) values('Campus sintético') returning id");
 const block=await id("insert into public.campus_blocks(campus_id,name) values($1,'Bloco de ensaio') returning id",[campus]);
 const room=await id("insert into public.campus_rooms(block_id,name) values($1,'Sala de ensaio') returning id",[block]);
 const cart=await id("insert into public.carts(code,name,capacity) values('F61-A','Carrinho de ensaio',10) returning id");
 const second=await id("insert into public.carts(code,name,capacity) values('F61-B','Manutenção de ensaio',8) returning id");
 await pg.query("insert into public.cart_storage_locations(cart_id,room_id) values($1,$2)",[cart,room]);
 const model=await id("insert into public.asset_models(name,kind,author,license,width_m,depth_m) values('Modelo sintético','CART','TI de teste','Interno',1,1) returning id");
 const scene=await id("insert into public.spatial_scenes(room_id,name,width_m,depth_m,height_m) values($1,'Cena sintética',10,8,3) returning id",[room]);
 await pg.query("insert into public.cart_scene_placements(cart_id,model_id,scene_id,position_x,position_y,position_z,yaw) values($1,$2,$3,0,0,0,0)",[cart,model,scene]);
 await pg.query("insert into public.cart_model_slots(model_id,slot_key,position_x,position_y,position_z) values($1,'F61-01',0,.4,0)",[model]);
 const notebook=await id("insert into public.notebook_codes(cart_id,code) values($1,'F61-NB') returning id",[cart]);
 await pg.query("insert into public.notebook_slot_links(cart_id,model_id,slot_key,notebook_id) values($1,$2,'F61-01',$3)",[cart,model,notebook]);
 const requester=await id("insert into public.requesters(name) values('Docente sintético') returning id");
 await pg.query("select public.link_teacher_account($1,'teacher@example.test')",[requester]);
 const day=(await one(pg,"select (current_date+14+((8-extract(isodow from current_date+14)::integer)%7))::text as d")).d;
 const reservation=await id("select public.create_reservation_with_room($1,$2,'PARCIAL',3,array[$3::date],array['MATUTINO'],false,null,array[$4::uuid],$5) as id",[requester,cart,day,notebook,room]);
 await pg.query("select public.schedule_maintenance($1,$2::date,$2::date,array['MATUTINO'],'Ensaio')",[second,day]);
 await pg.exec('reset role');
 // An outbox record in PENDING exercises restoration, without any external sender.
 await pg.query("insert into public.email_outbox(recipient_user_id,event_key,kind) values($1,'F61-synthetic-event','NOVO_PEDIDO')",[admin]);
 console.log('PASS synthetic operational records');
 return {cart,second,notebook,room,day,reservation};
}
async function dataManifest(pg){
 await pg.exec('reset role');
 const tables=(await pg.query("select schemaname,tablename from pg_tables where schemaname in ('public','auth','app_private') order by schemaname,tablename")).rows;
 const results=[];
 for(const {schemaname,tablename} of tables){
  const qualified=quote(schemaname)+'.'+quote(tablename);
  const data=(await pg.query("select to_jsonb(t)::text as row from "+qualified+" t order by to_jsonb(t)::text collate \"C\"")).rows.map(x=>x.row);
  results.push({table:schemaname+'.'+tablename,rows:data.length,sha256:hash(JSON.stringify(data))});
 }
 return results;
}
async function checkBusiness(pg,f){
 await who(pg,'authenticated',admin);
 const detail=(await one(pg,"select public.spatial_cart_details($1,$2::date,'MATUTINO') as d",[f.cart,f.day])).d;
 assert.equal(detail.summary.reserved,3);assert.equal(detail.summary.available,7);assert.equal(detail.summary.availability_status,'PARTIAL');
 assert.equal(detail.confirmed_slots.length,1);assert.equal(detail.confirmed_slots[0].notebook_id,f.notebook);
 assert.ok(detail.confirmed_slots[0].reservation_period_id);assert.equal(detail.reservations[0].destination_room_id,f.room);
 assert.equal((await one(pg,"select available from public.spatial_cart_summary($1::date,'MATUTINO') where cart_id=$2",[f.day,f.second])).available,0);
 assert.ok((await one(pg,"select count(*)::int as n from public.spatial_events")).n>0);
 await who(pg,'authenticated',teacher);assert.equal((await one(pg,'select count(*)::int as n from public.notebook_slot_links')).n,0);
 await assert.rejects(()=>pg.query("select public.spatial_cart_details($1,$2::date,'MATUTINO')",[f.cart,f.day]),e=>e.code==='42501');
 await who(pg,'authenticated',unlinked);await assert.rejects(()=>pg.query("select public.spatial_cart_summary($1::date,'MATUTINO')",[f.day]),e=>e.code==='42501');
 await who(pg,'anon');await assert.rejects(()=>pg.query('select * from public.notebook_slot_links'),e=>e.code==='42501');
 const publicRow=await one(pg,"select * from public.public_cart_availability($1::date,$1::date) where cart_id=$2 and shift='MATUTINO'",[f.day,f.cart]);
 assert.equal(publicRow.available,7);assert.equal(publicRow.reserved,3);
 assert.ok(!('requester' in publicRow)&&!('notebook_id' in publicRow)&&!('notes' in publicRow));
 await pg.exec('reset role');
 assert.equal((await one(pg,"select count(*)::int as n from public.email_outbox where state='PENDING'")).n,1);
 assert.equal((await one(pg,"select coalesce(bool_or(enabled),false) as enabled from public.email_delivery_settings")).enabled,false);
 console.log('PASS business, RLS and disabled email channel');
}
function verifyArchive(bytes,manifest){
 assert.equal(bytes.length,manifest.bytes,'Arquivo incompleto');
 assert.equal(hash(bytes),manifest.sha256,'Integridade SHA-256 divergente');
}
const dir=await mkdtemp(join(tmpdir(),'educart-f61-synthetic-'));
let source,restored;
try{
 source=new PGlite();const migrations=await migrate(source);const fixture=await seed(source);await checkBusiness(source,fixture);
 const before=await dataManifest(source);
 const started=performance.now();
 const blob=await source.dumpDataDir('gzip');
 const bytes=Buffer.from(await blob.arrayBuffer());
 const manifest={kind:'synthetic-pglite-rehearsal-v1',createdAt:new Date().toISOString(),bytes:bytes.length,sha256:hash(bytes),migrations,tables:before};
 await writeFile(join(dir,'snapshot.tar.gz'),bytes,{mode:0o600,flag:'wx'});
 await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest),{mode:0o600,flag:'wx'});
 const backupMs=performance.now()-started;
 console.log('PASS snapshot persisted',JSON.stringify({bytes:bytes.length,sha256:manifest.sha256,backupMs:Math.round(backupMs)}));
 const stored=await readFile(join(dir,'snapshot.tar.gz'));
 const saved=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
 verifyArchive(stored,saved);
 const altered=Buffer.from(stored);altered[Math.floor(altered.length/2)]^=1;
 assert.throws(()=>verifyArchive(altered,saved),/SHA-256/);
 assert.throws(()=>verifyArchive(stored.subarray(0,-1),saved),/incompleto/);
 console.log('PASS corrupted and truncated archives rejected before restore');
 // Simulate accidental cancellation on source, after taking the backup.
 await who(source,'authenticated',admin);await source.query('select public.cancel_reservation($1)',[fixture.reservation]);
 assert.equal((await one(source,"select available from public.spatial_cart_summary($1::date,'MATUTINO') where cart_id=$2",[fixture.day,fixture.cart])).available,10);
 await source.exec('reset role');
 const recoveryStarted=performance.now();
 restored=new PGlite({loadDataDir:new Blob([stored],{type:'application/gzip'})});
 await restored.waitReady;
 const after=await dataManifest(restored);assert.deepEqual(after,saved.tables);
 await checkBusiness(restored,fixture);
 // Existing read-only permission suite against recovered schema.
 await restored.exec(readFileSync('supabase/tests/f1_1_rls_read_only.sql','utf8'));
 const recoveryMs=performance.now()-recoveryStarted;
 console.log('PASS recovered all table fingerprints',JSON.stringify({tables:after.length,rows:after.reduce((a,b)=>a+b.rows,0),recoveryMs:Math.round(recoveryMs)}));
 // Verify restored database remains writable via legitimate business operation; source is independent.
 await who(restored,'authenticated',admin);await restored.query('select public.cancel_reservation($1)',[fixture.reservation]);
 assert.equal((await one(restored,"select available from public.spatial_cart_summary($1::date,'MATUTINO') where cart_id=$2",[fixture.day,fixture.cart])).available,10);
 console.log('PASS recovery writable via authorized RPC; isolated source');
 console.log('PASS F6.1 synthetic snapshot/recovery only; not hosted backup, PITR, JWT or external Storage.');
} catch(e){console.error('FAIL F6.1:',e?.message??String(e));process.exitCode=1;}
finally{await restored?.close();await source?.close();await rm(dir,{recursive:true,force:true});}
