-- Tema visual del catálogo público.
-- Default 'ambar' usa los colores naturales de Hermes.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS catalog_theme text DEFAULT 'ambar'
  CHECK (catalog_theme IN ('ambar', 'noche', 'carbon'));

COMMENT ON COLUMN public.settings.catalog_theme IS
  'Tema visual del catálogo público: ambar (default) | noche | carbon. Se aplica vía data-cp-theme en el body.';
