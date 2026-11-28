-- Test de la 0154: anular un pedido devuelve lo que la venta bajo de verdad,
-- no la cantidad entera. Correr DESPUES de aplicar la 0154, y cada vez que se
-- toca descontar_stock_del_pedido, anular_pedido o complete_order.
--
-- UN bloque DO que siembra un negocio de prueba y termina SIEMPRE con
-- raise exception: la transaccion se deshace entera. No toca negocios reales.
-- Resultado en el mensaje del error:
--   ANULAR_DEVUELVE OK {...}      todo bien
--   ANULAR_DEVUELVE FALLO: ...    que se esperaba y que dio
--
-- Casos:
--   a) insumo con stock 50, receta pide 200 -> vender deja 0 (libro -200,
--      stock_aplicado -50) -> anular deja 50 (return +200).
--   b) insumo con stock 500, receta pide 200 -> 300 -> anular deja 500.
--   c) producto sin receta, stock 1, linea de 3 -> 0 (stock_descontado 1) ->
--      anular deja 1.
--   d) movimiento 'sale' viejo con stock_aplicado null -> anular devuelve la
--      cantidad entera (como antes de la 0154).

do $test$
declare
  v_t     uuid := gen_random_uuid();
  v_user  uuid := gen_random_uuid();
  v_ia    uuid := gen_random_uuid();  -- insumo a
  v_ib    uuid := gen_random_uuid();  -- insumo b
  v_id    uuid := gen_random_uuid();  -- insumo d
  v_pa    uuid := gen_random_uuid();  -- plato a
  v_pb    uuid := gen_random_uuid();
  v_pc    uuid := gen_random_uuid();  -- producto sin receta
  v_oa    uuid := gen_random_uuid();
  v_ob    uuid := gen_random_uuid();
  v_oc    uuid := gen_random_uuid();
  v_od    uuid := gen_random_uuid();
  v_falla text := '';
  v_n     numeric;
  v_m     record;
begin
  -- ── siembra ──
  insert into public.tenants (id, slug, name, vertical)
    values (v_t, 'test-anular-' || substr(v_t::text, 1, 8), 'Test anular 0154', 'gastro');
  if not exists (select 1 from public.branches where tenant_id = v_t and is_default) then
    insert into public.branches (tenant_id, name, is_default) values (v_t, 'Central', true);
  end if;
  insert into public.tenant_members (tenant_id, user_id, role, roles)
    values (v_t, v_user, 'owner', array['owner']);
  insert into public.profiles (id, tenant_id, full_name, email)
    values (v_user, v_t, 'Duena Test', 'duena.test@example.com')
    on conflict (id) do update set full_name = 'Duena Test';
  begin
    insert into auth.users (id, email) values (v_user, 'duena.test@example.com')
      on conflict (id) do nothing;
  exception when others then
    null;
  end;

  insert into public.ingredients (id, tenant_id, name, stock, cost) values
    (v_ia, v_t, 'Pollo A', 50, 10),
    (v_ib, v_t, 'Pollo B', 500, 10),
    (v_id, v_t, 'Pollo D', 10, 10);
  insert into public.products (id, tenant_id, type, name, price, stock) values
    (v_pa, v_t, 'composite', 'Plato A', 1000, null),
    (v_pb, v_t, 'composite', 'Plato B', 1000, null),
    (v_pc, v_t, 'simple',    'Gaseosa',  300, 1);
  insert into public.product_ingredients (tenant_id, product_id, ingredient_id, qty) values
    (v_t, v_pa, v_ia, 200),
    (v_t, v_pb, v_ib, 200);

  insert into public.orders (id, tenant_id, status, payment, delivery, channel) values
    (v_oa, v_t, 'active', 'efectivo', 'retiro', 'counter'),
    (v_ob, v_t, 'active', 'efectivo', 'retiro', 'counter'),
    (v_oc, v_t, 'active', 'efectivo', 'retiro', 'counter'),
    (v_od, v_t, 'completed', 'efectivo', 'retiro', 'counter');
  insert into public.order_items (tenant_id, order_id, product_id, name_snapshot, unit_price, qty, subtotal) values
    (v_t, v_oa, v_pa, 'Plato A', 1000, 1, 1000),
    (v_t, v_ob, v_pb, 'Plato B', 1000, 1, 1000),
    (v_t, v_oc, v_pc, 'Gaseosa',  300, 3,  900);

  -- d) venta vieja: asiento 'sale' sin stock_aplicado, a mano.
  insert into public.inventory_movements (
    tenant_id, branch_id, ingredient_id, kind, qty, unit_cost,
    reference_type, reference_id, client_request_id, stock_aplicado
  ) values (
    v_t, (select b.id from public.branches b where b.tenant_id = v_t and b.is_default),
    v_id, 'sale', -200, 10, 'order', v_od, v_od, null
  );

  -- ── completar como el duenio ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.complete_order(v_oa);
  perform public.complete_order(v_ob);
  perform public.complete_order(v_oc);
  perform set_config('role', 'postgres', true);

  -- ── despues de vender ──
  select stock into v_n from public.ingredients where id = v_ia;
  if v_n <> 0 then v_falla := v_falla || format(' a_venta_stock=%s (esperaba 0);', v_n); end if;
  select * into v_m from public.inventory_movements
   where reference_id = v_oa and kind = 'sale' and ingredient_id = v_ia;
  if v_m.qty is distinct from -200 or v_m.stock_aplicado is distinct from -50 then
    v_falla := v_falla || format(' a_movimiento_sale qty=%s aplicado=%s (esperaba -200 / -50);', v_m.qty, v_m.stock_aplicado);
  end if;
  select stock into v_n from public.ingredients where id = v_ib;
  if v_n <> 300 then v_falla := v_falla || format(' b_venta_stock=%s (esperaba 300);', v_n); end if;
  select stock into v_n from public.products where id = v_pc;
  if v_n <> 0 then v_falla := v_falla || format(' c_venta_stock=%s (esperaba 0);', v_n); end if;
  select stock_descontado into v_n from public.order_items where order_id = v_oc;
  if v_n is distinct from 1 then v_falla := v_falla || format(' c_stock_descontado=%s (esperaba 1);', v_n); end if;

  -- ── anular los cuatro ──
  perform set_config('role', 'authenticated', true);
  perform public.anular_pedido(v_oa, 'prueba de stock');
  perform public.anular_pedido(v_ob, 'prueba de stock');
  perform public.anular_pedido(v_oc, 'prueba de stock');
  perform public.anular_pedido(v_od, 'prueba de stock');
  perform set_config('role', 'postgres', true);

  -- a) 50, y el libro devuelve lo que asento
  select stock into v_n from public.ingredients where id = v_ia;
  if v_n <> 50 then v_falla := v_falla || format(' a_anular_stock=%s (esperaba 50);', v_n); end if;
  select * into v_m from public.inventory_movements
   where reference_id = v_oa and kind = 'return' and ingredient_id = v_ia;
  if v_m.qty is distinct from 200 or v_m.stock_aplicado is distinct from 50 then
    v_falla := v_falla || format(' a_movimiento_return qty=%s aplicado=%s (esperaba 200 / 50);', v_m.qty, v_m.stock_aplicado);
  end if;
  -- b) vuelve a 500
  select stock into v_n from public.ingredients where id = v_ib;
  if v_n <> 500 then v_falla := v_falla || format(' b_anular_stock=%s (esperaba 500);', v_n); end if;
  -- c) vuelve a 1
  select stock into v_n from public.products where id = v_pc;
  if v_n <> 1 then v_falla := v_falla || format(' c_anular_stock=%s (esperaba 1);', v_n); end if;
  -- d) sin dato, la cantidad entera: 10 + 200
  select stock into v_n from public.ingredients where id = v_id;
  if v_n <> 210 then v_falla := v_falla || format(' d_anular_stock=%s (esperaba 210);', v_n); end if;

  if has_function_privilege('anon', 'public.anular_pedido(uuid,text)', 'execute') then
    v_falla := v_falla || ' anular_pedido es llamable por anon;';
  end if;
  if has_function_privilege('authenticated', 'public.descontar_stock_del_pedido(uuid)', 'execute') then
    v_falla := v_falla || ' descontar_stock_del_pedido es llamable por authenticated;';
  end if;

  if v_falla <> '' then
    raise exception 'ANULAR_DEVUELVE FALLO:%', v_falla;
  end if;
  raise exception 'ANULAR_DEVUELVE OK a=50 b=500 c=1 d=210';
end $test$;
