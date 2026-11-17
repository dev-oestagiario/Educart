#!/usr/bin/env bash
# Database isolated in Docker; no port published, no hosted credentials or project.
set -euo pipefail
cd "$(dirname "$0")/.."
name="educart-f51-test-$$"
docker run --rm -d --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT
for i in {1..30}; do if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
psql_local(){ docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
psql_local <<'SQL'
create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
SQL
for m in supabase/migrations/*.sql; do echo "APPLY $m"; psql_local -q < "$m"; done
psql_local < supabase/tests/f5_1_spatial.sql
# Two separate connections contend on the same position. Second must fail after first commits.
psql_local <<'SQL'
insert into auth.users(id,email,email_confirmed_at) values('11111111-1111-4111-8111-111111111111','test@example.test',now());
insert into public.admin_users(user_id,display_name) values('11111111-1111-4111-8111-111111111111','Teste');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
insert into public.campuses(id,name) values('00000000-0000-4000-8000-000000000001','Campus concorrência');
insert into public.campus_blocks(id,campus_id,name) values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Bloco');
insert into public.campus_rooms(id,block_id,name) values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','Sala');
insert into public.asset_models(id,name,kind,author,license,width_m,depth_m) values('00000000-0000-4000-8000-000000000004','Modelo','CART','Teste','Interno',1,1);
insert into public.spatial_scenes(id,room_id,name,width_m,depth_m,height_m) values('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003','Cena',10,10,3);
insert into public.carts(id,code,name,capacity) values('00000000-0000-4000-8000-000000000006','CON-A','Carrinho A',10),('00000000-0000-4000-8000-000000000007','CON-B','Carrinho B',10);
SQL
insert_pose(){
 psql_local <<SQL
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into public.cart_scene_placements(cart_id,model_id,scene_id,position_x,position_y,position_z,yaw)
values('00000000-0000-4000-8000-00000000000$1','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',0,0,0,0);
select pg_sleep($2);
commit;
SQL
}
log=$(mktemp)
trap 'rm -f "$log"; docker stop "$name" >/dev/null 2>&1 || true' EXIT
insert_pose 6 2 &
first=$!
# Poll the server until the first transaction holds the spatial advisory lock.
for i in {1..40}; do
 locked=$(psql_local -Atc "select count(*) from pg_locks where locktype='advisory' and classid=83510 and objid=1 and granted")
 if [[ "$locked" == 1 ]]; then break; fi; sleep .1
done
[[ "$locked" == 1 ]]
if insert_pose 7 0 >"$log" 2>&1; then echo 'FAIL concurrent overlap'; exit 1; fi
wait "$first"
grep -q 'Posicionamento conflita' "$log"
[[ "$(psql_local -Atc 'select count(*) from public.cart_scene_placements')" == 1 ]]
echo 'PASS F5.1 concurrent placement — exactly one commit'
