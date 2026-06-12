-- 20260612_version_dynamic_qrs_y_push_subscriptions.sql
-- NO aplica cambios en los tenants existentes (las tablas ya existen
-- identicas): versiona en el repo dos tablas que se crearon a mano en los
-- dashboards y nunca pasaron por migracion. Detectadas en la auditoria
-- del 12/jun (la misma que destapo el bug de info_pages sin policies).
-- Necesario para que el onboarding de un tenant nuevo las incluya.

-- ── QRs dinamicos (slug impreso → target_url editable) ──
create table if not exists public.dynamic_qrs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  target_url text not null,
  visits integer not null default 0,
  last_visited_at timestamptz,
  is_active boolean not null default true,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.dynamic_qrs enable row level security;
drop policy if exists qrs_public_read on public.dynamic_qrs;
create policy qrs_public_read on public.dynamic_qrs
  for select to anon, authenticated using (is_active = true);
drop policy if exists qrs_admin_write on public.dynamic_qrs;
create policy qrs_admin_write on public.dynamic_qrs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Suscripciones push (VAPID) ──
-- SIN policies a proposito: el acceso es solo via RPCs SECURITY DEFINER
-- por endpoint (upsert/delete/count_push_subscription[s], Sprint 1) y
-- service role desde la edge function send-push.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  phone text,
  role text not null default 'customer',
  endpoint text not null unique,
  keys_p256dh text not null,
  keys_auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
