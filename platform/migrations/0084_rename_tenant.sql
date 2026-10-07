-- 0084 — rename_tenant: renombrar un negocio en un solo paso.
--
-- POR QUE EXISTE
-- El nombre de un negocio vive en TRES lugares y hasta hoy se cambiaba a mano:
--
--     tenants.name                  -- el nombre "de ficha"
--     tenants.settings->>'biz_name' -- copia que escribe signup_tenant
--     settings.biz_name             -- la que LEE la marca (get_tenant_brand)
--
-- Al renombrar Mala Miga -> Crazy Miga (7/oct/2026) se cambiaron los dos
-- primeros y la pestania del panel siguio diciendo "Mala Miga": get_tenant_brand
-- lee `settings.biz_name`, la tercera. Ningun gate lo ve, porque las tres son
-- texto libre y ninguna depende de la otra.
--
-- QUE HACE
-- Cambia las tres a la vez. Opcionalmente cambia tambien el slug (la URL
-- `<slug>.divianco.app`), y en ese caso la direccion vieja deja de resolver.
--
-- LA INICIAL DEL LOGO
-- `settings.logo_letter` se recalcula SOLO si era la derivada del nombre viejo
-- (o si estaba vacia). Si el negocio eligio una inicial a mano, se respeta.
--
-- QUIEN LA LLAMA
-- Nadie desde el front: es una operacion de plataforma, no del dueno. Por eso
-- se revoca el execute a anon y authenticated; se corre con service role o por
-- SQL. No hace falta sumarla a DEFINER_APROBADAS.
--
-- Uso:
--   select public.rename_tenant('mala-miga', 'Crazy Miga', 'crazy-miga');
--   select public.rename_tenant('crazy-miga', 'Crazy Miga');  -- solo el nombre

create or replace function public.rename_tenant(
  p_slug      text,
  p_new_name  text,
  p_new_slug  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug     text := lower(trim(coalesce(p_slug, '')));
  v_name     text := nullif(trim(coalesce(p_new_name, '')), '');
  v_new_slug text := nullif(lower(trim(coalesce(p_new_slug, ''))), '');
  v_id       uuid;
  v_old_name text;
  v_old_biz  text;
  v_old_ltr  text;
begin
  if v_name is null then
    raise exception 'Falta el nombre nuevo' using errcode = '22023';
  end if;

  -- for update: dos renombres a la vez sobre el mismo negocio se serializan.
  select t.id, t.name into v_id, v_old_name
    from public.tenants t
   where t.slug = v_slug
   for update;

  if v_id is null then
    raise exception 'No existe el negocio %', v_slug using errcode = 'P0002';
  end if;

  -- Slug: solo si cambia de verdad. slug_available ya descarta reservados,
  -- formato invalido y los que estan en uso.
  if v_new_slug is not null and v_new_slug <> v_slug then
    if not public.slug_available(v_new_slug) then
      raise exception 'El slug % no esta disponible', v_new_slug using errcode = '23505';
    end if;
  else
    v_new_slug := null;
  end if;

  select s.biz_name, s.logo_letter into v_old_biz, v_old_ltr
    from public.settings s
   where s.tenant_id = v_id;

  update public.tenants
     set name     = v_name,
         slug     = coalesce(v_new_slug, slug),
         settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{biz_name}', to_jsonb(v_name))
   where id = v_id;

  -- La inicial se actualiza solo si era la derivada del nombre anterior.
  update public.settings
     set biz_name    = v_name,
         logo_letter = case
           when logo_letter is null
             or logo_letter = upper(left(coalesce(v_old_biz, v_old_name, ''), 1))
           then upper(left(v_name, 1))
           else logo_letter
         end
   where tenant_id = v_id;

  return jsonb_build_object(
    'tenant_id', v_id,
    'slug',      coalesce(v_new_slug, v_slug),
    'name',      v_name,
    'slug_cambio', v_new_slug is not null
  );
end $$;

revoke all on function public.rename_tenant(text, text, text) from public, anon, authenticated;

comment on function public.rename_tenant(text, text, text) is
  '0084: renombra un negocio en tenants.name, tenants.settings.biz_name y settings.biz_name; opcionalmente el slug. Solo service role.';
