-- 0120 Reserva el slug `consola`.
--
-- La consola de Divianco pasa a vivir en consola.divianco.app. Con el wildcard
-- *.divianco.app, `consola` era registrable como negocio: quien lo tomara se
-- quedaba con el subdominio de la consola. Se reserva en los dos lugares: aca
-- y en RESERVED_SUBDOMAINS (src/lib/tenantHost.js); reservedSlugsSync.test.js
-- compara ambas listas.
--
-- Solo agrega un valor al IN (...): ningun negocio existente se ve afectado
-- (verificado antes de aplicar: no hay ningun tenant con slug 'consola').
--
-- Aplicada via MCP el 3/nov/2026.

create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select lower(coalesce(p_slug, '')) in (
    -- Infra y protocolos
    'www', 'admin', 'api', 'app', 'cdn', 'static', 'assets', 'ftp',
    'localhost', 'dev', 'test', 'staging', 'preview', 'demo',
    -- Correo: el dominio de envio vive en un subdominio, y con el wildcard
    -- cualquiera de estos seria registrable como tenant.
    'mail', 'email', 'smtp', 'imap', 'pop', 'send', 'mailer', 'correo',
    'noreply', 'no-reply', 'bounces', 'feedback', 'notificaciones',
    -- Producto y marca
    'blog', 'docs', 'help', 'support', 'status',
    'dico', 'hermes', 'divianco', 'grupodivianco',
    -- Rutas de la plataforma
    'panel', 'dashboard', 'login', 'signup', 'register', 'registro',
    'bienvenido', 'account', 'billing', 'pay', 'checkout',
    -- La consola de Divianco
    'consola'
  );
$$;
revoke all on function public.is_reserved_slug(text) from public;
grant execute on function public.is_reserved_slug(text) to anon, authenticated, service_role;
