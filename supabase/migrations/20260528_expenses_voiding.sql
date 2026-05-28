-- Anulación de gastos (reverse entry / asiento de reversión)
-- Patrón contable estándar: nunca borrar, se crea una fila opuesta
-- que cancela el original. Audit trail completo.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by text,
  ADD COLUMN IF NOT EXISTS voids_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_reason text;

CREATE INDEX IF NOT EXISTS idx_expenses_voids_expense_id ON public.expenses(voids_expense_id);
CREATE INDEX IF NOT EXISTS idx_expenses_voided_at ON public.expenses(voided_at) WHERE voided_at IS NOT NULL;

COMMENT ON COLUMN public.expenses.voided_at IS 'Fecha/hora de anulacion. Si esta set, este gasto fue anulado y existe una fila de reversion apuntando a este id via voids_expense_id.';
COMMENT ON COLUMN public.expenses.voided_by IS 'Email del usuario que ejecuto la anulacion.';
COMMENT ON COLUMN public.expenses.voids_expense_id IS 'Si esta fila ES la reversion de otro gasto, apunta al original. Su amount es negativo del original.';
COMMENT ON COLUMN public.expenses.voided_reason IS 'Motivo opcional de la anulacion.';
