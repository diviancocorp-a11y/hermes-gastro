-- 0094 — Musica propia del negocio y promos del catalogo configurables.
--
-- Musica: hasta hoy el catalogo reproducia /catalog-music.mp3, una sola
-- cancion de Dico para todos los negocios. Ahora cada negocio puede subir la
-- suya (settings.music_url), apagar la musica (settings.catalog_music) o dejar
-- la de Dico. El bucket tenant-images acepta audio (mismo tope de 5 MB).
--
-- Promos: el carrusel del inicio mostraba siempre las tarjetas "Regalo de
-- cumple" y "Pedidos programados". Ahora cada una se prende o apaga desde
-- Ventas > Clientes (settings.promo_cumple / promo_programados). Ambas arrancan
-- prendidas: nada cambia para los negocios que ya existen.
--
-- Identica a 0093 mas esas cuatro claves en el espejo y en get_catalog.

alter table public.settings
  add column if not exists music_url text,
  add column if not exists catalog_music boolean,
  add column if not exists promo_cumple boolean,
  add column if not exists promo_programados boolean;

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg', 'image/png', 'image/webp', 'image/gif',
     'image/x-icon', 'image/vnd.microsoft.icon',
     'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
     'audio/ogg', 'audio/wav', 'audio/x-wav'
   ]
 where id = 'tenant-images';

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
       'telegram',         nullif(trim(new.telegram), ''),
       'free_delivery_over', new.free_delivery_over,
       'delivery_zone',    new.delivery_zone,
       'favicon_url',      nullif(trim(new.favicon_url), ''),
       'store_hours',      new.store_hours,
       'lead_time_hours',  new.lead_time_hours,
       'music_url',        nullif(trim(new.music_url), ''),
       'catalog_music',    new.catalog_music,
       'promo_cumple',     new.promo_cumple,
       'promo_programados', new.promo_programados
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
      'favicon_url', (select settings->>'favicon_url' from t),
      'timezone',    (select timezone from t),
      'store_hours', (select settings->'store_hours' from t),
      'lead_time_hours', coalesce((select (settings->>'lead_time_hours')::numeric from t), 0),
      'music_url',   (select settings->>'music_url' from t),
      'catalog_music', coalesce((select (settings->>'catalog_music')::boolean from t), true),
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
