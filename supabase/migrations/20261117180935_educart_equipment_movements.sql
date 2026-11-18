-- F3.3: custody records per confirmed reservation period; not live tracking.
create table public.equipment_movements(
 id uuid primary key default gen_random_uuid(),
 period_id uuid not null unique references public.reservation_periods(id),
 reservation_id uuid not null references public.reservations(id),
 cart_id uuid not null references public.carts(id),
 requester_id uuid not null references public.requesters(id),
 usage_date date not null, shift text not null check(shift in ('MATUTINO','VESPERTINO','NOTURNO')),
 quantity integer not null check(quantity>0),
 notebook_ids uuid[] not null default '{}',
 notebook_codes text[] not null default '{}',
 pickup_key uuid not null unique, pickup_at timestamptz not null default now(),
 pickup_by uuid not null references auth.users(id), pickup_responsible text not null,
 pickup_condition text not null check(pickup_condition in ('BOA','RESSALVA')),
 pickup_notes text,
 return_key uuid unique, return_at timestamptz, return_by uuid references auth.users(id),
 return_responsible text, return_condition text check(return_condition in ('BOA','RESSALVA')), return_notes text,
 check(cardinality(notebook_ids)=cardinality(notebook_codes) and cardinality(notebook_ids)<=quantity),
 check(length(btrim(pickup_responsible)) between 2 and 160),
 check(pickup_notes is null or length(pickup_notes)<=1000),
 check(return_notes is null or length(return_notes)<=1000),
 check(pickup_condition='BOA' or nullif(btrim(pickup_notes),'') is not null),
 check((return_at is null and return_key is null and return_by is null and return_responsible is null and return_condition is null and return_notes is null)
 or (return_at>=pickup_at and return_key is not null and return_by is not null and return_responsible is not null and length(btrim(return_responsible)) between 2 and 160 and return_condition is not null and (return_condition='BOA' or nullif(btrim(return_notes),'') is not null)))
);
create index movements_open_cart_idx on public.equipment_movements(cart_id) where return_at is null;
create index movements_date_idx on public.equipment_movements(usage_date desc,id);
alter table public.equipment_movements enable row level security;
revoke all on public.equipment_movements from public,anon,authenticated;
grant select on public.equipment_movements to authenticated;
create policy movements_admin_read on public.equipment_movements for select to authenticated using ((select app_private.is_admin()));

create function public.register_equipment_pickup(p_period_id uuid,p_key uuid,p_quantity integer,p_notebook_ids uuid[],p_responsible text,p_condition text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.reservations%rowtype; p public.reservation_periods%rowtype; c public.carts%rowtype;
 m public.equipment_movements%rowtype; v_id uuid; v_codes text[]; v_ids uuid[];
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_key is null or p_quantity is null or p_quantity<1 or p_notebook_ids is null
 or cardinality(p_notebook_ids)>p_quantity or array_position(p_notebook_ids,null) is not null
 or (select count(distinct x) from unnest(p_notebook_ids) x)<>cardinality(p_notebook_ids)
 or coalesce(length(btrim(p_responsible)),0) not between 2 and 160
 or p_condition is null or p_condition not in ('BOA','RESSALVA') or length(coalesce(p_notes,''))>1000
 or (p_condition='RESSALVA' and nullif(btrim(p_notes),'') is null) then raise exception 'Dados de retirada inválidos'; end if;
 select coalesce(array_agg(x order by x),'{}'::uuid[]) into v_ids from unnest(p_notebook_ids) x;
 select r.* into b from public.reservations r join public.reservation_periods rp on rp.reservation_id=r.id where rp.id=p_period_id for update of r;
 if not found then raise exception 'Período inexistente'; end if;
 select * into c from public.carts where id=b.cart_id for update;
 select * into p from public.reservation_periods where id=p_period_id for update;
 select * into m from public.equipment_movements where period_id=p_period_id;
 if found then
  if m.pickup_key=p_key and m.quantity=p_quantity and m.notebook_ids=v_ids and m.pickup_responsible=btrim(p_responsible)
   and m.pickup_condition=p_condition and m.pickup_notes is not distinct from nullif(btrim(p_notes),'') then return m.id; end if;
  raise exception 'Retirada já registrada para esse período';
 end if;
 if b.status<>'CONFIRMADA' or not p.active or p.cart_id<>b.cart_id or not c.active
 or p.usage_date<>(now() at time zone 'America/Sao_Paulo')::date or p_quantity>p.quantity then
  raise exception 'Retirada exige período confirmado de hoje e quantidade dentro da reserva'; end if;
 if app_private.cart_blocked(c.id,p.usage_date,p.shift) then raise exception 'Carrinho em manutenção'; end if;
 if p_quantity+(select coalesce(sum(quantity),0) from public.equipment_movements where cart_id=c.id and return_at is null)>c.capacity then
  raise exception 'Quantidade fisicamente pendente de devolução excede a capacidade'; end if;
 select coalesce(array_agg(n.code order by n.id),'{}'::text[]) into v_codes from public.notebook_codes n where n.id=any(v_ids) and n.cart_id=c.id and n.active;
 if cardinality(v_codes)<>cardinality(v_ids) then raise exception 'Código inválido ou de outro carrinho'; end if;
 if exists(select 1 from public.equipment_movements e where e.return_at is null and e.notebook_ids && v_ids)
 or exists(select 1 from public.reservation_notebooks n where n.notebook_id=any(v_ids) and n.active and n.usage_date=p.usage_date and n.shift=p.shift and n.period_id<>p.id) then
  raise exception 'Notebook já retirado ou atribuído a outra reserva do turno'; end if;
 insert into public.equipment_movements(period_id,reservation_id,cart_id,requester_id,usage_date,shift,quantity,notebook_ids,notebook_codes,pickup_key,pickup_by,pickup_responsible,pickup_condition,pickup_notes)
 values(p.id,b.id,c.id,b.requester_id,p.usage_date,p.shift,p_quantity,v_ids,v_codes,p_key,auth.uid(),btrim(p_responsible),p_condition,nullif(btrim(p_notes),'')) returning id into v_id;
 return v_id;
end $$;

create function public.register_equipment_return(p_movement_id uuid,p_key uuid,p_responsible text,p_condition text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.equipment_movements%rowtype;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_key is null or coalesce(length(btrim(p_responsible)),0) not between 2 and 160
 or p_condition is null or p_condition not in ('BOA','RESSALVA') or length(coalesce(p_notes,''))>1000
 or (p_condition='RESSALVA' and nullif(btrim(p_notes),'') is null) then raise exception 'Dados de devolução inválidos'; end if;
 select * into m from public.equipment_movements where id=p_movement_id;
 if not found then raise exception 'Retirada inexistente'; end if;
 perform 1 from public.carts where id=m.cart_id for update;
 select * into m from public.equipment_movements where id=p_movement_id for update;
 if m.return_at is not null then
  if m.return_key=p_key and m.return_responsible=btrim(p_responsible) and m.return_condition=p_condition and m.return_notes is not distinct from nullif(btrim(p_notes),'') then return m.id; end if;
  raise exception 'Devolução já registrada';
 end if;
 update public.equipment_movements set return_at=now(),return_by=auth.uid(),return_key=p_key,return_responsible=btrim(p_responsible),return_condition=p_condition,return_notes=nullif(btrim(p_notes),'') where id=m.id;
 return m.id;
end $$;
revoke all on function public.register_equipment_pickup(uuid,uuid,integer,uuid[],text,text,text),public.register_equipment_return(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.register_equipment_pickup(uuid,uuid,integer,uuid[],text,text,text),public.register_equipment_return(uuid,uuid,text,text,text) to authenticated;

-- Reservations remain planned occupancy; protect historical period identity.
create function app_private.guard_movement_period() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.equipment_movements where period_id=old.id) and
 (tg_op='DELETE' or new is distinct from old) then raise exception 'Período com movimentação registrada não pode ser alterado'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function app_private.guard_movement_period() from public,anon,authenticated;
create trigger guard_movement_period before update or delete on public.reservation_periods for each row execute function app_private.guard_movement_period();

-- Do not lower nominal capacity below outstanding custody.
create function app_private.guard_outstanding_capacity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.capacity<old.capacity and new.capacity<(select coalesce(sum(quantity),0) from public.equipment_movements where cart_id=old.id and return_at is null) then
 raise exception 'Capacidade inferior à quantidade pendente de devolução'; end if; return new;
end $$;
revoke all on function app_private.guard_outstanding_capacity() from public,anon,authenticated;
create trigger guard_outstanding_capacity before update of capacity on public.carts for each row execute function app_private.guard_outstanding_capacity();

-- An identified notebook in custody cannot be transferred or deactivated.
-- Lock carts in the same stable order used by reservation transfers.
create function app_private.guard_outstanding_notebook() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cart_id is distinct from old.cart_id or (old.active and not new.active) then
  perform 1 from public.carts where id in(old.cart_id,new.cart_id) order by id for update;
  if exists(select 1 from public.equipment_movements where return_at is null and old.id=any(notebook_ids)) then
   raise exception 'Notebook pendente de devolução não pode ser transferido ou desativado';
  end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_outstanding_notebook() from public,anon,authenticated;
create trigger guard_outstanding_notebook before update of cart_id,active on public.notebook_codes
for each row execute function app_private.guard_outstanding_notebook();
