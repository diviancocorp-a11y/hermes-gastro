-- 0098 La merma y la compra asientan en el libro de inventario.
-- RESCATADA el 16/oct/2026 de supabase_migrations.schema_migrations
-- (version 20260819124845, aplicada por MCP el 19/ago/2026). El SQL de abajo es
-- `statements` de esa fila, sin tocar. Lleva numero nuevo porque el
-- archivo se escribe hoy, pero en la base se aplico entre la 0042 y la 0043.
--
-- register_waste y register_purchase llaman a register_stock_movement
-- (0042). El repo seguia diciendo que corria la version de la 0040, que no
-- asienta en el libro. Misma firma y permisos que la 0040: no hace falta
-- volver a aplicarla.
--

create or replace function public.register_waste(
  p_tenant_id uuid,
  p_ingredient_id uuid,
  p_qty numeric,
  p_reason text default 'otro',
  p_note text default null,
  p_client_request_id uuid default null
)
returns setof public.waste_log
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ing public.ingredients;
  v_ya  public.waste_log;
  v_fila public.waste_log;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'cantidad_invalida';
  end if;

  if p_client_request_id is not null then
    select * into v_ya from public.waste_log w
     where w.tenant_id = p_tenant_id
       and w.client_request_id = p_client_request_id;
    if found then
      return next v_ya;
      return;
    end if;
  end if;

  select * into v_ing from public.ingredients i
   where i.id = p_ingredient_id and i.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'insumo_de_otro_negocio';
  end if;

  update public.ingredients
     set stock = greatest(0, stock - p_qty)
   where id = v_ing.id;

  insert into public.waste_log (
    tenant_id, ingredient_id, qty, reason, note, client_request_id
  )
  values (
    p_tenant_id, v_ing.id, p_qty,
    coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'otro'),
    nullif(btrim(coalesce(p_note, '')), ''),
    p_client_request_id
  )
  returning * into v_fila;

  perform public.register_stock_movement(
    p_tenant_id, 'waste', -p_qty, v_ing.id, null, null, v_ing.cost,
    'waste_log', v_fila.id, null, p_client_request_id);

  return next v_fila;
end $$;

revoke all on function public.register_waste(uuid, uuid, numeric, text, text, uuid)
  from public, anon;
grant execute on function public.register_waste(uuid, uuid, numeric, text, text, uuid)
  to authenticated;

create or replace function public.register_purchase(
  p_tenant_id uuid,
  p_date date,
  p_items jsonb,
  p_supplier text default null,
  p_supplier_id uuid default null,
  p_payment_method text default 'efectivo',
  p_payment_account_id text default null,
  p_receipt_url text default null,
  p_no_receipt boolean default false,
  p_client_request_id uuid default null
)
returns setof public.expenses
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_lineas jsonb;
  v_ajenos integer;
  v_gastro boolean;
  v_ya     public.expenses;
  v_gasto  public.expenses;
  v_linea  record;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;

  if p_client_request_id is not null then
    select * into v_ya from public.expenses e
     where e.tenant_id = p_tenant_id
       and e.client_request_id = p_client_request_id;
    if found then
      return next v_ya;
      return;
    end if;
    if exists (select 1 from public.inventory_movements m
                where m.tenant_id = p_tenant_id
                  and m.client_request_id = p_client_request_id
                  and m.kind = 'purchase') then
      return;
    end if;
  end if;

  select (t.vertical = 'gastro') into v_gastro
    from public.tenants t where t.id = p_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'ingredient_id', ingredient_id, 'qty', qty, 'unit_cost', unit_cost)), '[]'::jsonb)
    into v_lineas
    from (
      select (l ->> 'ingredient_id')::uuid                    as ingredient_id,
             sum(coalesce((l ->> 'qty')::numeric, 0))         as qty,
             (array_agg(coalesce((l ->> 'unit_cost')::numeric, 0) order by ord desc))[1] as unit_cost
        from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(l, ord)
       where nullif(l ->> 'ingredient_id', '') is not null
         and coalesce((l ->> 'qty')::numeric, 0) > 0
       group by 1
    ) g;

  if jsonb_array_length(v_lineas) = 0 then
    raise exception 'compra_sin_items';
  end if;

  select count(*) into v_ajenos
    from jsonb_to_recordset(v_lineas) as l(ingredient_id uuid)
    left join public.ingredients i
           on i.id = l.ingredient_id and i.tenant_id = p_tenant_id
   where i.id is null;
  if v_ajenos > 0 then
    raise exception 'insumo_de_otro_negocio';
  end if;

  with lineas as (
    select * from jsonb_to_recordset(v_lineas)
      as l(ingredient_id uuid, qty numeric, unit_cost numeric)
  ),
  movidos as (
    update public.ingredients i
       set stock = i.stock + l.qty,
           cost  = case when l.unit_cost > 0 then l.unit_cost else i.cost end
      from lineas l
     where i.id = l.ingredient_id
       and i.tenant_id = p_tenant_id
    returning i.id, i.name, i.unit, i.food_category
  ),
  detalle as (
    select sum(l.qty * l.unit_cost) as total,
           jsonb_agg(jsonb_build_object(
             'name', m.name, 'qty', l.qty, 'unit', m.unit,
             'unit_cost', l.unit_cost, 'subtotal', l.qty * l.unit_cost,
             'food_category', coalesce(m.food_category, case when v_gastro then 'dry' end)
           ) order by m.name) as items
      from movidos m
      join lineas l on l.ingredient_id = m.id
  )
  insert into public.expenses (
    tenant_id, date, description, amount, category, expense_type, usar_category,
    supplier, supplier_id, payment_method, payment_account_id,
    receipt_url, no_receipt, items, created_by, client_request_id
  )
  select
    p_tenant_id, coalesce(p_date, current_date), 'Compra de insumos',
    d.total, 'Materia Prima', 'variable', null,
    nullif(btrim(coalesce(p_supplier, '')), ''),
    p_supplier_id,
    coalesce(nullif(btrim(coalesce(p_payment_method, '')), ''), 'efectivo'),
    nullif(btrim(coalesce(p_payment_account_id, '')), ''),
    nullif(btrim(coalesce(p_receipt_url, '')), ''),
    coalesce(p_no_receipt, false),
    d.items, auth.uid(), p_client_request_id
  from detalle d
  where d.total > 0
  returning * into v_gasto;

  for v_linea in
    select * from jsonb_to_recordset(v_lineas)
      as l(ingredient_id uuid, qty numeric, unit_cost numeric)
  loop
    perform public.register_stock_movement(
      p_tenant_id, 'purchase', v_linea.qty, v_linea.ingredient_id, null, null,
      nullif(v_linea.unit_cost, 0), 'expense', v_gasto.id, null,
      p_client_request_id);
  end loop;

  if v_gasto.id is not null then
    return next v_gasto;
  end if;
  return;
end $$;

revoke all on function public.register_purchase(
  uuid, date, jsonb, text, uuid, text, text, text, boolean, uuid) from public, anon;
grant execute on function public.register_purchase(
  uuid, date, jsonb, text, uuid, text, text, text, boolean, uuid) to authenticated;
