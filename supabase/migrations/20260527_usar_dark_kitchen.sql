-- ─────────────────────────────────────────────────────────────────────
-- 20260527_usar_dark_kitchen.sql
-- ─────────────────────────────────────────────────────────────────────
-- Migration Fase A para Hermes Gastro USAR Dark Kitchen.
--
-- Cambios:
--   1. orders          → +delivery_channel, +platform_commission_amt
--   2. ingredients     → +food_category (enum USAR fijo, default 'dry')
--   3. expenses        → +usar_category  (enum USAR fijo, default 'other_opex')
--   4. settings        → +usar_targets    (jsonb con %s objetivo)
--   5. delivery_channels → tabla nueva con seed
--
-- NO se borran columnas viejas (settings.ing_cats / settings.exp_cats).
-- Quedan ahí como dead columns hasta confirmar que el UI nuevo funciona,
-- y se dropean en migration #2.
--
-- Aplicar en los 3 proyectos: LNP, Cochi, Mala Miga.
-- ─────────────────────────────────────────────────────────────────────

-- 1. ORDERS: canal de venta + comisión de plataforma ─────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_channel        text,
  ADD COLUMN IF NOT EXISTS platform_commission_amt numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN public.orders.delivery_channel IS
  'Canal de venta: rappi | pedidosya | ubereats | whatsapp | mostrador | web_own';
COMMENT ON COLUMN public.orders.platform_commission_amt IS
  'Comisión absoluta de la plataforma (Rappi/PYa/etc). Bruto - comisión = neto en caja.';

CREATE INDEX IF NOT EXISTS idx_orders_delivery_channel
  ON public.orders(delivery_channel)
  WHERE delivery_channel IS NOT NULL;

-- 2. INGREDIENTS: food_category USAR (enum fijo, NOT NULL con default) ─
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS food_category text NOT NULL DEFAULT 'dry';

-- CHECK constraint: solo permitir los 6 valores USAR
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ingredients_food_category_check'
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT ingredients_food_category_check
      CHECK (food_category IN ('protein','dairy','vegetable','dry','beverage','packaging'));
  END IF;
END $$;

COMMENT ON COLUMN public.ingredients.food_category IS
  'Categoría USAR fija: protein | dairy | vegetable | dry | beverage | packaging.';

-- 3. EXPENSES: usar_category (enum fijo) ─────────────────────────────
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS usar_category text NOT NULL DEFAULT 'other_opex';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_usar_category_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_usar_category_check
      CHECK (usar_category IN (
        'food_protein','food_dairy','food_vegetable','food_dry','food_beverage',
        'packaging','labor_boh','marketing','commission_delivery',
        'rent','utilities','other_opex'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.expenses.usar_category IS
  'Categoría USAR (modelo unificado dark kitchen).';

-- 4. SETTINGS: targets USAR ──────────────────────────────────────────
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS usar_targets jsonb DEFAULT '{
    "food_cost_pct": 30,
    "packaging_pct": 5,
    "labor_pct": 20,
    "marketing_pct": 5,
    "target_ebitda_pct": 15
  }'::jsonb;

COMMENT ON COLUMN public.settings.usar_targets IS
  'Targets % de referencia (food/packaging/labor/marketing/ebitda) — editables por negocio.';

-- 5. DELIVERY_CHANNELS: tabla nueva ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_channels (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            text UNIQUE NOT NULL,
  label           text NOT NULL,
  commission_pct  numeric(5,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='delivery_channels' AND policyname='dc_admin_all'
  ) THEN
    EXECUTE 'CREATE POLICY "dc_admin_all" ON public.delivery_channels FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='delivery_channels' AND policyname='dc_anon_read'
  ) THEN
    EXECUTE 'CREATE POLICY "dc_anon_read" ON public.delivery_channels FOR SELECT TO anon USING (is_active = true)';
  END IF;
END $$;

COMMENT ON TABLE public.delivery_channels IS
  'Canales de venta del negocio (Rappi, PYa, etc.) con su % de comisión configurado.';

-- Seed inicial — solo si está vacía
INSERT INTO public.delivery_channels (slug, label, commission_pct) VALUES
  ('rappi',     'Rappi',     22.00),
  ('pedidosya', 'PedidosYa', 20.00),
  ('ubereats',  'Uber Eats', 28.00),
  ('whatsapp',  'WhatsApp',   0.00),
  ('mostrador', 'Mostrador',  0.00),
  ('web_own',   'Web propia', 0.00)
ON CONFLICT (slug) DO NOTHING;
