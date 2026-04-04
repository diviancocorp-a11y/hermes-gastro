-- ═══════════════════════════════════════════════════════════
-- Migración v3: Columnas nuevas en settings (Fases 2-4)
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Logo URL (imagen subida)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';

-- Foto de portada
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cover_url text DEFAULT '';

-- Imágenes de carátulas de categorías (JSON: { "Primeros Mimos": "https://...", ... })
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cat_images jsonb DEFAULT '{}';

-- Categorías madre ocultas (JSON array: ["Cocina Consciente", ...])
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hidden_cats jsonb DEFAULT '[]';

-- Nombres personalizados de categorías (JSON: { "Primeros Mimos": "Entradas", ... })
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cat_names jsonb DEFAULT '{}';

-- Banner de anuncios
ALTER TABLE settings ADD COLUMN IF NOT EXISTS banner_text text DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS banner_color text DEFAULT '#2D1B0E';

-- Estado manual de la tienda (true=abierta, false=cerrada forzada)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_open boolean DEFAULT true;

-- Horarios del local (JSON: { "0": { "open": "09:00", "close": "20:00", "closed": false }, ... })
ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_hours jsonb DEFAULT '{}';
