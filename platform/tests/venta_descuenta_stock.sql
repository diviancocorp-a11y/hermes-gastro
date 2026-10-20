-- Test de la 0103: completar un pedido descuenta el stock de su receta, una
-- sola vez. Correr cada vez que se toca complete_order o el libro.
--
-- Es UN bloque DO que siembra un negocio de prueba, completa un pedido y
-- termina SIEMPRE con raise exception: la transaccion se deshace entera y no
-- queda nada en la base (el libro es de solo agregar: un tenant con
-- movimientos no se podria borrar despues). No toca ningun negocio real.
--
-- Correr: pegar en el SQL editor o via MCP execute_sql. El resultado viene
-- en el mensaje del error:
--   VENTA_DESCUENTA_STOCK OK {...}      todo bien
--   VENTA_DESCUENTA_STOCK FALLA: ...    que se esperaba y que dio
--
-- Escenario: Hamburguesa = 1 pan + 0.5 carne; Pancho = 1 pan + 2 queso;
-- Gaseosa sin receta con stock 7 (comercio); Servicio sin receta ni stock.
-- Pedido en la sucursal NO default: 2 hamburguesas, 1 pancho, 3 gaseosas,
-- 1 servicio.

do $test$
declare
  v_t      uuid := gen_random_uuid();
  v_user   uuid := gen_random_uuid();
  v_suc    uuid := gen_random_uuid();
  v_pan    uuid := gen_random_uuid();
  v_carne  uuid := gen_random_uuid();
  v_queso  uuid := gen_random_uuid();
  v_hamb   uuid := gen_random_uuid();
  v_pancho uuid := gen_random_uuid();
  v_gas    uuid := gen_random_uuid();
  v_serv   uuid := gen_random_uuid();
  v_order  uuid := gen_random_uuid();
  v_ventas integer;
  v_movs   integer;
  v_otra   text;
  v_r      integer;
  v_stock  jsonb;
  v_saldo  jsonb;
  v_stock2 jsonb;
  v_falla  text := '';
begin
  -- @@MIGRACION@@ (el runner previo a aplicar la 0103 la inserta aca)

  -- ── siembra ──
  insert into public.tenants (id, slug, name, vertical)
    values (v_t, 'test-stock-' || substr(v_t::text, 1, 8), 'Test stock 0103', 'gastro');
  if not exists (select 1 from public.branches where tenant_id = v_t and is_default) then
    insert into public.branches (tenant_id, name, is_default) values (v_t, 'Central', true);
  end if;
  insert into public.branches (id, tenant_id, name, is_default) values (v_suc, v_t, 'Norte', false);
  insert into public.tenant_members (tenant_id, user_id, role, roles)
    values (v_t, v_user, 'owner', array['owner']);

  insert into public.ingredients (id, tenant_id, name, stock, cost) values
    (v_pan,   v_t, 'Pan',   10, 100),
    (v_carne, v_t, 'Carne',  5, 500),
    (v_queso, v_t, 'Queso',  1,  50);
  insert into public.products (id, tenant_id, type, name, price, stock) values
    (v_hamb,   v_t, 'composite', 'Hamburguesa', 1000, null),
    (v_pancho, v_t, 'composite', 'Pancho',       600, null),
    (v_gas,    v_t, 'simple',    'Gaseosa',      300, 7),
    (v_serv,   v_t, 'simple',    'Servicio',     100, null);
  insert into public.product_ingredients (tenant_id, product_id, ingredient_id, qty) values
    (v_t, v_hamb,   v_pan,   1),
    (v_t, v_hamb,   v_carne, 0.5),
    (v_t, v_pancho, v_pan,   1),
    (v_t, v_pancho, v_queso, 2);

  insert into public.orders (id, tenant_id, branch_id, status, payment, delivery, channel)
    values (v_order, v_t, v_suc, 'active', 'efectivo', 'retiro', 'counter');
  insert into public.order_items (tenant_id, order_id, product_id, name_snapshot, unit_price, qty) values
    (v_t, v_order, v_hamb,   'Hamburguesa', 1000, 2),
    (v_t, v_order, v_pancho, 'Pancho',       600, 1),
    (v_t, v_order, v_gas,    'Gaseosa',      300, 3),
    (v_t, v_order, v_serv,   'Servicio',     100, 1);

  -- ── completar como el duenio ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_ventas from public.complete_order(v_order);

  -- Segunda vez: tiene que cortar sin descontar.
  begin
    perform public.complete_order(v_order);
    v_otra := 'no corto';
  exception when others then
    v_otra := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);

  -- Y la funcion de descuento llamada de nuevo a mano: no asienta nada.
  v_r := public.descontar_stock_del_pedido(v_order);

  -- ── lo que quedo ──
  select jsonb_object_agg(name, stock) into v_stock
    from (select name, stock from public.ingredients where tenant_id = v_t
          union all
          select name, stock from public.products where tenant_id = v_t) s;
  select jsonb_object_agg(i.name, b.qty) into v_saldo
    from public.inventory_balances b join public.ingredients i on i.id = b.ingredient_id
   where b.tenant_id = v_t and b.branch_id = v_suc;
  select count(*) into v_movs from public.inventory_movements m
   where m.tenant_id = v_t and m.kind = 'sale' and m.reference_type = 'order'
     and m.reference_id = v_order and m.branch_id = v_suc and m.unit_cost is not null;

  -- ── esperado ──
  if v_ventas <> 4 then v_falla := v_falla || format(' ventas=%s (esperaba 4);', v_ventas); end if;
  if v_otra not like '%ya_completado%' then v_falla := v_falla || format(' segunda_llamada=%s;', v_otra); end if;
  if v_r <> 0 then v_falla := v_falla || format(' descontar_de_nuevo=%s (esperaba 0);', v_r); end if;
  if v_movs <> 3 then v_falla := v_falla || format(' movimientos_sale=%s (esperaba 3);', v_movs); end if;
  -- pan 10 - (2*1 + 1*1) = 7 ; carne 5 - 2*0.5 = 4 ; queso 1 - 2 -> piso 0
  -- gaseosa 7 - 3 = 4 ; servicio sin stock queda null
  v_stock2 := '{"Pan": 7, "Carne": 4.0, "Queso": 0, "Gaseosa": 4, "Hamburguesa": null, "Pancho": null, "Servicio": null}';
  if not (v_stock @> jsonb_build_object('Pan', 7) and (v_stock->>'Carne')::numeric = 4
          and (v_stock->>'Queso')::numeric = 0 and (v_stock->>'Gaseosa')::numeric = 4
          and v_stock->'Servicio' = 'null'::jsonb) then
    v_falla := v_falla || format(' stock=%s (esperaba %s);', v_stock, v_stock2);
  end if;
  -- El libro no tiene piso: queso queda en -2 en la sucursal del pedido.
  if not ((v_saldo->>'Pan')::numeric = -3 and (v_saldo->>'Carne')::numeric = -1
          and (v_saldo->>'Queso')::numeric = -2) then
    v_falla := v_falla || format(' saldo_sucursal=%s (esperaba Pan -3, Carne -1, Queso -2);', v_saldo);
  end if;
  if has_function_privilege('authenticated', 'public.descontar_stock_del_pedido(uuid)', 'execute')
     or has_function_privilege('anon', 'public.descontar_stock_del_pedido(uuid)', 'execute') then
    v_falla := v_falla || ' descontar_stock_del_pedido es llamable desde el front;';
  end if;

  if v_falla <> '' then
    raise exception 'VENTA_DESCUENTA_STOCK FALLA:%', v_falla;
  end if;
  raise exception 'VENTA_DESCUENTA_STOCK OK %', jsonb_build_object(
    'ventas', v_ventas, 'segunda_llamada', v_otra, 'movimientos_sale', v_movs,
    'stock', v_stock, 'saldo_sucursal', v_saldo);
end $test$;
