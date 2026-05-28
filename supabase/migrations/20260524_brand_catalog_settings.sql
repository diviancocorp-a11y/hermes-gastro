-- Migración 2026-05-24
-- Campos nuevos en settings para personalización de identidad y catálogo
-- (FASE 10 — extender BrandModal con identidad social, banner, tiempos, métodos)

ALTER TABLE public.settings
  -- Identidad
  ADD COLUMN IF NOT EXISTS slogan          text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS description     text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp        text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram       text    DEFAULT '',

  -- Catálogo público
  ADD COLUMN IF NOT EXISTS min_order_amount    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prep_time_min       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_time_min   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_methods     jsonb   DEFAULT '["efectivo","transferencia","mercadopago"]'::jsonb,
  ADD COLUMN IF NOT EXISTS show_hours_on_catalog boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_font        text    DEFAULT 'dm-sans',
  ADD COLUMN IF NOT EXISTS og_image_url        text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS favicon_url         text    DEFAULT '';

COMMENT ON COLUMN public.settings.slogan IS 'Tagline corto de 1 línea bajo el logo en el catálogo';
COMMENT ON COLUMN public.settings.description IS 'Descripción más larga del negocio (página "Sobre nosotros")';
COMMENT ON COLUMN public.settings.whatsapp IS 'Número en formato internacional sin + (ej: 549112345678) — usado para burbuja flotante';
COMMENT ON COLUMN public.settings.instagram IS 'Username sin @ — usado en footer "Seguinos"';
COMMENT ON COLUMN public.settings.min_order_amount IS 'Monto mínimo de pedido en el catálogo. 0 = sin mínimo';
COMMENT ON COLUMN public.settings.prep_time_min IS 'Tiempo estimado de preparación en minutos (mostrado al cliente)';
COMMENT ON COLUMN public.settings.delivery_time_min IS 'Tiempo estimado de delivery en minutos (mostrado al cliente)';
COMMENT ON COLUMN public.settings.payment_methods IS 'Métodos habilitados en checkout. Subset de [efectivo, transferencia, mercadopago, tarjeta]';
COMMENT ON COLUMN public.settings.show_hours_on_catalog IS 'Si true, los horarios se muestran en el catálogo público';
COMMENT ON COLUMN public.settings.catalog_font IS 'Tipografía del catálogo: dm-sans | inter | playfair';
COMMENT ON COLUMN public.settings.og_image_url IS 'Imagen para preview al compartir el link (1200x630)';
COMMENT ON COLUMN public.settings.favicon_url IS 'Favicon custom para el navegador';
