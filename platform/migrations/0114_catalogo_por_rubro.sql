-- 0114 — Clasificacion y caracteristicas explicitas del catalogo por rubro.
-- Aplicada via MCP el 24/oct/2026. Solo expandir.
-- 0113 corresponde al ajuste de slots de agenda aplicado en paralelo.
-- Los datos existentes y el deploy anterior siguen siendo compatibles.

create function private.valid_catalog_attributes(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $valid$
declare entry record; feature jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object' or length(value::text) > 4096 then return false; end if;
  for entry in select * from jsonb_each(value) loop
    if entry.key not in ('category','brand','line','varietal','presentation','features') then return false; end if;
    if entry.key = 'features' then
      if jsonb_typeof(entry.value) <> 'array' then return false; end if;
      if jsonb_array_length(entry.value) > 3 then return false; end if;
      for feature in select * from jsonb_array_elements(entry.value) loop
        if jsonb_typeof(feature) <> 'string' or feature #>> '{}' not in ('vegetarian','vegan','gluten_free') then return false; end if;
      end loop;
      if (select count(distinct item) from jsonb_array_elements(entry.value) item) <> jsonb_array_length(entry.value) then return false; end if;
    elsif jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 120 then
      return false;
    end if;
  end loop;
  return true;
end $valid$;
revoke all on function private.valid_catalog_attributes(jsonb) from public, anon;
grant execute on function private.valid_catalog_attributes(jsonb) to authenticated, service_role;

alter table public.products add column catalog_attributes jsonb not null default '{}'::jsonb;
alter table public.products add constraint products_catalog_attributes_check check (private.valid_catalog_attributes(catalog_attributes));
alter table public.settings add column catalog_profile text
  check (catalog_profile in ('gastro','beverages','retail','barber'));

-- get_catalog conserva firma/retorno; solo suma datos publicos del tenant resuelto.
CREATE OR REPLACE FUNCTION public.get_catalog(p_tenant_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
