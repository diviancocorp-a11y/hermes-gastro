-- Performance indexes for pagination and common query patterns
-- Safe to run multiple times (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_orders_status_date
  ON orders(status, date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_date
  ON sales(date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON expenses(date DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_recipe
  ON order_items(recipe_id);

CREATE INDEX IF NOT EXISTS idx_waste_log_date
  ON waste_log(date DESC);

CREATE INDEX IF NOT EXISTS idx_waste_log_created_at
  ON waste_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupons_created_at
  ON coupons(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupons_code_used
  ON coupons(code, used);

CREATE INDEX IF NOT EXISTS idx_purchases_date
  ON purchases(date DESC);
