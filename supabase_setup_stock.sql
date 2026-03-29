-- ============================================================
-- LA NONA PATO — Supabase: RLS Policies para Stock
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================

-- ──────────────────────────────────────────
-- TABLA: ingredients (Stock de ingredientes)
-- ──────────────────────────────────────────

-- Habilitar RLS (si aún no está activo)
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Admin all ingredients" ON ingredients;

-- Solo el admin autenticado puede leer y modificar
CREATE POLICY "Admin all ingredients"
  ON ingredients
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────
-- TABLA: recipe_ingredients (Composición de recetas)
-- ──────────────────────────────────────────

-- Habilitar RLS (si aún no está activo)
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Admin all recipe_ingredients" ON recipe_ingredients;

-- Solo el admin autenticado puede leer y modificar
CREATE POLICY "Admin all recipe_ingredients"
  ON recipe_ingredients
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────
-- VERIFICACIÓN: listar políticas activas
-- ──────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('ingredients', 'recipe_ingredients', 'recipes', 'orders', 'order_items', 'settings')
ORDER BY tablename, policyname;
