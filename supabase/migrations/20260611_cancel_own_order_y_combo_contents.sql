-- 20260611_cancel_own_order_y_combo_contents.sql

-- Boton de arrepentimiento: el cliente puede cancelar SU pedido durante los
-- primeros 60 segundos, solo si sigue en estado "new" (la cocina todavia no
-- lo agarro). El UUID del pedido es el secreto: solo lo tiene quien lo creo.
CREATE OR REPLACE FUNCTION public.cancel_own_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND status = 'new'
    AND created_at > now() - interval '60 seconds';
  RETURN FOUND;
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_own_order(uuid) TO anon, authenticated;

-- Contenidos de combos visibles: para la descripcion automatica en la seccion
-- Super Combos ("Incluye: 2x Brownie - 1x Bebida"). combo_items no es legible
-- por anon via RLS, por eso el RPC SECURITY DEFINER acotado a combos visibles.
CREATE OR REPLACE FUNCTION public.get_combo_contents()
RETURNS TABLE(combo_id uuid, sub_name text, qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ci.recipe_id, r.name, ci.qty
  FROM public.combo_items ci
  JOIN public.recipes r ON r.id = ci.sub_recipe_id
  JOIN public.recipes c ON c.id = ci.recipe_id
  WHERE c.visible = true AND c.is_archived = false;
$$;
GRANT EXECUTE ON FUNCTION public.get_combo_contents() TO anon, authenticated;
