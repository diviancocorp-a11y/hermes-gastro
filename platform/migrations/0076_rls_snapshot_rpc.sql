-- 0076 Poder leer como esta REALMENTE el RLS del edificio.
--
-- ══════════════════ EL HUECO QUE TAPA ══════════════════
--
-- El aislamiento entre negocios lo da RLS por `tenant_id`, y ningun guard del
-- repo lo mira:
--
--   check-schema-sync / freshness / columns   columnas
--   check-functions-drift (0061)              cuerpo de funciones
--
-- Una tabla nueva sin `enable row level security`, o con una policy
-- `using (true)` para que el catalogo la lea sin login, no falla: funciona, y
-- cualquiera con la anon key lee los datos de todos los negocios. Es el error
-- mas caro que puede tener el edificio y el unico que no hace ruido.
--
-- Mismo antidoto que 0023 (`schema_snapshot`) y 0061 (`function_snapshot`):
-- un RPC que devuelve lo DESPLEGADO, y un script que lo juzga
-- (scripts/check-rls.mjs). La regla vive en el script, no aca: si cambia,
-- no hace falta otra migracion.
--
-- ══════════════════ QUE DEVUELVE ══════════════════
--
-- Una fila por tabla, vista o vista materializada de `public`:
--   rls            si tiene row level security activado
--   tenant_id      si tiene la columna (o sea, si es dato de un negocio)
--   security_invoker  para vistas: si respetan el RLS de quien consulta
--   anon_select / authenticated_select   si esos roles pueden leerla
--   policies       texto de cada policy tal como la reescribe Postgres
--
-- Se lee `pg_policies` y no los archivos de migracion porque lo que protege
-- es lo desplegado. Una policy cambiada por MCP sin archivo es justo el caso.

create or replace function public.rls_snapshot()
returns jsonb
language sql
stable
set search_path = public, pg_catalog, pg_temp
as $$
  select coalesce(jsonb_agg(fila order by fila->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'name', c.relname,
      -- r tabla, p particionada, v vista, m vista materializada
      'kind', c.relkind::text,
      'rls', c.relrowsecurity,
      'tenant_id', exists (
        select 1 from pg_attribute a
         where a.attrelid = c.oid
           and a.attname = 'tenant_id'
           and a.attnum > 0
           and not a.attisdropped
      ),
      -- Postgres guarda la opcion tal cual se escribio: `true`, `on`, `1`.
      'security_invoker', exists (
        select 1 from unnest(coalesce(c.reloptions, '{}')) o
         where lower(o) in ('security_invoker=true', 'security_invoker=on',
                            'security_invoker=1', 'security_invoker=yes')
      ),
      'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
      'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
      'policies', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', p.policyname,
                 'cmd', p.cmd,
                 'permissive', p.permissive,
                 'roles', to_jsonb(p.roles),
                 'using', p.qual,
                 'check', p.with_check
               ) order by p.policyname)
          from pg_policies p
         where p.schemaname = 'public'
           and p.tablename = c.relname
      ), '[]'::jsonb)
    ) as fila
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
  ) s;
$$;

-- Las policies describen quien ve que. No es un secreto, pero es el mapa de
-- como esta armado el aislamiento: no lo tiene que poder leer el catalogo
-- publico. Lo consume un script con service role.
revoke all on function public.rls_snapshot() from public, anon, authenticated;

comment on function public.rls_snapshot is
  'RLS desplegado de public (tablas, vistas y policies), para que '
  'scripts/check-rls.mjs verifique que ninguna tabla con tenant_id quede '
  'abierta entre negocios. Solo service role. Hermana de schema_snapshot() '
  '(0023) y function_snapshot() (0061).';

-- ══════════════════ COMO APLICARLA ══════════════════
--
-- Es de solo lectura y no toca datos ni schema: revertir es
-- `drop function public.rls_snapshot()`.
--
--   1. Aplicar por MCP sobre `wwwzdgprsooyjgkuyoav`.
--   2. Con PLATFORM_SUPABASE_SERVICE_ROLE_KEY exportada:
--        npm run check:rls
--      Sin credenciales o sin este RPC, el script SALTEA sin fallar.
--   3. No toca columnas: se sube `_migrations_through` a "0076" en
--      scripts/platform-schema.json sin regenerar.
