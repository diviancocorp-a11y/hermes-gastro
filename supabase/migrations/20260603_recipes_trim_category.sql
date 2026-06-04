-- Limpiar trailing/leading spaces de category existentes
UPDATE recipes SET category = trim(category)
WHERE category IS NOT NULL AND category <> trim(category);

-- Trigger preventivo
CREATE OR REPLACE FUNCTION public.recipes_trim_category_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.category IS NOT NULL THEN
    NEW.category := trim(NEW.category);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS recipes_trim_category_trig ON recipes;
CREATE TRIGGER recipes_trim_category_trig
  BEFORE INSERT OR UPDATE OF category ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.recipes_trim_category_fn();
