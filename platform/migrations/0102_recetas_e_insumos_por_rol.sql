-- 0102 Recetas e insumos dejan de ser escribibles por cualquier empleado.
-- Aplicada via MCP el 19/oct/2026 (schema_migrations 20261019224127,
-- `recetas_e_insumos_por_rol`), con el ok de Ricky.
-- Fase 0 de docs/plataforma/PLAN-RECETARIO.md.
--
-- ══════════════════ QUE PASA HOY ══════════════════
--
-- `ingredients` (0026) y `product_ingredients` (0028) tienen las 4 policies
-- por MEMBRESIA. Medido contra pg_policies el 19/oct: cualquiera con sesion
-- del negocio (mozo, cajero, marketing, contador) puede, contra la API,
-- cambiar las cantidades de una receta, el costo de un insumo o borrarlos.
-- Es el mismo hueco que la 0064 cerro en `products` y que no se extendio a
-- estas dos tablas.
--
-- ══════════════════ EL CORTE ══════════════════
--
-- product_ingredients (la receta: que insumo y cuanto)
--   LEER:    cualquier miembro, como hoy. El panel carga todas las lineas
--            para todos los roles (PlatformAdmin -> loadRecetas) y las usan
--            Ventas, gestion de productos y las reglas de Dico. Recortarlo
--            sin portar eso a una RPC deja al mozo con avisos falsos de
--            "producto sin receta". Esconder cantidades por ficha quedo para
--            despues (decision 2 del plan).
--   ESCRIBIR y BORRAR: duenio y encargado. Mismo criterio que `products`
--            (0064): la receta define el costo, y el costo, el precio.
--            BORRAR va con escribir y no solo duenio: guardar una receta es
--            borrar las lineas y volver a insertarlas
--            (saveProductIngredients, services/platformRecipes.js).
--
-- ingredients (los insumos)
--   LEER:    cualquier miembro, como hoy.
--   ESCRIBIR: duenio, encargado y cocina. La cocina tiene stock `PROPIO` en
--            la matriz (src/modules/roles.js) y hoy da de alta insumos y
--            carga merma desde StockPanel. `register_waste` es SECURITY
--            INVOKER y hace `select ... for update` + `update ingredients`:
--            con las policies de update la merma de la cocina sigue andando.
--            `register_purchase` tambien es invoker, pero inserta en
--            `expenses`, que ya es de duenio y encargado (0050).
--   BORRAR:  solo el duenio, como en el resto de 0050. La UI archiva.
--
-- Quedan afuera de la escritura: cajero, mozo, marketing y contador. En la
-- matriz el mozo tiene stock en `LECTURA` y los demas, nada.
--
-- ══════════════════ A QUIEN AFECTA HOY ══════════════════
--
-- A nadie: el 19/oct los 4 negocios con miembros (cochi, crazy-miga,
-- la-nona-pato, monare) tienen solo duenios. El corte se adelanta a que
-- carguen equipo.
--
-- Lo que la base no ve: StockPanel no esconde los botones por rol. Un mozo
-- que toque "Registrar merma" o "Nuevo insumo" va a ver el error generico de
-- guardado. Esconder esos botones va con la pantalla (fase 2).
--
-- Las funciones SECURITY DEFINER que mueven stock (`complete_order`,
-- `mover_stock_de_insumo`, `guardar_conteo_de_deposito`,
-- `register_stock_movement`) no pasan por estas policies: este corte no las
-- cambia, para bien y para mal.
--
-- Verificacion: platform/tests/recetas_por_rol.sql (antes de aplicar tiene
-- que fallar; despues, 56 de 56).
--
-- Mismo barrido previo que 0050 y 0064: las policies permisivas se combinan
-- con OR, asi que alcanza con que sobreviva una vieja por membresia para que
-- el corte no sirva de nada.

do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
            where schemaname = 'public'
              and tablename in ('product_ingredients', 'ingredients') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

/* ── product_ingredients ── */

create policy product_ingredients_select on public.product_ingredients for select using (
  tenant_id in (select private.current_user_tenants())
);

create policy product_ingredients_insert on public.product_ingredients for insert with check (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager'])
);

create policy product_ingredients_update on public.product_ingredients for update using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager'])
) with check (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager'])
);

create policy product_ingredients_delete on public.product_ingredients for delete using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager'])
);

comment on table public.product_ingredients is
  'Receta: que insumos y cuanto lleva un producto. Lee cualquier miembro; '
  'escriben y borran duenio y encargado (0102).';

/* ── ingredients ── */

create policy ingredients_select on public.ingredients for select using (
  tenant_id in (select private.current_user_tenants())
);

create policy ingredients_insert on public.ingredients for insert with check (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager','kitchen'])
);

create policy ingredients_update on public.ingredients for update using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager','kitchen'])
) with check (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager','kitchen'])
);

create policy ingredients_delete on public.ingredients for delete using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner'])
);

comment on table public.ingredients is
  'Insumos. Lee cualquier miembro; escriben duenio, encargado y cocina '
  '(la merma de register_waste es invoker); borra el duenio (0102).';
