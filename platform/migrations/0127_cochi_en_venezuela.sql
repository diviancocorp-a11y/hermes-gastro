-- Aplicada via MCP (execute_sql) el 2026-11-14
-- Datos del tenant, no esquema: Cochi pasa a Venezuela con bolivares como
-- moneda secundaria. La moneda principal sigue siendo USD (0100). Depende de
-- la 0126 (VE en el CHECK de country y tenants.secondary_currency).

update public.tenants
set country = 'VE', timezone = 'America/Caracas', secondary_currency = 'VES'
where slug = 'cochi';
