-- 0078 function_snapshot() dice tambien quien puede ejecutar cada funcion.
--
-- ══════════════════ EL HUECO QUE TAPA ══════════════════
--
-- check-rls.mjs (0077) mira el RLS de las tablas, pero una funcion SECURITY
-- DEFINER lo saltea a proposito: corre con los permisos de su dueno. Si anon
-- o authenticated la pueden ejecutar, lo unico que separa un negocio de otro
-- es lo que la funcion valide adentro.
--
-- Hoy son 31 firmas y estan bien: las de admin validan pertenencia
-- (`current_user_tenants`, `tiene_rol`) y las otras son publicas a proposito
-- (catalogo, QR, propinas). Pero nada impide que la proxima nazca sin
-- validar, o que una reescritura se lleve el `if ... raise` de la primera
-- linea. Postgres le da EXECUTE a todo el mundo por defecto, asi que el error
-- facil es el abierto.
--
-- Con estos dos campos check-rls exige que cada una este en una lista
-- aprobada, y que las que "se cuidan solas" sigan teniendo la validacion.
--
-- ══════════════════ POR QUE AMPLIAR Y NO UNA FUNCION NUEVA ══════════════════
--
-- function_snapshot() ya es "las funciones de public"; los permisos son un
-- dato mas de cada una. Los campos nuevos no rompen a check-functions-drift,
-- que solo lee `name`, `args` y `body`.
--
-- El cuerpo es el de 0061 mas `anon_exec` y `auth_exec`. Las de trigger
-- siguen afuera: no se pueden llamar por PostgREST.

create or replace function public.function_snapshot()
returns jsonb
language sql
stable
set search_path = public, pg_catalog, pg_temp
as $$
  select coalesce(
    jsonb_object_agg(
      -- Clave: `nombre(args)`. Unica aun con overloads.
      p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      jsonb_build_object(
        'name', p.proname,
        'args', pg_get_function_identity_arguments(p.oid),
        -- prosrc es el cuerpo literal, sin el encabezado que Postgres reescribe.
        'body', p.prosrc,
        'secdef', p.prosecdef,
        -- Quien la puede llamar desde el front (PostgREST).
        'anon_exec', has_function_privilege('anon', p.oid, 'EXECUTE'),
        'auth_exec', has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
    ),
    '{}'::jsonb)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    -- Las de trigger no se comparan: no las llama el front y su cuerpo cambia
    -- por razones que no son drift de contrato.
    and p.prorettype <> 'trigger'::regtype;
$$;

-- `create or replace` conserva los permisos, pero se repite para que el
-- archivo diga solo la verdad entera.
revoke all on function public.function_snapshot() from public, anon, authenticated;

-- ══════════════════ COMO APLICARLA ══════════════════
--
-- Solo lectura. Revertir es volver a aplicar el cuerpo de 0061.
--
--   1. Aplicar por MCP sobre `wwwzdgprsooyjgkuyoav`.
--   2. npm run check:rls (con la service role) ahora juzga tambien las
--      funciones SECURITY DEFINER.
--   3. No toca columnas: `_migrations_through` sube a "0078" sin regenerar.
