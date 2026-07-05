-- 20260704_recipes_sold_out_override.sql
-- Override manual de disponibilidad en catalogo (play/pause) por producto.
-- La regla automatica de stock sigue: si faltan ingredientes, la receta
-- aparece agotada. Este override deja forzar como aparece:
--   NULL  = auto (respeta la regla de stock, comportamiento historico)
--   true  = forzar disponible (se vende aunque falte materia prima)
--   false = forzar agotado (visible en catalogo pero no se puede pedir)
-- Lo aplica el catalogo (lib/stockAvailability.js). El admin lo puede ignorar
-- para mostrar el estado REAL de stock como indicador "SIN STOCK".
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS sold_out_override boolean;
COMMENT ON COLUMN public.recipes.sold_out_override IS 'Override manual de disponibilidad en catalogo (play/pause). NULL=auto (regla de stock) · true=forzar disponible · false=forzar agotado.';
