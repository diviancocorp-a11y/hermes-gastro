-- PENDIENTE de aplicar (la aplica el director via MCP con ok de Ricky)
--
-- 0149: anular un pedido YA COMPLETADO.
--
-- Hasta hoy el panel ocultaba "Cancelar" para un pedido completado, y pasar
-- `orders.status` a 'cancelled' a mano no revierte nada: la venta (`sales`),
-- el cobro (`payments`) y el descuento de stock (0104) quedan vivos. Un pedido
-- cargado por error, duplicado o de prueba seguia sumando en Ventas, en Caja
-- y en el resultado del dia.
--
-- `anular_pedido(p_order_id, p_motivo)` lo deshace todo en UNA transaccion:
--   1. Stock: por cada movimiento 'sale' del pedido asienta un 'return' de
--      signo contrario (el libro es de solo agregar: no se borra, se
--      compensa) y devuelve el insumo; en comercio repone `products.stock`
--      con el mismo criterio que 0104, al reves.
--   2. Cobros: borra los `payments` del pedido. `cash_session_expected` (0046)
--      suma payments de la sesion, asi que borrarlos es lo que baja la Caja.
--      Si el cobro era de una sesion YA CERRADA, el numero que se guardo al
--      cerrar no cambia: queda una `cash_exceptions` informativa para que el
--      encargado sepa que el cierre y la caja real ya no coinciden. El borrado
--      queda en auditoria por el trigger de `payments` (trg_auditar).
--   3. Ventas: borra las `sales` del pedido. Ventas y `resultado_del_dia`
--      suman `sales` sin mirar el estado del pedido, por eso no alcanza con
--      cambiar el status.
--   4. Cupon: libera el uso (`liberar_cupon`) para que no se gaste por un
--      pedido que ya no existe.
--   5. Marca el pedido: status 'cancelled', cuando, quien y por que.
--
-- No se anula si el pedido tiene una factura vigente: eso pide una nota de
-- credito (ARCA), que el edificio todavia no emite.
--
-- Aditiva: columnas nuevas y una funcion nueva. No rompe al deploy anterior.

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancel_reason text;

comment on column public.orders.cancel_reason is
  'Motivo con el que el duenio o encargado anulo un pedido ya completado (0149).';

create or replace function public.anular_pedido(p_order_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_order       public.orders;
  v_motivo      text := btrim(coalesce(p_motivo, ''));
  v_branch      uuid;
  v_pagos       jsonb;
  v_n_ventas    integer := 0;
  v_total       numeric := 0;
  v_stock_dev   integer := 0;
  v_sesion_cerr uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0002';
  end if;

  if v_order.tenant_id not in (select private.current_user_tenants()) then
    raise exception 'pedido_no_encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_order.tenant_id, array['owner','manager'])
     or not private.alcanza_branch(v_order.tenant_id, v_order.branch_id) then
    raise exception 'sin_permiso';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'ya_anulado';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'no_completado';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 300 then
    raise exception 'falta_motivo';
  end if;

  -- Una factura vigente se anula con nota de credito, que no existe todavia.
  if exists (select 1 from public.fiscal_documents f
              where f.order_id = v_order.id
                and f.related_document_id is null
                and f.status not in ('cancelled', 'rejected')) then
    raise exception 'tiene_factura';
  end if;

  v_branch := coalesce(v_order.branch_id,
                       (select b.id from public.branches b
                         where b.tenant_id = v_order.tenant_id and b.is_default));

  -- ── 1. Stock: compensar lo que bajo 0104 ──
  with devueltos as (
    insert into public.inventory_movements (
      tenant_id, branch_id, ingredient_id, variant_id, kind, qty, unit_cost,
      reference_type, reference_id, client_request_id, created_by
    )
    select m.tenant_id, m.branch_id, m.ingredient_id, m.variant_id, 'return',
           -m.qty, m.unit_cost, 'order', v_order.id, v_order.id, auth.uid()
      from public.inventory_movements m
     where m.tenant_id = v_order.tenant_id
       and m.reference_type = 'order'
       and m.reference_id = v_order.id
       and m.kind = 'sale'
    on conflict (tenant_id, client_request_id, kind, (coalesce(ingredient_id, variant_id)))
      where client_request_id is not null
      do nothing
    returning ingredient_id, qty
  ),
  repuestos as (
    update public.ingredients i
       set stock = coalesce(i.stock, 0) + d.qty
      from devueltos d
     where i.id = d.ingredient_id
    returning i.id
  )
  select count(*) into v_stock_dev from devueltos;

  -- Comercio: el articulo mismo, si no tiene receta y tiene stock cargado
  -- (el criterio de 0104, al reves). No deja asiento en el libro.
  update public.products p
     set stock = p.stock + v.cantidad
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

  -- ── 2. Cobros ──
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'amount', p.amount, 'method_id', p.method_id,
           'cash_session_id', p.cash_session_id, 'paid_at', p.paid_at)), '[]'::jsonb)
    into v_pagos
    from public.payments p
   where p.tenant_id = v_order.tenant_id and p.order_id = v_order.id;

  select s.id into v_sesion_cerr
    from public.payments p
    join public.cash_sessions s on s.id = p.cash_session_id
   where p.tenant_id = v_order.tenant_id
     and p.order_id = v_order.id
     and s.status = 'closed'
   limit 1;

  if v_sesion_cerr is not null and v_branch is not null then
    insert into public.cash_exceptions (
      tenant_id, branch_id, cash_session_id, order_id, kind, severity,
      title, description, context, reported_by
    ) values (
      v_order.tenant_id, v_branch, v_sesion_cerr, v_order.id, 'refund', 'info',
      'Pedido anulado despues del cierre',
      'El cobro era de una caja ya cerrada: el monto guardado al cerrar no cambia.',
      jsonb_build_object('motivo', v_motivo, 'pagos_borrados', v_pagos),
      auth.uid()
    );
  end if;

  delete from public.payments
   where tenant_id = v_order.tenant_id and order_id = v_order.id;

  -- ── 3. Ventas ──
  select count(*), coalesce(sum(s.total), 0) into v_n_ventas, v_total
    from public.sales s
   where s.tenant_id = v_order.tenant_id and s.order_id = v_order.id;

  delete from public.sales
   where tenant_id = v_order.tenant_id and order_id = v_order.id;

  -- ── 4. Cupon: un cupon viejo sin fila de uso no se toca ──
  perform public.liberar_cupon(r.id)
     from public.coupon_redemptions r
    where r.tenant_id = v_order.tenant_id and r.order_id = v_order.id;

  -- ── 5. El pedido ──
  update public.orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_reason = v_motivo
   where id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'ventas', v_n_ventas,
    'total_ventas', v_total,
    'pagos', jsonb_array_length(v_pagos),
    'stock_devuelto', v_stock_dev
  );
end;
$function$;

comment on function public.anular_pedido(uuid, text) is
  'Anula un pedido completado (solo owner/manager): compensa el stock con movimientos return, borra payments y sales (Ventas y resultado_del_dia suman sales sin mirar el estado; el delete de payments queda en auditoria por trg_auditar), libera el cupon y marca el pedido cancelled con motivo. 0149.';

revoke all on function public.anular_pedido(uuid, text) from public, anon;
grant execute on function public.anular_pedido(uuid, text) to authenticated;
