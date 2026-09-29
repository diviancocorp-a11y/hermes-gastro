-- 0081: el seguimiento de pedido (/order/:id) en el edificio.
--
-- Hasta hoy /order/:id, la vuelta de MercadoPago (/pago/exitoso) y la card
-- "tu pedido" del catalogo llamaban a get_order_tracker(uuid), una RPC del
-- modelo single-tenant que el edificio nunca tuvo: el seguimiento daba siempre
-- "pedido no encontrado". Esta es la del edificio.
--
-- Mismo patron que get_tip_target (0047): SECURITY DEFINER acotada al negocio
-- del slug, y el order_id es un uuid que solo tiene quien hizo el pedido (lo
-- recibe al confirmar y queda en su lista de pedidos activos). Por eso NO hay
-- busqueda por codigo corto (#ABC123): 6 hex se enumeran, y con eso se leerian
-- pedidos ajenos.
--
-- Devuelve lo minimo para la pantalla:
--   - del cliente, solo el primer nombre (el tracker dice "Hola, Ana"; el
--     telefono, el mail y la direccion no salen de aca).
--   - los items con name_snapshot: el nombre con el que se vendio, aunque el
--     producto despues se renombre o se archive.
--   - whatsapp y store_address del negocio, que las pantallas leian de
--     `settings` con id=1 sin sesion (el 42501 de private.tiene_rol en los logs).
--
-- Sin pedido de ese negocio devuelve null: el front no distingue "no existe"
-- de "es de otro negocio", a proposito.

create or replace function public.get_order_tracker(p_tenant_slug text, p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_t uuid;
  v_o public.orders;
  v_s public.settings;
begin
  select id into v_t from public.tenants where slug = lower(btrim(p_tenant_slug));
  if v_t is null then
    return null;
  end if;

  select * into v_o from public.orders where id = p_order_id and tenant_id = v_t;
  if not found then
    return null;
  end if;

  select * into v_s from public.settings where tenant_id = v_t;

  return jsonb_build_object(
    'id',                  v_o.id,
    'status',              v_o.status,
    'payment_status',      v_o.payment_status,
    'paid_at',             v_o.paid_at,
    'total',               v_o.total,
    'discount',            v_o.discount,
    'delivery',            v_o.delivery,
    'payment',             v_o.payment,
    'is_gift',             v_o.is_gift,
    'note',                v_o.note,
    'created_at',          v_o.created_at,
    'delivery_date',       v_o.delivery_date,
    'ticket_number',       v_o.ticket_number,
    'customer_first_name', nullif(split_part(btrim(coalesce(v_o.customer_name, '')), ' ', 1), ''),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.name_snapshot, 'qty', oi.qty,
        'unit_price', oi.unit_price, 'subtotal', oi.subtotal
      ) order by oi.created_at, oi.id)
      from public.order_items oi
      where oi.order_id = v_o.id and oi.tenant_id = v_t
    ), '[]'::jsonb),
    'whatsapp',            v_s.whatsapp,
    'store_address',       v_s.store_address
  );
end $$;

revoke all on function public.get_order_tracker(text, uuid) from public;
grant execute on function public.get_order_tracker(text, uuid) to anon, authenticated;

comment on function public.get_order_tracker(text, uuid) is
  'Seguimiento publico de un pedido: solo el negocio del slug y solo con el uuid del pedido. Primer nombre, items, estado y contacto del local.';
