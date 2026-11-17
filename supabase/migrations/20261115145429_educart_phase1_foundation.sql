-- Educart · fase 1: dados administrativos e controle de acesso.
-- Executar no projeto Supabase Educart. Não cria usuários administrativos.
create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon;
grant usage on schema app_private to authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(btrim(code)) between 1 and 50),
  name text not null check (length(btrim(name)) between 2 and 120),
  capacity integer not null check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);
create unique index carts_code_unique on public.carts (lower(btrim(code)));

create table public.requesters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  reference_code text check (reference_code is null or length(btrim(reference_code)) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);
create unique index requesters_reference_code_unique
  on public.requesters (lower(btrim(reference_code))) where reference_code is not null;

create table public.notebook_codes (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete restrict,
  code text not null check (length(btrim(code)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);
create unique index notebook_codes_code_unique on public.notebook_codes (lower(btrim(code)));
create index notebook_codes_cart_id_idx on public.notebook_codes(cart_id);

-- SECURITY DEFINER é usada apenas para consultar admin_users sem recursão
-- de RLS; a decisão de acesso depende exclusivamente de auth.uid().
create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.active = true);
$$;
revoke all on function app_private.is_admin() from public;
revoke all on function app_private.is_admin() from anon;
grant execute on function app_private.is_admin() to authenticated;

create or replace function app_private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger carts_updated_at before update on public.carts
for each row execute function app_private.touch_updated_at();
create trigger requesters_updated_at before update on public.requesters
for each row execute function app_private.touch_updated_at();
create trigger notebook_codes_updated_at before update on public.notebook_codes
for each row execute function app_private.touch_updated_at();

-- Não autorizar mais códigos ATIVOS que a capacidade numérica.
-- A quantidade de códigos não determina o saldo disponível das reservas.
create or replace function app_private.guard_notebook_codes_capacity()
returns trigger language plpgsql set search_path = ''
as $$
declare
  max_capacity integer;
  active_codes integer;
begin
  if not new.active then return new; end if;
  select c.capacity into max_capacity
    from public.carts c where c.id = new.cart_id for update;
  if max_capacity is null then raise exception 'Carrinho não encontrado'; end if;
  select count(*) into active_codes from public.notebook_codes n
    where n.cart_id = new.cart_id and n.active = true
      and n.id is distinct from new.id;
  if active_codes >= max_capacity then
    raise exception 'Quantidade de códigos ativos ultrapassa a capacidade do carrinho';
  end if;
  return new;
end;
$$;
create trigger notebook_codes_capacity_guard
before insert or update of cart_id, active on public.notebook_codes
for each row execute function app_private.guard_notebook_codes_capacity();

create or replace function app_private.guard_cart_capacity()
returns trigger language plpgsql set search_path = ''
as $$
declare active_codes integer;
begin
  if new.capacity is distinct from old.capacity then
    select count(*) into active_codes from public.notebook_codes n
      where n.cart_id = new.id and n.active = true;
    if new.capacity < active_codes then
      raise exception 'Capacidade inferior ao número de notebooks identificados ativos';
    end if;
  end if;
  return new;
end;
$$;
create trigger carts_capacity_guard before update of capacity on public.carts
for each row execute function app_private.guard_cart_capacity();

alter table public.admin_users enable row level security;
alter table public.carts enable row level security;
alter table public.requesters enable row level security;
alter table public.notebook_codes enable row level security;

-- admin_users é provisionada apenas via Dashboard/admin API.
create policy admin_users_read_authorized on public.admin_users
  for select to authenticated using ((select app_private.is_admin()));

create policy carts_read_authorized on public.carts
  for select to authenticated using ((select app_private.is_admin()));
create policy carts_insert_authorized on public.carts
  for insert to authenticated with check ((select app_private.is_admin()));
create policy carts_update_authorized on public.carts
  for update to authenticated using ((select app_private.is_admin()))
    with check ((select app_private.is_admin()));

create policy requesters_read_authorized on public.requesters
  for select to authenticated using ((select app_private.is_admin()));
create policy requesters_insert_authorized on public.requesters
  for insert to authenticated with check ((select app_private.is_admin()));
create policy requesters_update_authorized on public.requesters
  for update to authenticated using ((select app_private.is_admin()))
    with check ((select app_private.is_admin()));

create policy notebook_codes_read_authorized on public.notebook_codes
  for select to authenticated using ((select app_private.is_admin()));
create policy notebook_codes_insert_authorized on public.notebook_codes
  for insert to authenticated with check ((select app_private.is_admin()));
create policy notebook_codes_update_authorized on public.notebook_codes
  for update to authenticated using ((select app_private.is_admin()))
    with check ((select app_private.is_admin()));

revoke all on public.admin_users, public.carts, public.requesters, public.notebook_codes from anon;
grant select on public.admin_users to authenticated;
grant select, insert, update on public.carts, public.requesters, public.notebook_codes to authenticated;
-- Sem política de DELETE: desativar cadastros em vez de apagar histórico.
