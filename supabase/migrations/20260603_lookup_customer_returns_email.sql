DROP FUNCTION IF EXISTS public.lookup_customer_by_phone(text);

CREATE FUNCTION public.lookup_customer_by_phone(phone_search text)
RETURNS TABLE(
  display_name text, full_name text, nickname text, email text,
  has_email boolean, order_count integer, last_order_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c record; display text;
BEGIN
  SELECT cu.id, cu.name, cu.nickname AS nick, cu.email AS em, cu.last_order_at AS last_at
    INTO c FROM customers cu WHERE cu.phone = phone_search LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  display := COALESCE(split_part(c.name,' ',1)||' '||left(split_part(c.name,' ',2),1)||'.', c.name);
  RETURN QUERY SELECT display, c.name, COALESCE(c.nick,''), COALESCE(c.em,''),
    c.em IS NOT NULL AND c.em <> '',
    (SELECT COUNT(*)::int FROM orders o WHERE o.customer_phone = phone_search),
    c.last_at;
END $$;

GRANT EXECUTE ON FUNCTION public.lookup_customer_by_phone(text) TO anon, authenticated;
