-- F1.1: remove privileges not used by the application; preserve authorized catalog CRUD.
revoke insert, update, delete, truncate, references, trigger on table public.admin_users from public, anon, authenticated;
revoke delete, truncate, references, trigger on table public.carts, public.requesters, public.notebook_codes from public, anon, authenticated;
-- Trigger-only routines do not need to be executable directly by API roles.
revoke execute on function app_private.touch_updated_at(), app_private.guard_cart_capacity(), app_private.guard_notebook_codes_capacity() from public, anon, authenticated;
-- Fail the migration if the expected privilege boundary does not hold.
do $$
declare t text;
begin
  foreach t in array array['admin_users','carts','requesters','notebook_codes'] loop
    if has_table_privilege('authenticated','public.'||t,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or not has_table_privilege('authenticated','public.'||t,'SELECT') then
      raise exception 'Unexpected privileges on %', t;
    end if;
  end loop;
  if has_table_privilege('authenticated','public.admin_users','INSERT,UPDATE') then
    raise exception 'Admin provisioning must not be available to authenticated';
  end if;
  foreach t in array array['carts','requesters','notebook_codes'] loop
    if not has_table_privilege('authenticated','public.'||t,'INSERT') or not has_table_privilege('authenticated','public.'||t,'UPDATE') then
      raise exception 'Catalog operations must remain available through RLS: %', t;
    end if;
  end loop;
  if not has_function_privilege('anon','public.public_cart_availability(date,date)','EXECUTE') then
    raise exception 'Public availability must remain accessible';
  end if;
end;
$$;