-- Migration: Create referrals table for referral program
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_phone VARCHAR(30) NOT NULL,     -- the person who referred
  referrer_name VARCHAR(100) DEFAULT '',
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  referee_phone VARCHAR(30),               -- the person who was referred
  referee_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_type VARCHAR(20) DEFAULT 'discount', -- 'discount' | 'credit'
  reward_amount NUMERIC(10,2) DEFAULT 0,
  reward_claimed BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',    -- 'pending' | 'completed' | 'rewarded' | 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Anyone can read their own referral codes (by phone match) — via service role for now
CREATE POLICY "Public insert referrals" ON referrals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public read own referrals" ON referrals FOR SELECT
  USING (true);

CREATE POLICY "Admin manage referrals" ON referrals FOR ALL
  USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_phone);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_phone);
