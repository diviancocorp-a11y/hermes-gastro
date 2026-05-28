-- ─────────────────────────────────────────────────────────────────────
-- 20260526_expense_pct_catalog_pm.sql
-- ─────────────────────────────────────────────────────────────────────
-- Agrega settings.expense_pct y settings.catalog_payment_methods.
--
-- expense_pct:
--   % de gastos operativos prorrateados (alquiler, sueldos, servicios)
--   que se SUMA al costo base de cada producto para que la rentabilidad
--   mostrada en Recetas sea más realista. Se complementa con waste_pct.
--   Costo real = costo_base × (1 + waste_pct/100 + expense_pct/100)
--
-- catalog_payment_methods:
--   Subset de payment_methods (master, admin) que se ofrece a los clientes
--   en el checkout público. Si es NULL → se ofrecen TODOS los del master
--   (retrocompat con instalaciones existentes).
--
-- Aplicar en los 3 proyectos Supabase: LNP, Cochi, Mala Miga.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS expense_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catalog_payment_methods jsonb;

COMMENT ON COLUMN public.settings.expense_pct IS
  'Porcentaje de gastos operativos prorrateado al costo de cada producto (0-100)';
COMMENT ON COLUMN public.settings.catalog_payment_methods IS
  'Subset de payment_methods visible en el catálogo público. NULL = todos los del master.';
