-- 0125 Suscripciones de Mercado Pago: el cobro recurrente de Divianco.
-- Aplicada via MCP el 2026-11-06
--
-- Diseno y decisiones (Ricky, 6/nov/2026): docs/plataforma/COBRO-SUSCRIPCION.md.
-- La tarjeta se deja en el paso 3 del registro, la guarda Mercado Pago y el
-- primer debito queda pendiente hasta el fin de la prueba de 14 dias.
--
-- Solo aditiva: dos tablas nuevas y signup_tenant con la misma firma. El
-- deploy anterior no lee nada de esto y un alta sin suscripcion sigue igual
-- que con la 0122.
--
-- Escribe SOLO la service role (las edge functions suscripcion-alta y
-- suscripcion-webhook) y signup_tenant. Ninguna policy de escritura: un
-- duenio que pudiera tocar su suscripcion podria marcarse un pago.

/* ─────────────── 1. Una suscripcion por cuenta ─────────────── */

-- Nace en el paso 3 del registro, cuando el negocio todavia no existe: por
-- eso se ata al usuario y `tenant_id` se completa recien en signup_tenant.
create table if not exists public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  -- El id del preapproval en Mercado Pago. La tarjeta vive alla, no aca.
  preapproval_id text not null unique,
  plan_id text not null references public.plans(id),
  ciclo text not null check (ciclo in ('mensual', 'anual')),
  -- Lo que se debita por ciclo (en el anual, los 12 meses juntos).
  monto numeric(12,2) not null check (monto > 0),
  moneda text not null default 'ARS',
  -- El estado que informa MP: authorized, paused, cancelled.
  estado text not null,
  -- Solo para mostrar "Visa terminada en 4242". Nunca el numero.
  tarjeta_marca text,
  tarjeta_ultimos4 text check (tarjeta_ultimos4 is null or tarjeta_ultimos4 ~ '^[0-9]{4}$'),
  -- = start_date del preapproval = fin de la prueba.
  primer_debito timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una suscripcion viva por cuenta: el endpoint del paso 3 no puede crear dos.
create unique index if not exists suscripciones_una_viva_por_usuario
  on public.suscripciones (user_id) where estado <> 'cancelled';

create index if not exists suscripciones_tenant_idx on public.suscripciones (tenant_id);

-- El barrido de las cuentas que nunca confirmaron el mail las busca asi.
create index if not exists suscripciones_sin_negocio_idx
  on public.suscripciones (created_at) where tenant_id is null;

comment on table public.suscripciones is
  'Suscripcion de Mercado Pago de cada negocio (cobro de Divianco). La crea '
  'suscripcion-alta en el paso 3 del registro; signup_tenant le pone el '
  'tenant_id. Ver docs/plataforma/COBRO-SUSCRIPCION.md.';

alter table public.suscripciones enable row level security;

-- La ve el negocio, el propio usuario antes de tener negocio, y el staff.
drop policy if exists suscripciones_select on public.suscripciones;
create policy suscripciones_select on public.suscripciones
  for select to authenticated using (
    tenant_id in (select private.current_user_tenants())
    or user_id = (select auth.uid())
    or private.es_staff_divianco()
  );

/* ─────────────── 2. Cada debito que informa MP ─────────────── */

create table if not exists public.cobros_suscripcion (
  id bigint generated always as identity primary key,
  suscripcion_id uuid not null references public.suscripciones(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  -- El id del authorized_payment de MP. Unique: un webhook repetido no corre
  -- `paga_hasta` dos veces.
  mp_pago_id text not null unique,
  monto numeric(12,2) not null,
  -- El estado que informa MP del debito (approved, rejected, ...).
  estado text not null,
  -- Hasta donde corrio `paga_hasta` este debito, si fue aprobado.
  cubre_hasta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cobros_suscripcion_tenant_idx
  on public.cobros_suscripcion (tenant_id, created_at);

comment on table public.cobros_suscripcion is
  'Debitos de la suscripcion informados por el webhook de Mercado Pago. Los '
  'escribe solo suscripcion-webhook (service role).';

alter table public.cobros_suscripcion enable row level security;

drop policy if exists cobros_suscripcion_select on public.cobros_suscripcion;
create policy cobros_suscripcion_select on public.cobros_suscripcion
  for select to authenticated using (
    tenant_id in (select private.current_user_tenants())
    or private.es_staff_divianco()
  );

/* ─────────── 3. signup_tenant ata la suscripcion al negocio ─────────── */

-- Misma firma y mismo cuerpo que la 0122 (verificado contra
-- pg_get_functiondef el 6/nov), con dos cambios marcados 0125:
--   - si la cuenta tiene suscripcion, `prueba_hasta` es su primer debito, asi
--     la prueba y el cobro terminan el mismo dia (los 14 dias corren desde el
--     paso 3, no desde que confirma el mail);
--   - la suscripcion recibe el tenant_id.
-- `plan_id` sigue arrancando en 'digital': el plan elegido lo pone el webhook
-- con el primer debito aprobado. Nada se habilita antes de cobrarse.
create or replace function public.signup_tenant()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_email text;
  v_slug text;
  v_name text;
  v_vertical text;
  v_modo text;
  v_country text;
  v_currency text;
  v_tz text;
  v_channels text[];
  v_tenant uuid;
  v_existente record;
  v_primer_debito timestamptz;
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;

  -- El staff de Divianco no tiene negocio: se lo dice al front para que lo
  -- mande a /consola en vez de armar `https://undefined.divianco.app`.
  if exists (select 1 from public.platform_admins where user_id = v_uid) then
    return jsonb_build_object('es_staff', true, 'tenant_id', null);
  end if;

  select t.id, t.slug, t.vertical, t.operation_mode, t.country
    into v_existente
    from public.tenants t
    join public.tenant_members m on m.tenant_id = t.id
   where m.user_id = v_uid
   limit 1;

  -- Idempotente (0019): si ya tiene negocio se devuelve el suyo en vez de
  -- fallar. Es lo que hace que recargar /bienvenido o volver a tocar el link
  -- del mail termine bien.
  if found then
    return jsonb_build_object(
      'tenant_id', v_existente.id, 'slug', v_existente.slug,
      'vertical', v_existente.vertical, 'operation_mode', v_existente.operation_mode,
      'country', v_existente.country, 'already_existed', true);
  end if;

  select u.raw_user_meta_data, u.email into v_meta, v_email
    from auth.users u where u.id = v_uid;
  v_meta := coalesce(v_meta, '{}'::jsonb);

  v_slug := lower(trim(v_meta->>'slug'));

  -- 0060: se lee biz_name (antes business_name).
  -- Antes: coalesce(nullif(trim(v_meta->>'business_name'), ''), v_slug)
  -- `biz_name` es lo que manda signup.js y lo que dicen las 4 migraciones
  -- anteriores. `business_name` se deja como segunda opcion por si alguna
  -- cuenta quedo con el metadata escrito asi.
  v_name := coalesce(
    nullif(trim(v_meta->>'biz_name'), ''),
    nullif(trim(v_meta->>'business_name'), ''),
    v_slug);

  if v_slug is null or v_slug = '' then
    raise exception 'sin_slug';
  end if;

  v_vertical := coalesce(nullif(trim(v_meta->>'vertical'), ''), 'gastro');
  v_modo := coalesce(nullif(trim(v_meta->>'operation_mode'), ''), 'fisico');
  v_country := upper(coalesce(nullif(trim(v_meta->>'country'), ''), 'AR'));

  v_currency := nullif(trim(v_meta->>'currency'), '');
  if v_currency is null then
    v_currency := case v_country
      when 'AR' then 'ARS' when 'UY' then 'UYU' when 'CL' then 'CLP'
      when 'PY' then 'PYG' when 'BO' then 'BOB' when 'PE' then 'PEN'
      when 'CO' then 'COP' when 'MX' then 'MXN' when 'ES' then 'EUR'
      else 'ARS' end;
  end if;

  v_tz := nullif(trim(v_meta->>'timezone'), '');
  if v_tz is null then
    v_tz := case v_country
      when 'AR' then 'America/Argentina/Buenos_Aires'
      when 'UY' then 'America/Montevideo'
      when 'CL' then 'America/Santiago'
      when 'PY' then 'America/Asuncion'
      when 'BO' then 'America/La_Paz'
      when 'PE' then 'America/Lima'
      when 'CO' then 'America/Bogota'
      when 'MX' then 'America/Mexico_City'
      when 'ES' then 'Europe/Madrid'
      else 'America/Argentina/Buenos_Aires' end;
  end if;

  select coalesce(array_agg(c), '{}')::text[] into v_channels
    from jsonb_array_elements_text(
           case when jsonb_typeof(v_meta->'channels') = 'array'
                then v_meta->'channels' else '[]'::jsonb end
         ) as c
   where c in ('walk_in','counter','table_service','appointment',
               'online_booking','delivery','pickup','ecommerce',
               'whatsapp','marketplace');

  if not public.slug_available(v_slug) then
    raise exception 'El slug % no esta disponible', v_slug using errcode = '23505';
  end if;

  -- 0125: con suscripcion, la prueba termina el dia del primer debito.
  select s.primer_debito into v_primer_debito
    from public.suscripciones s
   where s.user_id = v_uid and s.estado <> 'cancelled' and s.tenant_id is null
   order by s.created_at desc
   limit 1;

  -- 0122: el alta arranca en Paris con 14 dias de Dante (src/modules/planes.js).
  insert into public.tenants(
    slug, name, vertical, operation_mode, country, currency, timezone,
    channels, plan_id, prueba_hasta, settings)
  values (
    v_slug, v_name, v_vertical, v_modo, v_country, v_currency, v_tz, v_channels,
    'digital', coalesce(v_primer_debito, now() + interval '14 days'),
    jsonb_build_object('logo_color', '#111111', 'catalog_theme', 'ambar', 'prep_time_min', 30))
  returning id into v_tenant;

  -- 0125: la suscripcion del paso 3 queda atada al negocio.
  update public.suscripciones
     set tenant_id = v_tenant, updated_at = now()
   where user_id = v_uid and estado <> 'cancelled' and tenant_id is null;

  insert into public.branches(tenant_id, name, timezone, is_default)
    values (v_tenant, 'Principal', v_tz, true);

  insert into public.tenant_members(tenant_id, user_id, roles)
    values (v_tenant, v_uid, array['owner']);

  insert into public.profiles(id, tenant_id, full_name, email)
    values (v_uid, v_tenant, coalesce(nullif(trim(v_meta->>'full_name'),''), v_name), v_email)
  on conflict (id) do update
    set tenant_id = excluded.tenant_id, email = excluded.email;

  return jsonb_build_object(
    'tenant_id', v_tenant, 'slug', v_slug, 'vertical', v_vertical,
    'operation_mode', v_modo, 'country', v_country, 'already_existed', false);
end $function$;

revoke all on function public.signup_tenant() from public, anon;
grant execute on function public.signup_tenant() to authenticated;

comment on function public.signup_tenant is
  'Alta self-service. Lee el metadata del usuario (biz_name, slug, vertical, '
  'operation_mode, country, currency, timezone, channels) y crea tenant + '
  'branch + member + profile. Arranca en Paris (digital) con 14 dias de Dante '
  '(prueba_hasta); si la cuenta dejo tarjeta en el paso 3, la prueba termina '
  'en el primer debito y la suscripcion queda atada al negocio (0125). '
  'Idempotente: si la cuenta ya tiene negocio lo devuelve con already_existed=true.';
