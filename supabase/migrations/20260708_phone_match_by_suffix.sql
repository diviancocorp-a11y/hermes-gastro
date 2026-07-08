-- Matching de telefono por SUFIJO (ultimos 10 digitos = numero nacional AR).
--
-- Problema 1 (robustez +54): lookup_customer_by_phone y get_phone_customer_orders
-- matcheaban exacto (phone = phone_search). Un cliente guardado en crudo
-- (3814123456) no matcheaba con 5493814123456 ni viceversa -> historial guest y
-- login fragmentados segun el formato. phone_key() normaliza ambos lados (saca
-- no-digitos y toma los ultimos 10) para que crudo/549/0/formateado matcheen.
--
-- Problema 2 (columna vacia): los pedidos guardan el telefono en orders.phone;
-- orders.customer_phone quedo vacia (0 filas llenas en LNP y MM). Las RPCs
-- matcheaban customer_phone -> devolvian historial/order_count SIEMPRE vacio
-- (bug latente del historial guest). Ahora matchean sobre orders.phone con
-- COALESCE al viejo customer_phone por robustez.
--
-- No requiere backfill: al normalizar ambos lados en tiempo de consulta, los
-- datos viejos en crudo y cualquier futuro dato normalizado (549...) matchean.
-- Aplicado 8/jul en la-nona-pato y mala-miga. cochi quedo pendiente (proyecto
-- pausado ese dia): reaplicar este archivo cuando se reactive.

CREATE OR REPLACE FUNCTION public.phone_key(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10);
$$;

CREATE OR REPLACE FUNCTION public.lookup_customer_by_phone(phone_search text)
RETURNS TABLE(display_name text, full_name text, nickname text, email text,
  has_email boolean, order_count integer, last_order_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c record; display text; k text;
BEGIN
  k := public.phone_key(phone_search);
  IF length(k) < 8 THEN RETURN; END IF;
  SELECT cu.id, cu.name, cu.nickname AS nick, cu.email AS em, cu.last_order_at AS last_at
    INTO c FROM customers cu WHERE public.phone_key(cu.phone) = k LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  display := COALESCE(split_part(c.name,' ',1)||' '||left(split_part(c.name,' ',2),1)||'.', c.name);
  RETURN QUERY SELECT display, c.name, COALESCE(c.nick,''), COALESCE(c.em,''),
    c.em IS NOT NULL AND c.em <> '',
    (SELECT COUNT(*)::int FROM orders o WHERE public.phone_key(COALESCE(NULLIF(o.phone,''), o.customer_phone)) = k),
    c.last_at;
END $$;

CREATE OR REPLACE FUNCTION public.get_phone_customer_orders(phone_search text)
RETURNS TABLE(id uuid, date date, total numeric, status text, created_at timestamptz,
  delivery text, payment text, customer text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE k text;
BEGIN
  k := public.phone_key(phone_search);
  IF length(k) < 8 THEN RETURN; END IF;
  RETURN QUERY
    SELECT o.id, o.date, o.total, o.status, o.created_at, o.delivery, o.payment, o.customer
    FROM orders o
    WHERE public.phone_key(COALESCE(NULLIF(o.phone,''), o.customer_phone)) = k
      AND COALESCE(o.status,'') NOT IN ('cancelado','cancelled','anulado')
    ORDER BY o.created_at DESC
    LIMIT 50;
END $$;

GRANT EXECUTE ON FUNCTION public.phone_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_customer_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_phone_customer_orders(text) TO anon, authenticated;
