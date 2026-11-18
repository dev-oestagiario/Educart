-- Isolated database fixture only; run as postgres with Auth schema/claims available.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','f51-admin@example.test',now()),
 ('22222222-2222-4222-8222-222222222222','f51-teacher@example.test',now()),
 ('33333333-3333-4333-8333-333333333333','f51-noaccess@example.test',now());
insert into public.admin_users(user_id,display_name) values('11111111-1111-4111-8111-111111111111','TI F51');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$
declare campus uuid; block uuid; room uuid; scene uuid; model uuid; room_model uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; n1 uuid; n2 uuid; req uuid; book uuid;
 d date:=current_date+14+((8-extract(isodow from current_date+14)::integer)%7); detail jsonb; n integer;
begin
 insert into public.campuses(name) values('F51 campus') returning id into campus;
 insert into public.campus_blocks(campus_id,name) values(campus,'F51 bloco') returning id into block;
 insert into public.campus_rooms(block_id,name) values(block,'F51 sala') returning id into room;
 insert into public.asset_models(name,kind,author,license,width_m,depth_m) values('F51 modelo','CART','Educart','Interno',1,1) returning id into model;
 insert into public.asset_models(name,kind,author,license,width_m,depth_m) values('F51 sala','ROOM','Educart','Interno',10,8) returning id into room_model;
 insert into public.spatial_scenes(room_id,name,model_id,width_m,depth_m,height_m) values(room,'F51 cena',room_model,10,8,3) returning id into scene;
 insert into public.carts(code,name,capacity) values('F51-A','F51 A',10) returning id into c1;
 insert into public.carts(code,name,capacity) values('F51-B','F51 B',10) returning id into c2;
 insert into public.carts(code,name,capacity) values('F51-C','F51 C',10) returning id into c3;
 insert into public.carts(code,name,capacity) values('F51-D','F51 D',10) returning id into c4;
 insert into public.carts(code,name,capacity,active) values('F51-E','F51 E',10,false) returning id into c5;
 insert into public.cart_storage_locations(cart_id,room_id) values(c2,room);
 insert into public.cart_scene_placements(cart_id,model_id,scene_id,position_x,position_y,position_z,yaw,updated_by) values(c1,model,scene,-2,0,0,0,'22222222-2222-4222-8222-222222222222');
 if (select updated_by from public.cart_scene_placements where cart_id=c1)<>auth.uid() then raise exception 'Actor spoofed';end if;
 begin
  insert into public.cart_scene_placements(cart_id,model_id,scene_id,position_x,position_y,position_z,yaw) values(c2,model,scene,-2,0,0,90);
  raise exception 'FAIL collision';
 exception when raise_exception then if sqlerrm='FAIL collision' then raise;end if;end;
 begin
  insert into public.cart_scene_placements(cart_id,model_id,scene_id,position_x,position_y,position_z,yaw) values(c2,model,scene,5,0,0,90);
  raise exception 'FAIL boundary';
 exception when raise_exception then if sqlerrm='FAIL boundary' then raise;end if;end;
 insert into public.cart_scene_placements(cart_id,model_id,scene_id,position_x,position_y,position_z,yaw) values(c2,model,scene,2,0,0,90);
 update public.cart_scene_placements set position_x=2.5 where cart_id=c2 and version=1;
 if (select version from public.cart_scene_placements where cart_id=c2)<>2 then raise exception 'FAIL version';end if;
 begin update public.spatial_scenes set width_m=2 where id=scene; raise exception 'FAIL resize'; exception when raise_exception then if sqlerrm='FAIL resize' then raise;end if;end;
 begin update public.asset_models set width_m=3 where id=model; raise exception 'FAIL model mutation'; exception when raise_exception then if sqlerrm='FAIL model mutation' then raise;end if;end;
 insert into public.cart_model_slots(model_id,slot_key,position_x,position_y,position_z) values(model,'A1',0,.4,0),(model,'A2',.1,.4,0);
 insert into public.notebook_codes(cart_id,code) values(c1,'F51-N1') returning id into n1;
 insert into public.notebook_codes(cart_id,code) values(c2,'F51-N2') returning id into n2;
 begin insert into public.notebook_slot_links(cart_id,model_id,slot_key,notebook_id) values(c1,model,'A1',n2); raise exception 'FAIL wrong cart'; exception when raise_exception then if sqlerrm='FAIL wrong cart' then raise;end if;end;
 insert into public.notebook_slot_links(cart_id,model_id,slot_key,notebook_id) values(c1,model,'A1',n1);
 begin insert into public.notebook_slot_links(cart_id,model_id,slot_key,notebook_id) values(c1,model,'A2',n1); raise exception 'FAIL duplicate'; exception when unique_violation then null;end;
 insert into public.requesters(name) values('F51 professor') returning id into req;
 perform public.link_teacher_account(req,'f51-teacher@example.test');
 book:=public.create_reservation_with_room(req,c1,'PARCIAL',3,array[d],array['MATUTINO'],false,null,array[n1],room);
 perform public.create_reservation(req,c3,'COMPLETA',10,array[d],array['MATUTINO'],false,null,'{}'::uuid[]);
 perform public.schedule_maintenance(c4,d,d,array['MATUTINO'],'Teste F51');
 select count(*) into n from public.spatial_cart_summary(d,'MATUTINO') where code like 'F51-%';
 if n<>5 then raise exception 'FAIL count';end if;
 if not exists(select 1 from public.spatial_cart_summary(d,'MATUTINO') where cart_id=c1 and reserved=3 and available=7 and availability_status='PARTIAL') then raise exception 'FAIL partial';end if;
 if not exists(select 1 from public.spatial_cart_summary(d,'MATUTINO') where cart_id=c3 and scene_id is null and availability_status='FULL') then raise exception 'FAIL full/unplaced';end if;
 if not exists(select 1 from public.spatial_cart_summary(d,'MATUTINO') where cart_id=c4 and availability_status='MAINTENANCE' and available=0) then raise exception 'FAIL maintenance';end if;
 if not exists(select 1 from public.spatial_cart_summary(d,'MATUTINO') where cart_id=c5 and availability_status='INACTIVE' and available=0) then raise exception 'FAIL inactive';end if;
 if not exists(select 1 from public.spatial_cart_summary(d,'VESPERTINO') where cart_id=c1 and availability_status='FREE' and available=10) then raise exception 'FAIL shift';end if;
 if not exists(select 1 from public.spatial_cart_summary(d+5,'MATUTINO') where cart_id=c1 and availability_status='UNAVAILABLE') then raise exception 'FAIL weekend';end if;
 detail:=public.spatial_cart_details(c1,d,'MATUTINO');
 if jsonb_array_length(detail->'confirmed_slots')<>1 or detail->'confirmed_slots'->0->>'reservation_period_id' is null then raise exception 'FAIL confirmed slot';end if;
 if detail->'reservations'->0->>'destination_room_id'<>room::text then raise exception 'FAIL destination';end if;
 if exists(select 1 from public.spatial_cart_summary(d,'MATUTINO') s join public.public_cart_availability(d,d) a on a.cart_id=s.cart_id and a.shift='MATUTINO' where s.available<>a.available or s.reserved<>a.reserved) then raise exception 'FAIL public consistency';end if;
 perform public.cancel_reservation(book);
 if (select reserved from public.spatial_cart_summary(d,'MATUTINO') where cart_id=c1)<>0 then raise exception 'FAIL cancel';end if;
 delete from public.notebook_slot_links where cart_id=c1;
 update public.cart_scene_placements set scene_id=null,position_x=null,position_y=null,position_z=null,yaw=null where cart_id=c2;
 if not exists(select 1 from public.spatial_cart_summary(d,'MATUTINO') where cart_id=c2 and scene_id is null and storage_room_id=room) then raise exception 'FAIL storage versus placement';end if;
 if not exists(select 1 from public.spatial_events where actor_id=auth.uid() and entity='notebook_slot_links' and operation='DELETE') then raise exception 'FAIL audit';end if;
 begin insert into public.spatial_events(entity,operation,actor_id) values('fake','INSERT',auth.uid());raise exception 'FAIL audit forgery';exception when insufficient_privilege then null;end;
 raise notice 'PASS F5.1 admin: constraints, collision, bounds, version, model, slots, aggregate/detail, maintenance, weekend, cancellation, audit';
end $$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$
declare t text; n bigint;
begin
 foreach t in array array['asset_models','spatial_scenes','cart_scene_placements','cart_model_slots','notebook_slot_links','spatial_events'] loop
 execute format('select count(*) from public.%I',t) into n;if n<>0 then raise exception 'FAIL teacher read %',t;end if;end loop;
 begin perform public.spatial_cart_summary(current_date,'MATUTINO');raise exception 'FAIL teacher RPC';exception when insufficient_privilege then null;end;
 begin perform public.spatial_cart_details(gen_random_uuid(),current_date,'MATUTINO');raise exception 'FAIL teacher detail';exception when insufficient_privilege then null;end;
 begin insert into public.asset_models(name,kind,author,license,width_m,depth_m) values('fake','CART','x','x',1,1);raise exception 'FAIL teacher write';exception when insufficient_privilege then null;end;
 raise notice 'PASS teacher denied';
end $$;
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.spatial_scenes) then raise exception 'FAIL unlinked read';end if;
 begin perform public.spatial_cart_summary(current_date,'MATUTINO');raise exception 'FAIL unlinked RPC';exception when insufficient_privilege then null;end;
 raise notice 'PASS unlinked denied';
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.spatial_scenes;raise exception 'FAIL anon table';exception when insufficient_privilege then null;end;
 begin perform public.spatial_cart_summary(current_date,'MATUTINO');raise exception 'FAIL anon RPC';exception when insufficient_privilege then null;end;
 perform public.public_cart_availability(current_date,current_date);
 raise notice 'PASS anon denied; public availability preserved';
end $$;
rollback;
