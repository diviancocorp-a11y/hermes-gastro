-- 0108 El resultado del dia no resta la compra de insumos.
-- Aplicada via MCP el 20/oct/2026, con ok de Ricky (schema_migrations
-- 20261020183425). Aditiva: misma firma y mismo retorno que la 0103, solo
-- cambia el cuerpo (create or replace compatible). Despues de aplicarla:
-- pg_proc 1 firma, invoker, anon sin execute; test SQL 17/17.
--
-- El bug (visto el 20/oct/2026 contra la funcion desplegada): register_purchase
-- (0098, igual desde la 0031) asienta cada compra en `expenses` con
-- category 'Materia Prima' y usar_category NULL. La 0103 solo sacaba de los
-- gastos del dia las filas con usar_category food_* o packaging, que es como
-- marcaba las compras el legacy. Resultado: el dia que se cargaba una compra,
-- la compra entera entraba como gasto del dia Y ademas se restaba el costo de
-- lo vendido segun recetas (sales.unit_cost). Doble conteo: la ganancia de
-- ese dia salia subestimada en el total de la compra.
--
-- El criterio, el mismo que usa el resumen del mes (esCompraDeInsumos en
-- src/constants/usar.js): una compra de insumos es inventario, no gasto.
--   category = 'Materia Prima'          -> lo que marca la compra desde la 0031
--   usar_category food_* o packaging    -> las compras del legacy
-- La carga manual de gastos no ofrece 'Materia Prima' (ExpForm la reserva
-- para Compras), asi que la categoria no se pisa con un gasto real.
--
-- Test: platform/tests/resultado_del_dia.sql (17 checks, uno con una compra
-- cargada por register_purchase el mismo dia de las ventas).

create or replace function public.resultado_del_dia(
  p_branch_id uuid,
  p_day date default null
)
returns table (
  dia date,
  ventas numeric,
  descuentos numeric,
  costo_mercaderia numeric,
  lineas_sin_costo integer,
  tickets integer,
  nomina numeric,
  horas numeric,
  merma numeric,
  gastos_del_dia numeric,
  gastos_fijos numeric,
  ganancia_neta numeric
)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  with b as (
    select br.id,
           br.tenant_id,
           d.dia,
           -- Ventana del dia operativo en tiempo real: de la hora de corte de
           -- `dia` a la hora de corte del dia siguiente, en la zona de la
           -- sucursal. Es la inversa de business_date, y deja usar el indice
           -- por created_at en vez de calcular la fecha fila por fila.
           ((d.dia::timestamp + make_interval(hours => br.day_cutoff_hour))
              at time zone br.timezone) as desde,
           (((d.dia + 1)::timestamp + make_interval(hours => br.day_cutoff_hour))
              at time zone br.timezone) as hasta
      from public.branches br
     cross join lateral (
       select coalesce(p_day, public.business_date(br.id, now())) as dia
     ) d
     where br.id = p_branch_id
       and br.tenant_id in (select private.current_user_tenants())
  ),
  vend as (
    select coalesce(sum(s.total), 0) as ventas,
           coalesce(sum(s.qty * coalesce(s.unit_cost, 0)), 0) as costo,
           count(*) filter (where coalesce(s.unit_cost, 0) = 0)::int as sin_costo,
           count(distinct coalesce(s.order_id, s.id))::int as tickets
      from public.sales s
      join b on s.branch_id = b.id and s.tenant_id = b.tenant_id
     where s.created_at >= b.desde
       and s.created_at <  b.hasta
  ),
  desc_ as (
    select coalesce(sum(o.discount), 0) as descuentos
      from public.orders o
      join b on o.tenant_id = b.tenant_id
     where o.id in (
       select s.order_id
         from public.sales s
        where s.branch_id = b.id
          and s.tenant_id = b.tenant_id
          and s.order_id is not null
          and s.created_at >= b.desde
          and s.created_at <  b.hasta
     )
  ),
  lab as (
    select coalesce(l.costo_laboral, 0) as nomina,
           coalesce(l.horas_trabajadas, 0) as horas
      from b
      cross join lateral public.labor_cost_vs_sales(b.id, b.dia) l
  ),
  merm as (
    select coalesce(sum(-m.qty * coalesce(m.unit_cost, i.cost, 0)), 0) as merma
      from public.inventory_movements m
      join b on m.branch_id = b.id and m.tenant_id = b.tenant_id
      left join public.ingredients i on i.id = m.ingredient_id
     where m.kind = 'waste'
       and m.created_at >= b.desde
       and m.created_at <  b.hasta
  ),
  gas as (
    select
      coalesce(sum(e.amount) filter (
        where e.date = b.dia and e.expense_type <> 'fixed'), 0) as del_dia,
      coalesce(sum(e.amount) filter (
        where e.expense_type = 'fixed'
          and date_trunc('month', e.date) = date_trunc('month', b.dia)), 0)
        / extract(day from (date_trunc('month', b.dia) + interval '1 month - 1 day'))
        as fijos
      from b
      left join public.expenses e
        on e.branch_id = b.id
       and e.tenant_id = b.tenant_id
       and e.voided_at is null
       and e.voids_expense_id is null
       -- La compra de insumos es inventario: lo que cuesta es lo vendido, y
       -- eso ya esta en costo_mercaderia. register_purchase la marca con
       -- category 'Materia Prima' y usar_category null (0031); las compras
       -- del legacy, con usar_category food_* o packaging.
       and e.category is distinct from 'Materia Prima'
       and not (coalesce(e.usar_category, '') like 'food\_%'
                or coalesce(e.usar_category, '') = 'packaging')
     group by b.dia
  )
  -- La ganancia sale de las lineas YA redondeadas: lo que se muestra tiene
  -- que sumar exacto, sin un centavo de diferencia.
  select r.dia, r.ventas, r.descuentos, r.costo_mercaderia, r.lineas_sin_costo,
         r.tickets, r.nomina, r.horas, r.merma, r.gastos_del_dia, r.gastos_fijos,
         r.ventas - r.descuentos - r.costo_mercaderia - r.nomina - r.merma
           - r.gastos_del_dia - r.gastos_fijos
    from (
      select b.dia,
             round(vend.ventas, 2)      as ventas,
             round(desc_.descuentos, 2) as descuentos,
             round(vend.costo, 2)       as costo_mercaderia,
             vend.sin_costo             as lineas_sin_costo,
             vend.tickets,
             round(lab.nomina, 2)       as nomina,
             round(lab.horas, 2)        as horas,
             round(merm.merma, 2)       as merma,
             round(gas.del_dia, 2)      as gastos_del_dia,
             round(gas.fijos, 2)        as gastos_fijos
        from b, vend, desc_, lab, merm, gas
    ) r;
$$;

revoke all on function public.resultado_del_dia(uuid, date) from public, anon;
grant execute on function public.resultado_del_dia(uuid, date) to authenticated;
