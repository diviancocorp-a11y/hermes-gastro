-- Migration: Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  description TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Public can read flags (needed for catalog features)
CREATE POLICY "Public read flags" ON feature_flags FOR SELECT
  USING (true);

-- Admin can manage flags
CREATE POLICY "Admin manage flags" ON feature_flags FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed initial flags (all enabled for La Nona Pato)
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('RECIPES_WITH_INGREDIENTS', true,  'Show ingredient details in recipes'),
  ('DELIVERY_ENABLED',        true,  'Enable delivery option in checkout'),
  ('SCHEDULING_ENABLED',      true,  'Allow customers to schedule orders for a future date'),
  ('GIFT_MODE',               true,  'Enable gift wrapping option'),
  ('COUPONS',                 true,  'Enable coupon/promo code system'),
  ('WHATSAPP',                true,  'Show WhatsApp contact links'),
  ('LOYALTY',                 false, 'Enable loyalty/points program'),
  ('REVIEWS',                 true,  'Enable customer reviews'),
  ('REFERRAL',                true,  'Enable referral program'),
  ('E_INVOICE',               false, 'Enable AFIP electronic invoicing'),
  ('PUSH_NOTIFICATIONS',      true,  'Enable push notification system'),
  ('DAILY_DEALS',             true,  'Enable daily deal discounts by category')
ON CONFLICT (key) DO NOTHING;
