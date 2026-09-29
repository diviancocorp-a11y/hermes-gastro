-- 0082: el comprador puede cancelar su pedido en los primeros 60 segundos.
--
-- El boton "¿Te equivocaste? Cancelar pedido" del seguimiento y de la card del
-- catalogo llamaba a la edge function cancel-order y a la RPC cancel_own_order
-- del legacy: ninguna existe en el edificio, el boton no hacia nada.
--
-- LA REGLA vive solo aca, en un update atomico: el pedido es de ESTE negocio,
-- sigue en 'new' y tiene menos de 60 segundos. 'new' alcanza para saber que
-- no esta en la cocina: bajar_pedido_a_cocina lo pasa a 'preparing' al
-- mandarlo. Los que esperan revision del mozo (pending_review) o el pago
-- (pending_payment) no entran: no son 'new'.
--
-- Solo la ejecuta el service_role: la llama la edge function cancel-order
-- (platform/functions), que ademas le avisa al local por push. Una
-- cancelacion silenciosa es un pedido que el local prepara igual (caso
-- Ornela, 5/jul). Por eso no se abre a anon: sin la function no hay aviso.
--
-- El quien lo deja trg_auditar: un update de status sin actor (auth.uid()
-- null) es el comprador.

create or replace function public.cancel_own_order(p_tenant_slug text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t uuid;
  v_o public.orders;
begin
  select id into v_t from public.tenants where slug = lower(btrim(p_tenant_slug));
  if v_t is null then
    return jsonb_build_object('cancelado', false);
  end if;

  update public.orders
     set status = 'cancelled'
   where id = p_order_id
     and tenant_id = v_t
     and status = 'new'
     and created_at > now() - interval '60 seconds'
  returning * into v_o;

  if not found then
    return jsonb_build_object('cancelado', false);
  end if;

  return jsonb_build_object(
    'cancelado', true,
    'tenant_id', v_t,
    'total', v_o.total,
    'customer_first_name', nullif(split_part(btrim(coalesce(v_o.customer_name, '')), ' ', 1), '')
  );
end $$;

revoke all on function public.cancel_own_order(text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_own_order(text, uuid) to service_role;

comment on function public.cancel_own_order(text, uuid) is
  'Cancela un pedido new de menos de 60s del negocio del slug. Solo service_role: la llama la edge function cancel-order, que avisa al local.';
