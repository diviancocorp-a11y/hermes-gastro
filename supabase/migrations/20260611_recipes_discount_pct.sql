-- 20260611_recipes_discount_pct.sql
-- Descuento % propio por producto (switch "Tiene descuento" del editor de
-- recetas). NULL/0 = sin descuento. Si tiene valor:
--   - el catalogo muestra precio tachado y el producto entra al filtro "En oferta"
--   - PISA al deal del dia por categoria (no se acumulan)
--   - submit-order lo valida server-side (mismo Math.round que el cliente)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS discount_pct numeric;
COMMENT ON COLUMN public.recipes.discount_pct IS 'Descuento % propio del producto (switch Tiene descuento del editor). NULL/0 = sin descuento. Entra al filtro en oferta y pisa el deal por categoria.';
