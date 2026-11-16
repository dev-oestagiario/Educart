-- Consulta publica agregada, sem nomes de professores ou dados de reservas.
-- Executar no projeto Supabase Educart antes de publicar o portal.
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
         c.capacity::integer,
         shifts.shift_name,
         coalesce(sum(rp.quantity),0)::integer,
         greatest(c.capacity::integer - coalesce(sum(rp.quantity),0)::integer,0)
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

revoke all on function public.public_cart_availability(date,date) from public;
grant execute on function public.public_cart_availability(date,date) to anon, authenticated;

comment on function public.public_cart_availability(date,date) is
  'Consulta publica apenas de ocupacao agregada por carrinho, dia e turno; nao retorna dados pessoais ou identificadores de reservas.';
