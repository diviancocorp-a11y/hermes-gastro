-- 20260614_mp_autocancel_pending_payment.sql
-- Auto-cancelacion de ordenes de MercadoPago que quedaron esperando el pago.
--
-- Contexto (flujo pending_payment, jun/2026):
--   - submit-order crea las ordenes pagadas con MercadoPago como
--     `pending_payment` (invisibles en el panel del admin: todavia no hay plata).
--   - mp-webhook las pasa a `new` (entran al panel) recien al aprobarse el pago,
--     y dispara el push "Nuevo pedido".
--   - Si el cliente abandona el checkout de MP, la orden quedaria colgada en
--     pending_payment para siempre. Este cron la cancela a los 30 min.
--
-- Por que se reusa el estado `cancelled` (y no uno nuevo tipo payment_expired):
--   - queda excluida de "pedidos activos" (useFinancials filtra new/preparing/active),
--   - queda excluida del conteo de ordenes (prevMonthOrdersCount excluye cancelled),
--   - nunca se convierte en venta (la venta vive en la tabla `sales`, no en `orders`).
--   Un pago TARDIO posterior al auto-cancel lo recupera mp-webhook: promueve a
--   `new` si la orden esta en `cancelled` con paid_at NULL (solo posible para una
--   MP auto-expirada, ya que el admin no puede cancelar a mano lo que no ve).
--
-- Corre cada 5 min (granularidad de pg_cron). No usa pg_net: es UPDATE directo.
-- Aplicado por MCP en los 3 tenants (LNP / Cochi / Mala Miga) el 14/jun/2026.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('mp-autocancel-pending') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mp-autocancel-pending');
SELECT cron.schedule(
  'mp-autocancel-pending',
  '*/5 * * * *',
  $$ UPDATE orders
       SET status = 'cancelled'
     WHERE status = 'pending_payment'
       AND created_at < now() - interval '30 minutes' $$
);
