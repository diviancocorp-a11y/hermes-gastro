-- Aplicada via MCP el 2026-11-15
-- Datos del tenant cochi: 10 productos cargados el 27/sep tenian el precio en
-- otra moneda (de cuando Cochi estaba en AR) y se leian como dolares. Pasan
-- al precio en USD del sitio de Cochi (public/data/products.json). Decision
-- de Ricky del 15/nov. "Costillas a la BBQ" se toma como la racion individual.

update public.products p
set price = v.usd
from (values
  ('Shawarma de Carne',       9.00, 4865.00),
  ('Shawarma Mixto',          8.00, 4263.00),
  ('Shawarma de Pollo',       7.00, 3648.00),
  ('Costillas a la BBQ',      9.00, 4864.00),
  ('Arroz Chino Classic Box', 4.00, 2432.00),
  ('Arroz Chino Megabox',     6.00, 3650.00),
  ('Tenders',                 7.00, 3040.00),
  ('Alitas de pollo',         6.00, 3040.00),
  ('Papas fritas pequeñas',   1.50,  912.00),
  ('Papas fritas grandes',    3.50, 2128.00)
) as v(name, usd, viejo)
where p.tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
  and p.name = v.name
  and p.price = v.viejo;
