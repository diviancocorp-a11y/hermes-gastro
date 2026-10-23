-- 0110 — Agenda: traslado por zona y servicios adicionales.
-- Aplicada via MCP el 23/oct/2026 (schema_migrations: agenda_zonas_y_adicionales),
-- con ok de Ricky. Probada antes con platform/tests/agenda_huecos.sql dentro de
-- una transaccion que terminaba en error. De paso marco Flores 3D de MiaEstudio
-- como adicional (dato del tenant, no parte del archivo).
--
-- Plan: docs/plataforma/PLAN-AGENDA.md. Decision de Ricky del 23/oct: el tiempo
-- de traslado depende de la direccion del cliente, y se resuelve POR ZONAS
-- (localidad o barrio con sus minutos); el calculo por distancia real queda
-- para despues. Flores 3D es un adicional: no se reserva solo y no necesita
-- duracion propia.
--
-- Solo expandir: tablas y columnas nuevas con default, y la misma funcion de
-- huecos con UN argumento nuevo con default (patron de la 0068: drop + create en
-- la misma migracion; la llamada vieja sigue andando).

alter table public.products
  add column if not exists is_addon boolean not null default false;

create table if not exists public.booking_zones (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  -- "Del Viso", "Champagne": como la nombra quien reserva.
  name       text not null check (length(btrim(name)) > 0),
  -- Minutos de viaje desde el local (o desde el turno anterior) hasta la zona.
  travel_min integer not null check (travel_min >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists booking_zones_nombre
  on public.booking_zones (tenant_id, lower(btrim(name))) where active;
create index if not exists idx_booking_zones_tenant on public.booking_zones(tenant_id);

alter table public.booking_zones enable row level security;
drop policy if exists booking_zones_select on public.booking_zones;
create policy booking_zones_select on public.booking_zones
  for select using (tenant_id in (select private.current_user_tenants()));
drop policy if exists booking_zones_write on public.booking_zones;
create policy booking_zones_write on public.booking_zones
  for all using (tenant_id in (select private.current_user_tenants()))
       with check (tenant_id in (select private.current_user_tenants()));

-- La zona del turno a domicilio (el traslado en si ya viaja en travel_min).
alter table public.appointments
  add column if not exists zone_id uuid references public.booking_zones(id) on delete set null;

-- Huecos libres con el traslado de la zona elegida. Sin p_travel_min usa el
-- fijo del negocio (booking_settings.travel_min), como hasta ahora.
drop function if exists public.get_available_slots(uuid, uuid, date, date, uuid, text);
create or replace function public.get_available_slots(
  p_tenant_id     uuid,
  p_service_id    uuid,
  p_from          date,
  p_to            date,
  p_staff_id      uuid default null,
  p_location_kind text default 'local',
  p_travel_min    integer default null
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
           coalesce(p_travel_min, bs.travel_min, 0) as travel,
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
revoke execute on function public.get_available_slots(uuid, uuid, date, date, uuid, text, integer)
  from public, anon;
grant execute on function public.get_available_slots(uuid, uuid, date, date, uuid, text, integer)
  to authenticated, service_role;

comment on function public.get_available_slots is
  'Agenda: horarios reservables de un servicio. p_travel_min (opcional) pisa el '
  'traslado fijo con el de la zona. Solo ofrece; el EXCLUDE de appointments es '
  'la garantia contra el doble turno.';
