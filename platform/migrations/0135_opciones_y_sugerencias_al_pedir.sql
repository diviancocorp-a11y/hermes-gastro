-- 0135 — Grupos de opciones por producto y sugerencias al pedir (Cochi fase 4).
-- Aplicada via MCP el 2026-11-15. Solo expandir:
-- columnas y tabla nuevas con default/null, y get_catalog con la misma firma
-- sumando solo claves nuevas. El deploy anterior y la function vieja siguen andando.
--
-- 1. products.option_groups: grupos de opciones del producto (jsonb validado).
--    [{id,name,type:'single'|'multiple',required,min,max,
--      choices:[{id,label,price,max_qty?}]}]. El precio de cada choice va en la
--    moneda base del tenant. El servidor lo relee de la base en cada pedido.
-- 2. product_suggestions: sugerencias al pedir (el "agregale papas" de Cochi).
-- 3. order_items.selection / suggestion_id: lo elegido, congelado en el pedido.
--    order_items.note ya existe (0072) y la cocina lo imprime: submit-order
--    escribe ahi el texto legible.
-- 4. get_catalog: copia de la funcion VIGENTE en la base (pg_get_functiondef
--    del 15/nov/2026) + 'option_groups' por producto y 'suggestions'.

create function private.valid_option_groups(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $valid$
declare g jsonb; c jsonb; gids text[] := '{}'; cids text[]; n int; mn int; mx int; tipo text;
begin
  if value is null or jsonb_typeof(value) <> 'array' or length(value::text) > 8192 then return false; end if;
  if jsonb_array_length(value) > 8 then return false; end if;
  for g in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(g) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(g) k where k not in ('id','name','type','required','min','max','choices')) then return false; end if;
    if jsonb_typeof(g->'id') <> 'string' or (g->>'id') !~ '^[a-z0-9_-]{1,40}$' then return false; end if;
    if (g->>'id') = any(gids) then return false; end if;
    gids := gids || (g->>'id');
    if jsonb_typeof(g->'name') <> 'string' or length(btrim(g->>'name')) not between 1 and 80 then return false; end if;
    tipo := g->>'type';
    if tipo is null or tipo not in ('single','multiple') then return false; end if;
    if g ? 'required' and jsonb_typeof(g->'required') <> 'boolean' then return false; end if;
    if jsonb_typeof(g->'choices') <> 'array' then return false; end if;
    n := jsonb_array_length(g->'choices');
    if n < 1 or n > 30 then return false; end if;
    mn := coalesce((g->>'min')::int, case when coalesce((g->>'required')::boolean,false) then 1 else 0 end);
    mx := coalesce((g->>'max')::int, case when tipo = 'single' then 1 else n end);
    if mn < 0 or mx < 1 or mn > mx or mx > n then return false; end if;
    if tipo = 'single' and mx <> 1 then return false; end if;
    cids := '{}';
    for c in select * from jsonb_array_elements(g->'choices') loop
      if jsonb_typeof(c) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(c) k where k not in ('id','label','price','max_qty')) then return false; end if;
      if jsonb_typeof(c->'id') <> 'string' or (c->>'id') !~ '^[a-z0-9_-]{1,40}$' then return false; end if;
      if (c->>'id') = any(cids) then return false; end if;
      cids := cids || (c->>'id');
      if jsonb_typeof(c->'label') <> 'string' or length(btrim(c->>'label')) not between 1 and 80 then return false; end if;
      if c ? 'price' and (jsonb_typeof(c->'price') <> 'number' or (c->>'price')::numeric < 0 or (c->>'price')::numeric > 1000000) then return false; end if;
      if c ? 'max_qty' and (jsonb_typeof(c->'max_qty') <> 'number' or (c->>'max_qty')::numeric <> trunc((c->>'max_qty')::numeric) or (c->>'max_qty')::int not between 1 and 99) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $valid$;
revoke all on function private.valid_option_groups(jsonb) from public, anon;
grant execute on function private.valid_option_groups(jsonb) to authenticated, service_role;

alter table public.products add column if not exists option_groups jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_option_groups_check;
alter table public.products add constraint products_option_groups_check check (private.valid_option_groups(option_groups));

create table if not exists public.product_suggestions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  title           text not null check (length(btrim(title)) between 1 and 80),
  body            text check (body is null or length(body) <= 200),
  when_categories text[] not null default '{}',
  add_product_id  uuid not null references public.products(id) on delete cascade,
  special_price   numeric(12,2) check (special_price is null or special_price >= 0),
  max_per_item    integer not null default 1 check (max_per_item between 1 and 20),
  days            integer[] not null default '{}' check (days <@ array[0,1,2,3,4,5,6]),
  start_time      time,
  end_time        time,
  start_date      date,
  end_date        date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_product_suggestions_tenant on public.product_suggestions(tenant_id);

alter table public.product_suggestions enable row level security;
drop policy if exists product_suggestions_select on public.product_suggestions;
create policy product_suggestions_select on public.product_suggestions
  for select using (tenant_id in (select private.current_user_tenants()));
drop policy if exists product_suggestions_write on public.product_suggestions;
create policy product_suggestions_write on public.product_suggestions
  for all using (tenant_id in (select private.current_user_tenants()))
  with check (tenant_id in (select private.current_user_tenants()));

-- La FK sola deja que add_product_id apunte a un producto de OTRO tenant y la
-- policy solo mira tenant_id de la fila: este trigger exige que el producto
-- sugerido sea del mismo tenant. Security invoker: el que escribe ya tiene RLS
-- sobre products, asi que un producto ajeno ni lo ve y falla igual.
create function private.suggestion_product_same_tenant()
returns trigger language plpgsql security invoker set search_path = ''
as $t$
begin
  if not exists (
    select 1 from public.products p
     where p.id = new.add_product_id and p.tenant_id = new.tenant_id
  ) then
    raise exception 'add_product_id no pertenece al tenant de la sugerencia' using errcode = '23514';
  end if;
  return new;
end $t$;
revoke all on function private.suggestion_product_same_tenant() from public, anon;
grant execute on function private.suggestion_product_same_tenant() to authenticated, service_role;
drop trigger if exists trg_suggestion_product_same_tenant on public.product_suggestions;
create trigger trg_suggestion_product_same_tenant
  before insert or update of add_product_id, tenant_id on public.product_suggestions
  for each row execute function private.suggestion_product_same_tenant();

alter table public.order_items add column if not exists selection jsonb;
alter table public.order_items add column if not exists suggestion_id uuid references public.product_suggestions(id) on delete set null;

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
