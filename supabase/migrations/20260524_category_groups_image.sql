-- Migración 2026-05-24
-- Agrega image_url a category_groups para reemplazar el campo icon (emoji)
-- por imágenes de categorías reales en el catálogo.

ALTER TABLE public.category_groups
  ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';

COMMENT ON COLUMN public.category_groups.image_url IS
  'URL de la imagen de la categoría. Reemplaza el uso de icon (emoji) en el catálogo.';

-- icon queda como columna legacy. Se podrá eliminar en una migración posterior
-- cuando ningún cliente esté leyéndola.
