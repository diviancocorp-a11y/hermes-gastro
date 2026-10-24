-- 0111 — Agenda, fase 3: reserva online (datos de la clienta y retencion de la
-- sena).
-- Aplicada via MCP el 23/oct/2026 (schema_migrations: reserva_online). Probada antes
-- con platform/tests/agenda_reserva_online.sql (6/6) en una transaccion que
-- terminaba en error y la deshacia.
--
-- Plan: docs/plataforma/PLAN-AGENDA.md. Solo expandir: columnas nuevas con
-- default y una funcion + un cron nuevos. Nada existente cambia.
--
-- * public_token: el "link" que recibe la clienta para ver o cancelar su turno
--   sin cuenta. Es un uuid aleatorio e impredecible; NO es el id del turno.
--   El navegador nunca lee la tabla: todo pasa por la edge function `booking`
--   (service role), que valida el token.
-- * customer_email: opcional, para los recordatorios por correo (fase 3C).
-- * hold_until: mientras la sena no se paga, el hueco se retiene hasta aca. Si
--   vence, el turno se cancela solo y el horario vuelve a ofrecerse.
--   No se agrega un estado nuevo: la sena pendiente es `deposit_status =
--   'pending'` (columna que ya existia), asi no hay que tocar el CHECK de status.

alter table public.appointments
  add column if not exists public_token   uuid not null default gen_random_uuid(),
  add column if not exists customer_email text,
  add column if not exists hold_until     timestamptz;

create unique index if not exists appointments_public_token_uniq
  on public.appointments (public_token);

-- Para el barrido: solo las que estan reteniendo un hueco.
create index if not exists idx_appointments_hold
  on public.appointments (hold_until)
  where deposit_status = 'pending' and hold_until is not null;

-- Cancela los turnos cuya sena no se pago a tiempo. Devuelve cuantos.
-- Vive en `private`: lo llama pg_cron (superusuario), no el navegador.
create or replace function private.expire_deposit_holds()
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare n integer;
begin
  update public.appointments
     set status = 'cancelled'
   where status = 'booked'
     and deposit_status = 'pending'
     and hold_until is not null
     and hold_until < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.expire_deposit_holds() from public, anon, authenticated;

comment on function private.expire_deposit_holds is
  'Agenda fase 3: libera los huecos cuya sena no se pago antes de hold_until.';

create extension if not exists pg_cron;

select cron.unschedule('agenda-expirar-senas')
where exists (select 1 from cron.job where jobname = 'agenda-expirar-senas');

select cron.schedule(
  'agenda-expirar-senas',
  '*/5 * * * *',
  $$select private.expire_deposit_holds()$$
);
