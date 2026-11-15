-- Educart Fase 7: notificações internas transacionais a partir dos eventos da Fase 6.
-- Nenhum serviço externo de e-mail ou chave privada é necessário.
-- As notificações só são criadas para eventos NOVOS; não há backfill.
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.reservation_requests(id) on delete restrict,
  request_event_id uuid not null references public.reservation_request_events(id) on delete restrict,
  kind text not null check(kind in ('NOVO_PEDIDO','PEDIDO_RETIRADO','PEDIDO_APROVADO','PEDIDO_REJEITADO')),
  title text not null check(length(title) between 1 and 120),
  body text not null check(length(body) between 1 and 400),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(request_event_id,recipient_user_id)
);
create index user_notifications_inbox_idx
  on public.user_notifications(recipient_user_id,created_at desc);
create index user_notifications_unread_idx
  on public.user_notifications(recipient_user_id,created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;
create policy notifications_recipient_read
  on public.user_notifications for select to authenticated
  using (recipient_user_id=(select auth.uid()));

revoke all on public.user_notifications from public,anon,authenticated;
grant select on public.user_notifications to authenticated;
-- Não há INSERT/UPDATE/DELETE diretos via REST.

create or replace function app_private.notify_request_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_request public.reservation_requests%rowtype;
begin
  select * into v_request from public.reservation_requests r where r.id=new.request_id;
  if not found then
    raise exception 'Evento sem solicitação válida';
  end if;

  if new.event_type in ('CRIACAO','DESISTENCIA') then
    insert into public.user_notifications(
      recipient_user_id,request_id,request_event_id,kind,title,body
    )
    select a.user_id,new.request_id,new.id,
      case when new.event_type='CRIACAO' then 'NOVO_PEDIDO' else 'PEDIDO_RETIRADO' end,
      case when new.event_type='CRIACAO' then 'Nova solicitação de reserva' else 'Solicitação retirada' end,
      case when new.event_type='CRIACAO'
        then 'Um professor enviou uma solicitação. Acesse a fila para analisar.'
        else 'Um professor retirou uma solicitação que estava pendente.' end
    from public.admin_users a where a.active
    on conflict(request_event_id,recipient_user_id) do nothing;
  elsif new.event_type in ('APROVACAO','REJEICAO') then
    insert into public.user_notifications(
      recipient_user_id,request_id,request_event_id,kind,title,body
    ) values (
      v_request.requested_by,new.request_id,new.id,
      case when new.event_type='APROVACAO' then 'PEDIDO_APROVADO' else 'PEDIDO_REJEITADO' end,
      case when new.event_type='APROVACAO' then 'Solicitação aprovada' else 'Solicitação rejeitada' end,
      case when new.event_type='APROVACAO'
        then 'Sua solicitação foi aprovada pela TI e a reserva foi confirmada.'
        else 'Sua solicitação foi rejeitada pela TI. Consulte a justificativa no portal.' end
    )
    on conflict(request_event_id,recipient_user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function app_private.notify_request_event() from public,anon,authenticated;

create trigger reservation_request_event_notification
  after insert on public.reservation_request_events
  for each row execute function app_private.notify_request_event();

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or p_notification_id is null then
    raise exception 'Sessão autenticada necessária' using errcode='42501';
  end if;
  update public.user_notifications
    set read_at=coalesce(read_at,now())
    where id=p_notification_id and recipient_user_id=auth.uid();
  return found;
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada necessária' using errcode='42501';
  end if;
  update public.user_notifications set read_at=now()
    where recipient_user_id=auth.uid() and read_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
