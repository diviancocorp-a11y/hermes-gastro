-- Aplicada via MCP el 26/nov/2026 (ok de Ricky): 29 productos actualizados.
-- 0151 — Cochi: fotos oficiales de los productos (zip "IMAGENES COCHI", 26/nov/2026).
-- Solo datos; no cambia esquema.
--
-- Los 25 archivos ya estan en el bucket tenant-images, carpeta del tenant
-- cochi (subidos por Ricky con el script de la sesion; nombre con hash del
-- contenido). El match foto -> producto es por nombre:
--   - COSTILLAS POR RACION va tambien en 1/4, 1/2 y 1 kilo de costilla sola.
--   - POLLO ASADO va en 1/2 pollo asado y en Pollo entero.
--   - BROWNIE no tiene producto en el menu: no se usa.
-- Pisa las 4 fotos que venian del sitio viejo (0133) con las oficiales.
--
-- Volver atras: image_url = null en los productos de la lista, y para los 4
-- de la 0133 volver a sus archivos cochi-food-* (ver 0133).

do $$
declare
  b text := 'https://wwwzdgprsooyjgkuyoav.supabase.co/storage/v1/object/public/tenant-images/27881a18-b49e-4ff4-831f-de7f5acf4aa5/';
  n integer;
begin
  with mapa(nombre, archivo) as (values
    ('Alitas de pollo', 'cochi-producto-alitas-4644a8b2.webp'),
    ('Arroz especial con alitas', 'cochi-producto-arroz-especial-con-alitas-d8e74578.webp'),
    ('Arroz especial con costillas', 'cochi-producto-arroz-especial-con-costilla-b8de9f18.webp'),
    ('Bandeja 3 carnes', 'cochi-producto-bandeja-3-carnes-12ea9c39.jpg'),
    ('Bandeja costilla y lomito', 'cochi-producto-bandeja-costilla-y-lomito-06573673.webp'),
    ('Bandeja costilla y pollo', 'cochi-producto-bandeja-costilla-y-pollo-ffcdf1e6.webp'),
    ('Ración de churrasco', 'cochi-producto-churraasco-995dbfc9.webp'),
    ('Arroz Chino Classic Box', 'cochi-producto-classic-box-5ec0265c.jpg'),
    ('Refresco 1 litro', 'cochi-producto-coca-cola-de-1-litro-d6f47e63.webp'),
    ('Refresco 2 litros', 'cochi-producto-coca-cola-de-2-litros-d6f47e63.webp'),
    ('Ración individual de Ribs a las BBQ', 'cochi-producto-costillas-indivuales-644cf14e.jpg'),
    ('Costillas a la BBQ', 'cochi-producto-costillas-por-racion-391206c7.webp'),
    ('¼ de costilla sola', 'cochi-producto-costillas-por-racion-391206c7.webp'),
    ('½ kilo de costilla sola', 'cochi-producto-costillas-por-racion-391206c7.webp'),
    ('1 kilo de costilla sola', 'cochi-producto-costillas-por-racion-391206c7.webp'),
    ('Ensalada César con pollo', 'cochi-producto-ensalda-cesar-con-pollo-6af7e891.webp'),
    ('Ensalada César', 'cochi-producto-ensalda-cesar-1d1a482c.webp'),
    ('Marquesa de chocolate', 'cochi-producto-marquesa-55c73dde.webp'),
    ('Arroz Chino Megabox', 'cochi-producto-mega-box-a77aaa02.jpg'),
    ('½ pollo asado', 'cochi-producto-pollo-asado-29393a6a.webp'),
    ('Pollo entero', 'cochi-producto-pollo-asado-29393a6a.webp'),
    ('Papas fritas grandes', 'cochi-producto-racion-de-papas-grandes-86efae2b.webp'),
    ('Papas fritas pequeñas', 'cochi-producto-racion-de-papas-pequenas-015655f8.webp'),
    ('Shawarma César', 'cochi-producto-shawarma-cesar-20cc4168.jpg'),
    ('Shawarma de Carne', 'cochi-producto-shawarma-de-carne-abc91b7b.webp'),
    ('Shawarma de pollo crispy', 'cochi-producto-shawarma-de-crispy-bbc94332.webp'),
    ('Shawarma de Pollo', 'cochi-producto-shawarma-de-pollo-400df293.webp'),
    ('Shawarma Mixto', 'cochi-producto-shawarma-mixto-d531b60e.webp'),
    ('Tenders', 'cochi-producto-tenders-d82ed56a.jpg')
  )
  update public.products p
     set image_url = b || m.archivo
    from mapa m
   where p.tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
     and p.name = m.nombre;
  get diagnostics n = row_count;
  if n <> 29 then
    raise exception 'esperaba 29 productos y actualice %', n;
  end if;
end $$;
