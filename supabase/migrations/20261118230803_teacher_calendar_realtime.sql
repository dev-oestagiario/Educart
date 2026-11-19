-- Additive, isolated QA before production. Existing whole-cart records retain their meaning.
alter table public.maintenance_windows add column notebook_id uuid references public.notebook_codes(id);
create index maintenance_notebook_open_idx on public.maintenance_windows(notebook_id,start_date,end_date) where closed_at is null and notebook_id is not null;

create or replace function app_private.cart_blocked(p_cart uuid,p_day date,p_shift text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.maintenance_windows m where m.cart_id=p_cart and m.notebook_id is null and m.closed_at is null
 and p_day between m.start_date and m.end_date and p_shift=any(m.shifts));
$$;
create function app_private.effective_cart_capacity(p_cart uuid,p_day date,p_shift text)
returns integer language sql stable security definer set search_path='' as $$
 select coalesce((select case when not c.active or app_private.cart_blocked(c.id,p_day,p_shift) then 0 else greatest(0,c.capacity-(select count(distinct m.notebook_id)::integer
 from public.maintenance_windows m where m.cart_id=c.id and m.notebook_id is not null and m.closed_at is null and p_day between m.start_date and m.end_date and p_shift=any(m.shifts))) end
 from public.carts c where c.id=p_cart),0);
$$;
revoke all on function app_private.effective_cart_capacity(uuid,date,text) from public,anon,authenticated;
-- Required by existing admin-only SECURITY INVOKER spatial summary (private schema).
grant execute on function app_private.effective_cart_capacity(uuid,date,text) to authenticated;

create function public.schedule_notebook_maintenance(p_cart_id uuid,p_notebook_id uuid,p_start date,p_end date,p_shifts text[],p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_capacity integer;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_notebook_id is null or p_start is null or p_end is null or p_start<(now() at time zone 'America/Sao_Paulo')::date
 or p_end<p_start or p_end-p_start>365 or p_shifts is null or cardinality(p_shifts) not between 1 and 3
 or exists(select 1 from unnest(p_shifts) s where s is null or s not in ('MATUTINO','VESPERTINO','NOTURNO'))
 or (select count(distinct s) from unnest(p_shifts) s)<>cardinality(p_shifts)
 or coalesce(length(btrim(p_reason)),0) not between 1 and 1000 then raise exception 'Informe equipamento, período, turnos e motivo válidos'; end if;
 select capacity into v_capacity from public.carts where id=p_cart_id and active for update;
 if not found then raise exception 'Carrinho inexistente ou inativo'; end if;
 -- Cart lock serializes with reservations, movement and maintenance.
 perform 1 from public.notebook_codes where id=p_notebook_id and cart_id=p_cart_id and active;
 if not found then raise exception 'Notebook inexistente, inativo ou de outro carrinho'; end if;
 if exists(select 1 from public.maintenance_windows m where m.cart_id=p_cart_id and (m.notebook_id is null or m.notebook_id=p_notebook_id) and m.closed_at is null
 and m.start_date<=p_end and m.end_date>=p_start and m.shifts&&p_shifts) then raise exception 'Já existe manutenção para o equipamento no período'; end if;
 if exists(select 1 from public.equipment_movements e where e.return_at is null and p_notebook_id=any(e.notebook_ids)) then raise exception 'Notebook pendente de devolução'; end if;
 if exists(select 1 from public.reservation_notebooks n where n.notebook_id=p_notebook_id and n.active and n.usage_date between p_start and p_end and n.shift=any(p_shifts)) then raise exception 'Notebook atribuído a uma reserva confirmada'; end if;
 if exists(select 1 from public.reservation_periods p where p.cart_id=p_cart_id and p.active and p.usage_date between p_start and p_end and p.shift=any(p_shifts)
 group by p.usage_date,p.shift having sum(p.quantity)>app_private.effective_cart_capacity(p_cart_id,p.usage_date,p.shift)-1) then raise exception 'A manutenção reduziria o saldo abaixo da quantidade já reservada'; end if;
 if exists(select 1 from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d cross join unnest(p_shifts) s
 where app_private.effective_cart_capacity(p_cart_id,d::date,s)<1) then raise exception 'Sem capacidade para esta manutenção'; end if;
 insert into public.maintenance_windows(cart_id,notebook_id,start_date,end_date,shifts,reason,created_by)
 values(p_cart_id,p_notebook_id,p_start,p_end,p_shifts,btrim(p_reason),auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.schedule_notebook_maintenance(uuid,uuid,date,date,text[],text) from public,anon;
grant execute on function public.schedule_notebook_maintenance(uuid,uuid,date,date,text[],text) to authenticated;

create or replace function app_private.guard_maintenance_period()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.active then
  perform 1 from public.carts where id=new.cart_id for update;
  if app_private.cart_blocked(new.cart_id,new.usage_date,new.shift) then raise exception 'Carrinho em manutenção no período selecionado'; end if;
  if new.quantity+(select coalesce(sum(p.quantity),0) from public.reservation_periods p where p.cart_id=new.cart_id and p.usage_date=new.usage_date and p.shift=new.shift and p.active and p.id<>new.id)>app_private.effective_cart_capacity(new.cart_id,new.usage_date,new.shift)
  then raise exception 'Quantidade indisponível devido à manutenção no período selecionado'; end if;
 end if;
 return new;
end $$;

create function app_private.guard_notebook_maintenance_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not new.active then return new; end if;
 select cart_id into cid from public.reservation_periods where id=new.period_id;
 perform 1 from public.carts where id=cid for update;
 if exists(select 1 from public.maintenance_windows m where m.cart_id=cid and m.notebook_id=new.notebook_id and m.closed_at is null and new.usage_date between m.start_date and m.end_date and new.shift=any(m.shifts)) then raise exception 'Notebook em manutenção no período selecionado'; end if;
 return new;
end $$;
revoke all on function app_private.guard_notebook_maintenance_assignment() from public,anon,authenticated;
create trigger guard_notebook_maintenance_assignment before insert or update of notebook_id,active,usage_date,shift on public.reservation_notebooks for each row execute function app_private.guard_notebook_maintenance_assignment();

create function app_private.guard_pickup_maintenance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.carts where id=new.cart_id for update;
 if exists(select 1 from public.maintenance_windows m where m.cart_id=new.cart_id and m.notebook_id=any(new.notebook_ids) and m.closed_at is null and new.usage_date between m.start_date and m.end_date and new.shift=any(m.shifts)) then raise exception 'Notebook em manutenção não pode ser retirado'; end if;
 if new.quantity+(select coalesce(sum(e.quantity),0) from public.equipment_movements e where e.cart_id=new.cart_id and e.return_at is null)>app_private.effective_cart_capacity(new.cart_id,new.usage_date,new.shift) then raise exception 'Capacidade física reduzida por manutenção'; end if;
 return new;
end $$;
revoke all on function app_private.guard_pickup_maintenance() from public,anon,authenticated;
create trigger guard_pickup_maintenance before insert on public.equipment_movements for each row execute function app_private.guard_pickup_maintenance();

create function app_private.guard_maintained_notebook_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cart_id is distinct from old.cart_id or (old.active and not new.active) then
  perform 1 from public.carts where id in(old.cart_id,new.cart_id) order by id for update;
  if exists(select 1 from public.maintenance_windows m where m.notebook_id=old.id and m.closed_at is null and m.end_date>=(now() at time zone 'America/Sao_Paulo')::date) then raise exception 'Encerre a manutenção do notebook antes de alterar seu cadastro'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_maintained_notebook_change() from public,anon,authenticated;
create trigger guard_maintained_notebook_change before update of cart_id,active on public.notebook_codes for each row execute function app_private.guard_maintained_notebook_change();

-- Teachers see only the operational scope and dates, never internal reasons, creators or individual codes.
create function public.teacher_maintenance_schedule(p_start date,p_end date)
returns table(id uuid,cart_name text,start_date date,end_date date,shifts text[],notebook_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (app_private.is_teacher() or app_private.is_admin()) then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end-p_start>365 then raise exception 'Intervalo inválido'; end if;
 return query select m.id,c.name,m.start_date,m.end_date,m.shifts,case when m.notebook_id is null then null::integer else 1 end
 from public.maintenance_windows m join public.carts c on c.id=m.cart_id
 where c.active and m.closed_at is null and m.end_date>=greatest(p_start,(now() at time zone 'America/Sao_Paulo')::date) and m.start_date<=p_end
 order by m.start_date,c.name,m.id;
end $$;
revoke all on function public.teacher_maintenance_schedule(date,date) from public,anon;
grant execute on function public.teacher_maintenance_schedule(date,date) to authenticated;

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
    select d.usage_date, s.shift, app_private.effective_cart_capacity(p_cart_id,d.usage_date,s.shift) as capacity,
      coalesce(sum(p.quantity),0)::integer as reserved,
      greatest(0,app_private.effective_cart_capacity(p_cart_id,d.usage_date,s.shift)-coalesce(sum(p.quantity),0)::integer) as remaining
    from unnest(p_dates) as d(usage_date)
    cross join unnest(p_shifts) as s(shift)
    left join public.reservation_periods p
      on p.cart_id=p_cart_id and p.usage_date=d.usage_date
      and p.shift=s.shift and p.active
    group by d.usage_date,s.shift
    order by d.usage_date,array_position(p_shifts,s.shift);
end;
$$;

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
         app_private.effective_cart_capacity(c.id,dates.day,shifts.shift_name),
         shifts.shift_name,
         coalesce(sum(rp.quantity),0)::integer,
         greatest(app_private.effective_cart_capacity(c.id,dates.day,shifts.shift_name)-coalesce(sum(rp.quantity),0)::integer,0)
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


create or replace function public.spatial_cart_summary(p_date date,p_shift text)
returns table(cart_id uuid,code text,name text,active boolean,storage_room_id uuid,scene_id uuid,model_id uuid,
 position_x numeric,position_y numeric,position_z numeric,yaw numeric,placement_version integer,
 nominal_capacity integer,effective_capacity integer,reserved integer,available integer,maintenance_count integer,
 availability_status text,snapshot_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_date is null or not isfinite(p_date) or p_shift is null or p_shift not in ('MATUTINO','VESPERTINO','NOTURNO') then raise exception 'Data ou turno inválido'; end if;
 return query
 with usage as (select rp.cart_id,sum(rp.quantity)::integer as qty from public.reservation_periods rp where rp.active and rp.usage_date=p_date and rp.shift=p_shift group by rp.cart_id),
 maint as (select mw.cart_id,count(*)::integer as qty from public.maintenance_windows mw where mw.closed_at is null and p_date between mw.start_date and mw.end_date and p_shift=any(mw.shifts) group by mw.cart_id),
 rows as (select c.*,coalesce(u.qty,0) as used,coalesce(m.qty,0) as maintenance,
  case when not c.active or extract(isodow from p_date)>5 then 0 else app_private.effective_cart_capacity(c.id,p_date,p_shift) end as effective
  from public.carts c left join usage u on u.cart_id=c.id left join maint m on m.cart_id=c.id)
 select c.id,c.code,c.name,c.active,l.room_id,
 case when s.active and r.active and b.active and cp.active and c.active then p.scene_id end,p.model_id,
 case when s.active and r.active and b.active and cp.active and c.active then p.position_x end,
 case when s.active and r.active and b.active and cp.active and c.active then p.position_y end,
 case when s.active and r.active and b.active and cp.active and c.active then p.position_z end,
 case when s.active and r.active and b.active and cp.active and c.active then p.yaw end,p.version,
 c.capacity,c.effective,c.used,greatest(0,c.effective-c.used),c.maintenance,
 case when not c.active then 'INACTIVE' when c.maintenance>0 and c.effective=0 then 'MAINTENANCE' when extract(isodow from p_date)>5 then 'UNAVAILABLE'
 when c.used>=c.effective then 'FULL' when c.used>0 then 'PARTIAL' else 'FREE' end,statement_timestamp()
 from rows c left join public.cart_scene_placements p on p.cart_id=c.id left join public.cart_storage_locations l on l.cart_id=c.id
 left join public.spatial_scenes s on s.id=p.scene_id left join public.campus_rooms r on r.id=s.room_id
 left join public.campus_blocks b on b.id=r.block_id left join public.campuses cp on cp.id=b.campus_id
 order by c.code,c.id;
end $$;


-- Postgres changes deliver INSERT/UPDATE through existing RLS. No delete subscriptions or new table grants.
do $$ begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
   create publication supabase_realtime with (publish='insert, update');
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_notifications') then
   alter publication supabase_realtime add table public.user_notifications;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reservation_requests') then
   alter publication supabase_realtime add table public.reservation_requests;
 end if;
end $$;
