-- Migration: Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Public can register subscriptions
CREATE POLICY "Public insert push subs" ON push_subscriptions FOR INSERT
  WITH CHECK (true);

-- Admin can read and manage
CREATE POLICY "Admin read push subs" ON push_subscriptions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin delete push subs" ON push_subscriptions FOR DELETE
  USING (auth.role() = 'authenticated');

-- Cleanup index
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
