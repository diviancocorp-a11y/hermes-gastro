-- 0085 — Avisos por Telegram (etapa 3 de la mini app).
--
-- QUE RESUELVE
-- El bot le avisa al dueno "pedido nuevo" (con botones Aceptar / Rechazar) y al
-- cliente "estamos preparando tu pedido" / "esta listo". Hay que saber a quien
-- escribirle y cuando.
--
-- A QUIEN: `telegram_chats`
-- Telegram solo deja escribirle a quien ya hablo con el bot, y entrega un
-- `chat_id`. Se guarda uno por (negocio, chat). `kind` distingue al dueno (que
-- recibe los pedidos nuevos) del cliente (que recibe el estado de su pedido).
-- El cliente se vincula por TELEFONO, porque el catalogo no exige cuenta: el
-- pedido trae `customer_phone` y de ahi sale el chat. `phone_tail` son los
-- ultimos 10 digitos, por la misma razon que la 20260708_phone_match_by_suffix:
-- el mismo numero llega como 549351..., 351... o 0351....
--
-- CUANDO: un trigger en `orders`
-- Un trigger cubre cualquier alta o cambio de estado venga de donde venga
-- (checkout, MercadoPago, panel, el propio bot) sin tocar submit-order ni
-- mp-webhook. Llama a la edge function `tg-notificar` por pg_net, que es
-- asincrono: no suma latencia al pedido.
--
-- EL TRIGGER NUNCA TUMBA UN PEDIDO
-- Todo el cuerpo va dentro de un bloque con EXCEPTION. Si Telegram, pg_net o
-- la firma fallan, se emite un WARNING y el pedido sigue. Un aviso perdido es
-- molesto; un pedido perdido es plata.
--
-- Y NO MOLESTA A LOS DEMAS NEGOCIOS
-- Si el negocio no tiene ningun chat de Telegram activo, el trigger sale antes
-- de llamar a nadie.
--
-- AUTENTICACION DE LA LLAMADA
-- `tg-notificar` es publica (verify_jwt=false, bug #6 de CLAUDE.md). La
-- protege una firma compartida en Vault: el trigger la manda en un header y la
-- function la compara con `tg_secreto_de_aviso()`, que solo ejecuta la service
-- role. Se genera una vez, aca, y no viaja por ningun chat ni archivo.

-- ─────────────────────────── Extension y tabla ──────────────────────────

create extension if not exists pg_net;

create table if not exists public.telegram_chats (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  chat_id           bigint not null,
  kind              text not null default 'customer'
                      check (kind in ('owner', 'customer')),
  telegram_user_id  bigint,
  first_name        text,
  username          text,
  phone             text,
  phone_tail        text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, chat_id)
);

create index if not exists telegram_chats_tenant_activos
  on public.telegram_chats (tenant_id) where active;
create index if not exists telegram_chats_phone
  on public.telegram_chats (tenant_id, phone_tail) where phone_tail is not null;

alter table public.telegram_chats enable row level security;

-- Los miembros del negocio ven sus chats (para mostrar quien esta vinculado).
-- Nadie escribe desde el front: solo las functions, con service role.
drop policy if exists telegram_chats_select on public.telegram_chats;
create policy telegram_chats_select on public.telegram_chats
  for select to authenticated
  using (tenant_id in (select private.current_user_tenants()));

revoke all on public.telegram_chats from anon, authenticated;
grant select on public.telegram_chats to authenticated;

comment on table public.telegram_chats is
  '0085: a quien le escribe el bot de Telegram de cada negocio. owner recibe pedidos nuevos; customer recibe el estado de su pedido (se vincula por telefono).';

-- ─────────────────────────── Firma en Vault ─────────────────────────────

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'tg_aviso') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'tg_aviso',
      'Firma de los avisos de Telegram: trigger de orders -> tg-notificar'
    );
  end if;
end $$;

create or replace function public.tg_secreto_de_aviso()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'tg_aviso' limit 1;
$$;

revoke all on function public.tg_secreto_de_aviso() from public, anon, authenticated;
grant execute on function public.tg_secreto_de_aviso() to service_role;

-- ─────────────────────────── El trigger ─────────────────────────────────
--
-- Eventos:
--   nuevo      el pedido entra en 'new' (alta directa, o paso de
--              pending_payment / pending_review a 'new' al pagarse o aprobarse)
--   preparando 'preparing'
--   listo      'active'
--   cancelado  'cancelled'  (le avisa al dueno: caso Ornela, 5/jul)
-- 'completed' no avisa: el cliente ya retiro o recibio, es ruido.

create or replace function public.tg_avisar_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
  v_secreto text;
begin
  begin
    if tg_op = 'INSERT' then
      if new.status = 'new' then v_evento := 'nuevo'; end if;
    elsif new.status is distinct from old.status then
      v_evento := case new.status
        when 'new'       then 'nuevo'
        when 'preparing' then 'preparando'
        when 'active'    then 'listo'
        when 'cancelled' then 'cancelado'
        else null
      end;
    end if;

    if v_evento is null then return new; end if;

    -- Negocio sin bot: no se llama a nadie.
    if not exists (
      select 1 from public.telegram_chats c
       where c.tenant_id = new.tenant_id and c.active
    ) then
      return new;
    end if;

    v_secreto := public.tg_secreto_de_aviso();
    if v_secreto is null then
      raise warning 'tg_avisar_pedido: falta el secreto tg_aviso en Vault';
      return new;
    end if;

    perform net.http_post(
      url     := 'https://wwwzdgprsooyjgkuyoav.supabase.co/functions/v1/tg-notificar',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-dico-aviso', v_secreto),
      body    := jsonb_build_object('order_id', new.id, 'evento', v_evento),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'tg_avisar_pedido (no bloquea el pedido): %', sqlerrm;
  end;
  return new;
end $$;

-- Una funcion de trigger no se llama por RPC: nadie necesita EXECUTE.
revoke all on function public.tg_avisar_pedido() from public, anon, authenticated;

drop trigger if exists trg_tg_avisar_pedido on public.orders;
create trigger trg_tg_avisar_pedido
  after insert or update of status on public.orders
  for each row execute function public.tg_avisar_pedido();
