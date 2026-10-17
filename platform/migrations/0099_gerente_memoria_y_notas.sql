-- 0099 GerenteDico recuerda la charla y anota issues (etapa 3).
-- Aplicada via MCP el 17/oct/2026.
--
-- Dos tablas que solo toca la edge function gerente-webhook, con la service
-- role. SIN tenant_id A PROPOSITO: son la charla de Ricky (el dueno de
-- Divianco) con el bot, no datos de un negocio. Mismo patron que
-- payment_integrations (0051): RLS activa, ninguna policy y sin grants para
-- anon/authenticated. check-rls exige RLS en toda tabla de public; la regla de
-- policy acotada es solo para tablas con tenant_id.
--
-- gerente_mensajes: lo que dijo Ricky y lo que contesto el bot. La function
-- manda como historia los ultimos 10 de las ultimas 12 horas y borra lo de
-- mas de 30 dias en cada escritura. No se guardan los resultados de las
-- herramientas: se vuelven a consultar.
--
-- gerente_notas: los issues que propone la herramienta `anotar`. Nacen
-- `pendiente` y solo se crean en GitHub cuando Ricky contesta SI. El paso a
-- `creando` es un update condicionado, asi un SI repetido no crea dos.

create table if not exists public.gerente_mensajes (
  id bigint generated always as identity primary key,
  chat_id text not null,
  rol text not null check (rol in ('user', 'assistant')),
  texto text not null check (char_length(texto) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_gerente_mensajes_chat
  on public.gerente_mensajes(chat_id, created_at desc);

alter table public.gerente_mensajes enable row level security;
-- SIN POLICIES A PROPOSITO. Ver la cabecera.
revoke all on table public.gerente_mensajes from public, anon, authenticated;

comment on table public.gerente_mensajes is
  'Memoria de la charla de Ricky con GerenteDico (Telegram). Tabla de plataforma, '
  'sin tenant_id. RLS sin policies: solo la service role, desde gerente-webhook.';

create table if not exists public.gerente_notas (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  titulo text not null check (char_length(titulo) between 1 and 80),
  cuerpo text not null check (char_length(cuerpo) <= 6000),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'creando', 'creada', 'descartada', 'fallo')),
  issue_number integer,
  issue_url text,
  created_at timestamptz not null default now(),
  resuelta_at timestamptz
);

-- Una sola nota esperando el SI por chat: el SI siempre se refiere a la ultima
-- que se mostro.
create unique index if not exists gerente_notas_una_pendiente
  on public.gerente_notas(chat_id) where estado = 'pendiente';

alter table public.gerente_notas enable row level security;
-- SIN POLICIES A PROPOSITO. Ver la cabecera.
revoke all on table public.gerente_notas from public, anon, authenticated;

comment on table public.gerente_notas is
  'Issues que GerenteDico propone anotar en GitHub. Se crean solo con el SI de '
  'Ricky. Tabla de plataforma, sin tenant_id. RLS sin policies: solo la service role.';
