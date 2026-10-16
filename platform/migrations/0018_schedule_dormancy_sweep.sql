-- 0018 Barrido diario de negocios dormidos (pg_cron).
-- RESCATADA el 16/oct/2026 de supabase_migrations.schema_migrations
-- (version 20260813234331, aplicada por MCP el 13/ago/2026). El SQL de abajo es
-- `statements` de esa fila, sin tocar. El archivo nunca estuvo en el repo:
-- el cron `release-dormant-tenants` corria sin que ninguna migracion lo
-- creara. Lo encontro la revision de las 27 migraciones sin archivo.
--

create extension if not exists pg_cron;

-- Barrido diario a las 4am UTC (1am Argentina): hora muerta, y si libera un
-- slug nadie esta mirando el catalogo en ese momento.
select cron.unschedule('release-dormant-tenants')
where exists (select 1 from cron.job where jobname = 'release-dormant-tenants');

select cron.schedule(
  'release-dormant-tenants',
  '0 4 * * *',
  $$select public.release_dormant_tenants(45)$$
);
