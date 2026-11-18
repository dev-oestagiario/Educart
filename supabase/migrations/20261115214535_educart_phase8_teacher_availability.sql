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
    select d.usage_date, s.shift, v_capacity as capacity,
      coalesce(sum(p.quantity),0)::integer as reserved,
      greatest(0,v_capacity-coalesce(sum(p.quantity),0)::integer) as remaining
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
