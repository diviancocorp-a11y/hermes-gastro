-- 20260611_payment_accounts_scope.sql
-- FASE 1 de unificacion de pagos: Finanzas como UNICA verdad.
--
-- 1. Cada cuenta de settings.payment_accounts gana `scope` (json):
--      'checkout' | 'proveedores' | 'ambos'  (ausente = 'ambos', compat)
--    - El checkout filtra scope != 'proveedores' (CheckoutScreen + submit-order)
--    - Gastos/Compras filtran scope != 'checkout'
-- 2. expenses.payment_account_id: con que cuenta se pago el gasto/compra
--    (NULL = efectivo o data historica). Base para Conciliaciones.
-- 3. settings.catalog_payment_methods y settings.payment_methods quedan
--    DEPRECADOS (sin UI): el checkout ya derivaba todo de payment_accounts.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_account_id text;
COMMENT ON COLUMN public.expenses.payment_account_id IS 'Cuenta de pago (id del jsonb settings.payment_accounts) con la que se pago el gasto/compra. NULL = efectivo o data vieja.';
