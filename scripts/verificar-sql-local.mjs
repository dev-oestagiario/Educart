// Supplemental SQL verification without Docker. Auth schema/claims are simulated;
// this is NOT the Supabase/PostgREST/JWT or concurrency suite.
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(resolve('.local-sql-test/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg=new PGlite();
try{
 await pg.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
 for(const name of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()){
  try{await pg.exec(readFileSync('supabase/migrations/'+name,'utf8'));console.log('PASS migration '+name);}
  catch(e){throw Error(name+': '+e.message);}
 }
 const admin='11111111-1111-4111-8111-111111111111',teacher='22222222-2222-4222-8222-222222222222';
 await pg.query("insert into auth.users values ($1,'admin@example.test',now()),($2,'teacher@example.test',now())",[admin,teacher]);
 await pg.query("insert into public.admin_users(user_id,display_name) values($1,'TI sintética')",[admin]);
 async function who(role,id=''){await pg.exec('reset role');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await pg.exec('set role '+role);}
 const one=async(sql,params=[])=>{const r=await pg.query(sql,params);return r.rows[0];};
 const denied=async(sql,params=[])=>assert.rejects(()=>pg.query(sql,params));
 await who('authenticated',admin);
 const cart=(await one("insert into public.carts(code,name,capacity) values('SQL-MAN','Carrinho sintético',10) returning id")).id;
 const requester=(await one("insert into public.requesters(name) values('Professor sintético') returning id")).id;
 await one("select public.link_teacher_account($1,'teacher@example.test')",[requester]);
 const campus=(await one("insert into public.campuses(name) values('Campus sintético') returning id")).id;
 const block=(await one("insert into public.campus_blocks(campus_id,name) values($1,'Bloco A') returning id",[campus])).id;
 const room=(await one("insert into public.campus_rooms(block_id,name) values($1,'Sala A') returning id",[block])).id;
 await one("insert into public.cart_storage_locations(cart_id,room_id) values($1,$2)",[cart,room]);
 const day=(await one("select (current_date+14+((8-extract(isodow from current_date+14)::int)%7))::text as d")).d;
 const bookingSql="select public.create_reservation_with_room($1,$2,'PARCIAL',2,array[$3::date],array['MATUTINO'],false,null,'{}'::uuid[],$4) as id";
 const reserveArgs=[requester,cart,day,room];
 const booking=(await one(bookingSql,reserveArgs)).id;
 assert.equal((await one("select destination_room_id from public.reservations where id=$1",[booking])).destination_room_id,room);
 const schedule="select public.schedule_maintenance($1,$2::date,$2::date,array['MATUTINO'],'Revisão') as id";
 await denied(schedule,[cart,day]);
 await one("select public.cancel_reservation($1)",[booking]);
 const maint=(await one(schedule,[cart,day])).id;
 await denied(schedule,[cart,day]);
 await denied(bookingSql,reserveArgs);
 assert.equal((await one("select count(*)::int as n from public.reservations where cart_id=$1",[cart])).n,1);
 await who('anon');
 await denied('select * from public.maintenance_windows');
 assert.equal((await one("select available from public.public_cart_availability($1::date,$1::date) where cart_id=$2 and shift='MATUTINO'",[day,cart])).available,0);
 assert.equal((await one("select available from public.public_cart_availability($1::date,$1::date) where cart_id=$2 and shift='VESPERTINO'",[day,cart])).available,10);
 await who('authenticated',teacher);
 assert.equal((await one("select count(*)::int as n from public.maintenance_windows")).n,0);
 await denied(schedule,[cart,day]);
 assert.equal((await one("select remaining from public.preview_teacher_availability($1,array[$2::date],array['MATUTINO'])",[cart,day])).remaining,0);
 const req=(await one("select public.submit_teacher_request($1,'PARCIAL',2,array[$2::date],array['MATUTINO'],false,null) as id",[cart,day])).id;
 await who('authenticated',admin);
 await denied("select public.review_teacher_request($1,true,null)",[req]);
 assert.equal((await one("select status from public.reservation_requests where id=$1",[req])).status,'PENDENTE');
 await one("select public.close_maintenance($1,'Resolvida')",[maint]);
 await denied("select public.close_maintenance($1,'Duplicada')",[maint]);
 assert.equal((await one("select closed_by from public.maintenance_windows where id=$1",[maint])).closed_by,admin);
 assert.ok((await one("select public.review_teacher_request_with_room($1,true,null,$2) as id",[req,room])).id);
 await who('anon');
 assert.equal((await one("select available from public.public_cart_availability($1::date,$1::date) where cart_id=$2 and shift='MATUTINO'",[day,cart])).available,8);
 console.log('PASS SQL LOCAL: 10 migrations, F3.1 destino/guarda, F3.2 RLS com claims simuladas, transações, bloqueio, aprovação e encerramento.');
}finally{await pg.close();}
