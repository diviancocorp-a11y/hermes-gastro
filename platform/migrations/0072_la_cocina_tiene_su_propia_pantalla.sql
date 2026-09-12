-- 0072 - La cocina tiene su propia pantalla.
--
-- QUE ES EL KDS Y QUE NO
-- La pantalla de Pedidos es administrativa: llega un pedido del catalogo, se
-- aprueba o se rechaza, se cobra, se cancela. El KDS es otra cosa: recibe
-- SOLO lo que hay que producir, y lo unico que se hace ahi es marcar platos y
-- cerrar tickets. Las dos conviven y no comparten ni una accion.
--
-- La frontera entre las dos es `kitchen_at`: un pedido baja a cocina cuando
-- alguien lo aprueba, y recien ahi aparece en el KDS.
--
-- EL CRONOMETRO CUENTA DESDE QUE BAJO A COCINA, NO DESDE QUE ENTRO EL PEDIDO
-- Es la razon de ser de `kitchen_at`. Un pedido programado para las 21:00 que
-- se carga a las 19:00 no lleva dos horas de demora: lleva los minutos que
-- pasaron desde que la comanda bajo. Con `created_at` los tres colores del
-- diseño —en tiempo, atencion, demorado— marcarian rojo desde el primer
-- segundo en cualquier pedido programado, que es el caso mas comun del
-- servicio de noche.
--
-- EL PLATO SE MARCA DE A UNO
-- "Ticket listo (0/3)" no es un contador decorativo: en una cocina real la
-- milanesa sale antes que el postre, y el que arma la bandeja necesita ver
-- cuanto falta. Por eso el estado vive en el ITEM (`order_items.ready_at`) y
-- el del ticket se deriva de el.

-- ── 1. A que estacion va cada cosa ─────────────────────────────────────
--
-- Texto libre y no un enum: Dico es multi-rubro. "Parrilla" y "Plancha" son
-- de una cocina; una barberia tendria "Sillon 1" y un retail no tendria
-- ninguna. Las estaciones que muestra el KDS se derivan de las que el negocio
-- efectivamente uso, igual que las categorias de productos.
--
-- Vive en el PRODUCTO porque es una propiedad de lo que se produce, no del
-- pedido. El item se la copia al crearse, como ya hace con el nombre: si
-- mañana la milanesa pasa de plancha a parrilla, las comandas viejas tienen
-- que seguir diciendo donde se hicieron.

alter table public.products
  add column if not exists station text;

alter table public.order_items
  add column if not exists station text,
  -- Los modificadores del plato: "a punto", "sin jamon en una". Es lo que
  -- distingue una comanda de un remito, y hasta ahora no habia donde
  -- guardarlo: `orders.note` es del pedido entero y no sirve para decir cual
  -- de las dos milanesas va sin jamon.
  add column if not exists note text,
  add column if not exists ready_at timestamptz;

create index if not exists order_items_pendientes_idx
  on public.order_items (order_id) where ready_at is null;


-- ── 2. Lo que el ticket necesita saber ─────────────────────────────────

alter table public.orders
  -- Cuando bajo a cocina. NULL = todavia no se aprobo y el KDS no lo ve.
  add column if not exists kitchen_at timestamptz,
  -- Cuando quedo listo y paso al pasador.
  add column if not exists ready_at timestamptz,
  -- Comensales. No sale de la capacidad de la mesa: una mesa de 6 puede
  -- tener 2 sentados, y la cocina cocina para los que estan.
  add column if not exists diners integer,
  -- Alergias e intolerancias, en su propio campo y NO dentro de `note`.
  -- El diseño les da una banda roja propia arriba de los platos: mezclarlas
  -- con "traer la cuenta" las haria invisibles justo donde no pueden serlo.
  add column if not exists allergy_note text;

-- El KDS pregunta siempre lo mismo: que hay en cocina de esta sucursal.
create index if not exists orders_en_cocina_idx
  on public.orders (tenant_id, branch_id, kitchen_at)
  where kitchen_at is not null and ready_at is null;


-- ── 3. Bajar un pedido a cocina ────────────────────────────────────────
--
-- Es la aprobacion vista desde la cocina. Idempotente a proposito: si ya
-- bajo, devuelve el pedido sin pisar `kitchen_at`. Aprobar dos veces por un
-- doble click no puede reiniciar el cronometro de una comanda que ya lleva
-- diez minutos.

create or replace function public.bajar_pedido_a_cocina(
  p_tenant_id uuid,
  p_order_id  uuid
)
returns public.orders
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_o public.orders;
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
  if v_o.status = 'cancelled' then
    raise exception 'pedido_cancelado';
  end if;

  if v_o.kitchen_at is not null then
    return v_o;
  end if;

  update public.orders
     set kitchen_at = now(),
         status = 'preparing'
   where id = v_o.id
  returning * into v_o;

  return v_o;
end $function$;

revoke all on function public.bajar_pedido_a_cocina(uuid, uuid) from anon;


-- ── 4. Marcar un plato ─────────────────────────────────────────────────
--
-- `p_listo` va explicito y no alterna: en una pantalla tactil de cocina, con
-- las manos ocupadas, un toque repetido tiene que dar siempre el mismo
-- resultado. Un toggle convierte el segundo toque accidental en "el plato
-- volvio a estar pendiente", que es el error mas caro de la pantalla.

create or replace function public.marcar_plato(
  p_tenant_id uuid,
  p_item_id   uuid,
  p_listo     boolean default true
)
returns public.order_items
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_i public.order_items;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;

  select * into v_i from public.order_items i
   where i.id = p_item_id and i.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'plato_de_otro_negocio';
  end if;

  -- Marcar un plato que ya estaba marcado no le corre la hora: la primera vez
  -- que salio es la que vale para medir cuanto tardo la cocina.
  if p_listo and v_i.ready_at is not null then
    return v_i;
  end if;

  update public.order_items
     set ready_at = case when p_listo then now() else null end
   where id = v_i.id
  returning * into v_i;

  return v_i;
end $function$;

revoke all on function public.marcar_plato(uuid, uuid, boolean) from anon;


-- ── 5. Cerrar el ticket ────────────────────────────────────────────────
--
-- Marca los platos que falten, sella `orders.ready_at` y pasa el pedido a
-- `active`, que en el flujo existente es "listo, esperando salir". El ticket
-- desaparece del KDS y aparece en el pasador.
--
-- Cierra TODO aunque queden platos sin marcar, porque es lo que hace el boton
-- "Todo" del diseño y porque una cocina que ya mando la bandeja no va a
-- volver a tocar la pantalla plato por plato. Los que se marcan aca quedan con
-- la hora del cierre, que es cuando salieron de verdad.

create or replace function public.cerrar_ticket_de_cocina(
  p_tenant_id uuid,
  p_order_id  uuid
)
returns public.orders
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_o public.orders;
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
   where order_id = v_o.id and ready_at is null;

  update public.orders
     set ready_at = now(),
         status = case when status = 'preparing' then 'active' else status end
   where id = v_o.id
  returning * into v_o;

  return v_o;
end $function$;

revoke all on function public.cerrar_ticket_de_cocina(uuid, uuid) from anon;
