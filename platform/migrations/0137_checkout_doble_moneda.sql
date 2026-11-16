-- 0137 — Cochi fase 5: checkout con doble moneda y "envio a confirmar".
-- PENDIENTE de aplicar (la aplica Ricky; cuando se aplique, actualizar esta cabecera).
--
-- Todo es EXPANDIR: columnas nuevas nullables o con default, funciones con la
-- misma firma que solo suman claves, una funcion nueva. Nada se borra ni se
-- renombra: el deploy anterior sigue andando contra esta migracion.
--
-- 1. settings.delivery_a_confirmar / settings.pedido_por_whatsapp: dos flags
--    del tenant. Camino IDENTICO al de `free_delivery_over`: el panel escribe
--    la columna de `settings`, el trigger espejar_settings_a_tenant la copia a
--    tenants.settings y get_catalog la emite. NO se copio el de
--    `has_physical_store`: ese NO esta en el espejo (el toggle del panel no
--    llega al catalogo; ver el reporte de la fase).
-- 2. orders.delivery_pending: el pedido entro sin costo de envio; el local lo
--    carga despues con set_delivery_cost().
-- 3. set_delivery_cost(): carga el costo UNA vez y recalcula total y
--    total_secondary con la tasa CONGELADA del pedido. SECURITY INVOKER: la
--    policy orders_update (tenant_id in current_user_tenants) es la guarda.
--    Quien lo cargo y cuando queda en audit_log: el trigger auditar() (0043)
--    ya corre sobre UPDATE de orders y guarda actor_id + diff.
-- 4. get_catalog, get_order_tracker y espejar_settings_a_tenant: copia de la
--    funcion DESPLEGADA el 16/nov/2026 (pg_get_functiondef) mas claves nuevas.

alter table public.settings add column if not exists delivery_a_confirmar boolean;
alter table public.settings add column if not exists pedido_por_whatsapp boolean;

comment on column public.settings.delivery_a_confirmar is
  'true = el envio a domicilio entra sin costo y el local lo confirma despues (pedido con delivery_pending).';
comment on column public.settings.pedido_por_whatsapp is
  'true = la confirmacion del pedido ofrece el boton "Enviar por WhatsApp" con el detalle.';

alter table public.orders add column if not exists delivery_pending boolean not null default false;
comment on column public.orders.delivery_pending is
  'true = el costo de envio todavia no se cargo: total y total_secondary son parciales.';

create index if not exists idx_orders_delivery_pending
  on public.orders (tenant_id, created_at desc) where delivery_pending;

/* ───────────── set_delivery_cost ───────────── */

create or replace function public.set_delivery_cost(p_order_id uuid, p_cost numeric)
returns public.orders
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_o      public.orders;
  v_tope   numeric;
begin
  if p_cost is null or p_cost < 0 then
    raise exception 'El costo de envio no puede ser negativo' using errcode = '22023';
  end if;

  select * into v_o from public.orders
   where id = p_order_id
     and tenant_id in (select private.current_user_tenants());
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;
  if not v_o.delivery_pending then
    raise exception 'El pedido no tiene el envio pendiente de confirmar' using errcode = '55000';
  end if;

  -- Tope: 10 veces el escalon mas caro que configuro el tenant; sin escalones,
  -- un techo fijo. Atrapa el cero de mas, no fija tarifas.
  select max((e->>'cost')::numeric) * 10 into v_tope
    from public.settings s, jsonb_array_elements(coalesce(s.delivery_pricing, '[]'::jsonb)) e
   where s.tenant_id = v_o.tenant_id and (e->>'cost') ~ '^[0-9]+(\.[0-9]+)?$';
  if p_cost > coalesce(nullif(v_tope, 0), 100000) then
    raise exception 'El costo de envio es demasiado alto' using errcode = '22023';
  end if;

  -- delivery_pending en el where: dos cargas a la vez, gana una sola.
  update public.orders o
     set delivery_cost    = round(p_cost, 2),
         total            = greatest(0, o.subtotal - o.discount) + o.tip_amount + round(p_cost, 2),
         total_secondary  = case when o.fx_rate is not null
           then round((greatest(0, o.subtotal - o.discount) + o.tip_amount + round(p_cost, 2)) * o.fx_rate, 2) end,
         delivery_pending = false
   where o.id = p_order_id and o.delivery_pending
     and o.tenant_id in (select private.current_user_tenants())
  returning * into v_o;
  if not found then
    raise exception 'El pedido no tiene el envio pendiente de confirmar' using errcode = '55000';
  end if;
  return v_o;
end $$;

revoke all on function public.set_delivery_cost(uuid, numeric) from public, anon;
grant execute on function public.set_delivery_cost(uuid, numeric) to authenticated;

comment on function public.set_delivery_cost(uuid, numeric) is
  'Carga el costo de envio de un pedido con delivery_pending, una sola vez. Recalcula total y total_secondary con la tasa congelada (fx_rate) del pedido.';

/* ───────────── espejo settings -> tenants.settings ───────────── */

CREATE OR REPLACE FUNCTION public.espejar_settings_a_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       'promo_programados', new.promo_programados,
       'music_volume',     new.music_volume,
       'delivery_a_confirmar', new.delivery_a_confirmar,
       'pedido_por_whatsapp',  new.pedido_por_whatsapp
     ))
   where t.id = new.tenant_id;
  return new;
end $function$;

/* ───────────── get_order_tracker ───────────── */

CREATE OR REPLACE FUNCTION public.get_order_tracker(p_tenant_slug text, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_t uuid;
  v_o public.orders;
  v_s public.settings;
begin
  select id into v_t from public.tenants where slug = lower(btrim(p_tenant_slug));
  if v_t is null then
    return null;
  end if;

  select * into v_o from public.orders where id = p_order_id and tenant_id = v_t;
  if not found then
    return null;
  end if;

  select * into v_s from public.settings where tenant_id = v_t;

  return jsonb_build_object(
    'id',                  v_o.id,
    'status',              v_o.status,
    'payment_status',      v_o.payment_status,
    'paid_at',             v_o.paid_at,
    'total',               v_o.total,
    'discount',            v_o.discount,
    'delivery',            v_o.delivery,
    'payment',             v_o.payment,
    'is_gift',             v_o.is_gift,
    'note',                v_o.note,
    'created_at',          v_o.created_at,
    'delivery_date',       v_o.delivery_date,
    'ticket_number',       v_o.ticket_number,
    'customer_first_name', nullif(split_part(btrim(coalesce(v_o.customer_name, '')), ' ', 1), ''),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.name_snapshot, 'qty', oi.qty,
        'unit_price', oi.unit_price, 'subtotal', oi.subtotal
      ) order by oi.created_at, oi.id)
      from public.order_items oi
      where oi.order_id = v_o.id and oi.tenant_id = v_t
    ), '[]'::jsonb),
    'whatsapp',            v_s.whatsapp,
    'store_address',       v_s.store_address,
    'delivery_cost',       v_o.delivery_cost,
    'delivery_pending',    v_o.delivery_pending,
    'fx_currency',         v_o.fx_currency,
    'total_secondary',     v_o.total_secondary
  );
end $function$;

/* ───────────── get_catalog ───────────── */

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
      'delivery_a_confirmar', coalesce((select (settings->>'delivery_a_confirmar')::boolean from t), false),
      'pedido_por_whatsapp',  coalesce((select (settings->>'pedido_por_whatsapp')::boolean from t), false),
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
        'option_groups', p.option_groups,
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
    'suggestions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'body', s.body,
        'when_categories', to_jsonb(s.when_categories),
        'add_product_id', s.add_product_id, 'special_price', s.special_price,
        'max_per_item', s.max_per_item, 'days', to_jsonb(s.days),
        'start_time', s.start_time, 'end_time', s.end_time,
        'start_date', s.start_date, 'end_date', s.end_date
      ) order by s.created_at)
      from public.product_suggestions s, t
      where s.tenant_id = t.id and s.active
    ), '[]'::jsonb),
    'serverNow', now()
  );
$function$;
