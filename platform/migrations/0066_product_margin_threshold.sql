-- 0066: umbral configurable para alertas de margen en la lista de productos.

alter table public.settings
  add column if not exists min_product_margin_pct numeric not null default 30
  check (min_product_margin_pct >= 0 and min_product_margin_pct <= 100);
