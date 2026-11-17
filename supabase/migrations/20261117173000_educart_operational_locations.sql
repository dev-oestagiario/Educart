-- F3.1: generic operational catalog. No real floor plans or coordinates.
create table public.campuses(
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 120),
 active boolean not null default true, created_at timestamptz not null default now());
create unique index campuses_name_unique on public.campuses(lower(btrim(name)));
create table public.campus_blocks(
 id uuid primary key default gen_random_uuid(), campus_id uuid not null references public.campuses(id),
 name text not null check(length(btrim(name)) between 1 and 120), active boolean not null default true,
 created_at timestamptz not null default now());
create unique index blocks_name_unique on public.campus_blocks(campus_id,lower(btrim(name)));
create table public.campus_rooms(
 id uuid primary key default gen_random_uuid(), block_id uuid not null references public.campus_blocks(id),
 name text not null check(length(btrim(name)) between 1 and 120), active boolean not null default true,
 created_at timestamptz not null default now());
create unique index rooms_name_unique on public.campus_rooms(block_id,lower(btrim(name)));
-- Keep storage assignment outside carts so teacher catalog queries do not reveal it.
create table public.cart_storage_locations(
 cart_id uuid primary key references public.carts(id),
 room_id uuid references public.campus_rooms(id),
 updated_at timestamptz not null default now());
alter table public.reservations add column destination_room_id uuid references public.campus_rooms(id);
alter table public.reservations add column destination_label text;
create index reservations_destination_idx on public.reservations(destination_room_id);
do $$
declare t text;
begin
 foreach t in array array['campuses','campus_blocks','campus_rooms','cart_storage_locations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy admin_read on public.%I for select to authenticated using ((select app_private.is_admin()))',t);
  execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select app_private.is_admin()))',t);
  execute format('create policy admin_update on public.%I for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()))',t);
 end loop;
end $$;
create function app_private.active_room_label(p_room uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare label text;
begin
 if p_room is null then return null; end if;
 select c.name||' / '||b.name||' / '||r.name into label
 from public.campus_rooms r join public.campus_blocks b on b.id=r.block_id
 join public.campuses c on c.id=b.campus_id
 where r.id=p_room and r.active and b.active and c.active
 for share of r,b,c;
 if not found then raise exception 'Sala inexistente ou inativa'; end if;
 return label;
end $$;
revoke all on function app_private.active_room_label(uuid) from public,anon;
grant execute on function app_private.active_room_label(uuid) to authenticated;
create function app_private.check_storage_location()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform app_private.active_room_label(new.room_id);
 new.updated_at=now();
 return new;
end $$;
revoke all on function app_private.check_storage_location() from public,anon,authenticated;
create trigger validate_storage before insert or update on public.cart_storage_locations
for each row execute function app_private.check_storage_location();
-- Preserve original APIs for old clients. The room-enabled variants are atomic:
-- original reservation + destination + audit metadata in a single transaction.
create function public.create_reservation_with_room(
 p_requester_id uuid,p_cart_id uuid,p_mode text,p_quantity integer,p_dates date[],p_shifts text[],
 p_needs_mouse boolean,p_notes text,p_notebook_ids uuid[],p_room_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_label text;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 v_label:=app_private.active_room_label(p_room_id);
 v_id:=public.create_reservation(p_requester_id,p_cart_id,p_mode,p_quantity,p_dates,p_shifts,p_needs_mouse,p_notes,p_notebook_ids);
 update public.reservations set destination_room_id=p_room_id,destination_label=v_label where id=v_id;
 update public.reservation_events set after_data=coalesce(after_data,'{}'::jsonb)||jsonb_build_object('destination_room_id',p_room_id,'destination_label',v_label)
 where reservation_id=v_id and event_type='CRIACAO';
 return v_id;
end $$;
create function public.update_reservation_with_room(
 p_reservation_id uuid,p_requester_id uuid,p_cart_id uuid,p_mode text,p_quantity integer,p_dates date[],p_shifts text[],
 p_needs_mouse boolean,p_notes text,p_notebook_ids uuid[],p_room_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_label text;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 v_label:=app_private.active_room_label(p_room_id);
 v_id:=public.update_reservation(p_reservation_id,p_requester_id,p_cart_id,p_mode,p_quantity,p_dates,p_shifts,p_needs_mouse,p_notes,p_notebook_ids);
 update public.reservations set destination_room_id=p_room_id,destination_label=v_label where id=v_id;
 update public.reservation_events set after_data=coalesce(after_data,'{}'::jsonb)||jsonb_build_object('destination_room_id',p_room_id,'destination_label',v_label)
 where id=(select id from public.reservation_events where reservation_id=v_id and event_type='EDICAO' order by occurred_at desc,id desc limit 1);
 return v_id;
end $$;
create function public.review_teacher_request_with_room(p_request_id uuid,p_approve boolean,p_review_notes text,p_room_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_label text;
begin
 if not app_private.is_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_approve then v_label:=app_private.active_room_label(p_room_id); end if;
 v_id:=public.review_teacher_request(p_request_id,p_approve,p_review_notes);
 if p_approve then
  update public.reservations set destination_room_id=p_room_id,destination_label=v_label where id=v_id;
  update public.reservation_events set after_data=coalesce(after_data,'{}'::jsonb)||jsonb_build_object('destination_room_id',p_room_id,'destination_label',v_label)
  where reservation_id=v_id and event_type='CRIACAO';
 end if;
 return v_id;
end $$;
revoke all on function public.create_reservation_with_room(uuid,uuid,text,integer,date[],text[],boolean,text,uuid[],uuid),
 public.update_reservation_with_room(uuid,uuid,uuid,text,integer,date[],text[],boolean,text,uuid[],uuid),
 public.review_teacher_request_with_room(uuid,boolean,text,uuid) from public,anon;
grant execute on function public.create_reservation_with_room(uuid,uuid,text,integer,date[],text[],boolean,text,uuid[],uuid),
 public.update_reservation_with_room(uuid,uuid,uuid,text,integer,date[],text[],boolean,text,uuid[],uuid),
 public.review_teacher_request_with_room(uuid,boolean,text,uuid) to authenticated;
