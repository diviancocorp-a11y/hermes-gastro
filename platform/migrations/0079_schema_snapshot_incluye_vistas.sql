-- 0079 schema_snapshot() devuelve tambien las vistas.
--
-- ══════════════════ EL HUECO QUE TAPA ══════════════════
--
-- La 0023 filtraba `table_type = 'BASE TABLE'`. Pero el front tambien hace
-- `.from('<vista>').select(...)` — hoy `staff_fichas` (0056), que lee
-- platformStaff.js — y check-supabase-columns.mjs valida esas columnas
-- contra el mismo snapshot.
--
-- Resultado: la vista estaba cargada a mano en scripts/platform-schema.json y
-- `schema:sync --check` la reportaba como "esta en el snapshot y no en la
-- base" aunque existe. Encontrado el 27/sep/2026. Correr `schema:sync` sin
-- --check la borraba del JSON, y desde ahi el check de columnas daba un error
-- falso sobre codigo sano.
--
-- ══════════════════ POR QUE LA MISMA FORMA ══════════════════
--
-- Cada vista sale como una tabla mas: `nombre -> [columnas]`. Para validar un
-- .select() no importa si detras hay una tabla o una vista, y asi ni
-- schema-sync.mjs ni check-supabase-columns.mjs tienen que cambiar.
--
-- Las materializadas no aparecen en information_schema; hoy no hay ninguna
-- en public. Si se agrega una, esta funcion la ignora en silencio: sumarla
-- aca (pg_attribute sobre pg_matviews) en la misma migracion que la cree.
--
-- Permisos: iguales que la 0023. Solo service_role.

create or replace function public.schema_snapshot()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.table_name, t.cols), '{}'::jsonb)
  from (
    select c.table_name,
           jsonb_agg(c.column_name order by c.ordinal_position) as cols
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema
     and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and tb.table_type in ('BASE TABLE', 'VIEW')
    group by c.table_name
  ) t;
$$;

revoke all on function public.schema_snapshot() from public;
revoke all on function public.schema_snapshot() from anon;
revoke all on function public.schema_snapshot() from authenticated;
grant execute on function public.schema_snapshot() to service_role;
