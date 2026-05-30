-- ─── Top Customers Weekly Ranking ─────────────────────────────
-- Sistema de puntos: 1 punto cada $10.000 gastados (NETO, sin pedidos cancelados).
-- Ranking semanal lunes 00:00 → domingo 23:59 (zona del server, ajustar si hace
-- falta TZ con AT TIME ZONE).
--
-- Privacidad: nombres anonimizados a "Juan G." y la identidad del cliente se
-- agrupa por COALESCE(phone, email_lowercase, customer_name).
--
-- Exposición: las RPCs son SECURITY DEFINER para que el catálogo público
-- (anon) pueda llamarlas sin abrir SELECT directo a la tabla orders.

-- ─── Helpers internos ─────────────────────────────────────────

-- Lunes 00:00 de la semana actual (date_trunc 'week' devuelve lunes en Postgres)
CREATE OR REPLACE FUNCTION public._current_week_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('week', NOW())::timestamptz;
$$;

-- Anonimizar nombre completo: "Juan García López" → "Juan G."
CREATE OR REPLACE FUNCTION public._display_name(full_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN full_name IS NULL OR TRIM(full_name) = '' THEN 'Cliente'
    WHEN array_length(string_to_array(TRIM(full_name), ' '), 1) = 1
      THEN INITCAP(TRIM(full_name))
    ELSE
      INITCAP(split_part(TRIM(full_name), ' ', 1)) || ' ' ||
      UPPER(LEFT(split_part(TRIM(full_name), ' ', 2), 1)) || '.'
  END;
$$;

-- ─── Vista interna: agregación semanal por cliente ────────────
-- Usamos vista interna (no exposed) para reusar lógica entre las 2 RPCs.

CREATE OR REPLACE VIEW public._weekly_customer_aggregate AS
  SELECT
    COALESCE(
      NULLIF(TRIM(o.phone), ''),
      LOWER(NULLIF(TRIM(o.email), '')),
      NULLIF(TRIM(o.customer), '')
    ) AS customer_id,
    MAX(o.customer) AS customer_name,
    SUM(COALESCE(o.total, 0))::numeric AS total_amount,
    COUNT(*)::int AS order_count
  FROM public.orders o
  WHERE o.status != 'cancelled'
    AND o.created_at >= public._current_week_start()
    AND COALESCE(
      NULLIF(TRIM(o.phone), ''),
      LOWER(NULLIF(TRIM(o.email), '')),
      NULLIF(TRIM(o.customer), '')
    ) IS NOT NULL
  GROUP BY 1;

-- ─── RPC 1: Top 5 de la semana ────────────────────────────────
-- Retorna: position (1-5), display_name (anonimizado), points (int)

-- NOTA: usamos `rank_position` (no `position`) porque `position` es keyword
-- reservado en Postgres y rompe el CREATE FUNCTION.
CREATE OR REPLACE FUNCTION public.get_weekly_top()
RETURNS TABLE(rank_position int, display_name text, points int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH ranked AS (
    SELECT
      customer_name,
      FLOOR(total_amount / 10000)::int AS pts,
      order_count,
      ROW_NUMBER() OVER (
        ORDER BY FLOOR(total_amount / 10000) DESC, order_count DESC
      )::int AS pos
    FROM public._weekly_customer_aggregate
  )
  SELECT
    pos AS rank_position,
    public._display_name(customer_name) AS display_name,
    pts AS points
  FROM ranked
  WHERE pos <= 5 AND pts > 0
  ORDER BY pos;
$$;

-- ─── RPC 2: Mi posición en el ranking ─────────────────────────
-- Input: email y/o phone del cliente logueado.
-- Output: my_position, my_points, my_count, points_to_top5

CREATE OR REPLACE FUNCTION public.get_my_ranking(my_email text DEFAULT NULL, my_phone text DEFAULT NULL)
RETURNS TABLE(
  my_position int,
  my_points int,
  my_count int,
  points_to_top5 int,
  top5_min_points int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH normalized AS (
    SELECT COALESCE(
      NULLIF(TRIM(my_phone), ''),
      LOWER(NULLIF(TRIM(my_email), ''))
    ) AS my_id
  ),
  ranked AS (
    SELECT
      customer_id,
      FLOOR(total_amount / 10000)::int AS pts,
      order_count,
      ROW_NUMBER() OVER (
        ORDER BY FLOOR(total_amount / 10000) DESC, order_count DESC
      )::int AS pos
    FROM public._weekly_customer_aggregate
  ),
  top5_threshold AS (
    SELECT COALESCE(MIN(pts), 0)::int AS min_pts FROM ranked WHERE pos <= 5
  )
  SELECT
    r.pos AS my_position,
    r.pts AS my_points,
    r.order_count AS my_count,
    GREATEST(0, (t.min_pts + 1) - r.pts) AS points_to_top5,
    t.min_pts AS top5_min_points
  FROM ranked r
  CROSS JOIN top5_threshold t
  CROSS JOIN normalized n
  WHERE r.customer_id = n.my_id;
$$;

-- ─── Permisos: anon (catálogo público) + authenticated ────────
GRANT EXECUTE ON FUNCTION public.get_weekly_top() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ranking(text, text) TO anon, authenticated;

-- Las RPCs son SECURITY DEFINER → ya tienen acceso a orders sin exponerla.
-- La vista _weekly_customer_aggregate NO se grant a anon — sólo las RPCs.

COMMENT ON FUNCTION public.get_weekly_top() IS
  'Top 5 clientes de la semana actual por puntos (1 pt = $10.000). Nombres anonimizados.';

COMMENT ON FUNCTION public.get_my_ranking(text, text) IS
  'Ranking del cliente identificado por email+phone. Devuelve posición, puntos, y cuántos puntos le faltan al top 5.';
