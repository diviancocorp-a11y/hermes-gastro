-- 0122 Prueba de Dante en el alta self-service.
-- Aplicada via MCP el 2026-11-04
--
-- Ricky, 4/nov/2026: el sistema arranca limitado y desbloquea al pagar, pero
-- el negocio nuevo prueba Dante 14 dias antes de bajar a Paris.
--
-- Expandir y nada mas: la columna es nueva y nullable, y signup_tenant
-- conserva su firma. El deploy anterior no lee prueba_hasta y un plan_id
-- 'digital' sin paga_hasta queda en `sin_fecha`, que no suspende (la
-- suspension de la 0052 exige paga_hasta not null).
--
-- El cuerpo es el DESPLEGADO el 4/nov (pg_get_functiondef), igual al de la
-- 0060, con dos columnas mas en el insert de tenants. Las altas a mano
-- (provision_owner) siguen sin plan: tienen acuerdos propios y ven todo.

alter table public.tenants
  add column if not exists prueba_hasta timestamptz;

comment on column public.tenants.prueba_hasta is
  'Hasta cuando el negocio tiene Dante de prueba aunque su plan_id sea menor. '
  'Lo pone signup_tenant. Ver planEfectivo en src/modules/planes.js.';

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

  -- 0122: el alta arranca en Paris con 14 dias de Dante (src/modules/planes.js).
  insert into public.tenants(
    slug, name, vertical, operation_mode, country, currency, timezone,
    channels, plan_id, prueba_hasta, settings)
  values (
    v_slug, v_name, v_vertical, v_modo, v_country, v_currency, v_tz, v_channels,
    'digital', now() + interval '14 days',
    jsonb_build_object('logo_color', '#111111', 'catalog_theme', 'ambar', 'prep_time_min', 30))
  returning id into v_tenant;

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
  '(prueba_hasta). Idempotente: si la cuenta ya tiene negocio lo devuelve con '
  'already_existed=true.';
