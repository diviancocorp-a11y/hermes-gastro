-- 0136 — Cochi: opciones de sus 5 productos y la sugerencia de papas (datos).
-- Aplicada via MCP el 2026-11-16 (despues de la 0135 y de publicar submit-order).
-- Solo datos del tenant `cochi`; no toca esquema. Matchea por NOMBRE del
-- producto en la base y avisa (NOTICE) lo que no encuentra, sin fallar.
--
-- Fuente: public/data/products.json y extras.json de CochiDarkitchen/cochi.
--   bandeja-3-carnes            -> "Bandeja 3 carnes"            (tenders / alitas, 250 g)
--   bandeja-costilla-pollo      -> "Bandeja costilla y pollo"    (tenders / alitas, 200 g)
--   arroz-especial-alitas       -> "Arroz especial con alitas"   (papas / ensalada)
--   arroz-especial-costillas    -> "Arroz especial con costillas"(papas / ensalada)
--   racion-alitas               -> "Alitas de pollo"  (INFERIDO: en la base no existe
--                                  "Racion individual de alitas"; "Alitas de pollo",
--                                  categoria Raciones Individuales a $6, es el mismo
--                                  producto por precio). Confirmar.
-- Sugerencia shawarma-papas: al pedir un shawarma, "Papas fritas pequeñas" a $1
-- (normal $1.50), 1 por shawarma. Cochi la ofrecia en la categoria Shawarmas; en
-- la base tres shawarmas estan en "Sandwiches", asi que va en las dos.
-- Ninguna opcion de Cochi suma precio hoy (todas a 0).

do $$
declare
  v_tenant uuid;
  v_papas uuid;
  r record;
  v_n int;
begin
  select id into v_tenant from public.tenants where slug = 'cochi';
  if v_tenant is null then raise notice 'tenant cochi no existe: no se cargo nada'; return; end if;

  for r in
    select * from (values
      ('Bandeja 3 carnes', '[{"id":"proteina","name":"Elige tenders o alitas","type":"single","required":true,"choices":[{"id":"tenders","label":"Tenders (250 g)"},{"id":"alitas","label":"Alitas (250 g)"}]}]'::jsonb),
      ('Bandeja costilla y pollo', '[{"id":"proteina","name":"Elige tenders o alitas","type":"single","required":true,"choices":[{"id":"tenders","label":"Tenders (200 g)"},{"id":"alitas","label":"Alitas (200 g)"}]}]'::jsonb),
      ('Arroz especial con alitas', '[{"id":"acompanamiento","name":"Elige un acompañamiento","type":"single","required":true,"choices":[{"id":"papas","label":"Papas fritas"},{"id":"ensalada","label":"Ensalada César"}]}]'::jsonb),
      ('Arroz especial con costillas', '[{"id":"acompanamiento","name":"Elige un acompañamiento","type":"single","required":true,"choices":[{"id":"papas","label":"Papas fritas"},{"id":"ensalada","label":"Ensalada César"}]}]'::jsonb),
      ('Alitas de pollo', '[{"id":"salsa","name":"Elige la preparación de tus alitas","type":"single","required":true,"choices":[{"id":"agridulce","label":"Agridulce"},{"id":"ajillo","label":"Al ajillo"},{"id":"bbq","label":"A la BBQ"},{"id":"clasicas","label":"Clásicas"}]}]'::jsonb)
    ) as t(nombre, grupos)
  loop
    update public.products set option_groups = r.grupos
     where tenant_id = v_tenant and name = r.nombre;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise notice 'SIN MATCH: producto "%" no existe en cochi', r.nombre; end if;
  end loop;

  select id into v_papas from public.products
   where tenant_id = v_tenant and name = 'Papas fritas pequeñas' and active;
  if v_papas is null then
    raise notice 'SIN MATCH: "Papas fritas pequeñas" no existe: no se creo la sugerencia';
    return;
  end if;

  if not exists (select 1 from public.product_suggestions where tenant_id = v_tenant and add_product_id = v_papas) then
    insert into public.product_suggestions
      (tenant_id, title, body, when_categories, add_product_id, special_price, max_per_item, active)
    values
      (v_tenant, 'Agrégale papas fritas', 'Ración pequeña con tu shawarma.',
       array['Shawarmas','Sandwiches'], v_papas, 1, 1, true);
  end if;
end $$;
