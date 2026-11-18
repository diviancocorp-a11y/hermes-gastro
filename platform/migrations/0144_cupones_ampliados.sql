-- PENDIENTE de aplicar (la aplica el director con ok de Ricky, via MCP: es aditiva)
-- Fase 6 de Cochi: cupones ampliados.
--
-- Hasta aca un cupon era: discount_pct, expires_at, email y un booleano
-- `used` (un solo uso). Esta migracion SOLO agrega (expandir):
--
--   1. coupons: tipo (porcentaje | monto fijo en la moneda principal),
--      minimo de compra, limite de usos total y por telefono, vigencia desde
--      y contador de usos. Los defaults dejan cada cupon de hoy igual:
--      discount_type='pct', max_uses=1 (el `used` de siempre), sin minimo,
--      sin limite por cliente, sin fecha de inicio.
--   2. coupon_redemptions: un uso por fila (cupon, pedido, telefono). Es lo
--      que permite contar usos por cliente.
--   3. validar_cupon(slug, code, phone, email): publica (anon), la usa el
--      checkout para MOSTRAR el descuento. No reserva nada.
--   4. reservar_cupon / liberar_cupon: solo service role (submit-order).
--      reservar toma el cupon con FOR UPDATE: dos pedidos con el ultimo uso
--      se serializan y el segundo ve el contador ya incrementado.
--
-- `used` se sigue escribiendo (true al llegar a max_uses) para el codigo
-- desplegado que todavia filtra por used=false.

/* ───────────── 1. columnas nuevas de coupons ───────────── */

alter table public.coupons
  add column if not exists discount_type text not null default 'pct',
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists min_subtotal numeric(12,2),
  add column if not exists max_uses integer default 1,
  add column if not exists max_uses_per_phone integer,
  add column if not exists starts_at timestamptz,
  add column if not exists uses_count integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coupons_discount_type_check') then
    alter table public.coupons add constraint coupons_discount_type_check
      check (discount_type in ('pct', 'fixed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_montos_check') then
    alter table public.coupons add constraint coupons_montos_check
      check (discount_amount >= 0
        and (min_subtotal is null or min_subtotal >= 0)
        and (max_uses is null or max_uses >= 1)
        and (max_uses_per_phone is null or max_uses_per_phone >= 1)
        and uses_count >= 0);
  end if;
end $$;

-- Los ya usados cuentan como un uso: con max_uses=1 quedan agotados igual que hoy.
update public.coupons set uses_count = 1 where used and uses_count = 0;

comment on column public.coupons.discount_type is
  'pct: discount_pct sobre el subtotal de productos. fixed: discount_amount en la moneda principal, nunca mas que el subtotal.';
comment on column public.coupons.max_uses is
  'Usos totales. 1 = un solo uso (lo de siempre). null = sin limite.';
comment on column public.coupons.min_subtotal is
  'Minimo de compra sobre el subtotal de productos (sin envio ni propina). null = sin minimo.';

/* ───────────── 2. usos ───────────── */

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_cupon_tel_idx
  on public.coupon_redemptions (coupon_id, phone);
create index if not exists coupon_redemptions_tenant_idx
  on public.coupon_redemptions (tenant_id);

alter table public.coupon_redemptions enable row level security;
drop policy if exists coupon_redemptions_select on public.coupon_redemptions;
create policy coupon_redemptions_select on public.coupon_redemptions
  for select using (tenant_id in (select private.current_user_tenants()));
-- Escribe solo submit-order (service role): sin policies de insert/update/delete.

/* ───────────── 3. validar (publica) ───────────── */

-- Devuelve las condiciones del cupon para que el checkout muestre el
-- descuento, o el motivo por el que no aplica. El minimo de compra lo juzga
-- el front con su subtotal (y despues el servidor con el suyo).
-- motivo: no_existe | no_corresponde | todavia_no | vencido | agotado | limite_cliente
create or replace function public.validar_cupon(
  p_tenant_slug text, p_code text, p_phone text default null, p_email text default null
) returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  c public.coupons;
  n integer;
begin
  select cp.* into c
  from public.coupons cp
  join public.tenants t on t.id = cp.tenant_id
  where t.slug = p_tenant_slug
    and upper(cp.code) = upper(trim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;
  if c.email is not null and p_email is not null and lower(c.email) <> lower(trim(p_email)) then
    return jsonb_build_object('ok', false, 'motivo', 'no_corresponde');
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('ok', false, 'motivo', 'todavia_no', 'starts_at', c.starts_at);
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;
  if c.max_uses is not null and c.uses_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'motivo', 'agotado');
  end if;
  if c.max_uses_per_phone is not null and nullif(trim(p_phone), '') is not null then
    select count(*) into n from public.coupon_redemptions r
    where r.coupon_id = c.id and r.phone = trim(p_phone);
    if n >= c.max_uses_per_phone then
      return jsonb_build_object('ok', false, 'motivo', 'limite_cliente');
    end if;
  end if;
  return jsonb_build_object(
    'ok', true,
    'id', c.id,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_pct', c.discount_pct,
    'discount_amount', c.discount_amount,
    'min_subtotal', c.min_subtotal,
    'expires_at', c.expires_at
  );
end;
$function$;

revoke all on function public.validar_cupon(text, text, text, text) from public;
grant execute on function public.validar_cupon(text, text, text, text) to anon, authenticated;

/* ───────────── 4. reservar y liberar (solo submit-order) ───────────── */

-- Cuenta un uso de forma atomica. submit-order ya valido tipo, vigencia y
-- minimo; aca se vuelve a mirar todo lo que depende del contador, con la fila
-- tomada: la carrera entre dos pedidos con el ultimo uso la gana uno solo.
create or replace function public.reservar_cupon(
  p_tenant_id uuid, p_coupon_id uuid, p_phone text default null
) returns jsonb
language plpgsql
volatile security definer
set search_path to 'public'
as $function$
declare
  c public.coupons;
  n integer;
  rid uuid;
  tel text := nullif(trim(coalesce(p_phone, '')), '');
begin
  select * into c from public.coupons
  where id = p_coupon_id and tenant_id = p_tenant_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('ok', false, 'motivo', 'todavia_no');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;
  if c.max_uses is not null and c.uses_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'motivo', 'agotado');
  end if;
  if c.max_uses_per_phone is not null and tel is not null then
    select count(*) into n from public.coupon_redemptions r
    where r.coupon_id = c.id and r.phone = tel;
    if n >= c.max_uses_per_phone then
      return jsonb_build_object('ok', false, 'motivo', 'limite_cliente');
    end if;
  end if;

  insert into public.coupon_redemptions (tenant_id, coupon_id, phone)
  values (p_tenant_id, c.id, tel)
  returning id into rid;

  update public.coupons
  set uses_count = uses_count + 1,
      used = (max_uses is not null and uses_count + 1 >= max_uses),
      used_at = now()
  where id = c.id;

  return jsonb_build_object('ok', true, 'redemption_id', rid);
end;
$function$;

-- Devuelve el uso si el pedido no llego a crearse.
create or replace function public.liberar_cupon(p_redemption_id uuid)
returns void
language plpgsql
volatile security definer
set search_path to 'public'
as $function$
declare
  cid uuid;
begin
  delete from public.coupon_redemptions where id = p_redemption_id
  returning coupon_id into cid;
  if cid is null then return; end if;
  update public.coupons
  set uses_count = greatest(uses_count - 1, 0),
      used = (max_uses is not null and greatest(uses_count - 1, 0) >= max_uses)
  where id = cid;
end;
$function$;

revoke all on function public.reservar_cupon(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.liberar_cupon(uuid) from public, anon, authenticated;
grant execute on function public.reservar_cupon(uuid, uuid, text) to service_role;
grant execute on function public.liberar_cupon(uuid) to service_role;
