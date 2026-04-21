-- Migration: Create reviews table for customer feedback
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(30),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: public can insert (submit review), authenticated can read all
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a review (no auth required)
CREATE POLICY "Public insert reviews" ON reviews FOR INSERT
  WITH CHECK (true);

-- Anyone can read visible reviews (for public display)
CREATE POLICY "Public read visible reviews" ON reviews FOR SELECT
  USING (visible = true);

-- Authenticated admin can read all reviews (including hidden)
CREATE POLICY "Admin read all reviews" ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin can update visibility
CREATE POLICY "Admin update reviews" ON reviews FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
