-- 0103 La venta descuenta el stock de lo que uso.
-- Sin aplicar: espera el ok de Ricky (va por MCP apply_migration, es aditiva).
--
-- ══════════════════ LO QUE ESTABA ROTO ══════════════════
--
-- El libro de inventario (0042) acepta kind 'sale' y lo leen 0071
-- (`consumo_diario_de_insumos`) y el panel, pero NADIE lo escribia: ni
-- `complete_order` (0032/0050), ni la edge function submit-order, ni el
-- front. Verificado el 19/oct/2026 contra la base: 0 movimientos 'sale' en
-- todo el edificio. El stock solo se movia por compra, merma y ajuste, y la
-- landing prometia "el stock baja con cada venta".
--
-- ══════════════════ DONDE SE DESCUENTA ══════════════════
--
-- Al completar el pedido, dentro de `complete_order`: es el momento que ya
-- congela el costo, la unica puerta a 'completed' (los demas estados son un
-- update pelado y ninguno llega ahi) y corre en la misma transaccion que las
-- ventas. Si el descuento falla, el pedido no se completa a medias.
--
-- No en submit-order: un pedido que se cancela despues no consumio nada, y
-- devolver stock al cancelar seria un segundo asiento para corregir el primero.
--
-- ══════════════════ QUE SE DESCUENTA ══════════════════
--
-- Gastro (producto con receta): por cada insumo, la suma de
--   cantidad vendida x cantidad de la receta
-- sobre todos los items del pedido. Un asiento por insumo y por pedido, no
-- por item: dos hamburguesas y un pancho que usan pan dan UN movimiento de
-- pan, que es lo que se lee en el libro.
--   - libro: movimiento 'sale' con qty negativa, sucursal del pedido,
--     reference_type 'order' y el costo del insumo al momento.
--   - `ingredients.stock` (lo que lee el panel y la alerta de stock bajo,
--     `stockBajo` en src/modules/dico/reglas.js) baja lo mismo, con piso en
--     0 igual que `register_waste` (0098). El libro no tiene piso: vender sin
--     stock cargado deja el saldo negativo, que es la verdad.
--
-- Comercio (producto SIN receta y con `products.stock` cargado): baja
-- `products.stock`, con piso en 0. No entra al libro porque el libro no tiene
-- columna de producto (solo insumo o variante) y `order_items` no guarda la
-- variante vendida; sumar las dos cosas es otra migracion. Por eso en
-- comercio el descuento no es por sucursal todavia.
--
-- ══════════════════ UNA VEZ Y NADA MAS ══════════════════
--
-- 1. `complete_order` ya corta un segundo intento ('ya_completado',
--    'ya_tiene_ventas') con el pedido bloqueado por `for update`.
-- 2. El asiento del libro usa el id del pedido como `client_request_id`: el
--    indice unico de 0042 (tenant, client_request_id, kind, insumo) hace que
--    el mismo insumo no se descuente dos veces por el mismo pedido, aunque
--    alguien llame a la funcion de nuevo. `ingredients.stock` baja solo por
--    las filas que el insert realmente escribio.
-- 3. Si el pedido ya tiene asientos 'sale', la funcion sale sin tocar nada.
--    El descuento de comercio no deja asiento, asi que en un pedido SOLO de
--    comercio la unica barrera es la 1: por eso la funcion no se expone.
--
-- La funcion nueva es SECURITY DEFINER y no la ejecuta nadie desde el front
-- (revoke de public, anon y authenticated): la unica puerta es
-- `complete_order`, que ya chequea negocio y rol.

create or replace function public.descontar_stock_del_pedido(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_order     public.orders;
  v_branch    uuid;
  v_asentados integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0002';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'pedido_no_completado';
  end if;

  if exists (select 1 from public.inventory_movements m
              where m.tenant_id = v_order.tenant_id
                and m.reference_type = 'order'
                and m.reference_id = v_order.id
                and m.kind = 'sale') then
    return 0;
  end if;

  v_branch := coalesce(v_order.branch_id,
                       (select b.id from public.branches b
                         where b.tenant_id = v_order.tenant_id and b.is_default));

  -- Gastro: lo que la receta dice que se uso.
  with consumo as (
    select pi.ingredient_id, sum(oi.qty * pi.qty) as cantidad
      from public.order_items oi
      join public.product_ingredients pi
        on pi.product_id = oi.product_id
       and pi.tenant_id = v_order.tenant_id
     where oi.order_id = v_order.id
       and oi.qty > 0
       and pi.qty > 0
     group by pi.ingredient_id
  ),
  asentados as (
    insert into public.inventory_movements (
      tenant_id, branch_id, ingredient_id, kind, qty, unit_cost,
      reference_type, reference_id, client_request_id, created_by
    )
    select v_order.tenant_id, v_branch, c.ingredient_id, 'sale', -c.cantidad,
           i.cost, 'order', v_order.id, v_order.id, auth.uid()
      from consumo c
      join public.ingredients i
        on i.id = c.ingredient_id and i.tenant_id = v_order.tenant_id
    on conflict (tenant_id, client_request_id, kind, (coalesce(ingredient_id, variant_id)))
      where client_request_id is not null
      do nothing
    returning ingredient_id, qty
  ),
  bajados as (
    update public.ingredients i
       set stock = greatest(0, coalesce(i.stock, 0) + a.qty)
      from asentados a
     where i.id = a.ingredient_id
    returning i.id
  )
  select count(*) into v_asentados from bajados;

  -- Comercio: el articulo mismo, si no tiene receta y tiene stock cargado.
  update public.products p
     set stock = greatest(0, p.stock - v.cantidad)
    from (
      select oi.product_id, sum(oi.qty) as cantidad
        from public.order_items oi
       where oi.order_id = v_order.id
         and oi.qty > 0
       group by oi.product_id
    ) v
   where p.id = v.product_id
     and p.tenant_id = v_order.tenant_id
     and p.stock is not null
     and not exists (select 1 from public.product_ingredients pi
                      where pi.product_id = p.id and pi.qty > 0);

  return v_asentados;
end;
$function$;

revoke all on function public.descontar_stock_del_pedido(uuid)
  from public, anon, authenticated;

comment on function public.descontar_stock_del_pedido(uuid) is
  '0103: asienta en el libro (kind sale) lo que la receta del pedido uso y baja el stock. Idempotente por pedido. Solo la llama complete_order.';


-- complete_order: igual que 0050, mas el descuento entre el cambio de estado
-- y el asiento de las ventas. Misma firma: create or replace conserva los
-- permisos (authenticated y service_role ejecutan, anon no, 0076).
create or replace function public.complete_order(p_order_id uuid)
returns setof public.sales
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_order public.orders;
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

  update public.orders set status = 'completed' where id = v_order.id;

  -- 0103: lo vendido sale del stock, en la misma transaccion.
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
    tenant_id, date, recipe_id, qty, unit_price, unit_cost, total,
    order_id, payment_method
  )
  select v_order.tenant_id, current_date, it.product_id, it.qty,
         it.unit_price, it.unit_cost, it.total,
         v_order.id, v_order.payment
    from items it
  returning *;
end;
$function$;
