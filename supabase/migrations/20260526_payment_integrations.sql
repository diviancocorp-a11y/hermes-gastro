-- ─────────────────────────────────────────────────────────────────────
-- 20260526_payment_integrations.sql
-- ─────────────────────────────────────────────────────────────────────
-- Tabla payment_integrations: conexiones OAuth a pasarelas (MercadoPago,
-- y a futuro Modo / Stripe).
--
-- Cada fila representa una cuenta de un proveedor conectada al admin del
-- negocio. Se guarda el access_token + refresh_token (tokens del comerciante,
-- el dinero entra a SU cuenta — no a la del SaaS).
--
-- RLS: solo authenticated users (admin del negocio) pueden ver/editar sus
-- integraciones. Las edge functions usan service_role para leer sin RLS.
--
-- Aplicar en los 3 proyectos Supabase.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_integrations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider      text NOT NULL,                -- 'mercadopago' | 'modo' | 'stripe' | ...
  access_token  text NOT NULL,                -- token del comerciante (encriptado en app si querés)
  refresh_token text,                         -- para renovar el access_token
  external_user_id text,                      -- mp_user_id, stripe_account_id, etc.
  scopes        text[] DEFAULT '{}',
  public_key    text,                         -- para inicializar SDK frontend (MP solo necesita esto)
  expires_at    timestamptz,                  -- cuándo vence el access_token
  is_active     boolean DEFAULT true,
  metadata      jsonb DEFAULT '{}',           -- datos extra del provider (ej: email, nombre)
  connected_at  timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_integrations_provider
  ON public.payment_integrations(provider) WHERE is_active = true;

-- Solo una integración activa por provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_integrations_unique_active
  ON public.payment_integrations(provider) WHERE is_active = true;

ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_integrations' AND policyname='pi_admin_all') THEN
    EXECUTE 'CREATE POLICY "pi_admin_all" ON public.payment_integrations FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

COMMENT ON TABLE public.payment_integrations IS
  'Integraciones OAuth con pasarelas de pago (MP, Modo, Stripe). El dinero va a la cuenta del comerciante.';
COMMENT ON COLUMN public.payment_integrations.access_token IS
  'Access token del comerciante. Usar solo desde edge functions con service_role.';
COMMENT ON COLUMN public.payment_integrations.public_key IS
  'Public key del proveedor (para inicializar SDK en frontend si aplica). MP: APP_USR-...';

-- También agregamos columnas a orders para trackear el pago externo
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider     text,           -- 'mercadopago' | ...
  ADD COLUMN IF NOT EXISTS payment_external_id  text,           -- MP payment.id
  ADD COLUMN IF NOT EXISTS payment_status       text,           -- 'pending' | 'approved' | 'rejected' | 'in_process'
  ADD COLUMN IF NOT EXISTS payment_preference_id text,          -- MP preference.id (para idempotencia)
  ADD COLUMN IF NOT EXISTS paid_at              timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_payment_external_id
  ON public.orders(payment_external_id) WHERE payment_external_id IS NOT NULL;

COMMENT ON COLUMN public.orders.payment_provider IS 'Pasarela usada (si pasarela). NULL para efectivo / transferencia manual.';
COMMENT ON COLUMN public.orders.payment_external_id IS 'ID del pago en la pasarela (ej: MP payment.id).';
COMMENT ON COLUMN public.orders.payment_status IS 'Estado del pago en la pasarela: pending | approved | rejected | in_process | refunded.';
