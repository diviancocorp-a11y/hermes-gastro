CREATE MATERIALIZED VIEW IF NOT EXISTS recipe_sale_counts AS
SELECT oi.recipe_id, SUM(oi.qty)::int AS sale_count,
       COUNT(DISTINCT oi.order_id)::int AS order_count,
       MAX(o.created_at) AS last_sold_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE COALESCE(o.status,'') NOT IN ('cancelado','cancelled','anulado')
GROUP BY oi.recipe_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_sale_counts_recipe_id
  ON recipe_sale_counts(recipe_id);

CREATE OR REPLACE FUNCTION public.refresh_recipe_sale_counts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recipe_sale_counts;
END $$;

GRANT EXECUTE ON FUNCTION public.refresh_recipe_sale_counts() TO authenticated;
GRANT SELECT ON recipe_sale_counts TO anon, authenticated;
