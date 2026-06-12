-- 20260612_info_pages_admin_policies.sql
-- Aplicada via MCP en los 3 tenants el 12/jun/2026.
--
-- CONTEXTO: info_pages se creo a mano en los dashboards (nunca estuvo en el
-- repo), por eso el endurecimiento del Sprint 1 no la alcanzo y quedo con
-- UNA sola policy: lectura publica de paginas visibles. Sin policy de
-- escritura, el editor del admin "guardaba" 0 filas SIN error (RLS silencioso)
-- y las paginas ocultas no aparecian en la lista del editor.
--
-- Este archivo tambien versiona la tabla completa (idempotente) para que
-- el bootstrap de tenants nuevos la incluya.

create table if not exists public.info_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  blocks jsonb not null default '[]'::jsonb,
  requires_age_gate boolean not null default false,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.info_pages enable row level security;

-- Lectura publica: solo paginas visibles (la usa /info/:slug del catalogo)
drop policy if exists info_pages_public_read on public.info_pages;
create policy info_pages_public_read on public.info_pages
  for select to anon, authenticated using (visible = true);

-- Admin: lee TODO (incluye ocultas) y escribe
drop policy if exists info_pages_admin_read on public.info_pages;
create policy info_pages_admin_read on public.info_pages
  for select to authenticated using (public.is_admin());
drop policy if exists info_pages_admin_insert on public.info_pages;
create policy info_pages_admin_insert on public.info_pages
  for insert to authenticated with check (public.is_admin());
drop policy if exists info_pages_admin_update on public.info_pages;
create policy info_pages_admin_update on public.info_pages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists info_pages_admin_delete on public.info_pages;
create policy info_pages_admin_delete on public.info_pages
  for delete to authenticated using (public.is_admin());
