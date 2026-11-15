-- Aplicada via MCP el 2026-11-15
-- Datos del tenant cochi: el pollo asado se muestra en el catalogo como
-- "solo domingos" (catalog_attributes.days = [0], cargado en la 0129) en vez
-- de estar inactivo. Decision de Ricky del 15/nov.

update public.products
set active = true
where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
  and category = 'Pollo asado'
  and name in ('½ pollo asado', 'Pollo entero');
