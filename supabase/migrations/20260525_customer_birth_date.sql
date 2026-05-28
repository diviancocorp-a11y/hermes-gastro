-- ─────────────────────────────────────────────────────────────────────
-- 20260525_customer_birth_date.sql
-- ─────────────────────────────────────────────────────────────────────
-- Agrega birth_date a la tabla customers para:
--   · Filtrar/segmentar el CRM por rango de edad
--   · Enviar saludos / promos de cumpleaños en el futuro
--   · Reportes demográficos
--
-- El campo es NULLABLE: clientes existentes quedan en NULL hasta que
-- vuelvan a pedir desde el catálogo y completen el dato (opcional).
--
-- Aplicar en los 3 proyectos Supabase: LNP, Cochi, Mala Miga.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.customers.birth_date IS
  'Fecha de nacimiento del cliente (opcional). Capturada en el checkout del catálogo.';

-- Índice opcional para filtros de edad rápidos en el CRM
CREATE INDEX IF NOT EXISTS idx_customers_birth_date
  ON public.customers (birth_date)
  WHERE birth_date IS NOT NULL;
