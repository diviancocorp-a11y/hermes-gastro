-- Aplicada via MCP el 2026-11-12
-- Datos internos de Cochi: salsas y marinados fuera del catalogo publico.

do $$
declare
  v_tenant uuid := (select id from public.tenants where slug = 'cochi');
begin
  if v_tenant is null then
    raise exception 'No existe el tenant cochi';
  end if;

  -- Insumos nuevos. Las cantidades de las recetas se guardan en la unidad base.
  insert into public.ingredients (tenant_id, name, unit, category, food_category)
  select v_tenant, x.name, x.unit, 'Preparaciones internas', 'Condimentos'
  from (values
    ('Salsa ketchup','g'), ('Papelón','g'), ('Jugo de lechosa','ml'), ('Refresco','ml'),
    ('Azúcar','g'), ('Salsa soya','g'), ('Salsa inglesa','g'), ('Vinagre','ml'),
    ('Mostaza','g'), ('Pimienta','g'), ('Orégano','g'), ('Ajo polvo','g'),
    ('Sal','g'), ('Canela','g'), ('Paprika','g'), ('Comino','g'),
    ('Color nacional','g'), ('Aceite','ml'), ('Perejil','g'), ('Romero','g'),
    ('7 especies','g'), ('Limón','g'), ('Cebolla rallada','g')
  ) as x(name, unit)
  where not exists (
    select 1 from public.ingredients i
    where i.tenant_id = v_tenant and lower(i.name) = lower(x.name)
  );

  -- Productos internos: quedan apagados y sirven como soporte de las recetas.
  insert into public.products (tenant_id, type, name, price, active, category, description)
  select v_tenant, 'composite', x.name, 0, false, 'Preparaciones internas', x.description
  from (values
    ('Salsa BBQ','Salsa BBQ interna; no visible en el catalogo.'),
    ('Marinado pollo asado','Marinado interno para 5 litros de salmuera.'),
    ('Marinado carne para shawarma','Marinado interno para 5 kg de carne.')
  ) as x(name, description)
  where not exists (select 1 from public.products p where p.tenant_id=v_tenant and p.name=x.name);

  -- Recetas y sus insumos. Se reemplazan solo los enlaces de estos tres productos,
  -- haciendo la carga repetible sin duplicar filas.
  insert into public.recipe_cards (tenant_id, product_id, yield_qty, yield_unit, steps, notes)
  select v_tenant, p.id, x.yield_qty, x.yield_unit, x.steps::jsonb, x.notes
  from (values
    ('Salsa BBQ',4000::numeric,'g', '[{"texto":"Mezclar todos los ingredientes y cocinar hasta integrar y espesar."}]', 'Receta informada por Cochi.'),
    ('Marinado pollo asado',5::numeric,'litros', '[{"texto":"Disolver los ingredientes en 5 litros de salmuera liquida y mezclar."}]', 'Receta informada por Cochi. Vinagre y aceite en ml.'),
    ('Marinado carne para shawarma',5::numeric,'kg', '[{"texto":"Mezclar todos los ingredientes y dejar marinar la carne para shawarma."}]', 'Receta informada por Cochi. Para 5 kg de carne.')
  ) as x(name, yield_qty, yield_unit, steps, notes)
  join public.products p on p.tenant_id=v_tenant and p.name=x.name
  where not exists (select 1 from public.recipe_cards r where r.tenant_id=v_tenant and r.product_id=p.id);

  delete from public.product_ingredients pi
  using public.products p
  where pi.product_id=p.id and pi.tenant_id=v_tenant and p.tenant_id=v_tenant
    and p.name in ('Salsa BBQ','Marinado pollo asado','Marinado carne para shawarma');

  insert into public.product_ingredients (tenant_id, product_id, ingredient_id, qty)
  select v_tenant, p.id, i.id, x.qty
  from (values
    ('Salsa BBQ','Salsa ketchup',4000::numeric),('Salsa BBQ','Papelón',800),('Salsa BBQ','Jugo de lechosa',2000),('Salsa BBQ','Refresco',1500),('Salsa BBQ','Azúcar',240),('Salsa BBQ','Salsa soya',40),('Salsa BBQ','Salsa inglesa',40),('Salsa BBQ','Vinagre',80),('Salsa BBQ','Mostaza',80),('Salsa BBQ','Pimienta',15),('Salsa BBQ','Orégano',2),('Salsa BBQ','Ajo polvo',30),('Salsa BBQ','Sal',20),('Salsa BBQ','Canela',0.5),
    ('Marinado pollo asado','Sal',450),('Marinado pollo asado','Orégano',2),('Marinado pollo asado','Pimienta',15),('Marinado pollo asado','Paprika',40),('Marinado pollo asado','Ajo polvo',60),('Marinado pollo asado','Comino',20),('Marinado pollo asado','Color nacional',40),('Marinado pollo asado','Vinagre',60),('Marinado pollo asado','Aceite',60),('Marinado pollo asado','Perejil',2),('Marinado pollo asado','Romero',2),
    ('Marinado carne para shawarma','Pimienta',15),('Marinado carne para shawarma','Comino',10),('Marinado carne para shawarma','Ajo polvo',40),('Marinado carne para shawarma','Sal',80),('Marinado carne para shawarma','7 especies',3),('Marinado carne para shawarma','Limón',75),('Marinado carne para shawarma','Cebolla rallada',70),('Marinado carne para shawarma','Paprika',20),('Marinado carne para shawarma','Aceite',60)
  ) as x(product_name, ingredient_name, qty)
  join public.products p on p.tenant_id=v_tenant and p.name=x.product_name
  join public.ingredients i on i.tenant_id=v_tenant and i.name=x.ingredient_name;
end $$;
