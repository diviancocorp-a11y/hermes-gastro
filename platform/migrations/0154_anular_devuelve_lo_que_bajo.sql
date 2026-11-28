-- PENDIENTE de aplicar (la aplica el director via MCP con ok de Ricky).
--
-- 0154: anular un pedido devuelve lo que la venta bajo, no la cantidad entera.
--
-- ══════════════════ EL BUG ══════════════════
--
-- `descontar_stock_del_pedido` (0104) baja `ingredients.stock` con piso en 0
-- (`greatest(0, stock - cantidad)`) pero asienta en el libro la cantidad
-- COMPLETA (el libro no tiene piso, a proposito). `anular_pedido` (0149/0150)
-- devolvia a la columna la cantidad entera. Si al vender habia menos stock que
-- lo consumido, el piso se comia la diferencia y la anulacion la inventaba:
-- insumo en 0, se vende un plato de 200 g, se anula, queda en 200 g.
-- Lo mismo con productos de comercio (`products.stock`).
--
-- ══════════════════ EL ARREGLO (solo aditivo: expandir) ══════════════════
--
--   inventory_movements.stock_aplicado  lo que el movimiento cambio de verdad
--                                       en ingredients.stock (con signo).
--   order_items.stock_descontado        unidades que la venta bajo de verdad
--                                       de products.stock.
--
-- La venta los llena; la anulacion devuelve eso. Null (ventas anteriores a la
-- 0154) = se asume la cantidad entera, como hasta hoy. Mismas firmas y
-- retornos: create or replace, sin drop. El libro sigue completo: la venta
-- asienta -cantidad y la anulacion +cantidad.

alter table public.inventory_movements
  add column if not exists stock_aplicado numeric;
comment on column public.inventory_movements.stock_aplicado is
  '0154: lo que este movimiento cambio de verdad en ingredients.stock (con signo). Null en movimientos viejos = se asume qty.';

alter table public.order_items
  add column if not exists stock_descontado numeric;
comment on column public.order_items.stock_descontado is
  '0154: unidades que la venta bajo de verdad de products.stock (comercio). Null = se asume qty.';

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
  r           record;
  v_stock_p   numeric;
  v_baja      numeric;
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

  -- 0154: se bloquean los insumos del pedido antes de calcular, asi lo que se
  -- lee como stock es lo que despues baja (dos ventas a la vez no se pisan).
  perform 1
     from public.ingredients i
    where i.tenant_id = v_order.tenant_id
      and i.id in (select pi.ingredient_id
                     from public.order_items oi
                     join public.product_ingredients pi
                       on pi.product_id = oi.product_id
                      and pi.tenant_id = v_order.tenant_id
                    where oi.order_id = v_order.id
                      and oi.qty > 0 and pi.qty > 0)
    order by i.id
      for update;

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
      reference_type, reference_id, client_request_id, created_by,
      stock_aplicado
    )
    select v_order.tenant_id, v_branch, c.ingredient_id, 'sale', -c.cantidad,
           i.cost, 'order', v_order.id, v_order.id, auth.uid(),
           -least(greatest(coalesce(i.stock, 0), 0), c.cantidad)
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
  -- 0154: linea por linea y con el producto bloqueado, para guardar en
  -- order_items.stock_descontado lo que de verdad bajo (el piso en 0 se come la
  -- diferencia y anular_pedido tiene que devolver solo eso).
  for r in
    select oi.id as item_id, oi.product_id, oi.qty
      from public.order_items oi
      join public.products p
        on p.id = oi.product_id and p.tenant_id = v_order.tenant_id
     where oi.order_id = v_order.id
       and oi.qty > 0
       and p.stock is not null
       and not exists (select 1 from public.product_ingredients pi
                        where pi.product_id = p.id and pi.qty > 0)
     order by oi.id
  loop
    select p.stock into v_stock_p
      from public.products p
     where p.id = r.product_id
       for update;
    if v_stock_p is null then
      continue;
    end if;
    v_baja := least(greatest(v_stock_p, 0), r.qty);
    update public.products
       set stock = greatest(0, v_stock_p - r.qty)
     where id = r.product_id;
    update public.order_items
       set stock_descontado = v_baja
     where id = r.item_id;
  end loop;

  return v_asentados;
end;
$function$;

revoke all on function public.descontar_stock_del_pedido(uuid)
  from public, anon, authenticated;

comment on function public.descontar_stock_del_pedido(uuid) is
  '0104/0154: asienta en el libro (kind sale) lo que la receta del pedido uso y baja el stock (con piso en 0, guardando lo que bajo de verdad en stock_aplicado / stock_descontado). Idempotente por pedido. Solo la llama complete_order.';

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
  v_cuando      timestamptz := now();
  v_nombre      text;
  v_correo      text;
  v_rol         text;
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

  -- ── Marca de seguimiento: foto de quien anula, tomada ahora ──
  -- Se guarda en el pedido y no se calcula al leer: si despues el usuario
  -- cambia de nombre, de rol o lo dan de baja, la marca no cambia.
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''),
                  split_part(u.email, '@', 1)),
         coalesce(u.email, p.email)
    into v_nombre, v_correo
    from (select auth.uid() as id) s
    left join auth.users u on u.id = s.id
    left join public.profiles p on p.id = s.id;

  select case r.rol
           when 'owner'      then 'Dueño'
           when 'manager'    then 'Encargado'
           when 'cashier'    then 'Cajero'
           when 'attendant'  then 'Mozo'
           when 'kitchen'    then 'Cocina'
           when 'marketer'   then 'Marketing'
           when 'accountant' then 'Contador'
           when 'staff'      then 'Equipo'
           else r.rol
         end
    into v_rol
    from (
      select x.rol
        from public.tenant_members tm
        cross join lateral unnest(
          case when coalesce(array_length(tm.roles, 1), 0) > 0
               then tm.roles else array[tm.role] end) as x(rol)
       where tm.tenant_id = v_order.tenant_id
         and tm.user_id = auth.uid()
       order by array_position(
         array['owner','manager','cashier','attendant','kitchen','marketer','accountant'], x.rol)
       limit 1
    ) r;

  v_branch := coalesce(v_order.branch_id,
                       (select b.id from public.branches b
                         where b.tenant_id = v_order.tenant_id and b.is_default));

  -- ── 1. Stock: compensar lo que bajo 0104 ──
  -- 0154: se devuelve lo que la venta bajo DE VERDAD (stock_aplicado /
  -- stock_descontado), no la cantidad entera: con el piso en 0 la anulacion
  -- inventaba stock. Sin dato (ventas viejas) se asume la cantidad entera.
  with devueltos as (
    insert into public.inventory_movements (
      tenant_id, branch_id, ingredient_id, variant_id, kind, qty, unit_cost,
      reference_type, reference_id, client_request_id, created_by,
      stock_aplicado
    )
    select m.tenant_id, m.branch_id, m.ingredient_id, m.variant_id, 'return',
           -m.qty, m.unit_cost, 'order', v_order.id, v_order.id, auth.uid(),
           -coalesce(m.stock_aplicado, m.qty)
      from public.inventory_movements m
     where m.tenant_id = v_order.tenant_id
       and m.reference_type = 'order'
       and m.reference_id = v_order.id
       and m.kind = 'sale'
    on conflict (tenant_id, client_request_id, kind, (coalesce(ingredient_id, variant_id)))
      where client_request_id is not null
      do nothing
    returning ingredient_id, qty, stock_aplicado
  ),
  repuestos as (
    update public.ingredients i
       set stock = coalesce(i.stock, 0) + coalesce(d.stock_aplicado, d.qty)
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
      select oi.product_id, sum(coalesce(oi.stock_descontado, oi.qty)) as cantidad
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
         cancelled_at = v_cuando,
         cancelled_by = auth.uid(),
         cancel_reason = v_motivo,
         cancelled_by_name = v_nombre,
         cancelled_by_email = v_correo,
         cancelled_by_role = v_rol
   where id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'ventas', v_n_ventas,
    'total_ventas', v_total,
    'pagos', jsonb_array_length(v_pagos),
    'stock_devuelto', v_stock_dev,
    'anulado_por', jsonb_build_object(
      'nombre', v_nombre, 'correo', v_correo, 'rol', v_rol, 'cuando', v_cuando)
  );
end;
$function$;

comment on function public.anular_pedido(uuid, text) is
  'Anula un pedido completado (solo owner/manager): compensa el stock con movimientos return por lo que la venta bajo de verdad (0154), borra payments y sales (Ventas y resultado_del_dia suman sales sin mirar el estado; el delete de payments queda en auditoria por trg_auditar), libera el cupon y marca el pedido cancelled con motivo y deja la marca de seguimiento: quien (nombre, correo, rol), cuando y por que. 0149, 0150 y 0154.';

revoke all on function public.anular_pedido(uuid, text) from public, anon;
grant execute on function public.anular_pedido(uuid, text) to authenticated;
