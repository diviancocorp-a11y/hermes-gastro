-- Soft delete de ingredientes (archivar en vez de borrar)
-- Mantiene historia: recetas, compras y mermas siguen apuntando al ingrediente.

ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingredients_is_archived
  ON public.ingredients(is_archived) WHERE is_archived = false;

COMMENT ON COLUMN public.ingredients.is_archived
  IS 'Soft delete. Archivado = oculto del stock activo pero preserva historia (recetas, compras, mermas).';
