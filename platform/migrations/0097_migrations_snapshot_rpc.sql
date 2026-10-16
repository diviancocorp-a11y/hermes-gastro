-- 0097 Poder leer el historial de migraciones aplicadas al edificio.
-- Aplicada via MCP el 16/oct/2026.
--
-- ══════════════════ EL HUECO QUE TAPA ══════════════════
--
-- El 16/oct aparecio `alta_de_duenio_con_roles` (14/oct) aplicada sin archivo
-- en el repo: el repo decia que provision_owner y attach_owner eran la
-- version rota. Se vio de casualidad, listando el historial por MCP. Con esto
-- scripts/check-migraciones-sin-archivo.mjs lo mira cada manana en
-- morning-health.
--
-- ══════════════════ POR QUE DEFINER ══════════════════
--
-- supabase_migrations es de postgres y service_role no tiene USAGE ahi
-- (verificado el 16/oct). Las hermanas schema_snapshot / function_snapshot /
-- rls_snapshot leen catalogos que service_role si ve; esta no. Cerrada al
-- front: solo service_role, que es lo que usa el script de CI.

create or replace function public.migrations_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('version', m.version, 'name', m.name) order by m.version),
    '[]'::jsonb)
  from supabase_migrations.schema_migrations m;
$$;

revoke all on function public.migrations_snapshot() from public, anon, authenticated;
grant execute on function public.migrations_snapshot() to service_role;

comment on function public.migrations_snapshot is
  'Version y nombre de cada migracion aplicada, para que '
  'scripts/check-migraciones-sin-archivo.mjs avise de las que no tienen '
  'archivo en platform/migrations. Solo service role.';
