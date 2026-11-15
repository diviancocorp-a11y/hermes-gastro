-- Aplicada via MCP el 2026-11-15
-- 1. Tasa manual de Cochi del 15/nov: 914,021 Bs. por dolar, la que dio Ricky
--    (es la que el BCV publico con vigencia desde el 16/nov). La manual del dia
--    le gana a la automatica (911,6243 de dolarapi, cargada por el sync).
-- 2. Cron diario de exchange-rate-sync: 06:00 y 09:00 de Caracas (10 y 13 UTC).
--    Solo de manana: el BCV publica a la tarde la tasa del dia habil siguiente
--    y la primera lectura del dia gana. La function valida el header contra
--    el secreto de Vault (tg_secreto_de_aviso), igual que tg-notificar.

insert into public.exchange_rates
  (tenant_id, base_currency, quote_currency, rate, effective_date, source, created_by)
select id, 'USD', 'VES', 914.021, date '2026-11-15', 'manual', null
from public.tenants where slug = 'cochi';

select cron.schedule('exchange-rate-sync', '0 10,13 * * *', $$
  select net.http_post(
    url := 'https://wwwzdgprsooyjgkuyoav.supabase.co/functions/v1/exchange-rate-sync',
    headers := jsonb_build_object('Content-Type','application/json',
               'x-dico-aviso', public.tg_secreto_de_aviso()),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
$$);
