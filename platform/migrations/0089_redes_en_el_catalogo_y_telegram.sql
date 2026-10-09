-- 0089 — Telegram entre las redes, y las redes llegan al catalogo.
--
-- Hallazgo: el pie del catalogo (CatalogFooter) lee instagram, facebook, etc.
-- de settings, pero get_catalog nunca las emitio y el espejo
-- espejar_settings_a_tenant (settings -> tenants.settings) tampoco las copiaba.
-- Resultado: lo que el negocio cargaba en Personalizacion > Redes se guardaba
-- y no se veia nunca. Esta migracion cierra las dos puntas:
--   1. settings.telegram (usuario sin @, como instagram y tiktok).
--   2. el espejo copia las redes a tenants.settings.
--   3. get_catalog emite las redes (solo las cargadas) en settings.
-- Identica a 0088 mas esas claves. LinkedIn queda en la tabla pero sin UI.

alter table public.settings add column if not exists telegram text;

create or replace function public.espejar_settings_a_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants t
     set settings = coalesce(t.settings, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
       'biz_name',         new.biz_name,
       'logo_color',       new.logo_color,
       'logo_url',         new.logo_url,
       'cover_url',        new.cover_url,
       'slogan',           new.slogan,
       'catalog_theme',    new.catalog_theme,
       'prep_time_min',    new.prep_time_min,
       'deal_pct',         new.deal_pct,
       'min_order_amount', new.min_order_amount,
       'daily_deals',      new.daily_deals,
       'cat_groups',       new.cat_groups,
       'delivery_pricing', new.delivery_pricing,
       'payment_accounts', new.payment_accounts,
       'whatsapp',         nullif(trim(new.whatsapp), ''),
       'instagram',        nullif(trim(new.instagram), ''),
       'facebook',         nullif(trim(new.facebook), ''),
       'tiktok',           nullif(trim(new.tiktok), ''),
       'youtube',          nullif(trim(new.youtube), ''),
       'twitter',          nullif(trim(new.twitter), ''),
       'telegram',         nullif(trim(new.telegram), '')
     ))
   where t.id = new.tenant_id;
  return new;
end $$;

create or replace function public.get_catalog(p_tenant_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
      'vertical',    (select vertical from t),
      'country',     (select country from t),
      'store_lat',   (select lat from origen),
      'store_lng',   (select lng from origen),
      'catalogo_activo', coalesce((select private.tiene_ubicacion(t.id) from t), false),
      'has_physical_store', coalesce((select (settings->>'has_physical_store')::boolean from t), true),
      'free_delivery_over', coalesce((select (settings->>'free_delivery_over')::numeric from t), 0),
      'delivery_zone', (select settings->'delivery_zone' from t),
      'logo_letter', upper(left(coalesce((select name from t),'H'),1)),
      'logo_color',  coalesce((select settings->>'logo_color' from t), '#111111'),
      'cover_url',   (select settings->>'cover_url' from t),
      'slogan',      (select settings->>'slogan' from t),
      'logo_url',    (select settings->>'logo_url' from t),
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
$$;

revoke all on function public.get_catalog(text) from public;
grant execute on function public.get_catalog(text) to anon, authenticated;

-- Las redes que ya estaban cargadas (p. ej. instagram de crazy-miga) llegan al
-- catalogo sin que nadie re-guarde: tocar la fila dispara el espejo.
update public.settings set tenant_id = tenant_id;
