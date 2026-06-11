-- 20260611_ranking_bots.sql
-- Bots de arranque para el ranking semanal: 3 "clientes" fijos con pocos
-- puntos (3/2/1 = $30k/$20k/$10k) para que el ranking nunca este vacio y los
-- clientes reales entiendan la mecanica y los superen facil.
--
-- Empate real vs bot: gana el real (tiebreak is_bot ASC).
-- OJO premio del lunes: en semanas muertas los bots pueden quedar en el
-- podio. Se reconocen por customer_id 'bot:%' / estos nombres fijos.

CREATE OR REPLACE FUNCTION public._ranking_bots()
RETURNS TABLE(customer_id text, display_name text, pts integer, order_count integer)
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  VALUES
    ('bot:migue',  'Migue B.', 3, 3),
    ('bot:cami',   'Cami R.',  2, 2),
    ('bot:tincho', 'Tincho',   1, 1)
$$;

-- Top 5 publico: reales (anonimizados) + bots, rankeados juntos
CREATE OR REPLACE FUNCTION public.get_weekly_top()
RETURNS TABLE(rank_position integer, display_name text, points integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH all_rows AS (
    SELECT customer_id, public._display_name(customer_name) AS display_name,
      FLOOR(total_amount / 10000)::int AS pts, order_count, 0 AS is_bot
    FROM public._weekly_customer_aggregate
    UNION ALL
    SELECT customer_id, display_name, pts, order_count, 1 FROM public._ranking_bots()
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY pts DESC, is_bot ASC, order_count DESC)::int AS pos
    FROM all_rows WHERE pts > 0
  )
  SELECT pos, display_name, pts FROM ranked WHERE pos <= 5 ORDER BY pos;
$$;

-- Posicion personal: misma union para que "Vos sos #N" sea consistente
-- con lo que se ve en el podio (los bots tambien cuentan posiciones)
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
