ALTER TABLE recipes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE recipes SET created_at = now() WHERE created_at IS NULL;
