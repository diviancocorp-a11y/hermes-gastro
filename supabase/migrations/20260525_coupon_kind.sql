-- ─────────────────────────────────────────────────────────────────────
-- 20260525_coupon_kind.sql
-- ─────────────────────────────────────────────────────────────────────
-- Agrega kind y label a coupons para soportar varios tipos de promo:
--   · 'percent'    → descuento porcentual (usa discount_pct)
--   · 'twoxone'    → 2x1 en algún producto/grupo (label describe qué)
--   · 'other'      → promo libre descrita en label
--
-- discount_pct queda como antes (NOT NULL DEFAULT 10) para retrocompat.
-- Para kinds que no son percent, discount_pct se ignora en la lógica.
--
-- Aplicar en los 3 proyectos Supabase: LNP, Cochi, Mala Miga.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS label text;

-- Constraint: kind tiene que ser uno de los valores válidos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_kind_check'
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_kind_check
      CHECK (kind IN ('percent', 'twoxone', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.coupons.kind  IS 'Tipo de promo: percent | twoxone | other';
COMMENT ON COLUMN public.coupons.label IS 'Descripción visible del cupón (ej: "2x1 en hamburguesas")';
