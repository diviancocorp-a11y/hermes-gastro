-- Permisos de recetas e insumos por rol (0102). Correr cada vez que se toquen
-- las policies de `ingredients` o `product_ingredients`.
--
-- No deja nada en la base: todo corre en un solo DO que TERMINA SIEMPRE EN
-- ERROR a proposito, y el error deshace la siembra entera (tenant, miembros,
-- auditoria, libro de stock). El resultado viene en el mensaje del error:
--   'RECETAS_POR_ROL 56/56 ok'                         -> verde
--   'RECETAS_POR_ROL 40/56 ok | kitchen.edita_receta ...' -> lo que fallo
--
-- Antes de aplicar la 0102 tiene que fallar (todos escriben todo); despues,
-- 56 de 56.
--
-- Correr: pegar en el SQL editor del proyecto, o via MCP execute_sql.

do $$
declare
  t  uuid := gen_random_uuid();
  p  uuid := gen_random_uuid();
  i1 uuid := gen_random_uuid();  -- esta en la receta
  i2 uuid := gen_random_uuid();  -- suelto (para probar el borrado: i1 lo frena la FK)
  u  uuid;
  rol text;
  n  int;
  real boolean;
  esperado boolean;
  accion text;
  total int := 0;
  fallas text[] := '{}';
  -- Quien DEBE poder hacer cada cosa. Lo que no esta en la lista, no.
  matriz constant jsonb := '{
    "lee_receta":   ["owner","manager","cashier","attendant","kitchen","marketer","accountant"],
    "edita_receta": ["owner","manager"],
    "agrega_linea": ["owner","manager"],
    "borra_linea":  ["owner","manager"],
    "edita_insumo": ["owner","manager","kitchen"],
    "alta_insumo":  ["owner","manager","kitchen"],
    "borra_insumo": ["owner"],
    "merma":        ["owner","manager","kitchen"]
  }';
begin
  /* ── Siembra (como el rol de la sesion, sin RLS) ── */
  insert into public.tenants (id, slug, name, vertical)
    values (t, 'zz-prueba-0102-' || substr(t::text, 1, 8), 'Prueba 0102', 'gastro');
  -- Sin sucursal por defecto la merma no puede asentar en el libro
  -- (aplicar_movimiento_al_saldo) y da error para todos los roles.
  insert into public.branches (tenant_id, name, is_default) values (t, 'Casa central', true);
  insert into public.products (id, tenant_id, type, name, price)
    values (p, t, 'composite', 'Plato de prueba', 100);
  insert into public.ingredients (id, tenant_id, name, unit, cost, stock) values
    (i1, t, 'Harina de prueba', 'kg', 10, 100),
    (i2, t, 'Sal de prueba', 'kg', 5, 100);
  insert into public.product_ingredients (tenant_id, product_id, ingredient_id, qty)
    values (t, p, i1, 1);

  foreach rol in array array['owner','manager','cashier','attendant','kitchen','marketer','accountant'] loop
    u := gen_random_uuid();
    perform set_config('role', 'none', true);
    insert into public.tenant_members (tenant_id, user_id, roles) values (t, u, array[rol]);

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', u, 'role', 'authenticated')::text, true);

    foreach accion in array array['lee_receta','edita_receta','agrega_linea','borra_linea',
                                  'edita_insumo','alta_insumo','borra_insumo','merma'] loop
      n := 0;
      -- Cada accion corre en su propio bloque y se deshace con un error
      -- propio, asi la siguiente arranca del mismo estado. Las variables
      -- locales sobreviven al rollback del bloque.
      begin
        case accion
          when 'lee_receta' then
            select count(*) into n from public.product_ingredients where tenant_id = t;
          when 'edita_receta' then
            update public.product_ingredients set qty = 2 where product_id = p and ingredient_id = i1;
            get diagnostics n = row_count;
          when 'agrega_linea' then
            insert into public.product_ingredients (tenant_id, product_id, ingredient_id, qty)
              values (t, p, i2, 1);
            get diagnostics n = row_count;
          when 'borra_linea' then
            delete from public.product_ingredients where product_id = p and ingredient_id = i1;
            get diagnostics n = row_count;
          when 'edita_insumo' then
            update public.ingredients set cost = 99 where id = i1;
            get diagnostics n = row_count;
          when 'alta_insumo' then
            insert into public.ingredients (tenant_id, name) values (t, 'Nuevo de ' || rol);
            get diagnostics n = row_count;
          when 'borra_insumo' then
            delete from public.ingredients where id = i2;
            get diagnostics n = row_count;
          when 'merma' then
            perform public.register_waste(t, i1, 1, 'otro');
            n := 1;
        end case;
        raise exception '__deshacer__';
      exception when others then
        if sqlerrm <> '__deshacer__' then n := -1; end if;  -- error real = bloqueado
      end;

      real := n = 1;
      esperado := (matriz -> accion) ? rol;
      total := total + 1;
      if real is distinct from esperado then
        fallas := fallas || format('%s.%s (esperado %s, dio %s)', rol, accion,
          case when esperado then 'puede' else 'no puede' end,
          case when n = -1 then 'error' else n || ' fila(s)' end);
      end if;
    end loop;
  end loop;

  perform set_config('role', 'none', true);
  raise exception 'RECETAS_POR_ROL %/% ok%', total - cardinality(fallas), total,
    case when cardinality(fallas) = 0 then '' else ' | ' || array_to_string(fallas, ' | ') end;
end $$;
