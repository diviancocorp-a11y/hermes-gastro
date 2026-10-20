-- La cuenta del resultado del dia (0103, compras afuera desde la 0108).
-- Correr cada vez que se toque resultado_del_dia, register_purchase o alguna
-- de las tablas que suma.
--
-- No deja nada en la base: todo corre en un solo DO que TERMINA SIEMPRE EN
-- ERROR a proposito, y el error deshace la siembra entera. El resultado viene
-- en el mensaje del error:
--   'RESULTADO_DEL_DIA 17/17 ok'                    -> verde
--   'RESULTADO_DEL_DIA 15/17 ok | merma (...) ...'  -> lo que fallo
--
-- Correr: pegar en el SQL editor del proyecto, o via MCP execute_sql.
--
-- El escenario: una sucursal de Buenos Aires con corte a las 6 de la manana,
-- el dia 15/10/2026. La ventana real es del 15/10 06:00 al 16/10 06:00 hora
-- local (09:00 UTC a 09:00 UTC). Cada fila de afuera de la cuenta esta para
-- probar una trampa concreta.

do $$
declare
  t   uuid := gen_random_uuid();
  t2  uuid := gen_random_uuid();   -- otro negocio: no tiene que ver nada
  b   uuid := gen_random_uuid();
  b2  uuid := gen_random_uuid();   -- otra sucursal del mismo negocio
  o1  uuid := gen_random_uuid();
  st  uuid := gen_random_uuid();
  ing uuid := gen_random_uuid();
  e3  uuid := gen_random_uuid();
  u   uuid := gen_random_uuid();
  u2  uuid := gen_random_uuid();
  dia constant date := '2026-10-15';
  r   record;
  n   int;
  total int := 0;
  fallas text[] := '{}';
begin
  /* ── Siembra (como el rol de la sesion, sin RLS) ── */
  insert into public.tenants (id, slug, name, vertical) values
    (t,  'zz-prueba-0103-'  || substr(t::text, 1, 8),  'Prueba 0103',      'gastro'),
    (t2, 'zz-prueba-0103b-' || substr(t2::text, 1, 8), 'Prueba 0103 otro', 'gastro');
  -- register_purchase firma la compra con auth.uid() (created_by -> auth.users)
  insert into auth.users (id, aud, role, email)
    values (u, 'authenticated', 'authenticated', 'zz-prueba-0108-' || substr(u::text, 1, 8) || '@example.invalid');
  insert into public.tenant_members (tenant_id, user_id, roles) values
    (t, u, array['owner']), (t2, u2, array['owner']);
  insert into public.branches (id, tenant_id, name, timezone, day_cutoff_hour, is_default) values
    (b,  t, 'Casa central', 'America/Argentina/Buenos_Aires', 6, true),
    (b2, t, 'Sucursal 2',   'America/Argentina/Buenos_Aires', 6, false);

  -- Ventas. o1 tiene dos lineas (un ticket) y 1000 de descuento del pedido.
  insert into public.orders (id, tenant_id, branch_id, status, total, subtotal, discount)
    values (o1, t, b, 'completed', 12000, 13000, 1000);
  insert into public.sales (tenant_id, branch_id, order_id, qty, unit_price, unit_cost, total, created_at) values
    -- 23:30 local del 15 = 02:30 UTC del 16: la trampa de current_date en UTC
    (t, b, o1, 2, 5000, 1500, 10000, '2026-10-16 02:30+00'),
    -- sin receta: costo 0, se cuenta aparte
    (t, b, o1, 1, 3000, 0,    3000,  '2026-10-16 02:30+00'),
    -- venta suelta a las 4 de la manana del 16: antes del corte, es del 15
    (t, b, null, 1, 2000, 800, 2000, '2026-10-16 07:00+00'),
    -- 5 de la manana del 15: antes del corte, es del 14. Afuera
    (t, b, null, 1, 9000, 100, 9000, '2026-10-15 08:00+00'),
    -- otra sucursal, mismo momento. Afuera
    (t, b2, null, 1, 99999, 1, 99999, '2026-10-16 02:30+00');

  -- Nomina: 4 horas a 2000 la hora, fichadas el 15.
  insert into public.staff (id, tenant_id, branch_id, name, hourly_cost)
    values (st, t, b, 'Cocinero de prueba', 2000);
  insert into public.time_entries (tenant_id, branch_id, staff_id, clock_in_at, clock_out_at, business_day)
    values (t, b, st, '2026-10-15 21:00+00', '2026-10-16 01:00+00', dia);

  -- Merma: 2 x 500 al costo del libro + 1 x 300 sin costo en el libro (toma
  -- el del insumo). La del 14 queda afuera.
  insert into public.ingredients (id, tenant_id, name, unit, cost, stock)
    values (ing, t, 'Queso de prueba', 'kg', 300, 100);
  insert into public.inventory_movements (tenant_id, branch_id, ingredient_id, kind, qty, unit_cost, created_at) values
    (t, b, ing, 'waste', -2, 500,  '2026-10-15 15:00+00'),
    (t, b, ing, 'waste', -1, null, '2026-10-15 16:00+00'),
    (t, b, ing, 'waste', -5, 500,  '2026-10-14 15:00+00'),
    -- una compra no es merma
    (t, b, ing, 'purchase', 10, 300, '2026-10-15 15:00+00');

  -- Gastos.
  insert into public.expenses (tenant_id, branch_id, date, description, amount, expense_type, usar_category) values
    (t, b, dia,          'Gas',               2000,  'variable', null),
    -- mercaderia: ya esta en el costo de lo vendido. Afuera
    (t, b, dia,          'Carne',             5000,  'variable', 'food_meat'),
    (t, b, dia,          'Bolsas',            400,   'variable', 'packaging'),
    -- de ayer. Afuera
    (t, b, dia - 1,      'Gas de ayer',       1000,  'variable', null),
    -- alquiler de octubre: 31000 / 31 dias = 1000 por dia
    (t, b, '2026-10-01', 'Alquiler',          31000, 'fixed',    null),
    -- alquiler de septiembre. Afuera
    (t, b, '2026-09-01', 'Alquiler sep',      30000, 'fixed',    null),
    -- gasto de la otra sucursal. Afuera
    (t, b2, dia,         'Gas sucursal 2',    7777,  'variable', null);
  -- Un gasto anulado no paso: ni el original ni el contraasiento.
  insert into public.expenses (id, tenant_id, branch_id, date, description, amount, expense_type, voided_at)
    values (e3, t, b, dia, 'Mal cargado', 700, 'variable', now());
  insert into public.expenses (tenant_id, branch_id, date, description, amount, expense_type, voids_expense_id)
    values (t, b, dia, 'Anula: Mal cargado', -700, 'variable', e3);

  /* ── La cuenta, como el dueno ── */
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', 'authenticated')::text, true);

  -- Una compra de insumos cargada hoy, por la RPC real: 10 kg a 300. Es
  -- inventario, no gasto: lo que cuesta es lo vendido, y eso ya esta en
  -- costo_mercaderia. Antes de la 0108 entraba entera en gastos_del_dia.
  perform public.register_purchase(t, dia,
    jsonb_build_array(jsonb_build_object('ingredient_id', ing, 'qty', 10, 'unit_cost', 300)));
  select count(*) into n from public.expenses e
   where e.tenant_id = t and e.date = dia and e.category = 'Materia Prima'
     and e.usar_category is null and e.amount = 3000 and e.branch_id = b;
  total := total + 1; if n <> 1 then
    fallas := fallas || format('la compra no quedo como la asienta register_purchase (%s filas)', n); end if;

  select * into r from public.resultado_del_dia(b, dia);

  total := total + 1; if r.dia is distinct from dia then fallas := fallas || format('dia (%s)', r.dia); end if;
  total := total + 1; if r.ventas is distinct from 15000::numeric then fallas := fallas || format('ventas (esperado 15000, dio %s)', r.ventas); end if;
  total := total + 1; if r.descuentos is distinct from 1000::numeric then fallas := fallas || format('descuentos (esperado 1000, dio %s)', r.descuentos); end if;
  total := total + 1; if r.costo_mercaderia is distinct from 3800::numeric then fallas := fallas || format('costo_mercaderia (esperado 3800, dio %s)', r.costo_mercaderia); end if;
  total := total + 1; if r.lineas_sin_costo is distinct from 1 then fallas := fallas || format('lineas_sin_costo (esperado 1, dio %s)', r.lineas_sin_costo); end if;
  total := total + 1; if r.tickets is distinct from 2 then fallas := fallas || format('tickets (esperado 2, dio %s)', r.tickets); end if;
  total := total + 1; if r.nomina is distinct from 8000::numeric then fallas := fallas || format('nomina (esperado 8000, dio %s)', r.nomina); end if;
  total := total + 1; if r.horas is distinct from 4::numeric then fallas := fallas || format('horas (esperado 4, dio %s)', r.horas); end if;
  total := total + 1; if r.merma is distinct from 1300::numeric then fallas := fallas || format('merma (esperado 1300, dio %s)', r.merma); end if;
  total := total + 1; if r.gastos_del_dia is distinct from 2000::numeric then fallas := fallas || format('gastos_del_dia (esperado 2000, dio %s)', r.gastos_del_dia); end if;
  total := total + 1; if r.gastos_fijos is distinct from 1000::numeric then fallas := fallas || format('gastos_fijos (esperado 1000, dio %s)', r.gastos_fijos); end if;
  -- 15000 - 1000 - 3800 - 8000 - 1300 - 2000 - 1000
  total := total + 1; if r.ganancia_neta is distinct from -2100::numeric then fallas := fallas || format('ganancia_neta (esperado -2100, dio %s)', r.ganancia_neta); end if;

  -- Un dia sin nada da todo en 0, no una fila vacia. En noviembre: cualquier
  -- dia de octubre carga su parte del alquiler.
  select * into r from public.resultado_del_dia(b, '2026-11-03');
  total := total + 1; if r.ganancia_neta is distinct from 0::numeric or r.ventas is distinct from 0::numeric then
    fallas := fallas || format('dia vacio (ventas %s, ganancia %s)', r.ventas, r.ganancia_neta); end if;

  -- Sin dia es hoy en la zona de la sucursal.
  select * into r from public.resultado_del_dia(b);
  total := total + 1; if r.dia is distinct from public.business_date(b, now()) then
    fallas := fallas || format('sin dia (dio %s)', r.dia); end if;

  /* ── Otro negocio no ve nada ── */
  perform set_config('request.jwt.claims',
    json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.resultado_del_dia(b, dia);
  total := total + 1; if n <> 0 then fallas := fallas || format('otro negocio ve %s fila(s)', n); end if;

  /* ── Anonimo no puede llamarla ── */
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  n := 0;
  begin
    perform public.resultado_del_dia(b, dia);
  exception when insufficient_privilege then
    n := -1;
  end;
  total := total + 1; if n <> -1 then fallas := fallas || 'anon puede llamarla'; end if;

  perform set_config('role', 'none', true);
  raise exception 'RESULTADO_DEL_DIA %/% ok%', total - cardinality(fallas), total,
    case when cardinality(fallas) = 0 then '' else ' | ' || array_to_string(fallas, ' | ') end;
end $$;
