-- 0083: sin la ubicacion del local no hay catalogo que tome pedidos.
--
-- Hasta 0080 el checkout tenia una ubicacion predeterminada: si el negocio no
-- habia cargado la suya, cotizaba el envio contra un punto del build (el
-- centro de Buenos Aires, antes Caracas). Eso es cobrar un envio medido desde
-- un lugar donde el local no esta. Ahora no hay predeterminada: la ubicacion
-- es la que carga el duenio, y hasta que la cargue el catalogo no toma
-- pedidos. Aplica tambien a las cocinas fantasma: no tienen local de retiro,
-- pero el envio sale de algun lado.
--
-- Lo hace la BASE y no solo la pantalla, porque submit-order es publica y se
-- puede llamar sin pasar por el catalogo:
--   1. private.tiene_ubicacion(tenant): la regla, en un solo lugar.
--   2. orders: un pedido channel='catalog' de un negocio sin ubicacion se
--      rechaza en el insert. El panel (pos, salon atendido) no pasa por aca.
--   3. branches: lat/lng validas o ninguna, y solo el duenio las cambia.
--   4. get_catalog emite `catalogo_activo` para que el catalogo lo muestre.

/* ─────────────────────────── 1. La regla ─────────────────────────────── */

create or replace function private.tiene_ubicacion(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1 from public.branches b
     where b.tenant_id = p_tenant and b.active
       and b.lat is not null and b.lng is not null
  )
$$;

comment on function private.tiene_ubicacion(uuid) is
  '0083: si el negocio cargo desde donde sale el envio. Sin esto el catalogo '
  'no toma pedidos (trigger orders_exige_ubicacion) y get_catalog devuelve '
  'catalogo_activo=false.';

/* ─────────────────── 2. Sin ubicacion no entra el pedido ─────────────── */

create or replace function private.pedido_exige_ubicacion()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.channel = 'catalog' and not private.tiene_ubicacion(new.tenant_id) then
    raise exception 'catalogo_sin_ubicacion'
      using hint = 'El negocio tiene que cargar la ubicacion de su local antes de tomar pedidos.';
  end if;
  return new;
end
$$;

drop trigger if exists orders_exige_ubicacion on public.orders;
create trigger orders_exige_ubicacion
  before insert on public.orders
  for each row execute function private.pedido_exige_ubicacion();

/* ─────────────── 3. Ubicacion valida, y solo la toca el duenio ───────── */

-- Las dos o ninguna, en rango, y 0,0 no: es lo que queda de un campo vacio
-- convertido a numero, no un local en el Golfo de Guinea. Los `is not null`
-- explicitos no sobran: un CHECK que da NULL pasa, y sin ellos se podia
-- guardar lat sin lng.
alter table public.branches drop constraint if exists branches_ubicacion_valida;
alter table public.branches add constraint branches_ubicacion_valida check (
  (lat is null and lng is null)
  or (
    lat is not null and lng is not null
    and lat between -90 and 90 and lng between -180 and 180
    and not (lat = 0 and lng = 0)
  )
);

-- La ubicacion define cuanto se le cobra de envio a cada cliente: es plata.
-- branches_write deja escribir a cualquier miembro del negocio (0041), asi que
-- este trigger acota lat/lng al duenio. Sin auth.uid() (service role,
-- migraciones, seeds) no aplica: ahi no hay una persona a la que acotar.
create or replace function private.solo_el_duenio_ubica_el_local()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.lat is null and new.lng is null then
      return new;
    end if;
  elsif new.lat is not distinct from old.lat and new.lng is not distinct from old.lng then
    return new;
  end if;
  if not private.tiene_rol(new.tenant_id, array['owner']) then
    raise exception 'solo_el_duenio_ubica_el_local'
      using hint = 'Solo el duenio del negocio puede cambiar la ubicacion del local.';
  end if;
  return new;
end
$$;

drop trigger if exists branches_solo_el_duenio_ubica on public.branches;
create trigger branches_solo_el_duenio_ubica
  before insert or update on public.branches
  for each row execute function private.solo_el_duenio_ubica_el_local();

/* ──────────────── 4. get_catalog dice si el catalogo esta activo ─────── */

-- Identica a 0080 mas `catalogo_activo`.
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
