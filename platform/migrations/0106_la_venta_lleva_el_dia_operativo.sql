-- 0106 La venta lleva el dia operativo y la sucursal del pedido, no la fecha UTC.
-- Aplicada via MCP el 20/oct/2026 (schema_migrations 20261020134800,
-- `la_venta_lleva_el_dia_operativo`), con el ok de Ricky. Tests contra lo
-- desplegado: platform/tests/venta_dia_operativo.sql -> 7/7 ok (antes de
-- aplicar daba 3/7) y venta_descuenta_stock.sql (0104) -> OK.
--
-- ══════════════════ LO QUE ESTABA ROTO ══════════════════
--
-- `complete_order` (0032, 0050, 0104) asienta `sales.date = current_date`, y
-- la sesion de Postgres corre en UTC. Una venta completada a las 22 hs de
-- Buenos Aires queda con la fecha del dia siguiente. El resumen del mes
-- (src/components/admin/MonthSummary.jsx) filtra por `sales.date`: la venta
-- de la noche del ultimo dia del mes cuenta en el mes que viene.
--
-- El resultado del dia (0103) ya corta por `business_date(sucursal,
-- created_at)`, y Ricky confirmo el 20/oct/2026 que la venta cuenta el dia en
-- que se completo el pedido. Las dos vistas tienen que dar lo mismo.
--
-- Medido el 20/oct/2026 contra la base: de las 3 filas de `sales` del
-- edificio (todas de crazy-miga), ninguna tiene la fecha corrida por UTC. Las
-- 3 difieren de `business_date(branch_id, created_at)` porque son una carga a
-- mano del 13/oct de pedidos del 10/oct: ahi `date` es la fecha real y
-- `created_at` es la hora de la carga. Esta migracion no toca datos.
--
-- ══════════════════ EL CAMBIO ══════════════════
--
-- 1. `current_date` pasa a ser la jornada de la sucursal del pedido en el
--    momento de completarlo,
--      business_date(v_order.branch_id, now())
--    que aplica la zona y la hora de corte (0041). `now()` es el inicio de la
--    transaccion, el mismo instante que toma `sales.created_at` por default,
--    asi que `date` y `created_at` quedan en el mismo dia operativo.
--
--    Si el pedido no tuviera sucursal (hoy no hay ninguno: todos la tienen
--    por el trigger `completar_sucursal`), cae a la sucursal default del
--    negocio y, en ultima instancia, a `current_date`: `sales.date` es NOT
--    NULL y una venta no puede dejar de asentarse por esto.
--
-- 2. La venta queda en la sucursal del pedido (`branch_id`). Hasta ahora el
--    insert no la pasaba y el trigger `completar_sucursal` ponia la default:
--    en un negocio con dos sucursales, la venta de la segunda no aparecia en
--    su resultado del dia (0103 filtra por `sales.branch_id`) y su fecha se
--    calculaba con la zona de otra. Hoy ningun negocio tiene mas de una
--    sucursal, asi que no cambia nada de lo ya asentado. Si el pedido no
--    tiene sucursal, el trigger sigue poniendo la default como antes.
--
-- El resto es la 0104 tal cual (cuerpo copiado de pg_get_functiondef el
-- 20/oct), incluido el descuento de stock. Misma firma: create or replace
-- conserva los permisos (authenticated y service_role ejecutan, anon no, 0076)
-- y no deja una segunda firma viva.

create or replace function public.complete_order(p_order_id uuid)
returns setof public.sales
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_order public.orders;
  v_dia   date;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0002';
  end if;

  -- Antes lo hacia la RLS. Ahora que la funcion es definer, se dice a mano.
  if v_order.tenant_id not in (select private.current_user_tenants()) then
    raise exception 'pedido_no_encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_order.tenant_id,
                           array['owner','manager','cashier','attendant']) then
    raise exception 'sin_permiso';
  end if;

  if v_order.status = 'completed' then
    raise exception 'ya_completado';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'pedido_cancelado';
  end if;
  if exists (select 1 from public.sales s where s.order_id = v_order.id) then
    raise exception 'ya_tiene_ventas';
  end if;

  -- 0106: la jornada de la sucursal, no la fecha UTC.
  v_dia := coalesce(public.business_date(v_order.branch_id, now()),
                    public.business_date_tenant(v_order.tenant_id, now()),
                    current_date);

  update public.orders set status = 'completed' where id = v_order.id;

  -- 0104: lo vendido sale del stock, en la misma transaccion.
  perform public.descontar_stock_del_pedido(v_order.id);

  return query
  with costos as (
    select pi.product_id, sum(pi.qty * coalesce(i.cost, 0)) as unit_cost
      from public.product_ingredients pi
      join public.ingredients i on i.id = pi.ingredient_id
     where pi.tenant_id = v_order.tenant_id
     group by pi.product_id
  ),
  items as (
    select oi.id,
           oi.product_id,
           oi.qty,
           oi.unit_price,
           case when oi.unit_cost > 0 then oi.unit_cost
                else coalesce(c.unit_cost, 0) end as unit_cost,
           coalesce(oi.subtotal, oi.qty * oi.unit_price) as total
      from public.order_items oi
      left join costos c on c.product_id = oi.product_id
     where oi.order_id = v_order.id
  ),
  actualizados as (
    update public.order_items oi
       set unit_cost = it.unit_cost
      from items it
     where oi.id = it.id
       and oi.unit_cost is distinct from it.unit_cost
    returning oi.id
  )
  insert into public.sales (
    tenant_id, branch_id, date, recipe_id, qty, unit_price, unit_cost, total,
    order_id, payment_method
  )
  select v_order.tenant_id, v_order.branch_id, v_dia, it.product_id, it.qty,
         it.unit_price, it.unit_cost, it.total,
         v_order.id, v_order.payment
    from items it
  returning *;
end;
$function$;
