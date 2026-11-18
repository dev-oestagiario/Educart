// Isolated PostgreSQL WASM verification; never connects to hosted Supabase.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(resolve('.local-sql-test/node_modules/@electric-sql/pglite/dist/index.js')).href);
const pg=new PGlite();
try {
 await pg.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
 for(const name of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()){
  try{await pg.exec(readFileSync('supabase/migrations/'+name,'utf8'));console.log('PASS migration '+name);}
  catch(e){throw Error(name+': '+e.message);}
 }
 // Synthetic admin for read-only fixture (distinct from f5.1 fixtures).
 await pg.exec("insert into auth.users values ('99999999-9999-4999-8999-999999999999','f56-admin@example.test',now()); insert into public.admin_users(user_id,display_name) values('99999999-9999-4999-8999-999999999999','TI F56');");
 for(const name of ['f1_1_rls_read_only.sql','f5_1_spatial.sql']){
  try{await pg.exec(readFileSync('supabase/tests/'+name,'utf8'),{onNotice:n=>console.log(n.message)});}catch(e){throw Error(name+': '+e.message);}
  console.log('PASS '+name);
 }
 console.log('PASS: PostgreSQL local, roles e claims simuladas; não valida JWT, PostgREST ou concorrência.');
}finally{await pg.close();}
