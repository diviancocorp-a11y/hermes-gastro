-- ═══════════════════════════════════════════════════════════
-- LA NONA PATO — Tablas faltantes en Supabase
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- ─── 1. VENTAS (sales) ────────────────────────────────────
-- Registra cada venta individual (al completar un pedido o manual)
CREATE TABLE IF NOT EXISTS sales (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  recipe_id   uuid REFERENCES recipes(id) ON DELETE SET NULL,
  qty         integer NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  total       numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- RLS: solo usuarios autenticados pueden ver/modificar
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_auth" ON sales
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─── 2. GASTOS (expenses) ────────────────────────────────
-- Registra gastos operativos del negocio
CREATE TABLE IF NOT EXISTS expenses (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount      numeric(10,2) NOT NULL DEFAULT 0,
  category    text NOT NULL DEFAULT 'Otros',
  supplier    text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_auth" ON expenses
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─── 3. COMPRAS (purchases) ──────────────────────────────
-- Cabecera de cada compra de insumos
CREATE TABLE IF NOT EXISTS purchases (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  supplier    text DEFAULT '',
  total       numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_auth" ON purchases
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─── 4. ITEMS DE COMPRA (purchase_items) ─────────────────
-- Detalle de cada insumo dentro de una compra
CREATE TABLE IF NOT EXISTS purchase_items (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id     uuid REFERENCES purchases(id) ON DELETE CASCADE,
  ingredient_id   uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  quantity        numeric(10,3) NOT NULL DEFAULT 0,
  unit_price      numeric(10,2) NOT NULL DEFAULT 0,
  subtotal        numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_items_auth" ON purchase_items
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─── 5. AGREGAR COLUMNAS FALTANTES EN INGREDIENTS ────────
-- La app usa 'category' en ingredients — verificar que exista
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category text DEFAULT 'Secos';

-- La app usa 'stock' (no 'current_stock') — verificar
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS stock numeric(10,3) DEFAULT 0;

-- La app usa 'min_stock' — verificar
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock numeric(10,3) DEFAULT 0;


-- ─── 6. AGREGAR COLUMNAS FALTANTES EN SETTINGS ───────────
-- La app guarda categorías en arrays JSON
ALTER TABLE settings ADD COLUMN IF NOT EXISTS exp_cats jsonb DEFAULT '["Materia Prima","Servicios","Packaging","Transporte","Alquiler","Equipamiento","Otros"]';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ing_cats jsonb DEFAULT '["Secos","Frescos","Packaging","Otros"]';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_color text DEFAULT '#C45D3E';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_letter text DEFAULT 'N';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS biz_name text DEFAULT 'La Nona Pato';


-- ─── 7. VERIFICAR COLUMNAS EN ORDERS ────────────────────
-- La app usa 'phone', 'delivery', 'payment', 'note'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery text DEFAULT 'retiro';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment text DEFAULT 'efectivo';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS note text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;


-- ─── 8. VERIFICAR COLUMNAS EN ORDER_ITEMS ───────────────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0;
-- La app usa 'quantity' (no 'qty')
-- Si tu tabla usa 'qty' en vez de 'quantity', ejecutar esto:
-- ALTER TABLE order_items RENAME COLUMN qty TO quantity;


-- ─── FIN ────────────────────────────────────────────────
-- Verificar que todo s