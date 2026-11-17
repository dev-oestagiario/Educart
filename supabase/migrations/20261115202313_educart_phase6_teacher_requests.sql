-- Educart Fase 6: conta de professor vinculada pela TI e pedido sujeito a aprovação.
-- Pendências NÃO ocupam capacidade. A aprovação chama create_reservation() atomicamente.
-- Migração aditiva: não modifica reservas confirmadas nem cadastros atuais.

create table public.teacher_account_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requester_id uuid not null references public.requesters(id) on delete restrict,
  active boolean not null default true,
  linked_by uuid not null references auth.users(id),
  linked_at timestamptz not null default now()
);
create unique index teacher_account_links_requester_active_idx
  on public.teacher_account_links(requester_id) where active;
create index teacher_account_links_requester_idx on public.teacher_account_links(requester_id);

create or replace function app_private.current_teacher_requester_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select l.requester_id
    from public.teacher_account_links l
    join public.requesters r on r.id=l.requester_id
    where l.user_id=(select auth.uid())
      and l.active and r.active
    limit 1;
$$;
revoke all on function app_private.current_teacher_requester_id() from public, anon;
grant execute on function app_private.current_teacher_requester_id() to authenticated;

create or replace function app_private.is_teacher()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select app_private.current_teacher_requester_id()) is not null;
$$;
revoke all on function app_private.is_teacher() from public, anon;
grant execute on function app_private.is_teacher() to authenticated;

create table public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.requesters(id) on delete restrict,
  requested_by uuid not null references auth.users(id),
  cart_id uuid not null references public.carts(id) on delete restrict,
  mode text not null check(mode in ('COMPLETA','PARCIAL')),
  quantity integer not null check(quantity>0),
  dates date[] not null check(cardinality(dates) between 1 and 93),
  shifts text[] not null check(cardinality(shifts) between 1 and 3),
  needs_mouse boolean not null default false,
  notes text check(notes is null or length(notes)<=1000),
  status text not null default 'PENDENTE'
    check(status in ('PENDENTE','APROVADA','REJEITADA','DESISTENCIA')),
  review_notes text check(review_notes is null or length(review_notes)<=1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reservation_id uuid unique references public.reservations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservation_requests_status_date_idx
  on public.reservation_requests(status,created_at desc);
create index reservation_requests_owner_date_idx
  on public.reservation_requests(requested_by,created_at desc);

create table public.reservation_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.reservation_requests(id) on delete restrict,
  event_type text not null check(event_type in ('CRIACAO','APROVACAO','REJEICAO','DESISTENCIA')),
  actor_id uuid not null references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index reservation_request_events_request_idx
  on public.reservation_request_events(request_id,occurred_at desc);

create trigger reservation_requests_touch before update on public.reservation_requests
for each row execute function app_private.touch_updated_at();

alter table public.teacher_account_links enable row level security;
alter table public.reservation_requests enable row level security;
alter table public.reservation_request_events enable row level security;

create policy teacher_links_admin_read on public.teacher_account_links
  for select to authenticated using ((select app_private.is_admin()));
create policy teacher_links_self_read on public.teacher_account_links
  for select to authenticated using (user_id=(select auth.uid()));
create policy teacher_requests_admin_read on public.reservation_requests
  for select to authenticated using ((select app_private.is_admin()));
create policy teacher_requests_own_read on public.reservation_requests
  for select to authenticated
  using (requested_by=(select auth.uid()) and (select app_private.is_teacher()));
create policy teacher_request_events_admin_read on public.reservation_request_events
  for select to authenticated using ((select app_private.is_admin()));
create policy teacher_request_events_own_read on public.reservation_request_events
  for select to authenticated using (
    (select app_private.is_teacher()) and
    exists(select 1 from public.reservation_requests r
      where r.id=request_id and r.requested_by=(select auth.uid()))
  );

-- Professores vinculados podem consultar somente carrinhos ativos e o próprio cadastro.
create policy carts_active_teacher_read on public.carts
  for select to authenticated using (active and (select app_private.is_teacher()));
create policy requesters_teacher_self_read on public.requesters
  for select to authenticated
  using (active and id=(select app_private.current_teacher_requester_id()));

revoke all on public.teacher_account_links, public.reservation_requests,
  public.reservation_request_events from public,anon,authenticated;
grant select on public.teacher_account_links,public.reservation_requests,
  public.reservation_request_events to authenticated;

-- Provisionamento explícito de uma conta previamente criada e com e-mail confirmado.
-- Nenhuma conta pode se autovincular ou se elevar a administrador.
create or replace function public.link_teacher_account(p_requester_id uuid,p_email text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Somente a TI pode vincular professores' using errcode='42501';
  end if;
  if p_requester_id is null or p_email is null or length(btrim(p_email)) not between 5 and 254 then
    raise exception 'Informe o professor e o e-mail da conta';
  end if;
  if not exists(select 1 from public.requesters where id=p_requester_id and active) then
    raise exception 'Professor inexistente ou inativo';
  end if;
  select u.id into v_user from auth.users u
    where lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null;
  if not found then
    raise exception 'Conta não localizada ou e-mail ainda não confirmado';
  end if;
  if exists(select 1 from public.admin_users a where a.user_id=v_user and a.active) then
    raise exception 'Esta conta já é administrativa';
  end if;
  insert into public.teacher_account_links(user_id,requester_id,linked_by)
    values(v_user,p_requester_id,auth.uid())
    on conflict(user_id) do update
      set requester_id=excluded.requester_id, active=true,
          linked_by=excluded.linked_by, linked_at=now();
  return v_user;
end;
$$;
revoke all on function public.link_teacher_account(uuid,text) from public,anon;
grant execute on function public.link_teacher_account(uuid,text) to authenticated;

create or replace function public.unlink_teacher_account(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if not app_private.is_admin() then
    raise exception 'Somente a TI pode revogar acesso' using errcode='42501';
  end if;
  update public.teacher_account_links set active=false where user_id=p_user_id and active;
  return found;
end;
$$;
revoke all on function public.unlink_teacher_account(uuid) from public,anon;
grant execute on function public.unlink_teacher_account(uuid) to authenticated;

create or replace function public.list_teacher_accounts()
returns table(user_id uuid,requester_id uuid,requester_name text,email text,active boolean)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not app_private.is_admin() then
    raise exception 'Sem autorização para consultar vínculos' using errcode='42501';
  end if;
  return query select l.user_id,l.requester_id,r.name,u.email::text,l.active
    from public.teacher_account_links l
    join public.requesters r on r.id=l.requester_id
    join auth.users u on u.id=l.user_id
    order by l.linked_at desc;
end;
$$;
revoke all on function public.list_teacher_accounts() from public,anon;
grant execute on function public.list_teacher_accounts() to authenticated;

create or replace function public.submit_teacher_request(
 p_cart_id uuid,p_mode text,p_quantity integer,p_dates date[],p_shifts text[],
 p_needs_mouse boolean default false,p_notes text default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_requester uuid;
  v_cart public.carts%rowtype;
  v_request_id uuid;
begin
  v_requester:=app_private.current_teacher_requester_id();
  if v_requester is null then
    raise exception 'Conta não vinculada ou professor inativo' using errcode='42501';
  end if;
  if p_cart_id is null or p_mode is null or p_mode not in ('COMPLETA','PARCIAL')
    or p_quantity is null or p_quantity<=0 then
    raise exception 'Informe carrinho, modalidade e quantidade válida';
  end if;
  if p_dates is null or cardinality(p_dates) not between 1 and 93
    or p_shifts is null or cardinality(p_shifts) not between 1 and 3 then
    raise exception 'Selecione de 1 a 93 datas úteis e ao menos um turno';
  end if;
  if exists(select 1 from unnest(p_dates) d
     where d is null or extract(isodow from d) not between 1 and 5
       or d<(now() at time zone 'America/Sao_Paulo')::date)
    or (select count(distinct d) from unnest(p_dates) d)<>cardinality(p_dates)
    or exists(select 1 from unnest(p_shifts) s
      where s is null or s not in ('MATUTINO','VESPERTINO','NOTURNO'))
    or (select count(distinct s) from unnest(p_shifts) s)<>cardinality(p_shifts) then
    raise exception 'Datas e turnos inválidos, passados ou duplicados';
  end if;
  if p_notes is not null and length(p_notes)>1000 then
    raise exception 'Observação deve ter até 1000 caracteres';
  end if;
  select * into v_cart from public.carts where id=p_cart_id and active;
  if not found then raise exception 'Carrinho não disponível'; end if;
  if p_quantity>v_cart.capacity
    or (p_mode='COMPLETA' and p_quantity<>v_cart.capacity) then
    raise exception 'Quantidade incompatível com a capacidade do carrinho';
  end if;

  -- Não consulta nem bloqueia a ocupação: a aprovação será revalidada atomicamente.
  insert into public.reservation_requests(
    requester_id,requested_by,cart_id,mode,quantity,dates,shifts,needs_mouse,notes
  ) values(
    v_requester,auth.uid(),p_cart_id,p_mode,p_quantity,p_dates,p_shifts,
    coalesce(p_needs_mouse,false),nullif(btrim(p_notes),'')
  ) returning id into v_request_id;
  insert into public.reservation_request_events(request_id,event_type,actor_id,metadata)
    values(v_request_id,'CRIACAO',auth.uid(),jsonb_build_object(
      'dates',p_dates,'shifts',p_shifts,'quantity',p_quantity));
  return v_request_id;
end;
$$;
revoke all on function public.submit_teacher_request(uuid,text,integer,date[],text[],boolean,text) from public,anon;
grant execute on function public.submit_teacher_request(uuid,text,integer,date[],text[],boolean,text) to authenticated;

create or replace function public.review_teacher_request(
  p_request_id uuid,p_approve boolean,p_review_notes text default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_req public.reservation_requests%rowtype;
  v_reservation uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Somente a TI pode aprovar ou rejeitar solicitações' using errcode='42501';
  end if;
  if p_request_id is null or p_approve is null then
    raise exception 'Informe a solicitação e a decisão';
  end if;
  if p_review_notes is not null and length(p_review_notes)>1000 then
    raise exception 'Justificativa deve ter até 1000 caracteres';
  end if;
  select * into v_req from public.reservation_requests
    where id=p_request_id for update;
  if not found or v_req.status<>'PENDENTE' then
    raise exception 'Esta solicitação não está mais pendente';
  end if;
  if p_approve then
    if not exists(select 1 from public.requesters
       where id=v_req.requester_id and active) then
      raise exception 'Professor inativo: não é possível aprovar';
    end if;
    -- A RPC já bloqueia carrinho, revalida saldo por turno e códigos físicos
    -- e registra o administrador que confirmou a reserva.
    v_reservation:=public.create_reservation(
      v_req.requester_id,v_req.cart_id,v_req.mode,v_req.quantity,
      v_req.dates,v_req.shifts,v_req.needs_mouse,v_req.notes,'{}'::uuid[]
    );
  end if;
  update public.reservation_requests
    set status=case when p_approve then 'APROVADA' else 'REJEITADA' end,
        review_notes=nullif(btrim(p_review_notes),''),
        reviewed_by=auth.uid(),reviewed_at=now(),reservation_id=v_reservation
    where id=p_request_id;
  insert into public.reservation_request_events(request_id,event_type,actor_id,metadata)
    values(p_request_id,case when p_approve then 'APROVACAO' else 'REJEICAO' end,
      auth.uid(),jsonb_build_object('reservation_id',v_reservation,'notes',p_review_notes));
  return v_reservation;
end;
$$;
revoke all on function public.review_teacher_request(uuid,boolean,text) from public,anon;
grant execute on function public.review_teacher_request(uuid,boolean,text) to authenticated;

create or replace function public.withdraw_teacher_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_req public.reservation_requests%rowtype;
begin
  if app_private.current_teacher_requester_id() is null then
    raise exception 'Professor não autorizado' using errcode='42501';
  end if;
  select * into v_req from public.reservation_requests
    where id=p_request_id for update;
  if not found or v_req.requested_by<>auth.uid()
    or v_req.requester_id<>app_private.current_teacher_requester_id() then
    raise exception 'Solicitação não encontrada para esta conta' using errcode='42501';
  end if;
  if v_req.status<>'PENDENTE' then
    raise exception 'Somente solicitações pendentes podem ser retiradas';
  end if;
  update public.reservation_requests set status='DESISTENCIA'
    where id=p_request_id;
  insert into public.reservation_request_events(request_id,event_type,actor_id)
    values(p_request_id,'DESISTENCIA',auth.uid());
  return true;
end;
$$;
revoke all on function public.withdraw_teacher_request(uuid) from public,anon;
grant execute on function public.withdraw_teacher_request(uuid) to authenticated;

-- Nunca conceder INSERT/UPDATE/DELETE nessas tabelas: toda escrita pela RPC.
