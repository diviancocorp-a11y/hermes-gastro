-- 0073 - El ticket tiene numero.
--
-- POR QUE HACE FALTA
-- En el KDS el ticket se llama "Mesa 7" o "Pedido 12". Lo primero sale de la
-- mesa; lo segundo no salia de ningun lado, porque el pedido solo tiene un
-- uuid. Un uuid no se grita: nadie dice "sale el a1b2c3d4" por encima del
-- ruido de una cocina, y el mostrador necesita cantar un numero para entregar.
--
-- POR QUE SE ASIGNA AL BAJAR A COCINA Y NO AL CREARSE
-- El numero es del TICKET, no del pedido. Un pedido que entra y se rechaza no
-- consume numero, porque nunca se produjo. Si se asignara al crearse, la
-- numeracion de la cocina tendria huecos por cada pedido rechazado y dejaria
-- de servir para lo unico que sirve: cantar en voz alta y que el de enfrente
-- encuentre la bandeja.
--
-- POR QUE SE REINICIA POR DIA
-- Un correlativo que nunca se reinicia llega a cuatro y cinco cifras en un mes
-- y deja de ser gritable. El numero vive lo que vive el servicio.
--
-- El dia se corta con `day_cutoff_hour` de la sucursal, no a medianoche: una
-- cocina que cierra a las 2 AM esta en el servicio del dia anterior, y
-- reiniciar la numeracion en medio del turno es peor que no tenerla.

alter table public.orders
  add column if not exists ticket_number integer;

create index if not exists orders_ticket_number_idx
  on public.orders (tenant_id, kitchen_at, ticket_number)
  where ticket_number is not null;


create or replace function public.bajar_pedido_a_cocina(
  p_tenant_id uuid,
  p_order_id  uuid
)
returns public.orders
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_o      public.orders;
  v_corte  integer;
  v_desde  timestamptz;
  v_num    integer;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;

  select * into v_o from public.orders o
   where o.id = p_order_id and o.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'pedido_de_otro_negocio';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'pedido_cancelado';
  end if;

  -- Idempotente: aprobar dos veces por un doble click no puede reiniciar el
  -- cronometro de una comanda que ya lleva diez minutos ni darle otro numero.
  if v_o.kitchen_at is not null then
    return v_o;
  end if;

  -- El inicio del servicio en curso. Sin sucursal o sin corte configurado,
  -- medianoche.
  select coalesce(b.day_cutoff_hour, 0) into v_corte
    from public.branches b where b.id = v_o.branch_id;
  v_corte := coalesce(v_corte, 0);

  v_desde := date_trunc('day', now()) + make_interval(hours => v_corte);
  if now() < v_desde then
    v_desde := v_desde - interval '1 day';
  end if;

  -- El maximo del servicio mas uno. Con el `for update` de arriba dos
  -- aprobaciones simultaneas del MISMO pedido no se pisan; para dos pedidos
  -- distintos al mismo tiempo, el peor caso es que compartan numero, que se
  -- resuelve mirando la mesa. Una secuencia por tenant seria exacta y no se
  -- podria reiniciar por dia, que es lo que hace al numero gritable.
  select coalesce(max(o.ticket_number), 0) + 1 into v_num
    from public.orders o
   where o.tenant_id = p_tenant_id
     and o.kitchen_at >= v_desde;

  update public.orders
     set kitchen_at = now(),
         status = 'preparing',
         ticket_number = v_num
   where id = v_o.id
  returning * into v_o;

  return v_o;
end $function$;

revoke all on function public.bajar_pedido_a_cocina(uuid, uuid) from anon;
