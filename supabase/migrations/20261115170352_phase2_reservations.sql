-- Educart Fase 2: reservas agrupadas e ocupação por data/turno.
-- As operações de escrita de reservas são feitas exclusivamente pela RPC atômica.
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.requesters(id) on delete restrict,
  cart_id uuid not null references public.carts(id) on delete restrict,
  mode text not null check (mode in ('COMPLETA','PARCIAL')),
  quantity integer not null check (quantity > 0),
  needs_mouse boolean not null default false,
  notes text check (notes is null or length(notes) <= 1000),
  status text not null default 'CONFIRMADA' check (status in ('CONFIRMADA','CANCELADA')),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservation_periods (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  cart_id uuid not null references public.carts(id) on delete restrict,
  usage_date date not null check (extract(isodow from usage_date) between 1 and 5),
  shift text not null check (shift in ('MATUTINO','VESPERTINO','NOTURNO')),
  quantity integer not null check (quantity > 0),
  active boolean not null default true,
  cancelled_at timestamptz,
  unique(reservation_id,usage_date,shift)
);
create index reservation_periods_lookup_idx
  on public.reservation_periods(cart_id, usage_date, shift) where active;

create table public.reservation_notebooks (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.reservation_periods(id) on delete restrict,
  notebook_id uuid not null references public.notebook_codes(id) on delete restrict,
  usage_date date not null,
  shift text not null check(shift in ('MATUTINO','VESPERTINO','NOTURNO')),
  active boolean not null default true,
  unique(period_id,notebook_id)
);
create unique index reservation_notebooks_unique_active
  on public.reservation_notebooks(notebook_id,usage_date,shift) where active;

create table public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  event_type text not null check (event_type in ('CRIACAO','EDICAO','CANCELAMENTO')),
  admin_id uuid not null references auth.users(id),
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);
create index reservation_events_by_reservation_idx
  on public.reservation_events(reservation_id,occurred_at desc);

create trigger reservations_touch before update on public.reservations
for each row execute function app_private.touch_updated_at();

alter table public.reservations enable row level security;
alter table public.reservation_periods enable row level security;
alter table public.reservation_notebooks enable row level security;
alter table public.reservation_events enable row level security;

create policy reservations_admin_read on public.reservations for select
  to authenticated using ((select app_private.is_admin()));
create policy reservation_periods_admin_read on public.reservation_periods for select
  to authenticated using ((select app_private.is_admin()));
create policy reservation_notebooks_admin_read on public.reservation_notebooks for select
  to authenticated using ((select app_private.is_admin()));
create policy reservation_events_admin_read on public.reservation_events for select
  to authenticated using ((select app_private.is_admin()));

revoke all on public.reservations, public.reservation_periods, public.reservation_notebooks, public.reservation_events from anon, authenticated;
grant select on public.reservations, public.reservation_periods, public.reservation_notebooks, public.reservation_events to authenticated;

create or replace function public.create_reservation(
  p_requester_id uuid,
  p_cart_id uuid,
  p_mode text,
  p_quantity integer,
  p_dates date[],
  p_shifts text[],
  p_needs_mouse boolean default false,
  p_notes text default null,
  p_notebook_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart public.carts%rowtype;
  v_requester_active boolean;
  v_quantity integer;
  v_day date;
  v_shift text;
  v_busy integer;
  v_conflicts integer;
  v_count integer;
  v_reservation_id uuid;
  v_period_id uuid;
  v_notebook_id uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Sem permissão para registrar reservas' using errcode='42501';
  end if;

  if p_requester_id is null or p_cart_id is null
      or p_mode is null or p_mode not in ('COMPLETA','PARCIAL')
      or p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe solicitante, carrinho, modalidade e quantidade válida';
  end if;

  if p_dates is null or cardinality(p_dates) not between 1 and 93
     or p_shifts is null or cardinality(p_shifts) not between 1 and 3 then
    raise exception 'Selecione de 1 a 93 datas e ao menos um turno';
  end if;
  if exists(select 1 from unnest(p_dates) d where d is null
     or extract(isodow from d) not between 1 and 5)
     or (select count(distinct d) from unnest(p_dates) d) <> cardinality(p_dates)
     or exists(select 1 from unnest(p_dates) d
         where d < (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Use datas únicas de segunda a sexta, sem datas passadas';
  end if;
  if exists(select 1 from unnest(p_shifts) s where s is null
     or s not in ('MATUTINO','VESPERTINO','NOTURNO'))
     or (select count(distinct s) from unnest(p_shifts) s) <> cardinality(p_shifts) then
    raise exception 'Os turnos devem ser únicos e válidos';
  end if;
  if p_notes is not null and length(p_notes) > 1000 then
    raise exception 'A observação deve ter no máximo 1000 caracteres';
  end if;
  if p_notebook_ids is null or
     exists(select 1 from unnest(p_notebook_ids) id where id is null) or
     (select count(distinct id) from unnest(p_notebook_ids) id) <> cardinality(p_notebook_ids) then
    raise exception 'A seleção de notebooks contém códigos repetidos ou inválidos';
  end if;

  -- O bloqueio da linha do carrinho serializa reservas simultâneas para esse carrinho.
  -- A mesma linha é bloqueada por UPDATE da capacidade, evitando corrida com a configuração.
  select * into v_cart from public.carts where id=p_cart_id for update;
  if not found or not v_cart.active then
    raise exception 'Carrinho não encontrado ou inativo';
  end if;
  select active into v_requester_active from public.requesters where id=p_requester_id;
  if not found or not v_requester_active then
    raise exception 'Solicitante não encontrado ou inativo';
  end if;

  v_quantity := case when p_mode='COMPLETA' then v_cart.capacity else p_quantity end;
  if v_quantity > v_cart.capacity then
    raise exception 'Quantidade maior do que a capacidade configurada';
  end if;
  if p_mode='COMPLETA' and p_quantity <> v_cart.capacity then
    raise exception 'Reserva completa deve usar toda a capacidade do carrinho';
  end if;
  if cardinality(p_notebook_ids)>v_quantity then
    raise exception 'Mais códigos selecionados do que a quantidade reservada';
  end if;
  select count(*) into v_count from public.notebook_codes n
  where n.id=any(p_notebook_ids) and n.cart_id=p_cart_id and n.active;
  if v_count<>cardinality(p_notebook_ids) then
    raise exception 'Um ou mais notebooks não pertencem ao carrinho ou estão inativos';
  end if;

  -- Validar TODAS as datas/turnos antes de inserir o cabeçalho.
  for v_day in select distinct d from unnest(p_dates) d order by d loop
    for v_shift in select distinct s from unnest(p_shifts) s order by s loop
      select coalesce(sum(p.quantity),0)::integer into v_busy
        from public.reservation_periods p
        where p.cart_id=p_cart_id and p.usage_date=v_day
          and p.shift=v_shift and p.active;
      if v_busy + v_quantity > v_cart.capacity then
        raise exception 'Sem disponibilidade em % (%). Disponíveis: %, solicitados: %',
          to_char(v_day,'DD/MM/YYYY'),v_shift,v_cart.capacity-v_busy,v_quantity;
      end if;
      if cardinality(p_notebook_ids)>0 then
        select count(*) into v_conflicts from public.reservation_notebooks a
        where a.notebook_id=any(p_notebook_ids) and a.active
          and a.usage_date=v_day and a.shift=v_shift;
        if v_conflicts > 0 then
          raise exception 'Um notebook já está reservado em % (%)',to_char(v_day,'DD/MM/YYYY'),v_shift;
        end if;
      end if;
    end loop;
  end loop;

  insert into public.reservations(requester_id,cart_id,mode,quantity,needs_mouse,notes,created_by)
  values(p_requester_id,p_cart_id,p_mode,v_quantity,coalesce(p_needs_mouse,false),
     nullif(btrim(p_notes),''),auth.uid())
  returning id into v_reservation_id;

  for v_day in select distinct d from unnest(p_dates) d order by d loop
    for v_shift in select distinct s from unnest(p_shifts) s order by s loop
      insert into public.reservation_periods(reservation_id,cart_id,usage_date,shift,quantity)
      values(v_reservation_id,p_cart_id,v_day,v_shift,v_quantity)
      returning id into v_period_id;
      foreach v_notebook_id in array p_notebook_ids loop
        insert into public.reservation_notebooks(period_id,notebook_id,usage_date,shift)
        values(v_period_id,v_notebook_id,v_day,v_shift);
      end loop;
    end loop;
  end loop;

  insert into public.reservation_events(reservation_id,event_type,admin_id,after_data)
  values(v_reservation_id,'CRIACAO',auth.uid(),jsonb_build_object(
    'requester_id',p_requester_id,'cart_id',p_cart_id,'mode',p_mode,
    'quantity',v_quantity,'needs_mouse',coalesce(p_needs_mouse,false),
    'dates',to_jsonb(p_dates),'shifts',to_jsonb(p_shifts),
    'notebook_ids',to_jsonb(p_notebook_ids),'notes',p_notes
  ));
  return v_reservation_id;
end;
$$;

revoke all on function public.create_reservation(uuid,uuid,text,integer,date[],text[],boolean,text,uuid[]) from public,anon;
grant execute on function public.create_reservation(uuid,uuid,text,integer,date[],text[],boolean,text,uuid[]) to authenticated;

-- Carrinhos não podem reduzir a capacidade abaixo da ocupação em qualquer turno
-- (além de não poderem ficar abaixo da quantidade de códigos ativos conhecidos).
create or replace function app_private.guard_cart_capacity()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_codes integer;
  v_busy integer;
begin
  if new.capacity is distinct from old.capacity then
    select count(*) into v_codes from public.notebook_codes n
      where n.cart_id=new.id and n.active;
    if new.capacity < v_codes then
      raise exception 'Capacidade inferior ao número de notebooks identificados ativos';
    end if;
    select coalesce(max(total_busy),0)::integer into v_busy from (
      select sum(p.quantity) total_busy
      from public.reservation_periods p
      where p.cart_id=new.id and p.active
      group by p.usage_date,p.shift
    ) as periods;
    if new.capacity < v_busy then
      raise exception 'Capacidade inferior à quantidade já reservada em um turno';
    end if;
  end if;
  return new;
end;
$$;
