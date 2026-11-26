-- Test de la 0149: anular un pedido completado lo saca de Ventas y de Caja,
-- devuelve el stock y no se puede repetir. Correr cada vez que se toca
-- anular_pedido, complete_order o el libro de stock.
--
-- Es UN bloque DO que siembra un negocio de prueba y termina SIEMPRE con
-- raise exception: la transaccion se deshace entera y no queda nada en la
-- base. No toca ningun negocio real.
--
-- Correr (DESPUES de aplicar la 0149): pegar en el SQL editor o via MCP
-- execute_sql. El resultado viene en el mensaje del error:
--   ANULAR_PEDIDO OK {...}      todo bien
--   ANULAR_PEDIDO FALLA: ...    que se esperaba y que dio
--
-- Escenario: Hamburguesa = 1 pan + 0.5 carne; Gaseosa sin receta con stock 7.
-- Pedido: 2 hamburguesas y 3 gaseosas, cobrado en efectivo. Se completa, se
-- anula con motivo y se prueban los rechazos: segunda anulacion, motivo corto,
-- pedido no completado y un usuario sin rol.

do $test$
declare
  v_t      uuid := gen_random_uuid();
  v_user   uuid := gen_random_uuid();
  v_mozo   uuid := gen_random_uuid();
  v_pan    uuid := gen_random_uuid();
  v_carne  uuid := gen_random_uuid();
  v_hamb   uuid := gen_random_uuid();
  v_gas    uuid := gen_random_uuid();
  v_order  uuid := gen_random_uuid();
  v_activo uuid := gen_random_uuid();
  v_res    jsonb;
  v_ventas integer;
  v_pagos  integer;
  v_status text;
  v_motivo text;
  v_stock  jsonb;
  v_returns integer;
  v_dos    text;
  v_corto  text;
  v_activ  text;
  v_mozo_r text;
  v_falla  text := '';
begin
  -- ── siembra ──
  insert into public.tenants (id, slug, name, vertical)
    values (v_t, 'test-anular-' || substr(v_t::text, 1, 8), 'Test anular 0149', 'gastro');
  if not exists (select 1 from public.branches where tenant_id = v_t and is_default) then
    insert into public.branches (tenant_id, name, is_default) values (v_t, 'Central', true);
  end if;
  insert into public.tenant_members (tenant_id, user_id, role, roles) values
    (v_t, v_user, 'owner',     array['owner']),
    (v_t, v_mozo, 'attendant', array['attendant']);

  insert into public.ingredients (id, tenant_id, name, stock, cost) values
    (v_pan,   v_t, 'Pan',   10, 100),
    (v_carne, v_t, 'Carne',  5, 500);
  insert into public.products (id, tenant_id, type, name, price, stock) values
    (v_hamb, v_t, 'composite', 'Hamburguesa', 1000, null),
    (v_gas,  v_t, 'simple',    'Gaseosa',      300, 7);
  insert into public.product_ingredients (tenant_id, product_id, ingredient_id, qty) values
    (v_t, v_hamb, v_pan,   1),
    (v_t, v_hamb, v_carne, 0.5);

  insert into public.orders (id, tenant_id, status, payment, delivery, channel)
    values (v_order, v_t, 'active', 'efectivo', 'retiro', 'counter');
  insert into public.order_items (tenant_id, order_id, product_id, name_snapshot, unit_price, qty) values
    (v_t, v_order, v_hamb, 'Hamburguesa', 1000, 2),
    (v_t, v_order, v_gas,  'Gaseosa',      300, 3);
  insert into public.orders (id, tenant_id, status, payment, delivery, channel)
    values (v_activo, v_t, 'active', 'efectivo', 'retiro', 'counter');

  -- ── completar y cobrar como el duenio ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.complete_order(v_order);
  perform set_config('role', 'postgres', true);
  insert into public.payments (tenant_id, order_id, amount) values (v_t, v_order, 2900);

  -- ── anular ──
  -- Un mozo no puede.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_mozo, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.anular_pedido(v_order, 'cargado dos veces');
    v_mozo_r := 'no corto';
  exception when others then v_mozo_r := sqlerrm;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  -- Motivo corto y pedido sin completar.
  begin
    perform public.anular_pedido(v_order, 'x');
    v_corto := 'no corto';
  exception when others then v_corto := sqlerrm;
  end;
  begin
    perform public.anular_pedido(v_activo, 'prueba de carga');
    v_activ := 'no corto';
  exception when others then v_activ := sqlerrm;
  end;

  v_res := public.anular_pedido(v_order, '  cargado dos veces  ');

  begin
    perform public.anular_pedido(v_order, 'cargado dos veces');
    v_dos := 'no corto';
  exception when others then v_dos := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);

  -- ── lo que quedo ──
  select count(*) into v_ventas from public.sales where order_id = v_order;
  select count(*) into v_pagos  from public.payments where order_id = v_order;
  select status, cancel_reason into v_status, v_motivo from public.orders where id = v_order;
  select jsonb_object_agg(name, stock) into v_stock
    from (select name, stock from public.ingredients where tenant_id = v_t
          union all
          select name, stock from public.products where tenant_id = v_t) s;
  select count(*) into v_returns from public.inventory_movements
   where tenant_id = v_t and kind = 'return' and reference_id = v_order;

  -- ── esperado ──
  if v_mozo_r not like '%sin_permiso%' then v_falla := v_falla || format(' mozo=%s;', v_mozo_r); end if;
  if v_corto  not like '%falta_motivo%' then v_falla := v_falla || format(' motivo_corto=%s;', v_corto); end if;
  if v_activ  not like '%no_completado%' then v_falla := v_falla || format(' sin_completar=%s;', v_activ); end if;
  if v_dos    not like '%ya_anulado%' then v_falla := v_falla || format(' segunda_anulacion=%s;', v_dos); end if;
  if v_ventas <> 0 then v_falla := v_falla || format(' sales=%s (esperaba 0);', v_ventas); end if;
  if v_pagos <> 0 then v_falla := v_falla || format(' payments=%s (esperaba 0);', v_pagos); end if;
  if v_status <> 'cancelled' then v_falla := v_falla || format(' status=%s;', v_status); end if;
  if v_motivo is distinct from 'cargado dos veces' then v_falla := v_falla || format(' motivo=%s;', v_motivo); end if;
  if v_returns <> 2 then v_falla := v_falla || format(' movimientos_return=%s (esperaba 2);', v_returns); end if;
  -- pan 10, carne 5 y gaseosa 7: vuelven a donde estaban.
  if not ((v_stock->>'Pan')::numeric = 10 and (v_stock->>'Carne')::numeric = 5
          and (v_stock->>'Gaseosa')::numeric = 7) then
    v_falla := v_falla || format(' stock=%s (esperaba Pan 10, Carne 5, Gaseosa 7);', v_stock);
  end if;
  if (v_res->>'ventas')::int <> 2 or (v_res->>'total_ventas')::numeric <> 2900
     or (v_res->>'pagos')::int <> 1 or (v_res->>'stock_devuelto')::int <> 2 then
    v_falla := v_falla || format(' resultado=%s;', v_res);
  end if;
  if has_function_privilege('anon', 'public.anular_pedido(uuid,text)', 'execute') then
    v_falla := v_falla || ' anular_pedido es llamable por anon;';
  end if;

  if v_falla <> '' then
    raise exception 'ANULAR_PEDIDO FALLA:%', v_falla;
  end if;
  raise exception 'ANULAR_PEDIDO OK %', jsonb_build_object(
    'resultado', v_res, 'stock', v_stock, 'segunda', v_dos);
end $test$;
