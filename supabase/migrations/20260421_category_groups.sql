-- Migration: Dynamic category groups
-- Replaces hardcoded CAT_GROUPS in catalogConstants.js

CREATE TABLE IF NOT EXISTS category_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📦',
  subcategories TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE category_groups ENABLE ROW LEVEL SECURITY;

-- Public can read visible categories
CREATE POLICY "Public read visible categories" ON category_groups FOR SELECT
  USING (visible = true);

-- Admin can manage all
CREATE POLICY "Admin manage categories" ON category_groups FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed with La Nona Pato defaults
INSERT INTO category_groups (name, icon, subcategories, sort_order) VALUES
  ('Primeros Mimos',         '🫕', ARRAY['Brusquetas','Escabeches','Aperitivos'], 0),
  ('La Mesa Principal',      '🍕', ARRAY['Rotisería','Pizzas'],                   1),
  ('El Sanguche de la Nona', '🥪', ARRAY['Sandwiches'],                           2),
  ('La Nona Amasó',          '🥖', ARRAY['Panadería','Panificados'],              3),
  ('La Última Mordida',      '🍰', ARRAY['Tortas','torta','Budines','Alfajores'], 4),
  ('Cocina Consciente',      '🥗', ARRAY['Saludable'],                            5)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cat_groups_sort ON category_groups(sort_order);
