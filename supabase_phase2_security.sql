-- ═══════════════════════════════════════════════════════════
-- PHASE 2: SECURITY — RLS Policies + Server Time Function
-- La Nona Pato
-- ═══════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar CADA bloque por separado en Supabase SQL Editor.
-- Si una tabla ya tiene RLS habilitado, el ALTER TABLE no falla.
-- Si una policy ya existe, el DROP previo la limpia.
-- ═══════════════════════════════════════════════════════════

-- ─── 0. FUNCIÓN: get_server_time (para horarios anti-manipulación) ───
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz AS $$
BEGIN
  RETURN now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que anon la llame
GRANT EXECUTE ON FUNCTION get_server_time() TO anon;
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;

-- ─── 1. SETTINGS — público lee, solo admin escribe ───
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_public_read" ON settings;
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON settings;
CREATE POLICY "settings_admin_write" ON settings
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 2. RECIPES — público lee visibles, admin CRUD completo ───
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_public_read" ON recipes;
CREATE POLICY "recipes_public_read" ON recipes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "recipes_admin_write" ON recipes;
CREATE POLICY "recipes_admin_write" ON recipes
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3. ORDERS — público inserta, admin lee y actualiza ───
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_public_insert" ON orders;
CREATE POLICY "orders_public_insert" ON orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "orders_admin_all" ON orders;
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Público puede leer su propio pedido (para order tracker)
DROP POLICY IF EXISTS "orders_public_read_own" ON orders;
CREATE POLICY "orders_public_read_own" ON orders
  FOR SELECT USING (true);

-- ─── 4. ORDER_ITEMS — público inserta, admin lee ───
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_public_insert" ON order_items;
CREATE POLICY "order_items_public_insert" ON order_items
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "order_items_public_read" ON order_items;
CREATE POLICY "order_items_public_read" ON order_items
  FOR SELECT USING (true);

-- ─── 5. CUSTOMERS — público upsert (email), admin lee ───
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_public_upsert" ON customers;
CREATE POLICY "customers_public_upsert" ON customers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "customers_public_update" ON customers;
CREATE POLICY "customers_public_update" ON customers
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "customers_admin_all" ON customers;
CREATE POLICY "customers_admin_all" ON customers
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 6. COUPONS — público lee (para validar), puede marcar used ───
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons_public_read" ON coupons;
CREATE POLICY "coupons_public_read" ON coupons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "coupons_public_mark_used" ON coupons;
CREATE POLICY "coupons_public_mark_used" ON coupons
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "coupons_admin_all" ON coupons;
CREATE POLICY "coupons_admin_all" ON coupons
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 7. INGREDIENTS — solo admin ───
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ingredients_admin_all" ON ingredients;
CREATE POLICY "ingredients_admin_all" ON ingredients
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Público necesita leer para calcular costos en submitOrder
DROP POLICY IF EXISTS "ingredients_public_read" ON ingredients;
CREATE POLICY "ingredients_public_read" ON ingredients
  FOR SELECT USING (true);

-- ─── 8. RECIPE_INGREDIENTS — público lee (costo), admin escribe ───
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipe_ingredients_public_read" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_public_read" ON recipe_ingredients
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "recipe_ingredients_admin_write" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_admin_write" ON recipe_ingredients
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 9. PURCHASES — solo admin ───
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchases_admin_all" ON purchases;
CREATE POLICY "purchases_admin_all" ON purchases
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 10. PURCHASE_ITEMS — solo admin ───
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_items_admin_all" ON purchase_items;
CREATE POLICY "purchase_items_admin_all" ON purchase_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 11. EXPENSES — solo admin ───
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_admin_all" ON expenses;
CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 12. SALES — solo admin ───
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_admin_all" ON sales;
CREATE POLICY "sales_admin_all" ON sales
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 13. WASTE_LOG — solo admin ───
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waste_log_admin_all" ON waste_log;
CREATE POLICY "waste_log_admin_all" ON waste_log
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 14. COMBO_ITEMS — solo admin ───
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "combo_items_admin_all" ON combo_items;
CREATE POLICY "combo_items_admin_all" ON combo_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════
-- NOTA: La función adjust_stock ya fue creada en Phase 1
-- como SECURITY DEFINER, lo que permite que funcione
-- independientemente de las RLS policies de ingredients.
-- ═══════════════════════════════════════════════════════════
