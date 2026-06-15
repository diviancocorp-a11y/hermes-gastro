-- ═══════════════════════════════════════════════════════════════════════════
-- HERMES GASTRO — INITIAL SCHEMA (v1)
-- ═══════════════════════════════════════════════════════════════════════════
-- Single idempotent script that brings a fresh Supabase project to the state
-- every Hermes client expects. Run it once on the SQL editor of a brand-new
-- project; safe to re-run (uses IF NOT EXISTS / OR REPLACE / drop-then-create).
--
-- Source of truth — this file supersedes the legacy migrations under
-- supabase_*.sql (root) and the 20260420/20260421/20260519 individual files,
-- which were removed in FASE 4 cleanup.
--
-- Sections:
--   1. Extensions
--   2. Tables (in dependency order)
--   3. Performance indexes
--   4. Row-Level Security
--   5. Policies (catalog/admin/customer-self)
--   6. Functions (rate-limit, order tracker, triggers)
--   7. Views (order_tracker_view, customer_masked_view)
--   8. Trigger: on_auth_user_created
--   9. Storage buckets + storage policies
--  10. Realtime publication
--  11. Seed (settings row, feature_flags, theme_config)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. EXTENSIONS ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 2. TABLES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  biz_name text DEFAULT 'Hermes'::text,
  logo_letter text DEFAULT 'H'::text,
  logo_color text DEFAULT '#C45D3E'::text,
  exp_cats jsonb DEFAULT '["Materia Prima","Servicios","Packaging","Transporte","Alquiler","Equipamiento","Otros"]'::jsonb,
  ing_cats jsonb DEFAULT '["Secos","Frescos","Packaging","Otros"]'::jsonb,
  cover_url text DEFAULT ''::text,
  banner_text text,
  banner_color text DEFAULT '#1A1210'::text,
  store_open boolean DEFAULT true,
  store_hours jsonb DEFAULT '{}'::jsonb,
  cat_images jsonb DEFAULT '{}'::jsonb,
  logo_url text DEFAULT ''::text,
  hidden_cats jsonb DEFAULT '[]'::jsonb,
  cat_names jsonb DEFAULT '{}'::jsonb,
  waste_pct numeric DEFAULT 5.00,
  -- Per-client multi-tenant config read by edge functions (FASE multi-tenant refactor)
  store_name text DEFAULT '',
  app_url text DEFAULT '',
  daily_deals jsonb DEFAULT '{}'::jsonb,   -- {"1":["Cat A"], "2":[...], ...} day-of-week → categories
  cat_groups jsonb DEFAULT '[]'::jsonb,    -- [{"name":"Parent","subs":["Child1",...]},...]
  deal_pct numeric DEFAULT 15,             -- discount % applied by submit-order on daily_deals days
  -- Escalones de costo de envio (Sprint 2): [{max_km, cost}], max_km null = resto
  delivery_pricing jsonb DEFAULT '[{"max_km":2,"cost":500},{"max_km":5,"cost":1000},{"max_km":10,"cost":1800},{"max_km":15,"cost":2500},{"max_km":25,"cost":3500},{"max_km":null,"cost":5000}]'::jsonb,
  -- Descuento % default de cupones post-pedido (Sprint 2)
  coupon_default_pct numeric NOT NULL DEFAULT 10,
  -- Descuento % del cupon de cumpleanos, 0 = desactivado (CRM + edge function birthday-gift)
  birthday_coupon_pct numeric NOT NULL DEFAULT 10
);
COMMENT ON COLUMN public.settings.waste_pct IS 'Porcentaje de merma promedio (0-100)';

CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  unit text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  category text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text NOT NULL,
  sale_price numeric NOT NULL DEFAULT 0,
  visible boolean DEFAULT true,
  image_url text,
  description text,
  related_ids uuid[] DEFAULT '{}'::uuid[],
  is_combo boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  -- Descuento % propio del producto (switch Tiene descuento; pisa el deal por categoria)
  discount_pct numeric
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  recipe_id uuid NOT NULL REFERENCES public.recipes(id),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  qty numeric NOT NULL,
  PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS public.combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES public.recipes(id),
  sub_recipe_id uuid REFERENCES public.recipes(id),
  qty numeric NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz DEFAULT now(),
  date date NOT NULL,
  status text NOT NULL DEFAULT 'new'::text,
  customer text NOT NULL,
  phone text, email text,
  total numeric NOT NULL DEFAULT 0,
  note text, delivery text, payment text,
  waste_note text, completed_at timestamptz,
  customer_name text, customer_phone text, customer_email text,
  delivery_method text DEFAULT 'retiro'::text,
  payment_method text DEFAULT 'efectivo'::text,
  delivery_address text,
  delivery_cost numeric NOT NULL DEFAULT 0,
  is_gift boolean DEFAULT false,
  gift_note text DEFAULT ''::text,
  coupon_id uuid,
  discount numeric DEFAULT 0,
  tracking_token uuid DEFAULT gen_random_uuid(),
  delivery_date date,
  receipt_url text,
  receipt_verified boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_pct integer NOT NULL DEFAULT 10,
  email text,
  order_id uuid REFERENCES public.orders(id),
  used boolean DEFAULT false,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Late-bind: orders.coupon_id → coupons.id (after coupons exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_coupon_id_fkey') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES public.orders(id),
  recipe_id uuid REFERENCES public.recipes(id),
  qty integer NOT NULL,
  unit_price numeric NOT NULL,
  subtotal numeric DEFAULT 0,
  unit_cost numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date NOT NULL,
  recipe_id uuid REFERENCES public.recipes(id),
  qty integer NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  unit_cost numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL,
  supplier text,
  expense_type text DEFAULT 'variable'::text CHECK (expense_type IN ('variable','fixed')),
  -- Cuenta de pago (id del jsonb settings.payment_accounts). NULL = efectivo/data vieja
  payment_account_id text
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text, phone text,
  total_orders integer DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text, phone text, email text,
  default_address_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  label text NOT NULL DEFAULT 'Casa'::text,
  address text NOT NULL,
  lat double precision, lng double precision,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text DEFAULT ''::text,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id),
  ingredient_id uuid REFERENCES public.ingredients(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.waste_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES public.ingredients(id),
  qty numeric NOT NULL,
  reason text NOT NULL DEFAULT 'otro'::text,
  note text DEFAULT ''::text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text, user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📦'::text,
  subcategories text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  description text DEFAULT ''::text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theme_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default'::text,
  is_active boolean NOT NULL DEFAULT false,
  color_bg text NOT NULL DEFAULT '#FBF7F2'::text,
  color_bg2 text NOT NULL DEFAULT '#F3EDE4'::text,
  color_bg3 text NOT NULL DEFAULT '#FFFFFF'::text,
  color_tx text NOT NULL DEFAULT '#2D1B0E'::text,
  color_t2 text NOT NULL DEFAULT '#6B5744'::text,
  color_t3 text NOT NULL DEFAULT '#9C8B7A'::text,
  color_accent text NOT NULL DEFAULT '#C45D3E'::text,
  color_accent_light text NOT NULL DEFAULT '#FFF0EB'::text,
  dark_bg text, dark_bg2 text, dark_bg3 text, dark_tx text,
  dark_t2 text, dark_t3 text, dark_accent text, dark_accent_light text,
  font_heading text NOT NULL DEFAULT 'DM Serif Display'::text,
  font_body text NOT NULL DEFAULT 'DM Sans'::text,
  font_url text NOT NULL DEFAULT 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap'::text,
  radius_sm integer NOT NULL DEFAULT 10,
  radius_base integer NOT NULL DEFAULT 16,
  radius_lg integer NOT NULL DEFAULT 24,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── 3. PERFORMANCE INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_status_date    ON orders(status, date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date            ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date         ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_recipe    ON order_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_date        ON waste_log(date DESC);
CREATE INDEX IF NOT EXISTS idx_waste_log_created_at  ON waste_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_created_at    ON coupons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_code_used     ON coupons(code, used);
CREATE INDEX IF NOT EXISTS idx_purchases_date        ON purchases(date DESC);

-- ─── 4. ROW-LEVEL SECURITY ─────────────────────────────────────────────────
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_config       ENABLE ROW LEVEL SECURITY;

-- ─── 5. POLICIES ──────────────────────────────────────────────────────────
-- Pattern: public read where appropriate, INSERT open for catalog flow
-- (validated server-side in submit-order edge function), full CRUD for
-- authenticated admins, self-scoped CRUD for end-customer profile data.

-- settings
DROP POLICY IF EXISTS settings_public_read   ON public.settings;
DROP POLICY IF EXISTS settings_admin_write   ON public.settings;
CREATE POLICY settings_public_read ON public.settings FOR SELECT USING (true);
CREATE POLICY settings_admin_write ON public.settings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ingredients
DROP POLICY IF EXISTS ingredients_public_read ON public.ingredients;
DROP POLICY IF EXISTS ingredients_admin_all   ON public.ingredients;
CREATE POLICY ingredients_public_read ON public.ingredients FOR SELECT USING (true);
CREATE POLICY ingredients_admin_all   ON public.ingredients FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- recipes
DROP POLICY IF EXISTS recipes_public_read  ON public.recipes;
DROP POLICY IF EXISTS recipes_admin_write  ON public.recipes;
CREATE POLICY recipes_public_read ON public.recipes FOR SELECT USING (true);
CREATE POLICY recipes_admin_write ON public.recipes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- recipe_ingredients
DROP POLICY IF EXISTS recipe_ingredients_public_read  ON public.recipe_ingredients;
DROP POLICY IF EXISTS recipe_ingredients_admin_write  ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_public_read ON public.recipe_ingredients FOR SELECT USING (true);
CREATE POLICY recipe_ingredients_admin_write ON public.recipe_ingredients FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- combo_items
DROP POLICY IF EXISTS combo_items_admin_all  ON public.combo_items;
DROP POLICY IF EXISTS combo_items_auth       ON public.combo_items;
CREATE POLICY combo_items_admin_all ON public.combo_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- orders
DROP POLICY IF EXISTS orders_admin_all       ON public.orders;
DROP POLICY IF EXISTS orders_public_insert   ON public.orders;
DROP POLICY IF EXISTS orders_user_read_own   ON public.orders;
CREATE POLICY orders_admin_all     ON public.orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY orders_public_insert ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY orders_user_read_own ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- coupons
DROP POLICY IF EXISTS coupons_admin_all  ON public.coupons;
DROP POLICY IF EXISTS coupons_auth_write ON public.coupons;
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_items
DROP POLICY IF EXISTS order_items_admin_all     ON public.order_items;
DROP POLICY IF EXISTS order_items_public_insert ON public.order_items;
CREATE POLICY order_items_admin_all     ON public.order_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY order_items_public_insert ON public.order_items FOR INSERT WITH CHECK (true);

-- sales / expenses
DROP POLICY IF EXISTS sales_admin_all     ON public.sales;
DROP POLICY IF EXISTS expenses_admin_all  ON public.expenses;
CREATE POLICY sales_admin_all    ON public.sales    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY expenses_admin_all ON public.expenses FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- customers
DROP POLICY IF EXISTS customers_admin_all              ON public.customers;
DROP POLICY IF EXISTS customers_authenticated_insert   ON public.customers;
DROP POLICY IF EXISTS customers_authenticated_update   ON public.customers;
CREATE POLICY customers_admin_all              ON public.customers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY customers_authenticated_insert   ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY customers_authenticated_update   ON public.customers FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- profiles (self)
DROP POLICY IF EXISTS "Users can view own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
CREATE POLICY "Users can view own profile"    ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- addresses (self)
DROP POLICY IF EXISTS "Users can view own addresses"    ON public.addresses;
DROP POLICY IF EXISTS "Users can insert own addresses"  ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses"  ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses"  ON public.addresses;
CREATE POLICY "Users can view own addresses"    ON public.addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses"  ON public.addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses"  ON public.addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses"  ON public.addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- favorites (self)
DROP POLICY IF EXISTS "Users can view own favorites"    ON public.favorites;
DROP POLICY IF EXISTS "Users can insert own favorites"  ON public.favorites;
DROP POLICY IF EXISTS "Users can delete own favorites"  ON public.favorites;
CREATE POLICY "Users can view own favorites"   ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- purchases / purchase_items / waste_log
DROP POLICY IF EXISTS purchases_admin_all      ON public.purchases;
DROP POLICY IF EXISTS purchases_auth           ON public.purchases;
DROP POLICY IF EXISTS purchase_items_admin_all ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_auth      ON public.purchase_items;
DROP POLICY IF EXISTS waste_log_admin_all      ON public.waste_log;
DROP POLICY IF EXISTS waste_log_auth           ON public.waste_log;
CREATE POLICY purchases_admin_all      ON public.purchases      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY purchase_items_admin_all ON public.purchase_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY waste_log_admin_all      ON public.waste_log      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- rate_limits (server-side, allow all so check_rate_limit function works for anon)
DROP POLICY IF EXISTS rate_limits_all  ON public.rate_limits;
CREATE POLICY rate_limits_all ON public.rate_limits FOR ALL USING (true) WITH CHECK (true);

-- admin_audit_log
DROP POLICY IF EXISTS admin_audit_log_admin_all  ON public.admin_audit_log;
CREATE POLICY admin_audit_log_admin_all ON public.admin_audit_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- category_groups
DROP POLICY IF EXISTS category_groups_public_read ON public.category_groups;
DROP POLICY IF EXISTS category_groups_admin_all   ON public.category_groups;
CREATE POLICY category_groups_public_read ON public.category_groups FOR SELECT USING (true);
CREATE POLICY category_groups_admin_all   ON public.category_groups FOR ALL  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- feature_flags
DROP POLICY IF EXISTS "Public read flags"   ON public.feature_flags;
DROP POLICY IF EXISTS "Admin manage flags"  ON public.feature_flags;
CREATE POLICY "Public read flags"  ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Admin manage flags" ON public.feature_flags FOR ALL  USING (auth.role() = 'authenticated');

-- theme_config
DROP POLICY IF EXISTS "Public read active theme" ON public.theme_config;
DROP POLICY IF EXISTS "Admin manage themes"      ON public.theme_config;
CREATE POLICY "Public read active theme" ON public.theme_config FOR SELECT USING (true);
CREATE POLICY "Admin manage themes"      ON public.theme_config FOR ALL  USING (auth.role() = 'authenticated');

-- ─── 6. FUNCTIONS ─────────────────────────────────────────────────────────
-- All SECURITY DEFINER funcs pin search_path to prevent schema-shadow attacks.

CREATE OR REPLACE FUNCTION public.adjust_stock(p_ingredient_id uuid, p_delta numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE ingredients SET stock = GREATEST(0, COALESCE(stock,0) + p_delta)
  WHERE id = p_ingredient_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN now();
END $$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  current_count integer; window_cutoff timestamptz;
BEGIN
  window_cutoff := now() - (p_window_seconds || ' seconds')::interval;
  DELETE FROM rate_limits WHERE key = p_key AND window_start < window_cutoff;
  SELECT COALESCE(SUM(request_count),0) INTO current_count FROM rate_limits
   WHERE key = p_key AND window_start >= window_cutoff;
  IF current_count >= p_max_requests THEN RETURN false; END IF;
  INSERT INTO rate_limits (key, window_start, request_count) VALUES (p_key, now(), 1);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - interval '10 minutes';
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = NOW();
  RETURN NEW;
END $$;

-- get_order_tracker: anon-safe order-tracking RPC used by /order/:id page.
-- Must DROP first because the return-type signature may have changed.
DROP FUNCTION IF EXISTS public.get_order_tracker(uuid);
CREATE FUNCTION public.get_order_tracker(p_order_id uuid)
RETURNS TABLE(
  id uuid, status text, payment_status text, paid_at timestamptz,
  total numeric, discount numeric,
  delivery text, payment text, is_gift boolean,
  created_at timestamptz, date date, delivery_date date,
  customer text, customer_first_name text, note text,
  items jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.status, o.payment_status, o.paid_at, o.total, o.discount,
    o.delivery, o.payment, o.is_gift,
    o.created_at, o.date, o.delivery_date,
    o.customer,
    split_part(COALESCE(o.customer,''),' ',1)::text AS customer_first_name,
    o.note,
    (SELECT jsonb_agg(jsonb_build_object(
       'name', r.name, 'qty', oi.qty, 'unit_price', oi.unit_price, 'subtotal', oi.subtotal
     ))
     FROM order_items oi JOIN recipes r ON r.id = oi.recipe_id
     WHERE oi.order_id = o.id) AS items
  FROM orders o WHERE o.id = p_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.get_order_tracker(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_time()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO anon, authenticated;

-- ─── 7. VIEWS ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.order_tracker_view AS
SELECT o.id, o.status, o.total, o.discount, o.delivery, o.payment, o.is_gift,
  o.created_at, o.date, o.delivery_date,
  split_part(o.customer, ' ', 1) AS customer_first_name,
  (SELECT jsonb_agg(jsonb_build_object('name', r.name, 'qty', oi.qty,
                                       'unit_price', oi.unit_price, 'subtotal', oi.subtotal))
   FROM order_items oi JOIN recipes r ON r.id = oi.recipe_id
   WHERE oi.order_id = o.id) AS items
FROM orders o;

CREATE OR REPLACE VIEW public.customer_masked_view AS
SELECT id,
  split_part(COALESCE(name, ''), ' ', 1) AS first_name,
  CASE WHEN phone IS NOT NULL AND length(phone) > 4 THEN '***' || right(phone, 4) ELSE NULL END AS phone_masked,
  CASE WHEN email IS NOT NULL AND position('@' IN email) > 1 THEN left(email, 1) || '***@' || split_part(email, '@', 2) ELSE NULL END AS email_masked,
  total_orders, last_order_at, created_at
FROM customers;

-- ─── 8. TRIGGER ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 9. STORAGE BUCKETS + POLICIES ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('backups',       'backups',       false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts',      'receipts',      true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "recipe_images_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "recipe_images_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "recipe_images_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "recipe_images_auth_delete"  ON storage.objects;
CREATE POLICY "recipe_images_public_read"  ON storage.objects FOR SELECT TO public USING (bucket_id = 'recipe-images');
CREATE POLICY "recipe_images_auth_insert"  ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'recipe-images' AND auth.role() = 'authenticated');
CREATE POLICY "recipe_images_auth_update"  ON storage.objects FOR UPDATE TO public USING (bucket_id = 'recipe-images' AND auth.role() = 'authenticated');
CREATE POLICY "recipe_images_auth_delete"  ON storage.objects FOR DELETE TO public USING (bucket_id = 'recipe-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users can upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update backups" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read backups"   ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload backups"       ON storage.objects;
DROP POLICY IF EXISTS "Anon can update backups"       ON storage.objects;
CREATE POLICY "Auth users can upload backups" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'backups');
CREATE POLICY "Auth users can update backups" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'backups');
CREATE POLICY "Auth users can read backups"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'backups');
CREATE POLICY "Anon can upload backups"       ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'backups');
CREATE POLICY "Anon can update backups"       ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'backups');

DROP POLICY IF EXISTS "Allow public upload to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update receipts"    ON storage.objects;
CREATE POLICY "Allow public upload to receipts" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Allow public read from receipts" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'receipts');
CREATE POLICY "Allow public update receipts"    ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'receipts') WITH CHECK (bucket_id = 'receipts');

-- ─── 10. REALTIME PUBLICATION ─────────────────────────────────────────────
-- Add all admin-relevant tables so useRealtimeInvalidation receives events.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'orders','order_items','recipes','ingredients','recipe_ingredients',
    'sales','expenses','purchases','waste_log','coupons','settings'
  ]) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ─── 11. SEED (clean, NO client-specific data) ────────────────────────────
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('RECIPES_WITH_INGREDIENTS', true,  'Show ingredient details in recipes'),
  ('DELIVERY_ENABLED',         true,  'Enable delivery option in checkout'),
  ('SCHEDULING_ENABLED',       true,  'Allow scheduled orders'),
  ('GIFT_MODE',                true,  'Enable gift wrapping option'),
  ('COUPONS',                  true,  'Enable coupon/promo code system'),
  ('WHATSAPP',                 true,  'Show WhatsApp contact links'),
  ('LOYALTY',                  false, 'Loyalty/points program'),
  ('REFERRAL',                 true,  'Referral program'),
  ('E_INVOICE',                false, 'AFIP e-invoicing'),
  ('PUSH_NOTIFICATIONS',       true,  'Push notification system'),
  ('DAILY_DEALS',              true,  'Daily deal discounts by category')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.theme_config (name, is_active) VALUES ('default', true) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLES DE ADMIN (Sprint 1, jun 2026)
-- Solo usuarios en admin_users acceden al panel. Las policies de tablas
-- operativas usan is_admin() en vez de "cualquier authenticated".
-- BOOTSTRAP de tenant nuevo: crear el primer usuario en Auth y correr:
--   INSERT INTO public.admin_users (user_id, role)
--   SELECT id, 'owner' FROM auth.users WHERE email = '<email-del-dueno>';
-- Despues, el resto de los usuarios se gestionan desde el panel (Mas > Usuarios).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$fn$ SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) $fn$;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$fn$ SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'owner') $fn$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO anon, authenticated;

DROP POLICY IF EXISTS admin_users_admin_read ON public.admin_users;
CREATE POLICY admin_users_admin_read ON public.admin_users FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS admin_users_owner_all ON public.admin_users;
CREATE POLICY admin_users_owner_all ON public.admin_users FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Reescribir policies "cualquier autenticado = admin" a is_admin()
-- (las policies de arriba en este archivo se crean con auth.uid() IS NOT NULL
--  y este bloque las convierte — asi el archivo queda consistente al correrlo entero)
DROP POLICY IF EXISTS orders_public_insert ON public.orders;
DROP POLICY IF EXISTS order_items_public_insert ON public.order_items;
DROP POLICY IF EXISTS customers_authenticated_insert ON public.customers;

DO $do$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' AND tablename <> 'admin_users'
      AND (coalesce(qual,'') IN ('(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)')
        OR coalesce(with_check,'') IN ('(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)'))
  LOOP
    IF p.cmd = 'SELECT' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (public.is_admin())', p.policyname, p.tablename);
    ELSIF p.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (public.is_admin())', p.policyname, p.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I USING (public.is_admin()) WITH CHECK (public.is_admin())', p.policyname, p.tablename);
    END IF;
  END LOOP;
END
$do$;

-- adjust_stock con guard de admin (la version base de este archivo no lo tiene)
CREATE OR REPLACE FUNCTION public.adjust_stock(p_ingredient_id uuid, p_delta numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'adjust_stock: requiere rol admin';
  END IF;
  UPDATE ingredients SET stock = GREATEST(0, COALESCE(stock, 0) + p_delta)
  WHERE id = p_ingredient_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, numeric) TO authenticated;

-- push_subscriptions: acceso solo via RPCs por endpoint (sin policies directas)
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text,
  p_user_id uuid, p_phone text, p_role text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF p_endpoint IS NULL OR length(p_endpoint) < 20 OR length(p_endpoint) > 1000 THEN
    RAISE EXCEPTION 'endpoint invalido';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('customer','admin') THEN p_role := 'customer'; END IF;
  IF p_role = 'admin' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'rol admin requiere sesion de admin';
  END IF;
  INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, user_agent, user_id, phone, role, last_seen_at)
  VALUES (p_endpoint, coalesce(p_p256dh,''), coalesce(p_auth,''), left(coalesce(p_user_agent,''),300), p_user_id, left(p_phone,20), p_role, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    keys_p256dh = EXCLUDED.keys_p256dh, keys_auth = EXCLUDED.keys_auth,
    user_agent = EXCLUDED.user_agent, user_id = EXCLUDED.user_id,
    phone = EXCLUDED.phone, role = EXCLUDED.role, last_seen_at = now();
END; $fn$;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS
$fn$ DELETE FROM push_subscriptions WHERE endpoint = p_endpoint $fn$;

CREATE OR REPLACE FUNCTION public.count_push_subscriptions(p_role text DEFAULT 'customer')
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$fn$ SELECT count(*)::int FROM push_subscriptions WHERE role = p_role $fn$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(text,text,text,text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_push_subscription(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_push_subscriptions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text,text,text,text,uuid,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_push_subscriptions(text) TO authenticated;

DROP POLICY IF EXISTS push_subs_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_update ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_delete ON public.push_subscriptions;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF INITIAL SCHEMA — verify with: SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
-- Expected: 23 tables (20 base + feature_flags + theme_config + admin_users) + 2 views.
-- ═══════════════════════════════════════════════════════════════════════════
