-- 0076 - Los secretos no viajan en claro, y lo que se revoca queda revocado.
--
-- Sale de una auditoria de seguridad contra una lista de 20 puntos. Casi todo
-- estaba cubierto; esto es lo que no.
--
-- 1. EL PERFIL PROPIO NO ELIGE NEGOCIO
-- `profiles_update` y `profiles_insert` dejan escribir la fila propia, y el
-- rol `authenticated` tenia UPDATE/INSERT sobre TODAS las columnas. Un
-- comprador cualquiera podia ponerse `tenant_id` de otro negocio y aparecer en
-- su lista de clientes (profiles_select muestra por tenant_id), o cambiarse
-- `email` y quedar distinto de auth.users. No daba acceso —el acceso sale de
-- tenant_members, no de profiles— pero es manipulacion de un campo que el
-- front no manda nunca: la app escribe name, phone y nickname, nada mas.
-- Las funciones que SI escriben tenant_id y email (signup_tenant,
-- attach_owner, provision_owner) son definer y no dependen de estos grants.
--
-- 2. `revoke ... from anon` NO ALCANZA
-- La 0075 y otras hacian `revoke all on function X from anon`. Postgres le da
-- EXECUTE a PUBLIC al crear una funcion, y anon lo hereda de ahi: el revoke no
-- sacaba nada. Las RPC internas igual se protegen por dentro (no_sos_miembro),
-- asi que no habia fuga; lo que habia era una intencion escrita que la base no
-- cumplia. Se revoca de PUBLIC y se deja el grant explicito a authenticated.
-- Las funciones de trigger no se llaman por RPC: nadie necesita EXECUTE sobre
-- ellas (el permiso se mira al crear el trigger, no al dispararlo).
--
-- 3. LOS SECRETOS DE MERCADOPAGO VAN A VAULT
-- `payment_integrations.access_token` y `webhook_secret` se guardaban en texto
-- plano. La tabla no tiene policies y solo la toca la service role, pero un
-- backup, un dump o un `select *` con la clave equivocada los mostraba. Ahora
-- un trigger los mueve a Vault (cifrado con una clave que no vive en la base)
-- antes de que la fila exista, y deja solo el id del secreto. Un CHECK impide
-- que vuelva a quedar uno en claro. Se lee con `mp_credenciales()`, que solo
-- puede ejecutar la service role.
-- Al aplicar esto la tabla tiene CERO filas: no hay nada que migrar.
-- `mp-connect` no cambia —sigue insertando el token y el trigger se lo lleva—;
-- cambian las que lo leen: mp-preference, mp-webhook y mp-status.
--
-- 4. search_path fijo en cuatro funciones que el linter marcaba.

-- ── 1. El perfil propio no elige negocio ────────────────────────────────

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, full_name, phone, nickname, updated_at)
  on public.profiles to authenticated;
-- `id` va tambien en UPDATE porque el upsert de PostgREST lo incluye en el
-- SET del ON CONFLICT. La policy sigue exigiendo id = auth.uid().
grant update (id, name, full_name, phone, nickname, updated_at)
  on public.profiles to authenticated;

-- ── 2. Lo que se revoca queda revocado ─────────────────────────────────

do $$
declare
  f record;
begin
  -- RPC de trabajo: todas validan membresia por dentro. Solo con sesion.
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'bajar_pedido_a_cocina', 'cerrar_ticket_de_cocina',
         'comandas_abiertas', 'comandas_por_imprimir', 'complete_order',
         'consumo_diario_de_insumos', 'count_push_subscriptions',
         'crear_sectores_tipicos', 'guardar_conteo_de_deposito',
         'marcar_comanda_impresa', 'marcar_plato', 'mover_stock_de_insumo')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;

  -- Funciones de trigger definer: nadie las llama por /rpc.
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ── 3. Los secretos de MercadoPago van a Vault ─────────────────────────

alter table public.payment_integrations
  add column if not exists access_token_vault_id uuid,
  add column if not exists webhook_secret_vault_id uuid;

alter table public.payment_integrations
  alter column access_token drop not null;

comment on column public.payment_integrations.access_token is
  'Solo de entrada: el trigger lo mueve a Vault y lo deja en null. Ver 0076.';
comment on column public.payment_integrations.webhook_secret is
  'Solo de entrada: el trigger lo mueve a Vault y lo deja en null. Ver 0076.';

create or replace function private.mp_secretos_a_vault()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Desconectar borra los secretos: una integracion inactiva no cobra, y un
  -- token que no se usa es solo algo mas que se puede filtrar.
  if tg_op = 'UPDATE' and old.is_active and not new.is_active then
    delete from vault.secrets
     where id in (old.access_token_vault_id, old.webhook_secret_vault_id);
    new.access_token_vault_id := null;
    new.webhook_secret_vault_id := null;
  end if;

  if nullif(btrim(coalesce(new.access_token, '')), '') is not null then
    if new.access_token_vault_id is null then
      new.access_token_vault_id := vault.create_secret(
        btrim(new.access_token),
        'mp_access_token:' || new.id::text,
        'MercadoPago access token de payment_integrations');
    else
      perform vault.update_secret(new.access_token_vault_id, btrim(new.access_token));
    end if;
  end if;

  if nullif(btrim(coalesce(new.webhook_secret, '')), '') is not null then
    if new.webhook_secret_vault_id is null then
      new.webhook_secret_vault_id := vault.create_secret(
        btrim(new.webhook_secret),
        'mp_webhook_secret:' || new.id::text,
        'Secreto de firma del webhook de MercadoPago');
    else
      perform vault.update_secret(new.webhook_secret_vault_id, btrim(new.webhook_secret));
    end if;
  end if;

  new.access_token := null;
  new.webhook_secret := null;
  return new;
end $$;

create or replace function private.mp_secretos_fuera_de_vault()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets
   where id in (old.access_token_vault_id, old.webhook_secret_vault_id);
  return old;
end $$;

revoke all on function private.mp_secretos_a_vault() from public, anon, authenticated;
revoke all on function private.mp_secretos_fuera_de_vault() from public, anon, authenticated;

drop trigger if exists payment_integrations_secretos on public.payment_integrations;
create trigger payment_integrations_secretos
  before insert or update on public.payment_integrations
  for each row execute function private.mp_secretos_a_vault();

drop trigger if exists payment_integrations_secretos_borrar on public.payment_integrations;
create trigger payment_integrations_secretos_borrar
  after delete on public.payment_integrations
  for each row execute function private.mp_secretos_fuera_de_vault();

-- Nunca en claro, y activa implica que hay con que cobrar.
alter table public.payment_integrations
  drop constraint if exists payment_integrations_sin_secretos_en_claro;
alter table public.payment_integrations
  add constraint payment_integrations_sin_secretos_en_claro
  check (access_token is null and webhook_secret is null);

alter table public.payment_integrations
  drop constraint if exists payment_integrations_activa_tiene_token;
alter table public.payment_integrations
  add constraint payment_integrations_activa_tiene_token
  check (not is_active or access_token_vault_id is not null);

-- La unica forma de leerlos. Solo service role: las edge functions.
create or replace function public.mp_credenciales(p_tenant_id uuid)
returns table (
  integration_id uuid,
  access_token text,
  webhook_secret text,
  live_mode boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id,
         (select s.decrypted_secret from vault.decrypted_secrets s
           where s.id = i.access_token_vault_id),
         (select s.decrypted_secret from vault.decrypted_secrets s
           where s.id = i.webhook_secret_vault_id),
         i.live_mode
    from public.payment_integrations i
   where i.tenant_id = p_tenant_id
     and i.provider = 'mercadopago'
     and i.is_active
   limit 1
$$;

revoke all on function public.mp_credenciales(uuid) from public, anon, authenticated;
grant execute on function public.mp_credenciales(uuid) to service_role;

-- ── 4. search_path fijo ────────────────────────────────────────────────

alter function public.tocar_settings_updated_at() set search_path = public, pg_temp;
alter function public.libro_es_de_solo_agregar() set search_path = public, pg_temp;
alter function public.documento_tiene_dorso(text, text) set search_path = public, pg_temp;
alter function public.cobro_completo(public.staff_legajo) set search_path = public, pg_temp;
