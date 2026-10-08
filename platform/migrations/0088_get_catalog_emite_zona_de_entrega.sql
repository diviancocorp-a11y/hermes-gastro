-- 0088 — get_catalog emite `delivery_zone` (a que zonas entrega el negocio).
--
-- `tenants.settings->'delivery_zone'` tiene la forma
--   { "partidos": ["Vicente López", "San Isidro", ...],
--     "notice":   "texto que el checkout muestra al elegir envio" }
--
--   partidos  si no esta vacio, el checkout bloquea direcciones cuyo partido
--             (segun el geocodificador) no figura. Si el geocodificador no da
--             un partido reconocible NO se bloquea: ahi decide el negocio.
--   notice    aviso visible, sin bloquear nada.
--
-- Ausente (NULL) significa "entrego en todos lados": ningun negocio existente
-- cambia. El checkout lo evalua con evaluarZona (src/modules/origenDelEnvio.js).
--
-- LO QUE ESTO NO HACE: la direccion se ubica en el cliente (Nominatim) y
-- submit-order no la revalida, igual que el costo de envio. No se pueden
-- excluir villas por geografia sin los poligonos: para eso esta el aviso.
--
-- Identica a 0087 mas esa linea.

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
