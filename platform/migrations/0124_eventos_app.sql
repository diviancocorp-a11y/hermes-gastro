-- 0124 Eventos de uso del panel, guardados en el edificio.
-- Aplicada via MCP el 2026-11-05
--
-- Ricky, 5/nov/2026: GerenteDico tiene que avisar novedades de la analitica.
-- trackEvent (src/lib/observability.js) manda a Plausible solo con
-- VITE_ANALYTICS_ID, que produccion no tiene, y Vercel Web Analytics no esta
-- activo: los eventos de los bloqueos de plan no llegaban a ningun lado. Se
-- eligio una tabla del edificio porque GerenteDico y morning-health ya leen
-- la base, sin dependencia nueva ni plan pago.
--
-- Solo aditiva. Sin funcion definer: escribe el propio miembro del negocio y
-- la policy lo ata a su negocio y a su usuario. Lee solo el staff de Divianco
-- (y la service role de GerenteDico y morning-health).
--
-- Los nombres no son un check de la base a proposito: sumar uno seria un
-- drop/add constraint. La lista vive en src/services/eventosApp.js.

create table if not exists public.eventos_app (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid default auth.uid(),
  nombre text not null check (nombre ~ '^[a-z0-9-]{3,40}$'),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 1024),
  created_at timestamptz not null default now()
);

comment on table public.eventos_app is
  'Eventos de uso del panel (ej: plan-bloqueo-visto). Los escribe el miembro del negocio; '
  'los leen GerenteDico y morning-health. Ver src/services/eventosApp.js.';

create index if not exists eventos_app_created_at_idx on public.eventos_app (created_at);
create index if not exists eventos_app_tenant_created_idx on public.eventos_app (tenant_id, created_at);

alter table public.eventos_app enable row level security;

drop policy if exists eventos_app_insert on public.eventos_app;
create policy eventos_app_insert on public.eventos_app
  for insert to authenticated
  with check (
    tenant_id in (select private.current_user_tenants())
    and user_id = (select auth.uid())
  );

drop policy if exists eventos_app_select_staff on public.eventos_app;
create policy eventos_app_select_staff on public.eventos_app
  for select using (private.es_staff_divianco());
