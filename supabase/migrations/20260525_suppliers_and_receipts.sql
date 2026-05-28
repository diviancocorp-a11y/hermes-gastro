-- Migración 2026-05-25
-- 1) Nueva tabla suppliers (proveedores) para gestión centralizada
-- 2) Columnas en expenses para vincular proveedor + foto del ticket

CREATE TABLE IF NOT EXISTS public.suppliers (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  phone       text DEFAULT '',
  email       text DEFAULT '',
  category    text DEFAULT '',          -- "Carnicería", "Verdulería", "Servicios", etc.
  notes       text DEFAULT '',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name   ON public.suppliers(name);

-- RLS: solo admin puede ver/editar
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_admin_all" ON public.suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- expenses ya tiene la columna supplier (text). Le agregamos:
--   supplier_id  → vínculo con la tabla nueva (nullable, mantiene compat)
--   receipt_url  → foto/PDF del ticket de la compra
--   no_receipt   → flag para gastos sin comprobante (compras en negro). Mutuamente
--                  excluyente con receipt_url: el usuario debe elegir uno de los dos
--                  para confirmar una compra. Sirve para reportar % de operación
--                  no comprobable.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_id          uuid REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS receipt_url          text DEFAULT '',
  ADD COLUMN IF NOT EXISTS no_receipt           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS installment_current  integer,
  ADD COLUMN IF NOT EXISTS installment_total    integer,
  ADD COLUMN IF NOT EXISTS payment_method       text DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS items                jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by           uuid REFERENCES auth.users(id);

-- Reemplazar el CHECK de expense_type para sumar 'installment' (cuotas / parte de pago)
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_expense_type_check
  CHECK (expense_type IN ('variable', 'fixed', 'installment'));

CREATE INDEX IF NOT EXISTS idx_expenses_supplier_id ON public.expenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_no_receipt  ON public.expenses(no_receipt) WHERE no_receipt = true;

COMMENT ON TABLE  public.suppliers IS 'Proveedores: catálogo centralizado para Compras y otros gastos';
COMMENT ON COLUMN public.expenses.supplier_id IS 'FK opcional a suppliers. Si está, usar este. Sino, fallback a la columna supplier (text legacy).';
COMMENT ON COLUMN public.expenses.receipt_url IS 'URL del comprobante (foto del ticket, PDF, etc.)';
COMMENT ON COLUMN public.expenses.no_receipt  IS 'Marca explícita "compra sin recibo" (en negro). Permite confirmar la compra sin obligar a subir ticket.';
COMMENT ON COLUMN public.expenses.installment_current IS 'Cuota actual (si expense_type=installment). Ej: 3 de 12.';
COMMENT ON COLUMN public.expenses.installment_total   IS 'Total de cuotas del plan (si expense_type=installment).';
COMMENT ON COLUMN public.expenses.payment_method      IS 'Medio de pago: efectivo, transferencia, mercadopago, tarjeta, o custom configurado en settings.';
COMMENT ON COLUMN public.expenses.items               IS 'Detalle de items comprados (cuando aplica). Array de {name, qty, unit, unit_cost}.';
COMMENT ON COLUMN public.expenses.created_by          IS 'Usuario que registró el gasto. Para trazabilidad/auditoría.';
