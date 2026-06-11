-- 20260611_customer_avatars.sql
-- Avatar elegible por el cliente (el sistema asigna uno deterministico por
-- nombre; desde Mi Cuenta puede cambiarlo). Se guarda en customers.avatar_key
-- y get_weekly_top lo devuelve para que el ranking lo muestre a todos.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS avatar_key text;
COMMENT ON COLUMN public.customers.avatar_key IS 'Avatar elegido por el cliente (m1-m4, f1-f5, capi). NULL = deterministico por nombre.';

-- Guardar la eleccion. SECURITY DEFINER + validacion de lista; solo
-- actualiza clientes existentes (sin pedido previo no hay fila que marcar,
-- el front igual lo muestra local via localStorage).
CREATE OR REPLACE FUNCTION public.set_customer_avatar(p_phone text, p_email text, p_avatar text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_email text := NULLIF(LOWER(TRIM(COALESCE(p_email, ''))), '');
  v_id uuid;
BEGIN
  IF p_avatar IS NULL OR p_avatar NOT IN ('m1','m2','m3','m4','f1','f2','f3','f4','f5','capi') THEN
    RETURN false;
  END IF;
  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_id FROM public.customers
    WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_phone
    ORDER BY COALESCE(last_order_at, created_at) DESC LIMIT 1;
  END IF;
  IF v_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM public.customers WHERE LOWER(email) = v_email LIMIT 1;
  END IF;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.customers SET avatar_key = p_avatar WHERE id = v_id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_customer_avatar(text, text, text) TO anon, authenticated;

-- Bots con avatar fijo (cambia el return type → drop primero)
DROP FUNCTION IF EXISTS public.get_weekly_top();
DROP FUNCTION IF EXISTS public._ranking_bots();

CREATE FUNCTION public._ranking_bots()
RETURNS TABLE(customer_id text, display_name text, pts integer, order_count integer, avatar_key text)
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  VALUES
    ('bot:migue',  'Migue B.', 3, 3, 'm2'),
    ('bot:cami',   'Cami R.',  2, 2, 'f1'),
    ('bot:tincho', 'Tincho',   1, 1, 'capi')
$$;

CREATE FUNCTION public.get_weekly_top()
RETURNS TABLE(rank_position integer, display_name text, points integer, avatar_key text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH all_rows AS (
    SELECT w.customer_id, public._display_name(w.customer_name) AS display_name,
      FLOOR(w.total_amount / 10000)::int AS pts, w.order_count, 0 AS is_bot,
      (SELECT c.avatar_key FROM public.customers c
        WHERE c.avatar_key IS NOT NULL AND (
          regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = w.customer_id
          OR LOWER(c.email) = w.customer_id)
        ORDER BY COALESCE(c.last_order_at, c.created_at) DESC LIMIT 1) AS avatar_key
    FROM public._weekly_customer_aggregate w
    UNION ALL
    SELECT customer_id, display_name, pts, order_count, 1, avatar_key FROM public._ranking_bots()
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY pts DESC, is_bot ASC, order_count DESC)::int AS pos
    FROM all_rows WHERE pts > 0
  )
  SELECT pos, display_name, pts, avatar_key FROM ranked WHERE pos <= 5 ORDER BY pos;
$$;

-- get_my_ranking referencia _ranking_bots (dropeada arriba) → recrear igual
CREATE OR REPLACE FUNCTION public.get_my_ranking(my_email text DEFAULT NULL, my_phone text DEFAULT NULL)
RETURNS TABLE(my_position integer, my_points integer, my_count integer, points_to_top5 integer, top5_min_points integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH normalized AS (SELECT COALESCE(NULLIF(TRIM(my_phone), ''), LOWER(NULLIF(TRIM(my_email), ''))) AS my_id),
  all_rows AS (
    SELECT customer_id, FLOOR(total_amount / 10000)::int AS pts, order_count, 0 AS is_bot
    FROM public._weekly_customer_aggregate
    UNION ALL
    SELECT customer_id, pts, order_count, 1 FROM public._ranking_bots()
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY pts DESC, is_bot ASC, order_count DESC)::int AS pos
    FROM all_rows
  ),
  top5_threshold AS (SELECT COALESCE(MIN(pts), 0)::int AS min_pts FROM ranked WHERE pos <= 5 AND pts > 0)
  SELECT r.pos, r.pts, r.order_count, GREATEST(0, (t.min_pts + 1) - r.pts), t.min_pts
  FROM ranked r CROSS JOIN top5_threshold t CROSS JOIN normalized n
  WHERE r.customer_id = n.my_id;
$$;
