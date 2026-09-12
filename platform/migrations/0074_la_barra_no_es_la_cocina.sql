-- 0074 - La barra no es la cocina.
--
-- QUE ESTABA MAL
-- La 0072 dejo la estacion como texto libre en el producto, y el KDS la usaba
-- como un filtro dentro de UNA pantalla. En un local con barra eso significa
-- que el barman ve tickets con la milanesa adentro y el cocinero ve la
-- limonada. La barra no es una estacion mas de la cocina: es otro lugar, con
-- otra gente, otro ritmo y otro tiempo.
--
-- Un gin tonic sale en tres minutos y un asado en veinticinco. Un umbral de
-- demora comun a los dos no sirve para ninguno: o la barra vive en rojo o la
-- cocina nunca avisa.
--
-- DOS NIVELES, NO UNO
--   sector    lo que tiene pantalla propia o impresora propia. Cocina, Barra.
--   estacion  donde se hace el plato dentro del sector. Parrilla, Plancha.
--
-- El sector es la unidad de DESPACHO y la estacion es la unidad de TRABAJO.
-- Con un solo nivel habria que elegir cual de las dos cosas representa, y
-- cualquiera de las dos elecciones rompe la otra.
--
-- POR QUE AHORA Y NO DESPUES
-- Cero productos tienen estacion asignada y cero pedidos bajaron a cocina: el
-- KDS todavia no se uso. Corregir el modelo hoy no migra ni un dato; en un mes
-- habria que reescribir comandas historicas.
--
-- EL MODO VIVE EN EL SECTOR
-- `mode` decide si ese sector trabaja con pantalla o con comanda en papel, y
-- se mezclan: cocina con monitor y barra con impresora es una configuracion
-- normal, no un caso raro. Poner el modo en el negocio entero obligaria a los
-- dos a lo mismo.

-- ── 1. Sectores ────────────────────────────────────────────────────────

create table if not exists public.production_sectors (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  -- 'pantalla' = KDS. 'papel' = comanda impresa; sin pantalla, el pedido lo
  -- cierra quien lo retira desde Salon.
  mode        text not null default 'pantalla'
              check (mode in ('pantalla', 'papel')),
  -- Minutos hasta que el ticket se considera demorado, POR SECTOR.
  umbral_min  integer not null default 18 check (umbral_min > 0),
  orden       integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists production_sectors_nombre_idx
  on public.production_sectors (tenant_id, lower(name)) where active;

create index if not exists production_sectors_tenant_idx
  on public.production_sectors (tenant_id, orden) where active;

alter table public.production_sectors enable row level security;

create policy production_sectors_select on public.production_sectors
  for select using (tenant_id in (select private.current_user_tenants()));

create policy production_sectors_write on public.production_sectors
  for all using (
    tenant_id in (select private.current_user_tenants())
    and private.tiene_rol(tenant_id, array['owner', 'manager'])
  ) with check (
    tenant_id in (select private.current_user_tenants())
    and private.tiene_rol(tenant_id, array['owner', 'manager'])
  );


-- ── 2. Estaciones ──────────────────────────────────────────────────────

create table if not exists public.production_stations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  sector_id   uuid not null references public.production_sectors(id) on delete cascade,
  name        text not null,
  -- Como se abrevia en la tablet, donde "PARRILLA" no entra al lado del
  -- plato. Si no se carga, el KDS corta el nombre en tres letras.
  short_name  text,
  -- El orden del CIRCUITO de la cocina, no alfabetico: caliente primero,
  -- postres al final. Es un dato que solo el local sabe, y hasta ahora no
  -- habia donde ponerlo.
  orden       integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists production_stations_nombre_idx
  on public.production_stations (tenant_id, lower(name)) where active;

create index if not exists production_stations_sector_idx
  on public.production_stations (sector_id, orden) where active;

alter table public.production_stations enable row level security;

create policy production_stations_select on public.production_stations
  for select using (tenant_id in (select private.current_user_tenants()));

create policy production_stations_write on public.production_stations
  for all using (
    tenant_id in (select private.current_user_tenants())
    and private.tiene_rol(tenant_id, array['owner', 'manager'])
  ) with check (
    tenant_id in (select private.current_user_tenants())
    and private.tiene_rol(tenant_id, array['owner', 'manager'])
  );


-- ── 3. El producto apunta a una estacion de verdad ─────────────────────
--
-- `products.station` (texto, 0072) queda como estaba y sin uso: borrar una
-- columna que otra rama puede estar leyendo es la forma mas facil de romper
-- un deploy ajeno. Se retira cuando el KDS lleve un tiempo andando.

alter table public.products
  add column if not exists station_id uuid
    references public.production_stations(id) on delete set null;

create index if not exists products_station_idx
  on public.products (station_id) where station_id is not null;

alter table public.order_items
  add column if not exists station_id uuid
    references public.production_stations(id) on delete set null,
  add column if not exists sector_id uuid
    references public.production_sectors(id) on delete set null;

-- El KDS de un sector pregunta siempre lo mismo: que me falta hacer.
create index if not exists order_items_sector_pendiente_idx
  on public.order_items (sector_id) where ready_at is null;


-- ── 4. El item hereda la estacion del producto, sin que nadie se acuerde ──
--
-- Los items de un pedido se crean desde tres lugares —la edge function del
-- catalogo, la carga manual del salon y el cobro de mostrador— y cada uno
-- tendria que acordarse de copiar la estacion. El que se olvide manda platos
-- que no aparecen en ninguna pantalla.
--
-- Con el trigger, olvidarse es imposible: si el item no trae estacion, la
-- toma del producto. Si la trae, se respeta, porque un pedido historico no
-- puede cambiar de estacion porque el producto se reconfiguro.

create or replace function public.item_hereda_su_estacion()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.station_id is null and new.product_id is not null then
    select p.station_id into new.station_id
      from public.products p where p.id = new.product_id;
  end if;

  if new.station_id is not null then
    select s.sector_id, s.name into new.sector_id, new.station
      from public.production_stations s where s.id = new.station_id;
  end if;

  return new;
end $function$;

drop trigger if exists trg_item_hereda_estacion on public.order_items;

create trigger trg_item_hereda_estacion
  before insert on public.order_items
  for each row execute function public.item_hereda_su_estacion();


-- ── 5. El juego tipico de una cocina, para no arrancar de cero ─────────
--
-- No se corre sola sobre los tenants que ya existen: crear sectores que nadie
-- pidio en siete negocios es peor que una pantalla vacia. La UI la ofrece con
-- un boton, y el que tiene otra organizacion arma la suya.
--
-- Los umbrales salen de lo que tarda cada cosa: la barra despacha en minutos
-- y la cocina en decenas de minutos.

create or replace function public.crear_sectores_tipicos(p_tenant_id uuid)
returns setof public.production_sectors
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_cocina uuid;
  v_barra  uuid;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if not private.tiene_rol(p_tenant_id, array['owner', 'manager']) then
    raise exception 'no_alcanza_el_rol';
  end if;

  -- Idempotente: llamarla dos veces no duplica nada.
  if exists (select 1 from public.production_sectors s
              where s.tenant_id = p_tenant_id and s.active) then
    return query select * from public.production_sectors s
                  where s.tenant_id = p_tenant_id and s.active order by s.orden;
    return;
  end if;

  insert into public.production_sectors (tenant_id, name, umbral_min, orden)
    values (p_tenant_id, 'Cocina', 18, 0) returning id into v_cocina;
  insert into public.production_sectors (tenant_id, name, umbral_min, orden)
    values (p_tenant_id, 'Barra', 5, 1) returning id into v_barra;

  insert into public.production_stations (tenant_id, sector_id, name, short_name, orden)
  values
    (p_tenant_id, v_cocina, 'Parrilla', 'PAR', 0),
    (p_tenant_id, v_cocina, 'Plancha',  'PLA', 1),
    (p_tenant_id, v_cocina, 'Fríos',    'FRÍ', 2),
    (p_tenant_id, v_cocina, 'Postres',  'POS', 3),
    (p_tenant_id, v_barra,  'Barra',    'BAR', 0);

  return query select * from public.production_sectors s
                where s.tenant_id = p_tenant_id and s.active order by s.orden;
end $function$;

revoke all on function public.crear_sectores_tipicos(uuid) from anon;
