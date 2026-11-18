-- F3.6: optional email channel, disabled unless explicitly configured by operator.
create table public.email_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.email_delivery_settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
create table public.email_outbox(
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null,
 kind text not null check(kind in ('NOVO_PEDIDO','PEDIDO_RETIRADO','PEDIDO_APROVADO','PEDIDO_REJEITADO','EQUIPAMENTO_RETIRADO','EQUIPAMENTO_DEVOLVIDO')),
 requester_id uuid references public.requesters(id),
 state text not null default 'PENDING' check(state in ('PENDING','LEASED','SENT','CANCELLED','FAILED','REVIEW')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 available_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(recipient_user_id,event_key),
 check((state='LEASED')=(lease_token is not null and lease_until is not null))
);
create index email_outbox_ready on public.email_outbox(available_at,id) where state='PENDING';
create index email_outbox_leases on public.email_outbox(lease_until) where state='LEASED';
alter table public.email_preferences enable row level security;
alter table public.email_delivery_settings enable row level security;
alter table public.email_outbox enable row level security;
revoke all on public.email_preferences,public.email_delivery_settings,public.email_outbox from public,anon,authenticated;
-- No client table grants: own preference is accessed only via checked RPC.
create function app_private.email_channel_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from public.email_delivery_settings where singleton),false);
$$;
create function app_private.email_recipient_allowed(p_user uuid,p_requester uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.email_preferences ep on ep.user_id=u.id
 where u.id=p_user and u.email_confirmed_at is not null and nullif(btrim(u.email),'') is not null and ep.enabled
 and (case when p_requester is null then exists(select 1 from public.admin_users a where a.user_id=u.id and a.active)
 else exists(select 1 from public.teacher_account_links l join public.requesters r on r.id=l.requester_id
 where l.user_id=u.id and l.active and l.requester_id=p_requester and r.active) end));
$$;
create function public.get_email_preference() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not(app_private.is_admin() or app_private.is_teacher()) then raise exception 'Sem permissão' using errcode='42501'; end if;
 return jsonb_build_object('enabled',coalesce((select enabled from public.email_preferences where user_id=auth.uid()),false),'channel_enabled',app_private.email_channel_enabled());
end $$;
create function public.set_email_preference(p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not(app_private.is_admin() or app_private.is_teacher()) or p_enabled is null then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_enabled and not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and nullif(btrim(email),'') is not null) then raise exception 'Confirme o e-mail da conta'; end if;
 insert into public.email_preferences(user_id,enabled) values(auth.uid(),p_enabled)
 on conflict(user_id) do update set enabled=excluded.enabled,updated_at=now();
 if not p_enabled then
  update public.email_outbox set state='CANCELLED',finished_at=now() where recipient_user_id=auth.uid() and state='PENDING';
 end if;
 return public.get_email_preference();
end $$;
create function app_private.enqueue_email(p_user uuid,p_event text,p_kind text,p_requester uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if app_private.email_channel_enabled() and app_private.email_recipient_allowed(p_user,p_requester) then
  insert into public.email_outbox(recipient_user_id,event_key,kind,requester_id)
  values(p_user,p_event,p_kind,p_requester) on conflict(recipient_user_id,event_key) do nothing;
 end if;
end $$;
create function app_private.enqueue_notification_email() returns trigger language plpgsql security definer set search_path='' as $$
declare v_requester uuid;
begin
 if new.kind in ('PEDIDO_APROVADO','PEDIDO_REJEITADO') then
  select requester_id into v_requester from public.reservation_requests where id=new.request_id;
  if v_requester is null then return new; end if;
 end if;
 perform app_private.enqueue_email(new.recipient_user_id,'notification:'||new.id,new.kind,v_requester);
 return new;
end $$;
create trigger email_notification_created after insert on public.user_notifications
 for each row execute function app_private.enqueue_notification_email();
create function app_private.enqueue_movement_email() returns trigger language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_kind text; v_event text;
begin
 if tg_op='INSERT' then v_kind:='EQUIPAMENTO_RETIRADO';v_event:='pickup:';
 elsif old.return_at is null and new.return_at is not null then v_kind:='EQUIPAMENTO_DEVOLVIDO';v_event:='return:';
 else return new; end if;
 select user_id into v_user from public.teacher_account_links where requester_id=new.requester_id and active;
 if found then perform app_private.enqueue_email(v_user,v_event||new.id,v_kind,new.requester_id);end if;
 return new;
end $$;
create trigger email_movement_created after insert or update of return_at on public.equipment_movements
 for each row execute function app_private.enqueue_movement_email();
-- Worker only. No automatic resend on an unknown outcome, including expired lease.
-- Claim uses current verified account email and current eligibility, never stores email addresses.
create function public.claim_email_batch(p_limit integer default 10)
returns table(id uuid,lease_token uuid,kind text,attempts integer)
language plpgsql security definer set search_path='' as $$
begin
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Lote inválido';end if;
 update public.email_outbox q set state='REVIEW',lease_token=null,lease_until=null,finished_at=now()
 where q.state='LEASED' and q.lease_until<=now();
 if not app_private.email_channel_enabled() then return;end if;
 update public.email_outbox q set state='CANCELLED',finished_at=now()
 where q.state='PENDING' and (not app_private.email_recipient_allowed(q.recipient_user_id,q.requester_id) or q.created_at<now()-interval '7 days');
 return query with candidates as (
  select q.id from public.email_outbox q where q.state='PENDING' and q.available_at<=now() and q.attempts<5
  order by q.available_at,q.id limit p_limit for update skip locked
 ), leased as (
  update public.email_outbox q set state='LEASED',attempts=q.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes'
  from candidates c where q.id=c.id returning q.id,q.lease_token,q.kind,q.recipient_user_id,q.attempts
 )
 select l.id,l.lease_token,l.kind,l.attempts from leased l;
end $$;
create function public.authorize_email_send(p_id uuid,p_token uuid) returns text language plpgsql security definer set search_path='' as $$
declare q public.email_outbox%rowtype; v_email text;
begin
 select * into q from public.email_outbox where id=p_id and state='LEASED' and lease_token=p_token and lease_until>now() for update;
 if not found then return null;end if;
 if not app_private.email_channel_enabled() or not app_private.email_recipient_allowed(q.recipient_user_id,q.requester_id) then
  update public.email_outbox set state='CANCELLED',lease_token=null,lease_until=null,finished_at=now() where id=p_id;
  return null;
 end if;
 select email into v_email from auth.users where id=q.recipient_user_id;
 return v_email;
end $$;
create function public.finish_email_delivery(p_id uuid,p_token uuid,p_outcome text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_outcome is null or p_outcome not in ('SENT','RETRY','FAILED','REVIEW') then raise exception 'Resultado inválido';end if;
 update public.email_outbox q set
 state=case when p_outcome='RETRY' and q.attempts<5 then 'PENDING' when p_outcome='RETRY' then 'FAILED' else p_outcome end,
 available_at=case when p_outcome='RETRY' then now()+make_interval(mins=>5*(2^(q.attempts-1))::integer) else q.available_at end,
 finished_at=case when p_outcome='RETRY' and q.attempts<5 then null else now() end,
 lease_token=null,lease_until=null
 where q.id=p_id and q.state='LEASED' and q.lease_token=p_token and q.lease_until>now();
 return found;
end $$;
revoke all on function app_private.email_channel_enabled(),app_private.email_recipient_allowed(uuid,uuid),app_private.enqueue_email(uuid,text,text,uuid),app_private.enqueue_notification_email(),app_private.enqueue_movement_email() from public,anon,authenticated;
revoke all on function public.get_email_preference(),public.set_email_preference(boolean) from public,anon,authenticated;
grant execute on function public.get_email_preference(),public.set_email_preference(boolean) to authenticated;
revoke all on function public.claim_email_batch(integer),public.authorize_email_send(uuid,uuid),public.finish_email_delivery(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_email_batch(integer),public.authorize_email_send(uuid,uuid),public.finish_email_delivery(uuid,uuid,text) to service_role;
