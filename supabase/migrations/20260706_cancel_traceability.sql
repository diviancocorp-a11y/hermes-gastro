-- 20260706_cancel_traceability.sql
-- Trazabilidad de cancelaciones. Caso Ornela (5/jul/2026): pedido en efectivo
-- cancelado sin rastro de quien/cuando -> diagnostico de horas para algo que
-- deberia leerse en una columna.
--
--   cancelled_by: 'customer' (boton arrepentimiento) | 'admin' (panel) | 'auto' (cron MP)
--   cancelled_at: momento de la cancelacion
--
-- Aplicado por MCP en LNP y Mala Miga el 6/jul/2026. COCHI PENDIENTE: el
-- proyecto esta pausado (limite de 2 proyectos activos del plan free de
-- Supabase) — aplicar al reactivarlo, junto con el deploy de cancel-order.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancelled_by_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'admin', 'auto'));

-- Trigger de autoria: cualquier UPDATE que deje la orden en cancelled SIN
-- autoria explicita queda marcado como 'admin' (la unica via autenticada que
-- no la setea: el panel via PostgREST). El RPC del cliente y el cron setean
-- la suya explicitamente. Si mp-webhook resucita una orden auto-cancelada
-- (pago tardio: cancelled -> new), el rastro se limpia.
CREATE OR REPLACE FUNCTION public.set_order_cancel_meta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    NEW.cancelled_by := COALESCE(NEW.cancelled_by, 'admin');
  ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
    NEW.cancelled_by := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_cancel_meta ON public.orders;
CREATE TRIGGER trg_order_cancel_meta
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_cancel_meta();

-- RPC de arrepentimiento (60s): ahora deja autoria 'customer'. Sigue vigente
-- como fallback del front para chunks viejos; la via principal pasa a ser la
-- edge function cancel-order (que ademas avisa al admin por push).
CREATE OR REPLACE FUNCTION public.cancel_own_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
  WHERE id = p_order_id
    AND status = 'new'
    AND created_at > now() - interval '60 seconds';
  RETURN FOUND;
END; $$;

-- Cron de auto-cancelacion MP: ahora deja autoria 'auto'.
SELECT cron.unschedule('mp-autocancel-pending') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mp-autocancel-pending');
SELECT cron.schedule(
  'mp-autocancel-pending',
  '*/5 * * * *',
  $cron$ UPDATE orders
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'auto'
     WHERE status = 'pending_payment'
       AND created_at < now() - interval '30 minutes' $cron$
);
