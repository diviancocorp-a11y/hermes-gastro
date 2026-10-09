-- 0092 — El favicon del negocio llega a la pestania.
--
-- Personalizacion guarda settings.favicon_url, pero nada lo leia: get_catalog
-- no lo emitia, el espejo no lo copiaba a tenants.settings y tenantHead usaba
-- solo logo_url. Subir un favicon no cambiaba la pestania.
--   - espejar_settings_a_tenant lo copia (y conserva lo de 0089/0090).
--   - get_catalog lo emite (identica a 0089 mas esa clave).
--   - get_tenant_brand lo emite: el panel /admin no pasa por get_catalog.

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
       'favicon_url',      nullif(trim(new.favicon_url), '')
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

create or replace function public.get_tenant_brand(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug',        t.slug,
    'name',        coalesce(s.biz_name, t.name),
    'vertical',    t.vertical,
    'logo_letter', coalesce(s.logo_letter, upper(left(coalesce(s.biz_name, t.name, 'D'), 1))),
    'logo_color',  s.logo_color,
    'logo_url',    s.logo_url,
    'favicon_url', s.favicon_url,
    'slogan',      s.slogan
  )
  from public.tenants t
  left join public.settings s on s.tenant_id = t.id
  where t.slug = lower(trim(coalesce(p_slug, '')))
  limit 1;
$$;

-- Lo ya cargado llega al catalogo sin re-guardar: tocar la fila dispara el espejo.
update public.settings set tenant_id = tenant_id;
