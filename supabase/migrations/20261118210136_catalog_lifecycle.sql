-- Inativação lógica: preservar histórico e impedir alterações incompatíveis com compromissos operacionais.
-- Funções privadas de trigger, sem novo endpoint RPC ou privilégio para clientes.
create function app_private.guard_catalog_deactivation() returns trigger
language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if not old.active or new.active then return new; end if;
 if tg_table_name='carts' then
  if exists(select 1 from public.reservation_periods where cart_id=old.id and active and usage_date>=today)
   or exists(select 1 from public.reservation_requests where cart_id=old.id and status='PENDENTE')
   or exists(select 1 from public.equipment_movements where cart_id=old.id and return_at is null)
   or exists(select 1 from public.maintenance_windows where cart_id=old.id and closed_at is null and end_date>=today)
  then raise exception 'Carrinho com reservas, solicitações, manutenção ou devoluções pendentes. Resolva antes de inativar.'; end if;
 elsif tg_table_name='requesters' then
  if exists(select 1 from public.reservations r join public.reservation_periods p on p.reservation_id=r.id where r.requester_id=old.id and p.active and p.usage_date>=today)
   or exists(select 1 from public.reservation_requests where requester_id=old.id and status='PENDENTE')
   or exists(select 1 from public.equipment_movements where requester_id=old.id and return_at is null)
  then raise exception 'Professor com reservas, solicitações ou devoluções pendentes. Resolva antes de inativar.'; end if;
 elsif tg_table_name='notebook_codes' then
  if exists(select 1 from public.reservation_notebooks n where n.notebook_id=old.id and n.active and n.usage_date>=today)
  then raise exception 'Notebook com reserva atual ou futura. Cancele ou altere a atribuição antes de inativar.'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_catalog_deactivation() from public,anon,authenticated;
create trigger guard_cart_deactivation before update of active on public.carts for each row execute function app_private.guard_catalog_deactivation();
create trigger guard_requester_deactivation before update of active on public.requesters for each row execute function app_private.guard_catalog_deactivation();
create trigger guard_notebook_deactivation before update of active on public.notebook_codes for each row execute function app_private.guard_catalog_deactivation();

-- Serializar novos compromissos com a alteração do estado do cadastro.
create function app_private.guard_commitment_catalog() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='reservation_requests' then
  if new.status<>'PENDENTE' then return new; end if;
 end if;
 if tg_table_name='reservations' or tg_table_name='reservation_requests' then
  perform 1 from public.carts where id=new.cart_id and active for share;
  if not found then raise exception 'Carrinho inativo'; end if;
  perform 1 from public.requesters where id=new.requester_id and active for share;
  if not found then raise exception 'Professor inativo'; end if;
 elsif tg_table_name='reservation_notebooks' then
  if not new.active then return new; end if;
  perform 1 from public.notebook_codes where id=new.notebook_id and active for share;
  if not found then raise exception 'Notebook inativo'; end if;
 elsif tg_table_name='notebook_codes' then
  if not new.active then return new; end if;
  perform 1 from public.carts where id=new.cart_id and active for share;
  if not found then raise exception 'Carrinho inativo'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_commitment_catalog() from public,anon,authenticated;
create trigger guard_active_reservation_catalog before insert or update of cart_id,requester_id on public.reservations for each row execute function app_private.guard_commitment_catalog();
create trigger guard_active_request_catalog before insert or update of cart_id,requester_id,status on public.reservation_requests for each row execute function app_private.guard_commitment_catalog();
create trigger guard_active_notebook_assignment before insert or update of notebook_id,active on public.reservation_notebooks for each row execute function app_private.guard_commitment_catalog();
create trigger guard_active_notebook_cart before insert or update of cart_id,active on public.notebook_codes for each row execute function app_private.guard_commitment_catalog();
