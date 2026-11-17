-- Aplicada via MCP el 2026-11-17
-- Datos del tenant cochi: titular de la cuenta de pago movil (0138), lo paso
-- Ricky el 17/nov.

update public.settings
set payment_accounts = (
  select jsonb_agg(case when a->>'id' = 'cochi-pago-movil' then jsonb_set(a, '{titular}', '"José Valera"') else a end)
  from jsonb_array_elements(payment_accounts) a)
where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
