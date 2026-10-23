-- 0109 — Agenda de servicios, fase 1: disponibilidad y huecos libres.
-- Aplicada via MCP el 23/oct/2026 (nombre en schema_migrations: agenda_disponibilidad).
-- Probada antes con platform/tests/agenda_huecos.sql (17/17), dentro de una
-- transaccion que terminaba en error y la deshacia.
--
-- Plan: docs/plataforma/PLAN-AGENDA.md. Es SOLO expandir: tablas y columnas
-- nuevas con default, una funcion nueva. Ninguna firma existente cambia, asi que
-- el deploy que hoy esta en produccion sigue andando contra esta base.
--
-- LO QUE YA ESTABA: staff, appointments con EXCLUDE por profesional y por
-- recurso (0005, 0045). Eso garantiza que no se pisen dos turnos. LO QUE FALTABA
-- era saber CUANDO se puede reservar: horario de cada profesional, ausencias,
-- que servicio hace cada una, margen entre turnos y domicilio.
--
-- DECISIONES
-- * Las reglas de reserva viven en una tabla propia (booking_settings) y no en
--   `settings`: asi no se toca el Zod de Settings (strip-mode) ni su manifest.
-- * La funcion de huecos solo OFRECE. La garantia contra el doble turno sigue
--   siendo el EXCLUDE: si dos clientas piden el mismo hueco, una rebota.
-- * El margen entre turnos y el traslado son blandos: los respeta esta funcion,
--   no el EXCLUDE (que solo ve [starts_at, ends_at)).
-- * Traslado: un solo viaje entre dos puntos. Se cuenta al llegar a un
--   domicilio y al volver al local desde uno; entre dos domicilios seguidos
--   cuenta una vez. No hay geocodificacion: el tiempo lo fija el negocio.

-- ───────────────────────── servicios y turnos ──────────────────────────

alter table public.products
  add column if not exists buffer_after_min integer not null default 0
    check (buffer_after_min >= 0);

alter table public.appointments
  add column if not exists location_kind text not null default 'local'
    check (location_kind in ('local', 'home')),
  add column if not exists address text,
  add column if not exists travel_min integer not null default 0
    check (travel_min >= 0);

-- ───────────────────── reglas de reserva por negocio ───────────────────

create table if not exists public.booking_settings (
  tenant_id         uuid primary key references public.tenants(id) on delete cascade,
  -- Con cuanta anticipacion minima se puede reservar y hasta cuando.
  min_notice_min    integer not null default 120 check (min_notice_min >= 0),
  max_advance_days  integer not null default 60 check (max_advance_days between 1 and 365),
  -- Paso de la grilla: cada cuantos minutos arranca un turno posible.
  slot_step_min     integer not null default 15 check (slot_step_min between 5 and 240),
  -- Hasta cuantas horas antes se puede cancelar sin perder la seña.
  cancel_window_hours integer not null default 24 check (cancel_window_hours >= 0),
  -- Modalidades que ofrece. Mia atiende en el local y a domicilio.
  offers_local      boolean not null default true,
  offers_home       boolean not null default false,
  -- Tiempo de traslado fijo para un domicilio.
  travel_min        integer not null default 0 check (travel_min >= 0),
  -- Seña: opcional por negocio, pensada desde el inicio (fase 3 la cobra).
  deposit_mode      text not null default 'none' check (deposit_mode in ('none', 'fixed', 'percent')),
  deposit_value     numeric(12,2) check (deposit_value is null or deposit_value >= 0),
  -- Minutos que se retiene el hueco esperando el pago de la seña.
  deposit_hold_min  integer not null default 30 check (deposit_hold_min > 0),
  updated_at        timestamptz not null default now(),
  constraint booking_deposit_coherente check (
    deposit_mode = 'none' or deposit_value is not null
  ),
  constraint booking_percent_valido check (
    deposit_mode <> 'percent' or deposit_value <= 100
  ),
  constraint booking_alguna_modalidad check (offers_local or offers_home)
);

-- ─────────────────────── horario, ausencias, servicios ─────────────────

create table if not exists public.staff_schedules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  -- 0 = domingo ... 6 = sabado (extract(dow)). Varios tramos por dia: partido.
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  created_at timestamptz not null default now(),
  constraint sched_tramo_valido check (end_time > start_time)
);
create index if not exists idx_staff_schedules_staff on public.staff_schedules(staff_id, weekday);
create index if not exists idx_staff_schedules_tenant on public.staff_schedules(tenant_id);

create table if not exists public.staff_time_off (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  -- Nulo = el negocio entero cierra (feriado, vacaciones del local).
  staff_id   uuid references public.staff(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint timeoff_valido check (ends_at > starts_at)
);
create index if not exists idx_staff_time_off_tenant on public.staff_time_off(tenant_id, starts_at);

create table if not exists public.staff_services (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  staff_id     uuid not null references public.staff(id) on delete cascade,
  service_id   uuid not null references public.products(id) on delete cascade,
  -- Duracion propia de esa profesional para ese servicio (si difiere).
  duration_min integer check (duration_min is null or duration_min > 0),
  primary key (staff_id, service_id)
);
create index if not exists idx_staff_services_tenant on public.staff_services(tenant_id);

-- ─────────────────────────────── RLS ───────────────────────────────────

do $$
declare tbl text;
begin
  foreach tbl in array array['booking_settings', 'staff_schedules', 'staff_time_off', 'staff_services'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I_select on public.%I', tbl, tbl);
    execute format('create policy %I_select on public.%I for select using (tenant_id in (select private.current_user_tenants()))', tbl, tbl);
    execute format('drop policy if exists %I_write on public.%I', tbl, tbl);
    execute format('create policy %I_write on public.%I for all using (tenant_id in (select private.current_user_tenants())) with check (tenant_id in (select private.current_user_tenants()))', tbl, tbl);
  end loop;
end $$;

-- ───────────────────────── huecos libres ───────────────────────────────

/**
 * Horarios en que se puede reservar un servicio.
 *
 * horario del profesional - turnos - ausencias - margen - traslado, con la
 * grilla, la anticipacion minima y la ventana maxima del negocio.
 *
 * - Sin p_staff_id devuelve una fila por profesional libre ("cualquiera"); la
 *   asignacion final la hace quien reserva y, si el EXCLUDE rebota, reintenta.
 * - Si ningun profesional tiene el servicio asignado en staff_services, lo
 *   puede hacer cualquiera (el alta no exige configurar todo de entrada).
 * - Un servicio sin duration_min no tiene huecos: no se inventan duraciones.
 * - Un no_show sigue ocupando el hueco, igual que en el EXCLUDE de staff
 *   (appt_no_overlap solo excluye 'cancelled'): ofrecerlo seria ofrecer algo
 *   que la base va a rechazar.
 *
 * Invoker: el panel pasa por RLS. El service_role (edge function de la reserva
 * publica, fase 3) pasa por la guarda de abajo.
 */
create or replace function public.get_available_slots(
  p_tenant_id     uuid,
  p_service_id    uuid,
  p_from          date,
  p_to            date,
  p_staff_id      uuid default null,
  p_location_kind text default 'local'
)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
set search_path = public, private, pg_temp
as $$
begin
  if p_location_kind not in ('local', 'home') then return; end if;
  if p_from is null or p_to is null or p_to < p_from then return; end if;
  if p_to - p_from > 62 then
    raise exception 'rango_demasiado_largo: maximo 62 dias';
  end if;

  if not (
    p_tenant_id in (select private.current_user_tenants())
    or coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') = 'service_role'
  ) then
    return;
  end if;

  return query
  with cfg as (
    select t.timezone as tz,
           coalesce(bs.min_notice_min, 120)   as min_notice,
           coalesce(bs.max_advance_days, 60)  as max_adv,
           coalesce(bs.slot_step_min, 15)     as step,
           coalesce(bs.travel_min, 0)         as travel,
           coalesce(bs.offers_local, true)    as offers_local,
           coalesce(bs.offers_home, false)    as offers_home
      from public.tenants t
      left join public.booking_settings bs on bs.tenant_id = t.id
     where t.id = p_tenant_id
  ),
  svc as (
    select p.id, p.duration_min, coalesce(p.buffer_after_min, 0) as buf
      from public.products p
     where p.id = p_service_id and p.tenant_id = p_tenant_id
       and p.type = 'service' and p.duration_min > 0
  ),
  cands as (
    select s.id as sid, coalesce(ss.duration_min, svc.duration_min) as dur
      from public.staff s
     cross join svc
      left join public.staff_services ss
        on ss.staff_id = s.id and ss.service_id = svc.id
     where s.tenant_id = p_tenant_id and s.active
       and (p_staff_id is null or s.id = p_staff_id)
       and (ss.staff_id is not null
            or not exists (select 1 from public.staff_services x
                            where x.service_id = svc.id and x.tenant_id = p_tenant_id))
  ),
  days as (
    select d::date as d from generate_series(p_from, p_to, interval '1 day') d
  ),
  wins as (
    select c.sid, c.dur,
           ((d.d + sc.start_time) at time zone cfg.tz) as w_start,
           ((d.d + sc.end_time)   at time zone cfg.tz) as w_end
      from cands c
     cross join cfg
     cross join days d
      join public.staff_schedules sc
        on sc.staff_id = c.sid and sc.weekday = extract(dow from d.d)::int
  ),
  slots as (
    select w.sid, g as s, g + make_interval(mins => w.dur) as e
      from wins w
     cross join cfg
     cross join lateral generate_series(
       w.w_start,
       w.w_end - make_interval(mins => w.dur),
       make_interval(mins => cfg.step)) g
  )
  select sl.sid, sl.s, sl.e
    from slots sl
   cross join cfg
   cross join svc
   where sl.s >= now() + make_interval(mins => cfg.min_notice)
     and sl.s <= now() + make_interval(days => cfg.max_adv)
     and ((p_location_kind = 'local' and cfg.offers_local)
          or (p_location_kind = 'home' and cfg.offers_home))
     and not exists (
       select 1 from public.staff_time_off o
        where o.tenant_id = p_tenant_id
          and (o.staff_id is null or o.staff_id = sl.sid)
          and tstzrange(o.starts_at, o.ends_at) && tstzrange(sl.s, sl.e))
     and not exists (
       select 1
         from public.appointments a
         left join public.products ap on ap.id = a.service_id
        where a.staff_id = sl.sid
          and a.status <> 'cancelled'
          and tstzrange(
                a.starts_at - make_interval(mins => case when a.location_kind = 'home' then a.travel_min else 0 end),
                a.ends_at
                  + make_interval(mins => coalesce(ap.buffer_after_min, 0))
                  + make_interval(mins => case when a.location_kind = 'home' and p_location_kind = 'local' then a.travel_min else 0 end))
              &&
              tstzrange(
                sl.s - make_interval(mins => case when p_location_kind = 'home' then cfg.travel else 0 end),
                sl.e
                  + make_interval(mins => svc.buf)
                  + make_interval(mins => case when p_location_kind = 'home' and a.location_kind = 'local' then cfg.travel else 0 end)))
   order by sl.s, sl.sid;
end;
$$;

revoke execute on function public.get_available_slots(uuid, uuid, date, date, uuid, text)
  from public, anon;
grant execute on function public.get_available_slots(uuid, uuid, date, date, uuid, text)
  to authenticated, service_role;

comment on function public.get_available_slots is
  'Agenda fase 1: horarios reservables de un servicio. Solo ofrece; el EXCLUDE '
  'de appointments es la garantia contra el doble turno.';
