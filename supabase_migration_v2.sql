-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN V2 — La Nona Pato
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Soft Delete para Recetas
--    Nunca borramos recetas físicamente; las archivamos.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- 2. Snapshot Financiero — costo histórico en items de pedidos
--    Almacena el costo de producción al momento del pedido.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;

-- 3. Snapshot Financiero — costo histórico en ventas
--    Permite calcular rentabilidad histórica real.
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;

-- 4. Agendamiento de Pedidos — fecha de entrega
--    El cliente elige para cuándo quiere su pedido.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_date date;
