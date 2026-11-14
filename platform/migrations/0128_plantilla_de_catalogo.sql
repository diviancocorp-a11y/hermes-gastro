-- 0128 — Plantilla de catalogo por tenant ("pop"), marca configurable y
-- atributos de producto para la portada (etiqueta, destacado, proximamente, dias).
-- SIN APLICAR (la aplica la directora tras auditarla). Solo expandir.
--
-- 1. settings.catalog_template ('default' | 'pop') y settings.catalog_template_config
--    (jsonb, claves planas y pocas, validado por private.valid_template_config).
--    Todo tenant existente queda en null = 'default': el catalogo no cambia.
-- 2. private.valid_catalog_attributes suma `tag`, `featured`, `coming_soon` y
--    `days`. Misma firma y mas permisiva (patron de 0118): los datos existentes
--    y el deploy anterior siguen siendo validos. La fase 4 suma sus claves al
--    lado de estas.
-- 3. get_catalog conserva firma y retorno; solo suma catalog_template,
--    catalog_template_config, currency y secondary_currency a `settings`.
--    Identica a 0119 salvo esas cuatro claves. create or replace, sin segunda firma.
--
-- Las listas cerradas (secciones, fuentes, claves) se comparan contra
-- src/lib/plantillaConfig.js en src/test/plantillaConfigSync.test.js.

alter table public.settings add column if not exists catalog_template text
  check (catalog_template is null or catalog_template in ('default','pop'));
alter table public.settings add column if not exists catalog_template_config jsonb;

create function private.valid_template_config(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $valid$
declare
  k text; v jsonb; item jsonb; ik text; iv jsonb;
  top_keys text[] := array['secciones','marca','textos','anuncios','cinta','intro','flyers','testimonios','submarca'];
  seccion_ids text[] := array['hero','cinta','favoritos','flyers','menu','submarca','banda','testimonios','historia'];
  marca_colores text[] := array['primario','fondo','texto','acento2'];
  marca_urls text[] := array['logo_header','logo_footer','isotipo'];
  fuentes text[] := array['Montserrat','Inter','DM Sans','Poppins','Playfair Display','Source Serif 4','Instrument Serif','DM Serif Display','Bebas Neue','Lora'];
  texto_keys text[] := array['hero_eyebrow','hero_titulo','hero_lead','hero_cta','hero_nota','hero_sello','intro_caption',
    'favoritos_eyebrow','favoritos_titulo','favoritos_aside','flyers_eyebrow','flyers_titulo','menu_eyebrow','menu_titulo','menu_lead',
    'banda_eyebrow','banda_titulo','banda_texto','banda_imagen','testimonios_eyebrow','testimonios_titulo',
    'historia_eyebrow','historia_titulo','historia_texto','historia_sello'];
  submarca_keys text[] := array['nombre','categoria','eyebrow','titulo','texto','fondo','color','logo','isotipo'];
  flyer_keys text[] := array['titulo','texto','imagen','badge','link','desde','hasta','activo'];
  quote_keys text[] := array['texto','nombre'];
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or length(value::text) > 16384 then return false; end if;
  for k, v in select * from jsonb_each(value) loop
    if not (k = any (top_keys)) then return false; end if;
    if k = 'secciones' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 12 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' or not (item ? 'id') then return false; end if;
        for ik, iv in select * from jsonb_each(item) loop
          if ik = 'id' then
            if jsonb_typeof(iv) <> 'string' or not ((iv #>> '{}') = any (seccion_ids)) then return false; end if;
          elsif ik = 'on' then
            if jsonb_typeof(iv) <> 'boolean' then return false; end if;
          else return false; end if;
        end loop;
      end loop;
    elsif k = 'marca' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for ik, iv in select * from jsonb_each(v) loop
        if ik = any (marca_colores) then
          if jsonb_typeof(iv) <> 'string' or (iv #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
        elsif ik in ('fuente_titulo','fuente_texto') then
          if jsonb_typeof(iv) <> 'string' or not ((iv #>> '{}') = any (fuentes)) then return false; end if;
        elsif ik = 'radio' then
          if jsonb_typeof(iv) <> 'string' or (iv #>> '{}') not in ('recto','suave','pildora') then return false; end if;
        elsif ik = any (marca_urls) then
          if jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 500 or (iv #>> '{}') !~ '^(https://|/)' then return false; end if;
        else return false; end if;
      end loop;
    elsif k = 'textos' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for ik, iv in select * from jsonb_each(v) loop
        if not (ik = any (texto_keys)) or jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false; end if;
        if ik = 'banda_imagen' and (iv #>> '{}') !~ '^(https://|/)' then return false; end if;
      end loop;
    elsif k in ('anuncios','cinta') then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 12 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 80 then return false; end if;
      end loop;
    elsif k = 'intro' then
      if jsonb_typeof(v) <> 'boolean' then return false; end if;
    elsif k = 'flyers' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' then return false; end if;
        for ik, iv in select * from jsonb_each(item) loop
          if not (ik = any (flyer_keys)) then return false; end if;
          if ik = 'activo' then
            if jsonb_typeof(iv) <> 'boolean' then return false; end if;
          elsif jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false;
          elsif ik = 'imagen' and (iv #>> '{}') !~ '^(https://|/)' then return false;
          elsif ik in ('desde','hasta') and (iv #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false;
          end if;
        end loop;
      end loop;
    elsif k = 'testimonios' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' then return false; end if;
        for ik, iv in select * from jsonb_each(item) loop
          if not (ik = any (quote_keys)) or jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false; end if;
        end loop;
      end loop;
    elsif k = 'submarca' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for ik, iv in select * from jsonb_each(v) loop
        if not (ik = any (submarca_keys)) or jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false; end if;
        if ik in ('fondo','color') and (iv #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
        if ik in ('logo','isotipo') and (iv #>> '{}') !~ '^(https://|/)' then return false; end if;
      end loop;
    end if;
  end loop;
  return true;
end $valid$;
revoke all on function private.valid_template_config(jsonb) from public, anon;
grant execute on function private.valid_template_config(jsonb) to authenticated, service_role;

alter table public.settings add constraint settings_catalog_template_config_check
  check (private.valid_template_config(catalog_template_config));

create or replace function private.valid_catalog_attributes(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $valid$
declare entry record; feature jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object' or length(value::text) > 4096 then return false; end if;
  for entry in select * from jsonb_each(value) loop
    if entry.key not in ('category','brand','line','varietal','presentation','features','family','family_pack','tag','featured','coming_soon','days') then return false; end if;
    if entry.key = 'features' then
      if jsonb_typeof(entry.value) <> 'array' then return false; end if;
      if jsonb_array_length(entry.value) > 3 then return false; end if;
      for feature in select * from jsonb_array_elements(entry.value) loop
        if jsonb_typeof(feature) <> 'string' or feature #>> '{}' not in ('vegetarian','vegan','gluten_free') then return false; end if;
      end loop;
      if (select count(distinct item) from jsonb_array_elements(entry.value) item) <> jsonb_array_length(entry.value) then return false; end if;
    elsif entry.key in ('featured','coming_soon') then
      if jsonb_typeof(entry.value) <> 'boolean' then return false; end if;
    elsif entry.key = 'days' then
      if jsonb_typeof(entry.value) <> 'array' or jsonb_array_length(entry.value) > 7 then return false; end if;
      for feature in select * from jsonb_array_elements(entry.value) loop
        if jsonb_typeof(feature) <> 'number' or (feature #>> '{}') !~ '^[0-6]$' then return false; end if;
      end loop;
      if (select count(distinct item) from jsonb_array_elements(entry.value) item) <> jsonb_array_length(entry.value) then return false; end if;
    elsif jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 120 then
      return false;
    elsif entry.key = 'tag' and length(entry.value #>> '{}') > 24 then
      return false;
    elsif entry.key = 'family_pack' and (entry.value #>> '{}') !~ '^[0-9]{1,3}$' then
      return false;
    end if;
  end loop;
  return true;
end $valid$;

create or replace function public.get_catalog(p_tenant_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with t as (select * from public.tenants where slug = p_tenant_slug limit 1),
  origen as (
    select b.lat, b.lng
      from public.branches b, t
     where b.tenant_id = t.id and b.active
       and b.lat is not null and b.lng is not null
     order by b.is_default desc, b.created_at
     limit 1
  )
  select jsonb_build_object(
    'settings', jsonb_build_object(
      'biz_name',    (select name from t),
      'catalog_profile', (select s.catalog_profile from public.settings s where s.tenant_id = (select id from t)),
      'catalog_template', coalesce((select s.catalog_template from public.settings s where s.tenant_id = (select id from t)), 'default'),
      'catalog_template_config', coalesce((select s.catalog_template_config from public.settings s where s.tenant_id = (select id from t)), '{}'::jsonb),
      'currency',           (select currency from t),
      'secondary_currency', (select secondary_currency from t),
      'vertical',    (select vertical from t),
      'country',     (select country from t),
      'store_lat',   (select lat from origen),
      'store_lng',   (select lng from origen),
      'catalogo_activo', coalesce((select private.tiene_ubicacion(t.id) from t), false),
      'online_booking', coalesce((select 'online_booking' = any(t.channels) from t), false),
      'has_physical_store', coalesce((select (settings->>'has_physical_store')::boolean from t), true),
      'free_delivery_over', coalesce((select (settings->>'free_delivery_over')::numeric from t), 0),
      'delivery_zone', (select settings->'delivery_zone' from t),
      'logo_letter', upper(left(coalesce((select name from t),'H'),1)),
      'logo_color',  coalesce((select settings->>'logo_color' from t), '#111111'),
      'cover_url',   (select settings->>'cover_url' from t),
      'slogan',      (select settings->>'slogan' from t),
      'logo_url',    (select settings->>'logo_url' from t),
      'favicon_url', (select settings->>'favicon_url' from t),
      'timezone',    (select timezone from t),
      'store_hours', (select settings->'store_hours' from t),
      'lead_time_hours', coalesce((select (settings->>'lead_time_hours')::numeric from t), 0),
      'music_url',   (select settings->>'music_url' from t),
      'catalog_music', coalesce((select (settings->>'catalog_music')::boolean from t), true),
      'music_volume', (select (settings->>'music_volume')::int from t),
      'promo_cumple', coalesce((select (settings->>'promo_cumple')::boolean from t), true),
      'promo_programados', coalesce((select (settings->>'promo_programados')::boolean from t), true),
      'whatsapp',    (select settings->>'whatsapp' from t),
      'instagram',   (select settings->>'instagram' from t),
      'facebook',    (select settings->>'facebook' from t),
      'tiktok',      (select settings->>'tiktok' from t),
      'youtube',     (select settings->>'youtube' from t),
      'twitter',     (select settings->>'twitter' from t),
      'telegram',    (select settings->>'telegram' from t),
      'catalog_theme', coalesce(
        (select settings->>'catalog_theme' from t
          where settings->>'catalog_theme' in ('ambar','noche','carbon')),
        'ambar'
      ),
      'prep_time_min',    coalesce((select (settings->>'prep_time_min')::int from t), 30),
      'deal_pct',         coalesce((select (settings->>'deal_pct')::numeric from t), 15),
      'min_order_amount', coalesce((select (settings->>'min_order_amount')::numeric from t), 0),
      'min_order',        coalesce((select (settings->>'min_order_amount')::numeric from t), 0),
      'daily_deals',      coalesce((select settings->'daily_deals' from t), '{}'::jsonb),
      'cat_groups',       coalesce((select settings->'cat_groups' from t), '[]'::jsonb),
      'delivery_pricing', coalesce((select settings->'delivery_pricing' from t), '[]'::jsonb),
      'payment_accounts', coalesce((
        select jsonb_agg(a)
        from t, jsonb_array_elements(coalesce(t.settings->'payment_accounts', '[]'::jsonb)) a
        where coalesce(a->>'active', 'true') <> 'false'
          and coalesce(a->>'scope', 'ambos') <> 'proveedores'
      ), '[]'::jsonb)
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'category', p.category,
        'catalog_attributes', p.catalog_attributes,
        'type', p.type, 'duration_min', p.duration_min,
        'sale_price', p.price, 'image_url', p.image_url, 'description', p.description,
        'related_ids', '[]'::jsonb, 'is_vegetarian', false,
        'requires_age_gate', p.requires_age_gate, 'is_combo', false,
        'discount_pct', 0, 'sold_out_override', null,
        'created_at', p.created_at, 'sale_count', 0
      ) order by p.category nulls last, p.name)
      from public.products p, t
      where p.tenant_id = t.id and p.active = true and p.is_archived = false
    ), '[]'::jsonb),
    'serverNow', now()
  );
$function$;

revoke all on function public.get_catalog(text) from public;
grant execute on function public.get_catalog(text) to anon, authenticated;
