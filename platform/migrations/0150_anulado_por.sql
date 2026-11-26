-- PENDIENTE de aplicar (la aplica el director via MCP con ok de Ricky).
--
-- 0150: marca de seguimiento de un pedido anulado.
--
-- La 0149 guarda `cancelled_by` (un uuid) y el motivo, y la tarjeta solo
-- mostraba "Anulado: <motivo>". Para saber QUIEN anulo hacia falta cruzar
-- profiles, auth.users y tenant_members, y esos datos cambian: la persona
-- puede renombrarse, cambiar de rol o ser dada de baja.
--
-- Por eso la marca es una FOTO del momento y vive en el pedido:
--   cancelled_by_name   nombre al anular (profiles.full_name, profiles.name,
--                       o lo que va antes de la @ del correo)
--   cancelled_by_email  correo canonico (auth.users.email)
--   cancelled_by_role   el rol de mayor jerarquia en ese negocio, en espanol
--
-- `anular_pedido` mantiene firma y forma del retorno (sumo la clave
-- `anulado_por`, que el front viejo ignora): es compatible, create or replace
-- sin drop. El cuerpo es el de la 0149 salvo el calculo de la marca y el
-- update final del pedido.
--
-- Backfill: los pedidos ya anulados con `cancelled_by` y sin nombre (hoy uno,
-- en Cochi) se completan con el mismo criterio. Una anulacion manual vieja,
-- sin `cancelled_by`, queda sin marca y la pantalla muestra solo el motivo.

alter table public.orders
  add column if not exists cancelled_by_name text,
  add column if not exists cancelled_by_email text,
  add column if not exists cancelled_by_role text;

comment on column public.orders.cancelled_by_name is
  'Foto del momento de la anulacion (0150): el nombre de quien anulo. No se actualiza si la persona cambia de nombre o la dan de baja.';
comment on column public.orders.cancelled_by_email is
  'Foto del momento de la anulacion (0150): el correo de quien anulo.';
comment on column public.orders.cancelled_by_role is
  'Foto del momento de la anulacion (0150): el rol de mayor jerarquia de quien anulo en ese negocio (Dueño, Encargado...).';

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
  'Anula un pedido completado (solo owner/manager): compensa el stock con movimientos return, borra payments y sales (Ventas y resultado_del_dia suman sales sin mirar el estado; el delete de payments queda en auditoria por trg_auditar), libera el cupon y marca el pedido cancelled con motivo y deja la marca de seguimiento: quien (nombre, correo, rol), cuando y por que. 0149 y 0150.';

revoke all on function public.anular_pedido(uuid, text) from public, anon;
grant execute on function public.anular_pedido(uuid, text) to authenticated;

-- ── Backfill: anulaciones ya hechas con cancelled_by y sin marca ──
update public.orders o
   set cancelled_by_name = m.nombre,
       cancelled_by_email = m.correo,
       cancelled_by_role = m.rol
  from (
    select o2.id,
           coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''),
                    split_part(u.email, '@', 1)) as nombre,
           coalesce(u.email, p.email) as correo,
           (select case x.rol
                     when 'owner'      then 'Dueño'
                     when 'manager'    then 'Encargado'
                     when 'cashier'    then 'Cajero'
                     when 'attendant'  then 'Mozo'
                     when 'kitchen'    then 'Cocina'
                     when 'marketer'   then 'Marketing'
                     when 'accountant' then 'Contador'
                     when 'staff'      then 'Equipo'
                     else x.rol
                   end
              from public.tenant_members tm
              cross join lateral unnest(
                case when coalesce(array_length(tm.roles, 1), 0) > 0
                     then tm.roles else array[tm.role] end) as x(rol)
             where tm.tenant_id = o2.tenant_id
               and tm.user_id = o2.cancelled_by
             order by array_position(
               array['owner','manager','cashier','attendant','kitchen','marketer','accountant'], x.rol)
             limit 1) as rol
      from public.orders o2
      left join auth.users u on u.id = o2.cancelled_by
      left join public.profiles p on p.id = o2.cancelled_by
     where o2.cancelled_by is not null
       and o2.cancelled_by_name is null
  ) m
 where o.id = m.id;
