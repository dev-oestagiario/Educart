-- F3.2 Whole-cart maintenance windows; reservation and release share cart locking.
create table public.maintenance_windows(
 id uuid primary key default gen_random_uuid(),
 cart_id uuid not null references public.carts(id),
 start_date date not null, end_date date not null,
 shifts text[] not null,
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 closed_at timestamptz, closed_by uuid references auth.users(id),
 close_reason text, check(end_date>=start_date and end_date-start_date<=365),
 check(cardinality(shifts) between 1 and 3 and shifts <@ array['MATUTINO','VESPERTINO','NOTURNO']::text[] and array_position(shifts,null) is null),
 check((closed_at is null and closed_by is null and close_reason is null) or (closed_at is not null and closed_by is not null and length(btrim(close_reason)) between 1 and 1000))
);
create index maintenance_open_cart_idx on public.maintenance_windows(cart_id,start_date,end_date) where closed_at is null;
alter table public.maintenance_windows enable row level security;
revoke all on public.maintenance_windows from public,anon,authenticated;
grant select on public.maintenance_windows to authenticated;
create policy maintenance_admin_read on public.maintenance_windows for select to authenticated using ((select app_private.is_admin()));

create function app_private.cart_blocked(p_cart uuid,p_day date,p_shift text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.maintenance_windows m where m.cart_id=p_cart and m.closed_at is null
 and p_day between m.start_date and m.end_date and p_shift=any(m.shifts));
$$;
revoke all on function app_private.cart_blocked(uuid,date,text) from public,anon,authenticated;

create function public.schedule_maintenance(p_cart_id uuid,p_start date,p_end date,p_shifts text[],p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_start<(now() at time zone 'America/Sao_Paulo')::date
 or p_end<p_start or p_end-p_start>365 or p_shifts is null or cardinality(p_shifts) not between 1 and 3
 or exists(select 1 from unnest(p_shifts) s where s is null or s not in ('MATUTINO','VESPERTINO','NOTURNO'))
 or (select count(distinct s) from unnest(p_shifts) s)<>cardinality(p_shifts)
 or coalesce(length(btrim(p_reason)),0) not between 1 and 1000 then raise exception 'Informe período, turnos e motivo válidos'; end if;
 perform 1 from public.carts where id=p_cart_id and active for update;
 if not found then raise exception 'Carrinho inexistente ou inativo'; end if;
 if exists(select 1 from public.maintenance_windows m where m.cart_id=p_cart_id and m.closed_at is null
 and m.start_date<=p_end and m.end_date>=p_start and m.shifts && p_shifts) then
 raise exception 'Já existe manutenção para um dos períodos'; end if;
 if exists(select 1 from public.reservation_periods p where p.cart_id=p_cart_id and p.active
 and p.usage_date between p_start and p_end and p.shift=any(p_shifts)) then
 raise exception 'Existem reservas confirmadas no período. Resolva o conflito antes de programar a manutenção'; end if;
 insert into public.maintenance_windows(cart_id,start_date,end_date,shifts,reason,created_by)
 values(p_cart_id,p_start,p_end,p_shifts,btrim(p_reason),auth.uid()) returning id into v_id;
 return v_id;
end $$;
create function public.close_maintenance(p_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_cart uuid;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)),0) not between 1 and 1000 then raise exception 'Informe o motivo do encerramento'; end if;
 select cart_id into v_cart from public.maintenance_windows where id=p_id;
 if not found then raise exception 'Manutenção inexistente'; end if;
 perform 1 from public.carts where id=v_cart for update;
 update public.maintenance_windows set closed_at=now(),closed_by=auth.uid(),close_reason=btrim(p_reason)
 where id=p_id and closed_at is null;
 if not found then raise exception 'Manutenção já encerrada'; end if;
 return p_id;
end $$;
revoke all on function public.schedule_maintenance(uuid,date,date,text[],text),public.close_maintenance(uuid,text) from public,anon;
grant execute on function public.schedule_maintenance(uuid,date,date,text[],text),public.close_maintenance(uuid,text) to authenticated;

create function app_private.guard_maintenance_period()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.active then
  perform 1 from public.carts where id=new.cart_id for update;
  if app_private.cart_blocked(new.cart_id,new.usage_date,new.shift) then
   raise exception 'Carrinho em manutenção no período selecionado';
  end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_maintenance_period() from public,anon,authenticated;
create trigger guard_maintenance_period before insert or update on public.reservation_periods
for each row execute function app_private.guard_maintenance_period();

-- Educart Fase 8: prévia agregada da disponibilidade para professores autorizados.
-- Somente leitura: não modifica períodos, não bloqueia carrinhos, não aprova pedidos.
-- Sem nomes, códigos físicos, observações, IDs de reservas ou dados de outros professores.
create or replace function public.preview_teacher_availability(
  p_cart_id uuid,
  p_dates date[],
  p_shifts text[]
)
returns table (
  usage_date date,
  shift text,
  capacity integer,
  reserved integer,
  remaining integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
begin
  if not ((select app_private.is_teacher()) or (select app_private.is_admin())) then
    raise exception 'Conta não autorizada a consultar disponibilidade'
      using errcode='42501';
  end if;
  if p_cart_id is null
    or p_dates is null or cardinality(p_dates) not between 1 and 93
    or p_shifts is null or cardinality(p_shifts) not between 1 and 3 then
    raise exception 'Escolha um carrinho, até 93 dias úteis e pelo menos um turno';
  end if;
  if exists (
      select 1 from unnest(p_dates) d
      where d is null or extract(isodow from d) not between 1 and 5
        or d < (now() at time zone 'America/Sao_Paulo')::date
    )
    or (select count(distinct d) from unnest(p_dates) d)<>cardinality(p_dates)
    or exists (
      select 1 from unnest(p_shifts) s
      where s is null or s not in ('MATUTINO','VESPERTINO','NOTURNO')
    )
    or (select count(distinct s) from unnest(p_shifts) s)<>cardinality(p_shifts) then
    raise exception 'Datas ou turnos inválidos, passados ou repetidos';
  end if;

  select c.capacity into v_capacity
    from public.carts c
    where c.id=p_cart_id and c.active;
  if not found then
    raise exception 'Carrinho inativo ou inexistente';
  end if;

  -- Fonte da verdade: capacidade configurada - soma das reservas confirmadas ativas.
  -- Quantidade de códigos físicos registrados não afeta a capacidade.
  -- Solicitações pendentes NÃO são períodos reservados e não afetam a prévia.
  return query
    select d.usage_date, s.shift, case when app_private.cart_blocked(p_cart_id,d.usage_date,s.shift) then 0 else v_capacity end as capacity,
      coalesce(sum(p.quantity),0)::integer as reserved,
      case when app_private.cart_blocked(p_cart_id,d.usage_date,s.shift) then 0 else greatest(0,v_capacity-coalesce(sum(p.quantity),0)::integer) end as remaining
    from unnest(p_dates) as d(usage_date)
    cross join unnest(p_shifts) as s(shift)
    left join public.reservation_periods p
      on p.cart_id=p_cart_id and p.usage_date=d.usage_date
      and p.shift=s.shift and p.active
    group by d.usage_date,s.shift
    order by d.usage_date,array_position(p_shifts,s.shift);
end;
$$;
revoke all on function public.preview_teacher_availability(uuid,date[],text[])
  from public,anon;
grant execute on function public.preview_teacher_availability(uuid,date[],text[])
  to authenticated;

-- Consulta publica agregada, sem nomes de professores ou dados de reservas.
-- Executar no projeto Supabase Educart antes de publicar o portal.
create or replace function public.public_cart_availability(p_start date, p_end date)
returns table (
  usage_date date,
  cart_id uuid,
  cart_name text,
  capacity integer,
  shift text,
  reserved integer,
  available integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with dates as (
    select d::date as day
    from generate_series(p_start::timestamp, least(p_end, p_start + 34)::timestamp, interval '1 day') as d
    where (p_end - p_start) between 0 and 34
  ), shifts(shift_name) as (
    values ('MATUTINO'::text), ('VESPERTINO'::text), ('NOTURNO'::text)
  )
  select dates.day,
         c.id,
         c.name::text,
         case when app_private.cart_blocked(c.id,dates.day,shifts.shift_name) then 0 else c.capacity::integer end,
         shifts.shift_name,
         coalesce(sum(rp.quantity),0)::integer,
         case when app_private.cart_blocked(c.id,dates.day,shifts.shift_name) then 0 else greatest(c.capacity::integer - coalesce(sum(rp.quantity),0)::integer,0) end
  from dates
  cross join public.carts as c
  cross join shifts
  left join public.reservation_periods as rp
    on rp.cart_id = c.id
   and rp.usage_date = dates.day
   and rp.shift::text = shifts.shift_name
   and rp.active = true
  where c.active = true
    and extract(isodow from dates.day) between 1 and 5
  group by dates.day, c.id, c.name, c.capacity, shifts.shift_name
  order by dates.day, c.name, shifts.shift_name;
$$;

revoke all on function public.public_cart_availability(date,date) from public;
grant execute on function public.public_cart_availability(date,date) to anon, authenticated;

comment on function public.public_cart_availability(date,date) is
  'Consulta publica apenas de ocupacao agregada por carrinho, dia e turno; nao retorna dados pessoais ou identificadores de reservas.';
