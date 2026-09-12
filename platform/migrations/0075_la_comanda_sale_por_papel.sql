-- 0075 - La comanda sale por papel.
--
-- QUE FALTABA
-- La 0074 dejo el modo en el sector: `pantalla` o `papel`. El modo se podia
-- elegir y no hacia nada. Un sector en papel no tiene KDS, asi que su trabajo
-- tiene que SALIR del sistema como comanda impresa y VOLVER como "listo"
-- desde otro lado. Las dos mitades faltaban.
--
-- POR QUE UNA TABLA Y NO UNA COLUMNA EN EL PEDIDO
-- Una comanda es de un (pedido, sector). Un local con cocina en pantalla y
-- barra en papel produce UNA comanda por pedido; uno con barra y cafeteria en
-- papel produce DOS, y cada una se imprime, se pierde y se cierra por su
-- cuenta. Con una columna en `orders` habria que elegir cual de las dos
-- representa.
--
-- QUE SE GUARDA Y POR QUE
--   printed_at    cuando salio por la impresora. Sin esto, cada recarga de la
--                 pantalla de la comandera reimprime todo el servicio.
--   impresiones   cuantas veces se imprimio. Cuando el cocinero dice que
--                 nunca le llego, la diferencia entre 0 y 2 es el diagnostico.
--   closed_at     cuando alguien dijo que ese sector ya entrego.
--
-- CERRAR DEJA DE SER TODO O NADA
-- `cerrar_ticket_de_cocina` marcaba listos TODOS los platos del pedido. Con
-- sectores eso es falso: el cocinero que toca "Ticket listo" en su pantalla
-- estaria diciendo que la barra ya sirvio los tragos. Ahora recibe un sector
-- opcional y cierra solo lo suyo; el pedido entero se sella recien cuando no
-- queda ningun plato pendiente, lo marque quien lo marque.

-- ── 1. La comanda de un sector ─────────────────────────────────────────

create table if not exists public.production_dispatches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  sector_id   uuid not null references public.production_sectors(id) on delete cascade,
  printed_at  timestamptz,
  impresiones integer not null default 0,
  closed_at   timestamptz,
  closed_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index if not exists production_dispatches_unico_idx
  on public.production_dispatches (order_id, sector_id);

-- La pregunta que hace la comandera cada pocos segundos, toda la noche.
create index if not exists production_dispatches_pendiente_idx
  on public.production_dispatches (tenant_id, sector_id) where closed_at is null;

alter table public.production_dispatches enable row level security;

-- Solo lectura directa. Toda escritura pasa por las funciones de abajo, que
-- ademas validan que el pedido este en cocina y que el sector sea del mismo
-- negocio: un upsert suelto desde el cliente no puede comprobar nada de eso.
create policy production_dispatches_select on public.production_dispatches
  for select using (tenant_id in (select private.current_user_tenants()));


-- ── 2. Que le falta imprimir a este sector ─────────────────────────────
--
-- Un pedido entra a la cola cuando bajo a cocina, todavia no se cerro, tiene
-- al menos un plato pendiente de ESTE sector, y nadie lo imprimio.
--
-- Va como funcion y no como vista porque "no existe la fila de impresion" no
-- se puede pedir desde el cliente sin traerse la tabla entera.

create or replace function public.comandas_por_imprimir(
  p_tenant_id uuid,
  p_sector_id uuid,
  p_branch_id uuid default null
)
returns setof public.orders
language sql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
  select o.*
    from public.orders o
   where o.tenant_id = p_tenant_id
     and p_tenant_id in (select private.current_user_tenants())
     and o.kitchen_at is not null
     and o.ready_at is null
     and (p_branch_id is null or o.branch_id = p_branch_id)
     and exists (
       select 1 from public.order_items i
        where i.order_id = o.id
          and i.sector_id = p_sector_id
          and i.ready_at is null
     )
     and not exists (
       select 1 from public.production_dispatches d
        where d.order_id = o.id
          and d.sector_id = p_sector_id
          and d.printed_at is not null
     )
   order by o.kitchen_at;
$function$;

revoke all on function public.comandas_por_imprimir(uuid, uuid, uuid) from anon;


-- ── 3. Las comandas que ya salieron y todavia no volvieron ─────────────
--
-- Es lo que la comandera muestra en pantalla y lo que el mozo ve en Salon: el
-- papel esta en la cocina y nadie dijo todavia que se entrego.

create or replace function public.comandas_abiertas(
  p_tenant_id uuid,
  p_sector_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  order_id    uuid,
  sector_id   uuid,
  printed_at  timestamptz,
  impresiones integer,
  kitchen_at  timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
  select d.order_id, d.sector_id, d.printed_at, d.impresiones, o.kitchen_at
    from public.production_dispatches d
    join public.orders o on o.id = d.order_id
   where d.tenant_id = p_tenant_id
     and p_tenant_id in (select private.current_user_tenants())
     and d.closed_at is null
     and d.printed_at is not null
     and o.ready_at is null
     and (p_sector_id is null or d.sector_id = p_sector_id)
     and (p_branch_id is null or o.branch_id = p_branch_id)
   order by d.printed_at;
$function$;

revoke all on function public.comandas_abiertas(uuid, uuid, uuid) from anon;


-- ── 4. Anotar que la comanda salio ─────────────────────────────────────
--
-- `p_reimprimir` existe para que una reimpresion sea una DECISION y no un
-- efecto de recargar la pagina. Sin el, la funcion no vuelve a imprimir nada
-- que ya haya salido: dos comandas identicas en el pasaplatos son dos platos
-- cocinados.

create or replace function public.marcar_comanda_impresa(
  p_tenant_id   uuid,
  p_order_id    uuid,
  p_sector_id   uuid,
  p_reimprimir  boolean default false
)
returns public.production_dispatches
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_d public.production_dispatches;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if not exists (
    select 1 from public.orders o
     where o.id = p_order_id and o.tenant_id = p_tenant_id and o.kitchen_at is not null
  ) then
    raise exception 'pedido_no_esta_en_cocina';
  end if;
  if not exists (
    select 1 from public.production_sectors s
     where s.id = p_sector_id and s.tenant_id = p_tenant_id
  ) then
    raise exception 'sector_de_otro_negocio';
  end if;

  insert into public.production_dispatches (tenant_id, order_id, sector_id, printed_at, impresiones)
  values (p_tenant_id, p_order_id, p_sector_id, now(), 1)
  on conflict (order_id, sector_id) do update
     set printed_at  = case when production_dispatches.printed_at is null or p_reimprimir
                            then now() else production_dispatches.printed_at end,
         impresiones = case when production_dispatches.printed_at is null or p_reimprimir
                            then production_dispatches.impresiones + 1
                            else production_dispatches.impresiones end
  returning * into v_d;

  return v_d;
end $function$;

revoke all on function public.marcar_comanda_impresa(uuid, uuid, uuid, boolean) from anon;


-- ── 5. Cerrar, entero o por sector ─────────────────────────────────────
--
-- Se reemplaza la version de dos argumentos en vez de agregar una tercera:
-- con las dos vivas, una llamada de dos argumentos queda ambigua y falla en
-- runtime, no al desplegar.

drop function if exists public.cerrar_ticket_de_cocina(uuid, uuid);

create or replace function public.cerrar_ticket_de_cocina(
  p_tenant_id uuid,
  p_order_id  uuid,
  p_sector_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_o        public.orders;
  v_pendiente integer;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;

  select * into v_o from public.orders o
   where o.id = p_order_id and o.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'pedido_de_otro_negocio';
  end if;
  if v_o.kitchen_at is null then
    raise exception 'pedido_no_esta_en_cocina';
  end if;
  if v_o.ready_at is not null then
    return v_o;
  end if;

  update public.order_items
     set ready_at = now()
   where order_id = v_o.id
     and ready_at is null
     and (p_sector_id is null or sector_id = p_sector_id);

  -- La comanda de papel se cierra con el sector: es la misma accion vista
  -- desde el otro lado del mostrador.
  if p_sector_id is not null then
    insert into public.production_dispatches (tenant_id, order_id, sector_id, closed_at, closed_by)
    values (p_tenant_id, p_order_id, p_sector_id, now(), auth.uid())
    on conflict (order_id, sector_id) do update
       set closed_at = coalesce(production_dispatches.closed_at, now()),
           closed_by = coalesce(production_dispatches.closed_by, auth.uid());
  end if;

  select count(*) into v_pendiente
    from public.order_items
   where order_id = v_o.id and ready_at is null;

  -- El pedido se sella cuando no queda NADA pendiente, lo haya cerrado la
  -- cocina desde su pantalla o el mozo desde el salon.
  if v_pendiente = 0 then
    update public.orders
       set ready_at = now(),
           status = case when status = 'preparing' then 'active' else status end
     where id = v_o.id
    returning * into v_o;

    update public.production_dispatches
       set closed_at = coalesce(closed_at, now())
     where order_id = v_o.id and closed_at is null;
  end if;

  return v_o;
end $function$;

revoke all on function public.cerrar_ticket_de_cocina(uuid, uuid, uuid) from anon;
