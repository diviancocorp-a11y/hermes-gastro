-- 0126 Venezuela y doble moneda (Cochi, fase 1).
-- Pendiente de aplicar
--
-- Decision de Ricky: el dolar es la verdad. Un solo precio por producto, en la
-- moneda principal del negocio (`tenants.currency`, USD para Cochi); el bolivar
-- se calcula con la tasa. Generico: cualquier negocio puede declarar una moneda
-- secundaria opcional.
--
-- Solo expandir. Nada se borra ni se vuelve NOT NULL:
--   1. 'VE' entra al CHECK de tenants.country. Es ampliar la lista: el CHECK
--      viejo se reemplaza por uno que acepta todo lo que aceptaba antes.
--   2. tenants.secondary_currency, nullable.
--   3. exchange_rates: historial de tasas por negocio.
--   4. get_exchange_rate(slug): la tasa vigente para el catalogo publico.
--   5. Columnas nullable en orders y payments para congelar tasa y monto en la
--      moneda secundaria (el uso llega en fases posteriores).
--
-- signup_tenant (0125) no se toca: pasa `country` tal cual al insert, asi que
-- VE entra apenas el CHECK lo acepta.

/* ───────────── 1. country: sumar VE ───────────── */

-- Cambiar un CHECK es drop + add. `drop constraint` no lo marca
-- check:expandir (solo mira drop column/table/view/type/function): la lista
-- nueva es superconjunto de la vieja, asi que ninguna fila ni escritura del
-- deploy anterior deja de pasar. Va en una sola transaccion.
alter table public.tenants drop constraint if exists tenants_country_check;
alter table public.tenants
  add constraint tenants_country_check
  check (country in ('AR', 'UY', 'CL', 'PY', 'BO', 'PE', 'CO', 'MX', 'ES', 'VE'));

/* ───────────── 2. moneda secundaria ───────────── */

alter table public.tenants
  add column if not exists secondary_currency text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_secondary_currency_check') then
    alter table public.tenants
      add constraint tenants_secondary_currency_check
      check (secondary_currency is null or (
        secondary_currency ~ '^[A-Z]{3}$' and secondary_currency <> currency));
  end if;
end $$;

comment on column public.tenants.secondary_currency is
  'Moneda secundaria opcional (ej: VES con currency=USD). El precio vive en currency; '
  'esta se calcula con la ultima fila de exchange_rates.';

/* ───────────── 3. historial de tasas ───────────── */

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- 1 unidad de base_currency = `rate` unidades de quote_currency.
  -- Cochi: base USD, quote VES, rate 479.14 (Bs. por dolar).
  base_currency  text not null check (base_currency  ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(18,6) not null check (rate > 0),
  -- Dia desde el que rige, en la zona del negocio.
  effective_date date not null,
  -- 'manual' o el nombre del proveedor ('bcv', 'dolarapi').
  source text not null check (length(trim(source)) > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (base_currency <> quote_currency)
);

-- La vigente: el dia mas nuevo; dentro del dia, la manual le gana a la
-- automatica y despues la mas reciente. Esa regla esta en get_exchange_rate y
-- en el sync (que nunca pisa una manual).
create index if not exists exchange_rates_vigente_idx
  on public.exchange_rates (tenant_id, base_currency, quote_currency, effective_date desc, created_at desc);

-- Re-correr el sync el mismo dia no duplica filas del mismo proveedor.
create unique index if not exists exchange_rates_dia_fuente_uidx
  on public.exchange_rates (tenant_id, base_currency, quote_currency, effective_date, source);

comment on table public.exchange_rates is
  'Historial de tasas por negocio. Solo se agrega: corregir una tasa es cargar otra '
  '(la manual del dia le gana a la automatica). Lo escribe el miembro del negocio o '
  'la edge function exchange-rate-sync (service role).';

alter table public.exchange_rates enable row level security;

drop policy if exists exchange_rates_select on public.exchange_rates;
create policy exchange_rates_select on public.exchange_rates
  for select to authenticated
  using (tenant_id in (select private.current_user_tenants()));

-- Sin update ni delete: es historial. El miembro carga una tasa manual y deja
-- su usuario. A que roles se les muestra el boton es de la fase del panel.
drop policy if exists exchange_rates_insert on public.exchange_rates;
create policy exchange_rates_insert on public.exchange_rates
  for insert to authenticated
  with check (
    tenant_id in (select private.current_user_tenants())
    and created_by = (select auth.uid())
  );

/* ───────────── 4. lectura publica para el catalogo ───────────── */

-- El catalogo lee todo por RPC SECURITY DEFINER con el slug (get_catalog,
-- get_tenant_brand): anon no tiene select sobre las tablas. Se sigue ese
-- mecanismo en vez de abrir exchange_rates, y get_catalog no se toca (otras
-- fases lo usan). Devuelve solo la tasa vigente, nada del historial.
create or replace function public.get_exchange_rate(p_tenant_slug text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((
    select jsonb_build_object(
      'base_currency',  r.base_currency,
      'quote_currency', r.quote_currency,
      'rate',           r.rate,
      'effective_date', r.effective_date,
      'source',         r.source
    )
    from public.tenants t
    join public.exchange_rates r
      on r.tenant_id = t.id
     and r.base_currency  = t.currency
     and r.quote_currency = t.secondary_currency
    where t.slug = p_tenant_slug
    order by r.effective_date desc, (r.source = 'manual') desc, r.created_at desc
    limit 1
  ), 'null'::jsonb);
$function$;

revoke all on function public.get_exchange_rate(text) from public;
grant execute on function public.get_exchange_rate(text) to anon, authenticated;

/* ───────────── 5. tasa congelada en pedidos y pagos ───────────── */

-- Todo nullable y sin default: los pedidos y pagos de hoy quedan como estan y
-- el deploy anterior sigue insertando sin tocarlas.
alter table public.orders
  add column if not exists fx_rate numeric(18,6),
  add column if not exists fx_currency text,
  add column if not exists total_secondary numeric(14,2);

alter table public.payments
  add column if not exists fx_rate numeric(18,6),
  add column if not exists fx_currency text,
  add column if not exists amount_secondary numeric(14,2);

comment on column public.orders.fx_rate is
  'Tasa con la que se hizo el pedido (1 moneda principal = fx_rate fx_currency). Null si no hubo doble moneda.';
comment on column public.orders.total_secondary is
  'Total en fx_currency, calculado con fx_rate al crear el pedido.';
comment on column public.payments.fx_rate is
  'Tasa vigente al registrar el pago (1 moneda principal = fx_rate fx_currency).';
comment on column public.payments.amount_secondary is
  'Monto en fx_currency con fx_rate. Si el cliente pago en Bs., es lo que entrego.';
