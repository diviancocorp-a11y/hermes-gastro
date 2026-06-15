-- 20260614_get_order_tracker_payment_status.sql
-- Agrega payment_status y paid_at al RPC get_order_tracker (anon-safe).
--
-- Motivo: la pantalla de retorno de MercadoPago (/pago/exitoso) reconstruye la
-- confirmacion del pedido via este RPC. Sin payment_status no podia distinguir
-- "pago aprobado" de "todavia esperando el webhook" -> mostraba "confirmado"
-- aunque el pago no hubiera entrado. Ahora el front decide:
--   confirmado  = payment_status='approved' OR status promovido (!= pending_payment)
--   verificando = pending_payment / in_process / pending  (auto-poll)
--   rechazado   = payment_status in (rejected, cancelled) OR status='cancelled'
--
-- Se aplica a los 3 tenants (la-nona-pato, cochi, mala-miga).

DROP FUNCTION IF EXISTS public.get_order_tracker(uuid);
CREATE FUNCTION public.get_order_tracker(p_order_id uuid)
RETURNS TABLE(
  id uuid, status text, payment_status text, paid_at timestamptz,
  total numeric, discount numeric,
  delivery text, payment text, is_gift boolean,
  created_at timestamptz, date date, delivery_date date,
  customer text, customer_first_name text, note text,
  items jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.status, o.payment_status, o.paid_at, o.total, o.discount,
    o.delivery, o.payment, o.is_gift,
    o.created_at, o.date, o.delivery_date,
    o.customer,
    split_part(COALESCE(o.customer,''),' ',1)::text AS customer_first_name,
    o.note,
    (SELECT jsonb_agg(jsonb_build_object(
       'name', r.name, 'qty', oi.qty, 'unit_price', oi.unit_price, 'subtotal', oi.subtotal
     ))
     FROM order_items oi JOIN recipes r ON r.id = oi.recipe_id
     WHERE oi.order_id = o.id) AS items
  FROM orders o WHERE o.id = p_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.get_order_tracker(uuid) TO anon, authenticated;
