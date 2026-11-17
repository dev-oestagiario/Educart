-- Educart Fase 3: edição e cancelamento com auditoria.
-- Escrita somente por RPCs SECURITY DEFINER com app_private.is_admin().
create or replace function public.cancel_reservation_period(p_period_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_booking public.reservations%rowtype;
  v_period public.reservation_periods%rowtype;
  v_remaining integer;
begin
  if not app_private.is_admin() then
    raise exception 'Sem permissão para cancelar reservas' using errcode='42501';
  end if;
  select r.* into v_booking from public.reservations r
    join public.reservation_periods p on p.reservation_id=r.id
    where p.id=p_period_id for update of r;
  if not found or v_booking.status <> 'CONFIRMADA' then
    raise exception 'Reserva não encontrada ou já cancelada';
  end if;
  select * into v_period from public.reservation_periods
    where id=p_period_id for update;
  if not v_period.active then raise exception 'Esse período já está cancelado'; end if;
  if v_period.usage_date <= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Cancelamento permitido somente até o dia anterior à utilização';
  end if;

  -- A mesma linha do carrinho usada por criação/edição para serializar a liberação.
  perform 1 from public.carts where id=v_booking.cart_id for update;
  update public.reservation_notebooks set active=false where period_id=p_period_id;
  update public.reservation_periods set active=false,cancelled_at=now() where id=p_period_id;
  select count(*) into v_remaining from public.reservation_periods
    where reservation_id=v_booking.id and active;
  if v_remaining=0 then
    update public.reservations set status='CANCELADA' where id=v_booking.id;
  end if;
  insert into public.reservation_events(reservation_id,event_type,admin_id,before_data,after_data)
    values(v_booking.id,'CANCELAMENTO',auth.uid(),
      jsonb_build_object('period_id',v_period.id,'date',v_period.usage_date,'shift',v_period.shift,
        'quantity',v_period.quantity,'active',true),
      jsonb_build_object('period_id',v_period.id,'active',false,'booking_cancelled',v_remaining=0));
  return v_booking.id;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_booking public.reservations%rowtype;
  v_count integer;
  v_periods jsonb;
begin
  if not app_private.is_admin() then
    raise exception 'Sem permissão para cancelar reservas' using errcode='42501';
  end if;
  select * into v_booking from public.reservations where id=p_reservation_id for update;
  if not found or v_booking.status <> 'CONFIRMADA' then
    raise exception 'Reserva não encontrada ou já cancelada';
  end if;
  if exists(select 1 from public.reservation_periods p
     where p.reservation_id=p_reservation_id and p.active
       and p.usage_date <= (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Não é possível cancelar a reserva inteira no próprio dia ou após a utilização';
  end if;
  select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'period_id',id,'date',usage_date,'shift',shift,'quantity',quantity)), '[]'::jsonb)
    into v_count,v_periods from public.reservation_periods
    where reservation_id=p_reservation_id and active;
  if v_count=0 then raise exception 'Reserva sem períodos ativos'; end if;
  perform 1 from public.carts where id=v_booking.cart_id for update;
  update public.reservation_notebooks set active=false
    where period_id in (select id from public.reservation_periods where reservation_id=p_reservation_id);
  update public.reservation_periods set active=false,cancelled_at=now()
    where reservation_id=p_reservation_id and active;
  update public.reservations set status='CANCELADA' where id=p_reservation_id;
  insert into public.reservation_events(reservation_id,event_type,admin_id,before_data,after_data)
    values(p_reservation_id,'CANCELAMENTO',auth.uid(),jsonb_build_object('periods',v_periods),
      jsonb_build_object('status','CANCELADA'));
  return p_reservation_id;
end;
$$;

create or replace function public.update_reservation(
  p_reservation_id uuid,
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
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_old public.reservations%rowtype;
  v_cart public.carts%rowtype;
  v_old_periods jsonb;
  v_old_notebooks jsonb;
  v_day date;
  v_shift text;
  v_quantity integer;
  v_busy integer;
  v_known_count integer;
  v_notebook_id uuid;
  v_period_id uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Sem permissão para editar reservas' using errcode='42501';
  end if;
  select * into v_old from public.reservations where id=p_reservation_id for update;
  if not found or v_old.status <> 'CONFIRMADA' then
    raise exception 'Reserva inexistente ou cancelada';
  end if;
  -- Regras de edição retroativa ainda não definidas: preservar períodos já transcorridos.
  if exists(select 1 from public.reservation_periods p
      where p.reservation_id=p_reservation_id and p.active
        and p.usage_date < (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Reservas com períodos já transcorridos não podem ser editadas nesta versão';
  end if;
  if p_requester_id is null or p_cart_id is null or
     p_mode is null or p_mode not in ('COMPLETA','PARCIAL') or p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe os dados obrigatórios da reserva';
  end if;
  if p_dates is null or cardinality(p_dates) not between 1 and 93 or
     p_shifts is null or cardinality(p_shifts) not between 1 and 3 then
    raise exception 'Selecione de 1 a 93 dias e de 1 a 3 turnos';
  end if;
  if exists(select 1 from unnest(p_dates) d where d is null
       or extract(isodow from d) not between 1 and 5
       or d < (now() at time zone 'America/Sao_Paulo')::date)
     or (select count(distinct d) from unnest(p_dates) d)<>cardinality(p_dates)
     or exists(select 1 from unnest(p_shifts) s where s is null
       or s not in ('MATUTINO','VESPERTINO','NOTURNO'))
     or (select count(distinct s) from unnest(p_shifts) s)<>cardinality(p_shifts) then
    raise exception 'Selecione dias úteis e turnos válidos, sem duplicações ou datas passadas';
  end if;
  if p_notes is not null and length(p_notes)>1000 then
    raise exception 'Observações excedem 1000 caracteres';
  end if;
  if p_notebook_ids is null or
     exists(select 1 from unnest(p_notebook_ids) id where id is null) or
     (select count(distinct id) from unnest(p_notebook_ids) id)<>cardinality(p_notebook_ids) then
    raise exception 'Notebooks duplicados ou inválidos';
  end if;
  -- Uma edição não pode remover totalmente a ocupação de uma data que é HOJE.
  if exists(select 1 from public.reservation_periods p
      where p.reservation_id=p_reservation_id and p.active
        and p.usage_date=(now() at time zone 'America/Sao_Paulo')::date)
     and not ((now() at time zone 'America/Sao_Paulo')::date=any(p_dates)) then
    raise exception 'A edição não pode remover todos os períodos da utilização de hoje';
  end if;

  -- Bloquear os dois carrinhos em ordem estável, inclusive quando há transferência.
  perform 1 from public.carts where id in(v_old.cart_id,p_cart_id) order by id for update;
  select * into v_cart from public.carts where id=p_cart_id;
  if not found or not v_cart.active then
    raise exception 'Carrinho de destino inexistente ou inativo';
  end if;
  if not exists(select 1 from public.requesters where id=p_requester_id and active) then
    raise exception 'Professor inexistente ou inativo';
  end if;

  v_quantity:=case when p_mode='COMPLETA' then v_cart.capacity else p_quantity end;
  if v_quantity>v_cart.capacity or (p_mode='COMPLETA' and p_quantity<>v_cart.capacity) then
    raise exception 'Quantidade incompatível com a capacidade';
  end if;
  if cardinality(p_notebook_ids)>v_quantity then
    raise exception 'Mais notebooks identificados do que a quantidade solicitada';
  end if;
  select count(*) into v_known_count from public.notebook_codes n
    where n.id=any(p_notebook_ids) and n.cart_id=p_cart_id and n.active;
  if v_known_count<>cardinality(p_notebook_ids) then
    raise exception 'Existem códigos de notebook inválidos para este carrinho';
  end if;

  for v_day in select distinct d from unnest(p_dates) d order by d loop
    for v_shift in select distinct s from unnest(p_shifts) s order by s loop
      select coalesce(sum(p.quantity),0)::integer into v_busy from public.reservation_periods p
        where p.cart_id=p_cart_id and p.active and p.usage_date=v_day
          and p.shift=v_shift and p.reservation_id<>p_reservation_id;
      if v_busy+v_quantity>v_cart.capacity then
        raise exception 'Sem disponibilidade em % (%) — livres: %, solicitados: %',
          to_char(v_day,'DD/MM/YYYY'),v_shift,v_cart.capacity-v_busy,v_quantity;
      end if;
      if exists(select 1 from public.reservation_notebooks n
        join public.reservation_periods p on p.id=n.period_id
        where n.active and n.notebook_id=any(p_notebook_ids)
          and n.usage_date=v_day and n.shift=v_shift
          and p.reservation_id<>p_reservation_id) then
        raise exception 'Notebook já reservado em % (%)',to_char(v_day,'DD/MM/YYYY'),v_shift;
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('date',usage_date,'shift',shift,
    'quantity',quantity) order by usage_date,shift),'[]'::jsonb)
    into v_old_periods from public.reservation_periods
    where reservation_id=p_reservation_id and active;
  select coalesce(jsonb_agg(jsonb_build_object('notebook_id',n.notebook_id,
    'date',n.usage_date,'shift',n.shift)),'[]'::jsonb)
    into v_old_notebooks from public.reservation_notebooks n
      join public.reservation_periods p on p.id=n.period_id
    where p.reservation_id=p_reservation_id and n.active;

  -- Não apagar registros antigos: desativá-los e reutilizar os períodos coincidentes.
  update public.reservation_notebooks set active=false
    where period_id in(select id from public.reservation_periods where reservation_id=p_reservation_id);
  update public.reservation_periods set active=false
    where reservation_id=p_reservation_id;

  update public.reservations set
    requester_id=p_requester_id,cart_id=p_cart_id,mode=p_mode,quantity=v_quantity,
    needs_mouse=coalesce(p_needs_mouse,false),notes=nullif(btrim(p_notes),'')
    where id=p_reservation_id;

  for v_day in select distinct d from unnest(p_dates) d order by d loop
    for v_shift in select distinct s from unnest(p_shifts) s order by s loop
      insert into public.reservation_periods(reservation_id,cart_id,usage_date,shift,quantity,active,cancelled_at)
      values(p_reservation_id,p_cart_id,v_day,v_shift,v_quantity,true,null)
      on conflict(reservation_id,usage_date,shift)
        do update set cart_id=excluded.cart_id,quantity=excluded.quantity,active=true,cancelled_at=null
      returning id into v_period_id;
      foreach v_notebook_id in array p_notebook_ids loop
        insert into public.reservation_notebooks(period_id,notebook_id,usage_date,shift,active)
        values(v_period_id,v_notebook_id,v_day,v_shift,true)
        on conflict(period_id,notebook_id)
          do update set usage_date=excluded.usage_date,shift=excluded.shift,active=true;
      end loop;
    end loop;
  end loop;

  insert into public.reservation_events(reservation_id,event_type,admin_id,before_data,after_data)
    values(p_reservation_id,'EDICAO',auth.uid(),
      to_jsonb(v_old)||jsonb_build_object('periods',v_old_periods,'notebooks',v_old_notebooks),
      jsonb_build_object('requester_id',p_requester_id,'cart_id',p_cart_id,
        'mode',p_mode,'quantity',v_quantity,'needs_mouse',coalesce(p_needs_mouse,false),
        'notes',p_notes,'dates',to_jsonb(p_dates),'shifts',to_jsonb(p_shifts),
        'notebook_ids',to_jsonb(p_notebook_ids)));
  return p_reservation_id;
end;
$$;

revoke all on function public.cancel_reservation_period(uuid),
  public.cancel_reservation(uuid),
  public.update_reservation(uuid,uuid,uuid,text,integer,date[],text[],boolean,text,uuid[])
  from public,anon;
grant execute on function public.cancel_reservation_period(uuid),
  public.cancel_reservation(uuid),
  public.update_reservation(uuid,uuid,uuid,text,integer,date[],text[],boolean,text,uuid[])
  to authenticated;
