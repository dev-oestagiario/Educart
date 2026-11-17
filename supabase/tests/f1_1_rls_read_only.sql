-- Read-only regression checks; run as database administrator in an authorized project.
-- No real token is issued and no application row is changed.
begin read only;
do $$
declare t record; table_name text; n bigint; u uuid; fake uuid := '00000000-0000-4000-8000-000000000001';
begin
  if exists(select 1 from auth.users where id=fake) then raise exception 'Test identity already exists'; end if;
  select user_id into u from public.admin_users where active order by user_id limit 1;
  if u is null then raise exception 'No active admin for read-only check'; end if;
  for t in select c.oid, c.relname from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r' loop
    if not (select relrowsecurity from pg_class where oid=t.oid) then raise exception 'RLS disabled: %', t.relname; end if;
    if has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Anonymous table grant: %',t.relname; end if;
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
    where s.nspname='public' and p.proname<>'public_cart_availability'
      and has_function_privilege('anon',p.oid,'EXECUTE')) then raise exception 'Unexpected anonymous RPC'; end if;
  if not has_function_privilege('anon','public.public_cart_availability(date,date)','EXECUTE') then raise exception 'Public RPC unavailable'; end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub',fake::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',fake,'role','authenticated')::text,true);
  if app_private.is_admin() or app_private.is_teacher() then raise exception 'Unlinked identity authorized'; end if;
  foreach table_name in array array['admin_users','carts','notebook_codes','requesters','reservation_events','reservation_notebooks','reservation_periods','reservation_request_events','reservation_requests','reservations','teacher_account_links','user_notifications'] loop
    execute format('select count(*) from public.%I',table_name) into n;
    if n<>0 then raise exception 'Unlinked identity can read %',table_name; end if;
  end loop;
  begin
    perform public.list_teacher_accounts();
    raise exception 'Unlinked identity can list teacher accounts';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
  if not app_private.is_admin() then raise exception 'Active admin not recognized'; end if;
  if not exists(select 1 from public.admin_users where user_id=u and active) then raise exception 'Admin cannot read own authorization'; end if;
end $$;
select 'passed' as read_only_role_checks;
rollback;
