-- Datos que permiten conciliar el cobro sin atarlo a una terminal concreta.
-- Tarjeta exige los ultimos cuatro del comprobante; autorizacion, QR y
-- transferencia usan `reference`. La verificacion final sigue en Caja.

alter table public.payments
  add column if not exists receipt_last_four text
    check (receipt_last_four is null or receipt_last_four ~ '^[0-9]{4}$');

create or replace function private.identificar_cobrador()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_kind text;
begin
  new.collected_by := coalesce(new.collected_by, auth.uid());
  if new.collector_staff_id is null and new.collected_by is not null then
    select s.id into new.collector_staff_id
      from public.staff s
     where s.tenant_id = new.tenant_id
       and s.user_id = new.collected_by
       and s.active
     order by s.created_at
     limit 1;
  end if;
  select pm.kind into v_kind from public.payment_methods pm where pm.id = new.method_id;
  if new.verification_status = 'not_required' and v_kind in ('card','mp','transfer') then
    new.verification_status := 'pending';
  end if;
  return new;
end $$;

drop function if exists public.register_payment(uuid, uuid, uuid, numeric, uuid);

create function public.register_payment(
  p_tenant_id uuid,
  p_order_id uuid,
  p_method_id uuid,
  p_amount numeric,
  p_reference text default null,
  p_receipt_last_four text default null,
  p_client_request_id uuid default null
)
returns public.payments
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_pago public.payments;
  v_branch uuid;
  v_ses uuid;
  v_total numeric;
  v_pagado numeric;
  v_saldo numeric;
  v_method_kind text;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_last_four text := nullif(regexp_replace(coalesce(p_receipt_last_four, ''), '[^0-9]', '', 'g'), '');
begin
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'monto_invalido';
  end if;

  if p_client_request_id is not null then
    select * into v_pago from public.payments p
     where p.tenant_id = p_tenant_id and p.client_request_id = p_client_request_id;
    if found then return v_pago; end if;
  end if;

  select pm.kind into v_method_kind
    from public.payment_methods pm
   where pm.id = p_method_id and pm.tenant_id = p_tenant_id and pm.active;
  if not found then raise exception 'medio_pago_invalido'; end if;
  if v_method_kind = 'card' and coalesce(v_last_four, '') !~ '^[0-9]{4}$' then
    raise exception 'ultimos_cuatro_requeridos';
  end if;
  if v_method_kind <> 'card' then v_last_four := null; end if;

  select o.branch_id, o.total into v_branch, v_total
    from public.orders o
   where o.id = p_order_id and o.tenant_id = p_tenant_id
   for update;

  if p_order_id is not null then
    if not found then raise exception 'pedido_no_encontrado'; end if;
    select coalesce(sum(p.amount), 0) into v_pagado
      from public.payments p where p.order_id = p_order_id;
    v_saldo := v_total - v_pagado;
    if v_saldo <= 0 then raise exception 'pedido_ya_saldado'; end if;
    if p_amount > v_saldo + 0.01 then
      raise exception 'monto_supera_el_saldo'
        using detail = format('saldo %s, intento %s', v_saldo, p_amount);
    end if;
  end if;

  if v_branch is null then
    select b.id into v_branch from public.branches b
     where b.tenant_id = p_tenant_id and b.is_default;
  end if;
  select s.id into v_ses from public.cash_sessions s
   where s.branch_id = v_branch and s.status = 'open';

  insert into public.payments (
    tenant_id, branch_id, order_id, cash_session_id, method_id, amount,
    reference, receipt_last_four, client_request_id
  ) values (
    p_tenant_id, v_branch, p_order_id, v_ses, p_method_id, p_amount,
    v_reference, v_last_four, p_client_request_id
  ) returning * into v_pago;

  return v_pago;
end $$;

revoke all on function public.register_payment(uuid, uuid, uuid, numeric, text, text, uuid)
  from public, anon;
grant execute on function public.register_payment(uuid, uuid, uuid, numeric, text, text, uuid)
  to authenticated;

comment on function public.register_payment(uuid, uuid, uuid, numeric, text, text, uuid) is
  'Asienta un cobro idempotente, guarda su referencia conciliable y exige '
  'los ultimos cuatro para tarjeta.';
