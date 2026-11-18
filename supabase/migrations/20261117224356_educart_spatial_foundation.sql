-- F5.1: private administrative projection, no modifications to reservations or public APIs.
create table public.asset_models (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 kind text not null check(kind in ('CART','ROOM')),
 version integer not null default 1 check(version>0),
 storage_path text check(storage_path ~ '^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*[.]glb$'),
 checksum text check(checksum ~ '^[a-f0-9]{64}$'),
 author text not null check(length(btrim(author)) between 1 and 160),
 license text not null check(length(btrim(license)) between 1 and 160),
 scale numeric(8,4) not null default 1 check(scale between .0001 and 100),
 width_m numeric(8,3) not null check(width_m between .1 and 100),
 depth_m numeric(8,3) not null check(depth_m between .1 and 100),
 active boolean not null default true,
 check((storage_path is null)=(checksum is null)),
 unique(name,kind,version)
);
create table public.spatial_scenes (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.campus_rooms(id),
 name text not null check(length(btrim(name)) between 1 and 120),
 model_id uuid references public.asset_models(id),
 width_m numeric(8,3) not null check(width_m between 1 and 100),
 depth_m numeric(8,3) not null check(depth_m between 1 and 100),
 height_m numeric(8,3) not null check(height_m between 1 and 20),
 revision integer not null default 1 check(revision>0),
 active boolean not null default true,
 unique(room_id,name,revision)
);
create index spatial_scenes_room_idx on public.spatial_scenes(room_id);
-- One profile per cart. NULL pose is deliberate: storage or real-time location is NOT inferred.
create table public.cart_scene_placements (
 cart_id uuid primary key references public.carts(id),
 model_id uuid references public.asset_models(id),
 scene_id uuid references public.spatial_scenes(id),
 position_x numeric(8,3), position_y numeric(8,3), position_z numeric(8,3), yaw numeric(8,3),
 version integer not null default 1 check(version>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(cart_id,model_id),
 check((scene_id is null and position_x is null and position_y is null and position_z is null and yaw is null)
    or (scene_id is not null and model_id is not null and position_x is not null and position_y=0 and position_y is not null and position_z is not null and yaw is not null and yaw>=0 and yaw<360))
);
create index cart_placement_scene_idx on public.cart_scene_placements(scene_id);
create index cart_placement_model_idx on public.cart_scene_placements(model_id);
create table public.cart_model_slots (
 model_id uuid not null references public.asset_models(id),
 slot_key text not null check(slot_key ~ '^[a-zA-Z0-9_-]{1,40}$'),
 position_x numeric(8,3) not null check(position_x between -100 and 100),
 position_y numeric(8,3) not null check(position_y between 0 and 100),
 position_z numeric(8,3) not null check(position_z between -100 and 100),
 description text check(length(description)<=200),
 primary key(model_id,slot_key)
);
-- Composite reference prevents assignments to a notebook from another cart, including later transfers.
alter table public.notebook_codes add constraint notebook_cart_identity unique(id,cart_id);
create table public.notebook_slot_links (
 cart_id uuid not null, model_id uuid not null, slot_key text not null,
 notebook_id uuid not null unique,
 confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),
 primary key(cart_id,slot_key),
 foreign key(cart_id,model_id) references public.cart_scene_placements(cart_id,model_id),
 foreign key(model_id,slot_key) references public.cart_model_slots(model_id,slot_key),
 foreign key(notebook_id,cart_id) references public.notebook_codes(id,cart_id)
);
create table public.spatial_events (
 id bigint generated always as identity primary key,
 entity text not null, operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 actor_id uuid not null references auth.users(id), occurred_at timestamptz not null default now(),
 before_data jsonb, after_data jsonb
);
create index spatial_events_time_idx on public.spatial_events(occurred_at desc);
do $$
declare t text;
begin
 foreach t in array array['asset_models','spatial_scenes','cart_scene_placements','cart_model_slots','notebook_slot_links','spatial_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy admin_read on public.%I for select to authenticated using ((select app_private.is_admin()))',t);
  if t<>'spatial_events' then
   execute format('grant insert,update on public.%I to authenticated',t);
   execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select app_private.is_admin()))',t);
   execute format('create policy admin_update on public.%I for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()))',t);
  end if;
 end loop;
end $$;
grant delete on public.notebook_slot_links to authenticated;
create policy admin_unlink on public.notebook_slot_links for delete to authenticated using ((select app_private.is_admin()));
-- Serialize geometry edits before validation. Reject higher isolation levels rather than use stale snapshots.
create function app_private.lock_spatial_edits() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'Edição espacial exige read committed'; end if;
 perform pg_advisory_xact_lock(83510,1);
 return null;
end $$;
do $$
declare t text;
begin
 foreach t in array array['asset_models','spatial_scenes','cart_scene_placements','cart_model_slots','notebook_slot_links'] loop
  execute format('create trigger spatial_lock before insert or update or delete on public.%I for each statement execute function app_private.lock_spatial_edits()',t);
 end loop;
end $$;
create function app_private.validate_spatial_scene() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.active then
  perform app_private.active_room_label(new.room_id);
  if new.model_id is not null and not exists(select 1 from public.asset_models m where m.id=new.model_id and m.kind='ROOM' and m.active) then raise exception 'Modelo de sala inválido'; end if;
 end if;
 if tg_op='UPDATE' then
  if new.id<>old.id then raise exception 'Identificador imutável'; end if;
  if exists(select 1 from public.cart_scene_placements p where p.scene_id=old.id)
    and (new.room_id,new.width_m,new.depth_m,new.height_m,new.model_id,new.revision,new.active) is distinct from
        (old.room_id,old.width_m,old.depth_m,old.height_m,old.model_id,old.revision,old.active)
    then raise exception 'Retire os posicionamentos antes de alterar a cena'; end if;
 end if;
 return new;
end $$;
create trigger spatial_scene_validate before insert or update on public.spatial_scenes for each row execute function app_private.validate_spatial_scene();
create function app_private.validate_asset_model() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id<>old.id then raise exception 'Identificador imutável'; end if;
 if (exists(select 1 from public.cart_scene_placements p where p.model_id=old.id)
  or exists(select 1 from public.spatial_scenes s where s.model_id=old.id)
  or exists(select 1 from public.cart_model_slots s where s.model_id=old.id))
  and new is distinct from old then raise exception 'Modelo em uso; cadastre uma nova versão'; end if;
 return new;
end $$;
create trigger spatial_model_validate before update on public.asset_models for each row execute function app_private.validate_asset_model();
create function app_private.validate_cart_placement() returns trigger language plpgsql security invoker set search_path='' as $$
declare m public.asset_models%rowtype; s public.spatial_scenes%rowtype; radius numeric;
begin
 if tg_op='UPDATE' then
  if new.cart_id<>old.cart_id then raise exception 'Carrinho imutável'; end if;
  if new.version<>old.version then raise exception 'Versão desatualizada'; end if;
  new.version:=old.version+1;
 else new.version:=1; end if;
 new.updated_by:=auth.uid();new.updated_at:=now();
 if new.model_id is not null then
  select * into m from public.asset_models where id=new.model_id and kind='CART' and active;
  if not found then raise exception 'Modelo de carrinho inválido'; end if;
 end if;
 if new.scene_id is not null then
  if not exists(select 1 from public.carts where id=new.cart_id and active) then raise exception 'Carrinho inativo'; end if;
  select * into s from public.spatial_scenes where id=new.scene_id and active;
  if not found then raise exception 'Cena inativa ou inexistente'; end if;
  perform app_private.active_room_label(s.room_id);
  -- Conservative bounding circle (rotation-independent), origin at centre of room.
  radius:=sqrt(m.width_m^2+m.depth_m^2)/2;
  if new.position_x is null or new.position_z is null or abs(new.position_x)+radius>s.width_m/2 or abs(new.position_z)+radius>s.depth_m/2 then
   raise exception 'Posição fora dos limites da cena';
  end if;
  if exists(select 1 from public.cart_scene_placements p join public.asset_models am on am.id=p.model_id
    where p.scene_id=new.scene_id and p.cart_id<>new.cart_id
    and (p.position_x-new.position_x)^2+(p.position_z-new.position_z)^2 < (radius+sqrt(am.width_m^2+am.depth_m^2)/2)^2)
  then raise exception 'Posicionamento conflita com outro carrinho'; end if;
 end if;
 return new;
end $$;
create trigger cart_placement_validate before insert or update on public.cart_scene_placements for each row execute function app_private.validate_cart_placement();
create function app_private.validate_spatial_slot() returns trigger language plpgsql security invoker set search_path='' as $$
declare m public.asset_models%rowtype;
begin
 select * into m from public.asset_models where id=new.model_id and kind='CART' and active;
 if not found or abs(new.position_x)>m.width_m/2 or abs(new.position_z)>m.depth_m/2 then raise exception 'Slot fora do modelo de carrinho'; end if;
 if tg_op='UPDATE' and exists(select 1 from public.notebook_slot_links l where l.model_id=old.model_id and l.slot_key=old.slot_key) then raise exception 'Desvincule o notebook antes de editar o slot'; end if;
 return new;
end $$;
create trigger spatial_slot_validate before insert or update on public.cart_model_slots for each row execute function app_private.validate_spatial_slot();
create function app_private.confirm_spatial_slot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.notebook_codes n where n.id=new.notebook_id and n.cart_id=new.cart_id and n.active) then raise exception 'Notebook não pertence ao carrinho ou está inativo'; end if;
 if not exists(select 1 from public.carts c where c.id=new.cart_id and c.active) then raise exception 'Carrinho inativo'; end if;
 new.confirmed_by:=auth.uid();new.confirmed_at:=now();return new;
end $$;
create trigger spatial_link_validate before insert or update on public.notebook_slot_links for each row execute function app_private.confirm_spatial_slot();
-- Audit trigger is private and privileged ONLY to insert immutable events, never to expose records.
create function app_private.audit_spatial_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 insert into public.spatial_events(entity,operation,actor_id,before_data,after_data)
 values(tg_table_name,tg_op,auth.uid(),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return null;
end $$;
do $$
declare t text;
begin
 foreach t in array array['asset_models','spatial_scenes','cart_scene_placements','cart_model_slots','notebook_slot_links'] loop
  execute format('create trigger spatial_audit after insert or update or delete on public.%I for each row execute function app_private.audit_spatial_change()',t);
 end loop;
end $$;
revoke all on function app_private.lock_spatial_edits(),app_private.validate_spatial_scene(),app_private.validate_asset_model(),app_private.validate_cart_placement(),app_private.validate_spatial_slot(),app_private.confirm_spatial_slot(),app_private.audit_spatial_change() from public,anon,authenticated;
-- Single-period summary, all carts including inactive and intentionally unplaced. No PII.
create function public.spatial_cart_summary(p_date date,p_shift text)
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
  case when not c.active or coalesce(m.qty,0)>0 or extract(isodow from p_date)>5 then 0 else c.capacity end as effective
  from public.carts c left join usage u on u.cart_id=c.id left join maint m on m.cart_id=c.id)
 select c.id,c.code,c.name,c.active,l.room_id,
 case when s.active and r.active and b.active and cp.active and c.active then p.scene_id end,p.model_id,
 case when s.active and r.active and b.active and cp.active and c.active then p.position_x end,
 case when s.active and r.active and b.active and cp.active and c.active then p.position_y end,
 case when s.active and r.active and b.active and cp.active and c.active then p.position_z end,
 case when s.active and r.active and b.active and cp.active and c.active then p.yaw end,p.version,
 c.capacity,c.effective,c.used,greatest(0,c.effective-c.used),c.maintenance,
 case when not c.active then 'INACTIVE' when c.maintenance>0 then 'MAINTENANCE' when extract(isodow from p_date)>5 then 'UNAVAILABLE'
 when c.used>=c.effective then 'FULL' when c.used>0 then 'PARTIAL' else 'FREE' end,statement_timestamp()
 from rows c left join public.cart_scene_placements p on p.cart_id=c.id left join public.cart_storage_locations l on l.cart_id=c.id
 left join public.spatial_scenes s on s.id=p.scene_id left join public.campus_rooms r on r.id=s.room_id
 left join public.campus_blocks b on b.id=r.block_id left join public.campuses cp on cp.id=b.campus_id
 order by c.code,c.id;
end $$;
-- Details only on selection; confirmed associations only. Reservation destinations are separate from placement.
create function public.spatial_cart_details(p_cart_id uuid,p_date date,p_shift text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 select to_jsonb(s) into result from public.spatial_cart_summary(p_date,p_shift) s where s.cart_id=p_cart_id;
 if result is null then raise exception 'Carrinho inexistente'; end if;
 return jsonb_build_object('summary',result,'reservations',coalesce((
 select jsonb_agg(jsonb_build_object('id',r.id,'period_id',rp.id,'requester',rq.name,'quantity',rp.quantity,'mode',r.mode,'destination_room_id',r.destination_room_id,'destination_label',r.destination_label,'needs_mouse',r.needs_mouse,'notes',r.notes) order by r.id)
 from public.reservation_periods rp join public.reservations r on r.id=rp.reservation_id join public.requesters rq on rq.id=r.requester_id
 where rp.cart_id=p_cart_id and rp.usage_date=p_date and rp.shift=p_shift and rp.active),'[]'::jsonb),
 'confirmed_slots',coalesce((
 select jsonb_agg(jsonb_build_object('slot_key',l.slot_key,'notebook_id',n.id,'code',n.code,'confirmed_at',l.confirmed_at,'reservation_period_id',
 (select rn.period_id from public.reservation_notebooks rn join public.reservation_periods rp on rp.id=rn.period_id where rn.notebook_id=n.id and rn.active and rp.active and rp.cart_id=p_cart_id and rp.usage_date=p_date and rp.shift=p_shift limit 1)) order by l.slot_key)
 from public.notebook_slot_links l join public.notebook_codes n on n.id=l.notebook_id and n.cart_id=l.cart_id and n.active where l.cart_id=p_cart_id),'[]'::jsonb));
end $$;
revoke all on function public.spatial_cart_summary(date,text),public.spatial_cart_details(uuid,date,text) from public,anon,authenticated;
grant execute on function public.spatial_cart_summary(date,text),public.spatial_cart_details(uuid,date,text) to authenticated;
