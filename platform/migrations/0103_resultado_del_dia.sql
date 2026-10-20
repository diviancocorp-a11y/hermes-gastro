-- 0103 El resultado del dia: cuanto se gano hoy, por sucursal.
-- SIN APLICAR: espera el ok de Ricky. Aditiva (una funcion nueva, no toca
-- nada de lo que ya corre). Al aplicarla, cambiar esta linea por
-- "Aplicada via MCP el <fecha>".
--
-- Hasta aca el resultado existia solo por mes (MonthSummary, armado en el
-- front con todas las ventas del tenant). La promesa es "sabe cuanto ganas
-- cada noche", y eso es una cuenta por dia operativo y por sucursal:
--
--   ventas
--   - descuentos          (los del pedido: sales lleva el subtotal de items)
--   - costo de mercaderia (el unit_cost que complete_order congelo en sales)
--   - nomina              (horas FICHADAS x valor hora: labor_cost_vs_sales)
--   - merma               (libro de inventario, kind 'waste', al costo del dia)
--   - gastos del dia      (variables y en cuotas con fecha de hoy)
--   - gastos fijos        (los del mes, prorrateados por dia)
--   = ganancia neta
--
-- Criterios, uno por linea de la cuenta:
--
-- * El dia es el DIA OPERATIVO de la sucursal (business_date: zona horaria +
--   hora de corte), sobre sales.created_at. Mismo criterio que
--   labor_cost_vs_sales, asi la nomina y las ventas hablan del mismo dia.
--   sales.date no sirve: complete_order lo llena con current_date, que es UTC
--   (una venta de las 22 hs de Buenos Aires cae al dia siguiente).
-- * El envio no entra: no es venta de producto y casi siempre se le paga al
--   que reparte. Mismo criterio que el resumen del mes.
-- * Los gastos de mercaderia (usar_category food_* o packaging) no entran: ya
--   estan en el costo de lo vendido. Es el fix de doble conteo de jun/2026.
-- * Un gasto anulado no paso: se excluyen el original (voided_at) y su
--   contraasiento (voids_expense_id). En el mes se netean igual.
-- * Los fijos (alquiler, servicios) se cargan un dia pero son de todo el mes:
--   cargados de golpe, el dia del alquiler daria una perdida que no es de ese
--   dia. Se reparten en partes iguales entre los dias del mes.
-- * lineas_sin_costo cuenta las ventas que se asentaron sin receta
--   (unit_cost 0): su margen no se conoce y la ganancia queda inflada. La UI
--   lo dice en vez de esconderlo.
--
-- SECURITY INVOKER: cada rol ve la cuenta que su RLS le deja ver (un rol sin
-- acceso a gastos ve los gastos en 0). Los permisos son los de las tablas.

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

comment on function public.resultado_del_dia is
  'Ganancia neta del dia operativo de una sucursal: ventas - descuentos - '
  'costo de mercaderia - nomina fichada - merma - gastos del dia - fijos del '
  'mes prorrateados. p_day null = hoy en la zona de la sucursal.';
