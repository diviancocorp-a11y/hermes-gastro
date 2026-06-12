-- 20260612_suppliers_cuit_invoice_location.sql
-- Aplicada via MCP en los 3 tenants el 12/jun/2026.
--
-- Proveedores enriquecidos: CUIT, si puede facturar, ubicacion.
-- is_active pasa de soft-delete oculto a pause/play visible en la UI
-- (pausado: va al fondo de la lista y no aparece al cargar gastos/compras).
alter table public.suppliers add column if not exists cuit text;
alter table public.suppliers add column if not exists can_invoice boolean not null default false;
alter table public.suppliers add column if not exists location text;

-- "Eliminar" pasa a ser DELETE real: la FK de gastos suelta la referencia
-- (el gasto conserva el nombre del proveedor en texto).
alter table public.expenses drop constraint if exists expenses_supplier_id_fkey;
alter table public.expenses add constraint expenses_supplier_id_fkey
  foreign key (supplier_id) references public.suppliers(id) on delete set null;
