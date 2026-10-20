-- Test de la 0106: la venta que asienta complete_order lleva la jornada de la
-- sucursal del pedido (zona + hora de corte) y esa sucursal, no la fecha UTC
-- ni la sucursal default. Correr cada vez que se toque complete_order,
-- business_date o el resumen del mes.
--
-- No deja nada en la base: todo corre en un solo DO que TERMINA SIEMPRE EN
-- ERROR a proposito, y el error deshace la siembra entera. El resultado viene
-- en el mensaje del error:
--   'VENTA_DIA_OPERATIVO 7/7 ok'                  -> verde
--   'VENTA_DIA_OPERATIVO 5/7 ok | fecha (...) ...' -> lo que fallo
--
-- Correr: pegar en el SQL editor del proyecto, o via MCP execute_sql.
-- Para probar la migracion ANTES de aplicarla, reemplazar la linea
-- @@MIGRACION@@ por `execute $mig$ <cuerpo de la 0106> $mig$;`: el error del
-- final la deshace junto con la siembra.
--
-- complete_order usa now(), que no se puede fijar. Por eso las dos sucursales
-- estan en las puntas del huso: Kiritimati (UTC+14) y Etc/GMT+12 (UTC-12).
-- En cualquier instante al menos una de las dos esta en otro dia que UTC
-- (UTC+14 pasa al dia siguiente desde las 10 UTC; UTC-12 sigue en el
-- anterior hasta las 12 UTC), asi que la trampa de current_date se ve a
-- cualquier hora que se corra. El chequeo 'trampa' lo confirma.

do $$
declare
  t    uuid := gen_random_uuid();
  u    uuid := gen_random_uuid();
  bdef uuid;
  b2   uuid := gen_random_uuid();
  p    uuid := gen_random_uuid();
  o1   uuid := gen_random_uuid();   -- en la sucursal default (UTC+14)
  o2   uuid := gen_random_uuid();   -- en la otra (UTC-12)
  dia1 date;
  dia2 date;
  r    record;
  n    int;
  total int := 0;
  fallas text[] := '{}';
begin
  -- @@MIGRACION@@

  -- La sesion del edificio corre en UTC: current_date es la fecha UTC.
  perform set_config('timezone', 'UTC', true);

  /* ── Siembra (como el rol de la sesion, sin RLS) ── */
  insert into public.tenants (id, slug, name, vertical)
    values (t, 'zz-prueba-0106-' || substr(t::text, 1, 8), 'Prueba 0106', 'gastro');
  insert into public.tenant_members (tenant_id, user_id, role, roles)
    values (t, u, 'owner', array['owner']);

  -- El alta puede crear la sucursal default sola (0041): se reusa si esta.
  select id into bdef from public.branches where tenant_id = t and is_default;
  if bdef is null then
    bdef := gen_random_uuid();
    insert into public.branches (id, tenant_id, name, is_default)
      values (bdef, t, 'Central', true);
  end if;
  update public.branches set timezone = 'Pacific/Kiritimati', day_cutoff_hour = 0
   where id = bdef;
  insert into public.branches (id, tenant_id, name, timezone, day_cutoff_hour, is_default)
    values (b2, t, 'Oeste', 'Etc/GMT+12', 0, false);

  insert into public.products (id, tenant_id, type, name, price, stock)
    values (p, t, 'simple', 'Producto de prueba', 1000, null);
  insert into public.orders (id, tenant_id, branch_id, status, payment, delivery, channel) values
    (o1, t, bdef, 'active', 'efectivo', 'retiro', 'counter'),
    (o2, t, b2,   'active', 'efectivo', 'retiro', 'counter');
  insert into public.order_items (tenant_id, order_id, product_id, name_snapshot, unit_price, qty) values
    (t, o1, p, 'Producto de prueba', 1000, 2),
    (t, o2, p, 'Producto de prueba', 1000, 1);

  dia1 := public.business_date(bdef, now());
  dia2 := public.business_date(b2, now());

  /* ── Completar como el duenio ── */
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select * into r from public.complete_order(o1);
  -- Lo que devuelve la RPC es lo que asento.
  total := total + 1; if r.date is distinct from dia1 then
    fallas := fallas || format('devuelve (esperado %s, dio %s)', dia1, r.date); end if;
  perform public.complete_order(o2);

  perform set_config('role', 'none', true);

  /* ── Lo que quedo en sales ── */
  select count(*) into n from public.sales
   where order_id = o1 and date = dia1 and branch_id = bdef;
  total := total + 1; if n <> 1 then
    fallas := fallas || format('fecha default (esperado %s en Central, %s fila(s) ok)', dia1, n); end if;

  select count(*) into n from public.sales
   where order_id = o2 and date = dia2;
  total := total + 1; if n <> 1 then
    fallas := fallas || format('fecha otra sucursal (esperado %s, %s fila(s) ok)', dia2, n); end if;

  -- La venta queda en la sucursal del pedido, no en la default del trigger.
  select count(*) into n from public.sales where order_id = o2 and branch_id = b2;
  total := total + 1; if n <> 1 then
    fallas := fallas || format('sucursal (esperado Oeste, %s fila(s) ok)', n); end if;

  -- Lo mismo que lee el resultado del dia (0103): business_date(branch_id,
  -- created_at). El resumen del mes y el del dia cuentan la venta el mismo dia.
  select count(*) into n from public.sales
   where tenant_id = t and date is distinct from public.business_date(branch_id, created_at);
  total := total + 1; if n <> 0 then
    fallas := fallas || format('date vs created_at (%s fila(s) distintas)', n); end if;

  -- La prueba solo vale si alguna de las dos jornadas no es la fecha UTC.
  total := total + 1; if dia1 = current_date and dia2 = current_date then
    fallas := fallas || format('trampa (las dos jornadas dan %s = UTC)', current_date); end if;

  -- Misma firma, sin una segunda viva.
  select count(*) into n from pg_proc where proname = 'complete_order'
   and pronamespace = 'public'::regnamespace;
  total := total + 1; if n <> 1 then
    fallas := fallas || format('firmas de complete_order (%s)', n); end if;

  raise exception 'VENTA_DIA_OPERATIVO %/% ok%', total - cardinality(fallas), total,
    case when cardinality(fallas) = 0 then '' else ' | ' || array_to_string(fallas, ' | ') end;
end $$;
