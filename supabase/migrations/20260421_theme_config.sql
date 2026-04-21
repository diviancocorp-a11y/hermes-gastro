-- Migration: Theme configuration
-- Stores customizable theme settings (colors, fonts, radii)
CREATE TABLE IF NOT EXISTS theme_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT false,

  -- Palette (light)
  color_bg TEXT NOT NULL DEFAULT '#FBF7F2',
  color_bg2 TEXT NOT NULL DEFAULT '#F3EDE4',
  color_bg3 TEXT NOT NULL DEFAULT '#FFFFFF',
  color_tx TEXT NOT NULL DEFAULT '#2D1B0E',
  color_t2 TEXT NOT NULL DEFAULT '#6B5744',
  color_t3 TEXT NOT NULL DEFAULT '#9C8B7A',
  color_accent TEXT NOT NULL DEFAULT '#C45D3E',
  color_accent_light TEXT NOT NULL DEFAULT '#FFF0EB',

  -- Palette (dark — auto-derived if null)
  dark_bg TEXT,
  dark_bg2 TEXT,
  dark_bg3 TEXT,
  dark_tx TEXT,
  dark_t2 TEXT,
  dark_t3 TEXT,
  dark_accent TEXT,
  dark_accent_light TEXT,

  -- Typography
  font_heading TEXT NOT NULL DEFAULT 'DM Serif Display',
  font_body TEXT NOT NULL DEFAULT 'DM Sans',
  font_url TEXT NOT NULL DEFAULT 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap',

  -- Border radii
  radius_sm INT NOT NULL DEFAULT 10,
  radius_base INT NOT NULL DEFAULT 16,
  radius_lg INT NOT NULL DEFAULT 24,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE theme_config ENABLE ROW LEVEL SECURITY;

-- Public can read active theme
CREATE POLICY "Public read active theme" ON theme_config FOR SELECT
  USING (true);

-- Admin can manage themes
CREATE POLICY "Admin manage themes" ON theme_config FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed default theme
INSERT INTO theme_config (name, is_active) VALUES ('La Nona Pato', true)
ON CONFLICT DO NOTHING;
